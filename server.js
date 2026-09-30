const express = require('express');
const rateLimit = require('express-rate-limit');
const PQueue = require('p-queue').default;
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const { Lexer } = require('./engine/lexer');
const { Parser } = require('./engine/parser');
const { Compiler } = require('./engine/compiler');

const app = express();
const PORT = process.env.PORT || 3000;

const TEMP_DIR = path.join(os.tmpdir(), 'mawww-obs');
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname));

const limiter = rateLimit({ windowMs: 60000, max: 30 });
app.use('/api/', limiter);

const queue = new PQueue({ concurrency: 2 });

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), queue: { pending: queue.pending, size: queue.size } });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ---------- VM pipeline ----------
function xorBytes(buf, key) {
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ ((key + i * 3) & 0xFF);
  return out;
}

function bytesToLuaString(buf) {
  // Emit as \ddd escapes for safety
  let s = '';
  for (const b of buf) s += '\\' + b;
  return '"' + s + '"';
}

function luaNum(n) {
  if (n === null) return 'nil';
  if (typeof n === 'boolean') return n ? 'true' : 'false';
  if (typeof n === 'number') {
    if (Number.isInteger(n)) return String(n);
    return String(n);
  }
  return 'nil';
}

function luaStr(s) {
  return JSON.stringify(s);
}

function serializeProto(proto, key) {
  const Klines = proto.K.map(k => {
    if (typeof k === 'string') {
      const enc = xorBytes(Buffer.from(k, 'utf8'), key);
      return bytesToLuaString(enc);
    }
    return luaNum(k);
  }).join(', ');

  const instLines = proto.insts.map(i => `{${i.join(',')}}`).join(',');

  return `{
    K = {${Klines}},
    insts = {${instLines}},
    numParams = ${proto.numParams},
    isVararg = ${proto.isVararg ? 'true' : 'false'},
    upvals = {}
  }`;
}

function buildLuaOutput(compiled, key) {
  const protosLua = compiled.protos.map(p => serializeProto(p, key));
  const vmRuntime = fs.readFileSync(path.join(__dirname, 'engine', 'vm.lua'), 'utf8');

  const guard = `
do
    local _rawget, _pcall, _type = rawget, pcall, type
    if _type(_rawget) ~= "function" or _type(_pcall) ~= "function" then return end
    if islclosure and loadstring and islclosure(loadstring) then return end
    local bad = {"ScriptDumper","ConstantDumper","BytecodeDumper","LuauDumper","SimpleSpy","DarkDex","Hydroxide","TurtleSpy"}
    local env = (getgenv and getgenv()) or _G
    for i = 1, #bad do if env[bad[i]] ~= nil then return end end
    if debug and debug.getinfo then
        for lvl = 2, 12 do
            local ok, info = _pcall(debug.getinfo, lvl)
            if not ok or not info then break end
            local s = tostring(info.source or ""):lower()
            if s:find("dump") or s:find("deobf") or s:find("decompile") then return end
        end
    end
end
`;

  return `${guard}
-- Mawww VM Bytecode (Build Key: ${key.toString(16)})
local __KEY = ${key}
local function __xor_str(s, k)
    local out = {}
    for i = 1, #s do
        out[i] = string.char((string.byte(s, i) ~ ((k + (i-1) * 3) % 256)) % 256)
    end
    return table.concat(out)
end
local __PROTOS = {${protosLua.join(',')}}
-- Decrypt string constants
for _, p in ipairs(__PROTOS) do
    for i = 1, #p.K do
        local v = p.K[i]
        if type(v) == "string" and v:byte(1) ~= 34 then
            -- already decrypted? skip
        end
    end
end
local function __decrypt_k(p)
    for i = 1, #p.K do
        if type(p.K[i]) == "string" then
            p.K[i] = __xor_str(p.K[i], __KEY)
        end
    end
end
for _, p in ipairs(__PROTOS) do __decrypt_k(p) end
-- link sub-protos into main proto
for i = 1, #__PROTOS do
    __PROTOS[i].P = __PROTOS
end

${vmRuntime}

local __env = (getgenv and getgenv()) or _G
local __run = runVM
__run(__PROTOS[1], {}, __env, {...})
`;
}

// ---------- Obfuscation endpoint ----------
app.post('/api/obfuscate', async (req, res) => {
  const { code, preset } = req.body || {};
  if (typeof code !== 'string' || !code.trim()) return res.status(400).json({ error: 'No code provided.' });
  if (Buffer.byteLength(code, 'utf8') > MAX_INPUT_BYTES) return res.status(413).json({ error: 'Input too large.' });

  try {
    const result = await queue.add(() => {
      const tokens = new Lexer(code).tokenize();
      const ast = new Parser(tokens).parse();
      const compiler = new Compiler();
      const compiled = compiler.compile(ast);
      const key = crypto.randomBytes(4).readUInt32BE(0) & 0xFF;
      return buildLuaOutput(compiled, key);
    });

    res.json({ success: true, output: result, buildId: uuidv4() });
  } catch (err) {
    console.error('[obfuscate]', err.message);
    res.status(500).json({ error: err.message || 'Obfuscation failed.' });
  }
});

app.listen(PORT, () => console.log(`[mawww] listening on ${PORT}`));
