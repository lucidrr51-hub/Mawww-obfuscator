const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Storage =====
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'scripts.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}');

function loadDB() {
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch { return {}; }
}
function saveDB(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ===== Middleware =====
app.use(express.json({ limit: '20mb' }));

app.use(express.static(path.join(__dirname), {
    index: 'index.html',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
        else if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        else if (filePath.endsWith('.html')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
}));

// ============================================================
//  ULTRA OBFUSCATOR v14.0 — Stable Custom VM
//  - Custom VM dengan random opcodes (unik per obfuscate)
//  - Enkripsi bytecode: XOR reversibel + verifikasi ketat
//  - Decoy arrays & dead code
//  - Anti-debug timing check (aman untuk Delta)
//  - Magic Byte untuk verifikasi dekripsi di VM
// ============================================================

function makeNameGenerator() {
    const used = new Set();
    return function name() {
        const cs = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let s;
        do {
            s = '_';
            for (let i = 0; i < 12; i++) s += cs[Math.floor(Math.random() * cs.length)];
        } while (used.has(s));
        used.add(s);
        return s;
    };
}

function obfuscate(source) {
    const nm = makeNameGenerator();

    const V = {};
    const baseNames = [
        'vm_loader', 'vm_opcodes', 'vm_bytecode', 'vm_key', 'vm_pc',
        'vm_stack', 'vm_output', 'anti_debug', 'xor_func', 'bit_lib',
        'loadstr', 'pcall_fn', 'type_fn', 'tostring_fn', 'char_fn',
        'concat_fn', 'os_clock', 'floor_fn', 'magic_byte', 'decrypted'
    ];
    baseNames.forEach(k => V[k] = nm());

    const D = [];
    for (let i = 0; i < 25; i++) D.push(nm());

    const sourceBytes = Buffer.from(source, 'utf8');

    // ─── Buat opcode acak (unik) ───
    const usedOps = new Set();
    const newOp = () => {
        let o;
        do { o = Math.floor(Math.random() * 180) + 60; } while (usedOps.has(o));
        usedOps.add(o);
        return o;
    };

    const OP_PUSH_BYTE = newOp();
    const OP_BUILD_STRING = newOp();
    const OP_EXECUTE = newOp();
    const OP_HALT = newOp();

    // ─── Bangun bytecode mentah ───
    const rawBytecode = [];

    // Magic byte (untuk verifikasi)
    const MAGIC = 0xAA;
    rawBytecode.push(MAGIC);

    // Header: panjang source (3 byte little-endian)
    rawBytecode.push(sourceBytes.length & 0xFF);
    rawBytecode.push((sourceBytes.length >> 8) & 0xFF);
    rawBytecode.push((sourceBytes.length >> 16) & 0xFF);

    // Body: PUSH_BYTE untuk setiap byte
    for (let i = 0; i < sourceBytes.length; i++) {
        rawBytecode.push(OP_PUSH_BYTE);
        rawBytecode.push(sourceBytes[i]);
    }

    rawBytecode.push(OP_BUILD_STRING);
    rawBytecode.push(OP_EXECUTE);
    rawBytecode.push(OP_HALT);

    // ─── Enkripsi bytecode (XOR satu lapis, 100% reversibel) ───
    const KEY_LEN = 64;
    const key = [];
    for (let i = 0; i < KEY_LEN; i++) key.push(Math.floor(Math.random() * 256));

    const encryptedBytecode = rawBytecode.map((b, i) => {
        return (b ^ key[i % KEY_LEN]) & 0xFF;
    });

    // Verifikasi ganda
    for (let i = 0; i < rawBytecode.length; i++) {
        const decrypted = (encryptedBytecode[i] ^ key[i % KEY_LEN]) & 0xFF;
        if (decrypted !== rawBytecode[i]) {
            throw new Error(`Encryption verification failed at index ${i}`);
        }
    }

    // ─── Decoy arrays ───
    const decoyArrays = [];
    for (let d = 0; d < 8; d++) {
        const size = 40 + Math.floor(Math.random() * 60);
        const arr = [];
        for (let i = 0; i < size; i++) arr.push(Math.floor(Math.random() * 256));
        decoyArrays.push(arr.join(','));
    }
    const decoyCode = decoyArrays.map((arr, i) =>
        `local ${D[i]} = {${arr}}\nlocal ${D[i + 8]} = #${D[i]} + ${Math.floor(Math.random() * 100)}`
    ).join('\n');

    const keyStr = key.join(',');
    const bytecodeStr = encryptedBytecode.join(',');

    const lua = `-- Mawww Obfuscator v14.0 | Stable Custom VM
-- Generated: ${new Date().toISOString()}
-- DO NOT EDIT

${decoyCode}

-- Anti-Debug: timing check (aman untuk Delta)
local ${V.anti_debug} = (function()
    local t0 = os.clock()
    for i = 1, 500 do local x = i * 2 end
    local t1 = os.clock() - t0
    return t1 < 0.05
end)()

if not ${V.anti_debug} then
    error("Debugging detected")
end

-- Bit library detection
local ${V.bit_lib}
local ok, lib = pcall(function() return bit32 end)
if ok and type(lib) == "table" and lib.bxor then
    ${V.bit_lib} = lib
else
    ok, lib = pcall(function() return bit end)
    if ok and type(lib) == "table" and lib.bxor then
        ${V.bit_lib} = lib
    end
end

local ${V.xor_func}
if ${V.bit_lib} then
    local b = ${V.bit_lib}.bxor
    ${V.xor_func} = function(a, c) return b(a, c) end
else
    ${V.xor_func} = function(a, c)
        a = math.floor(a)
        c = math.floor(c)
        local r, p = 0, 1
        while a > 0 or c > 0 do
            local xb, yb = a % 2, c % 2
            if xb ~= yb then r = r + p end
            a = (a - xb) / 2
            c = (c - yb) / 2
            p = p * 2
        end
        return r
    end
end

local ${V.vm_bytecode} = {${bytecodeStr}}
local ${V.vm_key} = {${keyStr}}

local ${V.loadstr} = loadstring
if type(${V.loadstr}) ~= "function" then ${V.loadstr} = load end
if type(${V.loadstr}) ~= "function" then error("[Mawww] No loadstring") end

local ${V.decrypted} = {}
for i = 1, #${V.vm_bytecode} do
    local v = ${V.xor_func}(${V.vm_bytecode}[i], ${V.vm_key}[(i - 1) % 64 + 1])
    ${V.decrypted}[i] = v % 256
    if ${V.decrypted}[i] < 0 then ${V.decrypted}[i] = ${V.decrypted}[i] + 256 end
end

-- Verifikasi magic byte
if ${V.decrypted}[1] ~= 170 then
    error("[Mawww] Magic byte mismatch: " .. tostring(${V.decrypted}[1]))
end

local ${V.vm_pc} = 2 -- Lewati magic byte
local ${V.vm_stack} = {}
local ${V.vm_output} = nil

local OP_PUSH_BYTE = ${OP_PUSH_BYTE}
local OP_BUILD_STRING = ${OP_BUILD_STRING}
local OP_EXECUTE = ${OP_EXECUTE}
local OP_HALT = ${OP_HALT}

while ${V.vm_pc} <= #${V.decrypted} do
    local opcode = ${V.decrypted}[${V.vm_pc}]
    ${V.vm_pc} = ${V.vm_pc} + 1

    if opcode == OP_PUSH_BYTE then
        local operand = ${V.decrypted}[${V.vm_pc}]
        ${V.vm_pc} = ${V.vm_pc} + 1
        ${V.vm_stack}[#${V.vm_stack} + 1] = operand

    elseif opcode == OP_BUILD_STRING then
        local str = ""
        for i = 1, #${V.vm_stack} do
            str = str .. string.char(${V.vm_stack}[i])
        end
        ${V.vm_output} = str
        ${V.vm_stack} = {}

    elseif opcode == OP_EXECUTE then
        local src = ${V.vm_output}
        if not src or #src == 0 then
            error("[Mawww] Nothing to execute")
        end

        local load_ok, load_res = pcall(${V.loadstr}, src)
        if not load_ok then
            error("[Mawww] Decode failed: " .. tostring(load_res))
        end

        local fn = load_res
        if type(fn) == "boolean" then
            local direct_ok, direct_fn = ${V.loadstr}(src)
            if direct_ok and type(direct_fn) == "function" then
                fn = direct_fn
            elseif type(direct_ok) == "function" then
                fn = direct_ok
            else
                error("[Mawww] loadstring returned " .. type(direct_ok))
            end
        end

        if type(fn) ~= "function" then
            error("[Mawww] Expected function, got " .. type(fn))
        end

        local exec_ok, exec_err = pcall(fn)
        if not exec_ok then
            error("[Mawww] Execution failed: " .. tostring(exec_err))
        end

    elseif opcode == OP_HALT then
        break

    else
        error("[Mawww] Unknown VM opcode: " .. tostring(opcode))
    end
end
`;

    return lua;
}

// ===== Healthcheck =====
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== API: Obfuscate =====
app.post('/api/obfuscate', (req, res) => {
    try {
        const { code } = req.body || {};
        if (!code || typeof code !== 'string' || !code.trim()) {
            return res.status(400).send('No code provided');
        }
        const result = obfuscate(code);
        res.type('text/plain').send(result);
    } catch (err) {
        res.status(500).send(`Obfuscation error: ${err.message}`);
    }
});

// ===== API: Publish =====
app.post('/api/publish', (req, res) => {
    const { code } = req.body || {};
    if (!code || typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ error: 'No code provided' });
    }

    const random = crypto.randomBytes(6).toString('hex');
    const id = `${Date.now().toString(36)}${random}`;

    const db = loadDB();
    db[id] = {
        code,
        createdAt: new Date().toISOString(),
        size: Buffer.byteLength(code, 'utf8')
    };
    saveDB(db);

    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const rawUrl = `${proto}://${host}/raw/${id}.lua`;

    res.json({ id, url: rawUrl, size: db[id].size });
});

// ===== Raw endpoint =====
app.get('/raw/:id', (req, res) => {
    const id = req.params.id.replace(/\.lua$/i, '');
    const db = loadDB();
    const entry = db[id];

    if (!entry) {
        res.status(404).type('text/plain').send('-- Script not found or expired.');
        return;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(entry.code);
});

// ===== Stats =====
app.get('/api/stats', (req, res) => {
    const db = loadDB();
    res.json({ total: Object.keys(db).length });
});

// ===== SPA fallback =====
app.get('*', (req, res) => {
    if (path.extname(req.path)) {
        return res.status(404).send('Not found');
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== Listen =====
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Mawww Obfuscator v14.0 (Stable VM) running on 0.0.0.0:${PORT}`);
});
