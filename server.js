const express = require('express');
const rateLimit = require('express-rate-limit');
const PQueue = require('p-queue').default;
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const { Lexer } = require('./engine/lexer');
const { Parser } = require('./engine/parser');
const { Compiler } = require('./engine/compiler');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- CONFIG ----------
const TEMP_DIR = path.join(os.tmpdir(), 'mawww-obs');
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ---------- MIDDLEWARE ----------
app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname));

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, slow down.' }
});
app.use('/api/', limiter);

// ---------- QUEUE ----------
const queue = new PQueue({ concurrency: 2 });

// ---------- HEALTH ----------
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        queue: { pending: queue.pending, size: queue.size }
    });
});

// ---------- ROOT ----------
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ---------- HELPERS: XOR ----------
function xorBytes(buf, key) {
    const out = Buffer.alloc(buf.length);
    for (let i = 0; i < buf.length; i++) {
        out[i] = buf[i] ^ ((key + i * 3) & 0xFF);
    }
    return out;
}

function bytesToLuaString(buf) {
    let s = '';
    for (const b of buf) s += '\\' + b;
    return '"' + s + '"';
}

function luaNum(n) {
    if (n === null || n === undefined) return 'nil';
    if (typeof n === 'boolean') return n ? 'true' : 'false';
    if (typeof n === 'number') return String(n);
    return 'nil';
}

// ---------- VM SERIALIZER ----------
function serializeProto(proto, key) {
    const Klines = proto.K.map(k => {
        if (typeof k === 'string') {
            const enc = xorBytes(Buffer.from(k, 'utf8'), key);
            return bytesToLuaString(enc);
        }
        return luaNum(k);
    }).join(', ');

    const instLines = proto.insts.map(i => `{${i.join(',')}}`).join(',');

    // Serialize upvals: [{parentReg: 0}, ...] → {{parentReg = 0}, ...}
    const upvalsLua = (proto.upvals || [])
        .map(u => `{parentReg = ${u.parentReg}}`)
        .join(', ');

    return `{
        K = {${Klines}},
        insts = {${instLines}},
        numParams = ${proto.numParams},
        isVararg = ${proto.isVararg ? 'true' : 'false'},
        upvals = {${upvalsLua}}
    }`;
}

// ---------- BUILD FINAL LUA OUTPUT ----------
function buildLuaOutput(compiled, key) {
    const protosLua = compiled.protos.map(p => serializeProto(p, key));

    // Baca vm.lua lalu STRIP `return runVM` supaya tidak menghentikan chunk
    let vmRuntime = fs.readFileSync(path.join(__dirname, 'engine', 'vm.lua'), 'utf8');
    vmRuntime = vmRuntime.replace(/^\s*return\s+runVM\s*;?\s*$/m, '');

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
        out[i] = string.char((string.byte(s, i) ~ ((k + (i - 1) * 3) % 256)) % 256)
    end
    return table.concat(out)
end
local __PROTOS = {${protosLua.join(',')}}
local function __decrypt_k(p)
    for i = 1, #p.K do
        if type(p.K[i]) == "string" then
            p.K[i] = __xor_str(p.K[i], __KEY)
        end
    end
end
for _, p in ipairs(__PROTOS) do __decrypt_k(p) end
for i = 1, #__PROTOS do __PROTOS[i].P = __PROTOS end

${vmRuntime}

local __env = (getgenv and getgenv()) or _G
local __run = runVM
__run(__PROTOS[1], {}, __env, {...})
`;
}

// ---------- API: FETCH RAW URL ----------
app.post('/api/fetch-raw', async (req, res) => {
    const { url } = req.body || {};
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
        return res.status(400).json({ error: 'Invalid URL.' });
    }

    // SSRF Protection
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (
            host === 'localhost' ||
            host === '127.0.0.1' ||
            host === '0.0.0.0' ||
            host === '::1' ||
            /^10\./.test(host) ||
            /^192\.168\./.test(host) ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
            /^169\.254\./.test(host)
        ) {
            return res.status(400).json({ error: 'URL tidak diizinkan.' });
        }
    } catch (_) {
        return res.status(400).json({ error: 'URL tidak valid.' });
    }

    const fetchOnce = (targetUrl, redirectCount = 0) => new Promise((resolve, reject) => {
        if (redirectCount > 3) {
            reject(new Error('Too many redirects'));
            return;
        }
        const client = targetUrl.startsWith('https') ? https : http;
        const reqFetch = client.get(targetUrl, {
            timeout: FETCH_TIMEOUT_MS,
            headers: { 'User-Agent': 'Mawww-Obfuscator/1.0' }
        }, (r) => {
            if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
                const next = new URL(r.headers.location, targetUrl).toString();
                fetchOnce(next, redirectCount + 1).then(resolve).catch(reject);
                return;
            }
            if (r.statusCode !== 200) {
                reject(new Error('HTTP ' + r.statusCode));
                return;
            }
            let d = '';
            let size = 0;
            r.on('data', c => {
                size += c.length;
                if (size > MAX_INPUT_BYTES) {
                    reqFetch.destroy();
                    reject(new Error('File terlalu besar'));
                    return;
                }
                d += c;
            });
            r.on('end', () => resolve(d));
        });
        reqFetch.on('error', reject);
        reqFetch.on('timeout', () => {
            reqFetch.destroy();
            reject(new Error('Timeout'));
        });
    });

    try {
        const code = await fetchOnce(url);
        if (Buffer.byteLength(code, 'utf8') > MAX_INPUT_BYTES) {
            return res.status(413).json({ error: 'File terlalu besar.' });
        }
        res.json({ success: true, code });
    } catch (err) {
        console.error('[fetch-raw]', err.message);
        res.status(500).json({ error: 'Gagal fetch: ' + err.message });
    }
});

// ---------- API: OBFUSCATE ----------
app.post('/api/obfuscate', async (req, res) => {
    const { code, preset } = req.body || {};
    if (typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ error: 'No code provided.' });
    }
    if (Buffer.byteLength(code, 'utf8') > MAX_INPUT_BYTES) {
        return res.status(413).json({ error: 'Input too large (max 15MB).' });
    }

    const allowedPresets = ['Weak', 'Medium', 'Strong', 'Minify'];
    const chosen = allowedPresets.includes(preset) ? preset : 'Strong';

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

// ---------- API: STATUS ----------
app.get('/api/status', (req, res) => {
    res.json({
        pending: queue.pending,
        size: queue.size,
        concurrency: queue.concurrency
    });
});

// ---------- START ----------
app.listen(PORT, () => {
    console.log(`[mawww] listening on ${PORT}`);
});
