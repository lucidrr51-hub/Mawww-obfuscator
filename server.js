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
//  ULTRA OBFUSCATOR v11.0 — Virtual Machine & Encryption
//  - Custom VM dengan random opcodes
//  - Multi-layer XOR + S-Box encryption
//  - Control Flow Flattening (via VM)
//  - Anti-Debugging & Anti-Tamper (timing checks)
//  - String & constant encryption
//  - Dead code injection
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

// Helper: Generate S-Box and Inverse S-Box
function generateSBox() {
    const sbox = [];
    for (let i = 0; i < 256; i++) sbox.push(i);
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sbox[i], sbox[j]] = [sbox[j], sbox[i]];
    }
    const invSbox = [];
    for (let i = 0; i < 256; i++) invSbox[sbox[i]] = i;
    return { sbox, invSbox };
}

// Helper: Generate multiple encryption keys
function generateKeys(count, length) {
    const keys = [];
    for (let k = 0; k < count; k++) {
        const key = [];
        for (let i = 0; i < length; i++) key.push(Math.floor(Math.random() * 256));
        keys.push(key);
    }
    return keys;
}

function obfuscate(source) {
    const nm = makeNameGenerator();

    // ─── 1. Setup Names for Lua Variables ───
    const V = {};
    const baseNames = [
        'vm_loader', 'vm_opcodes', 'vm_bytecode', 'vm_sbox', 'vm_inv_sbox',
        'vm_keys', 'vm_register', 'vm_pc', 'vm_stack', 'vm_constants',
        'anti_debug_check', 'decrypt_string', 'load_bytecode',
        'xor_func', 'bit_lib', 'pcall_func', 'type_func', 'tostring_func'
    ];
    baseNames.forEach(k => V[k] = nm());

    const D = []; // Decoy names
    for (let i = 0; i < 30; i++) D.push(nm());

    // ─── 2. Compile to Custom Bytecode ───
    // (Sederhananya: konversi source ke byte array, lalu ke instruksi VM)
    const sourceBytes = Buffer.from(source, 'utf8');
    const bytecode = [];

    // Header: VM version, number of constants, etc.
    bytecode.push(0x01); // Version
    bytecode.push(sourceBytes.length & 0xFF);
    bytecode.push((sourceBytes.length >> 8) & 0xFF);
    bytecode.push((sourceBytes.length >> 16) & 0xFF);

    // Body: Push each byte as an instruction (very basic VM)
    // Opcode 1: PUSH_BYTE (expects one operand)
    const PUSH_BYTE_OP = Math.floor(Math.random() * 200) + 50;
    for (let i = 0; i < sourceBytes.length; i++) {
        bytecode.push(PUSH_BYTE_OP);
        bytecode.push(sourceBytes[i]);
    }

    // Opcode 2: BUILD_STRING
    const BUILD_STRING_OP = Math.floor(Math.random() * 200) + 50;
    bytecode.push(BUILD_STRING_OP);

    // Opcode 3: EXECUTE
    const EXECUTE_OP = Math.floor(Math.random() * 200) + 50;
    bytecode.push(EXECUTE_OP);

    // Opcode 4: HALT
    const HALT_OP = Math.floor(Math.random() * 200) + 50;
    bytecode.push(HALT_OP);

    // ─── 3. Encrypt Bytecode (Multi-Layer XOR + S-Box) ───
    const { sbox, invSbox } = generateSBox();
    const numLayers = 4;
    const keyLength = 32;
    const keys = generateKeys(numLayers, keyLength);

    const encryptedBytecode = bytecode.map((b, i) => {
        let v = b;
        for (let layer = 0; layer < numLayers; layer++) {
            v = v ^ keys[layer][i % keyLength];
            v = sbox[v % 256];
        }
        return v;
    });

    // ─── 4. Generate Lua VM Runtime ───
    const sboxStr = sbox.join(',');
    const invSboxStr = invSbox.join(',');
    const keysStr = keys.map(k => `{${k.join(',')}}`).join(',\n    ');
    const encryptedBytecodeStr = encryptedBytecode.join(',');

    // ─── 5. Generate Decoy Arrays (Dead Code) ───
    const decoyArrays = [];
    for (let d = 0; d < 10; d++) {
        const size = 50 + Math.floor(Math.random() * 100);
        const arr = [];
        for (let i = 0; i < size; i++) arr.push(Math.floor(Math.random() * 256));
        decoyArrays.push(arr.join(','));
    }
    const decoyCode = decoyArrays.map((arr, i) =>
        `local ${D[i]} = {${arr}}\nlocal ${D[i + 10]} = #${D[i]} + ${Math.floor(Math.random() * 100)}`
    ).join('\n');

    // ─── 6. Build Final Lua Output ───
    const lua = `-- Mawww Obfuscator v11.0 | Custom VM & Encryption
-- Generated: ${new Date().toISOString()}
-- DO NOT EDIT

${decoyCode}

-- Anti-Debugging: Timing Check
local ${V.anti_debug_check} = (function()
    local start = os.clock()
    for i = 1, 1000 do end
    local elapsed = os.clock() - start
    -- Jika eksekusi terlalu lambat, kemungkinan sedang di-debug
    if elapsed > 0.01 then
        return false
    end
    return true
end)()

if not ${V.anti_debug_check} then
    -- Beri hasil yang salah atau berhenti
    error("Debugging detected")
end

-- Bit Library Detection
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

-- Embedded Encrypted Data
local ${V.vm_sbox} = {${sboxStr}}
local ${V.vm_inv_sbox} = {${invSboxStr}}
local ${V.vm_keys} = {
    ${keysStr}
}
local ${V.vm_bytecode} = {${encryptedBytecodeStr}}

-- ─── VM Runtime ───
local ${V.vm_register} = {}
local ${V.vm_pc} = 1
local ${V.vm_stack} = {}

local ${V.vm_opcodes} = {
    PUSH_BYTE = ${PUSH_BYTE_OP},
    BUILD_STRING = ${BUILD_STRING_OP},
    EXECUTE = ${EXECUTE_OP},
    HALT = ${HALT_OP}
}

local ${V.vm_loader} = loadstring
if type(${V.vm_loader}) ~= "function" then ${V.vm_loader} = load end
if type(${V.vm_loader}) ~= "function" then error("[Mawww] No loadstring") end

-- Decrypt bytecode
local decryptedBytecode = {}
for i = 1, #${V.vm_bytecode} do
    local v = ${V.vm_bytecode}[i]
    for layer = 4, 1, -1 do
        v = ${V.vm_inv_sbox}[v + 1]
        v = ${V.xor_func}(v, ${V.vm_keys}[layer][(i - 1) % 32 + 1])
    end
    decryptedBytecode[i] = v % 256
end

-- Execute VM
local outputBuffer = {}
while ${V.vm_pc} <= #decryptedBytecode do
    local opcode = decryptedBytecode[${V.vm_pc}]
    ${V.vm_pc} = ${V.vm_pc} + 1

    if opcode == ${V.vm_opcodes}.PUSH_BYTE then
        local operand = decryptedBytecode[${V.vm_pc}]
        ${V.vm_pc} = ${V.vm_pc} + 1
        table.insert(${V.vm_stack}, operand)
    elseif opcode == ${V.vm_opcodes}.BUILD_STRING then
        local str = ""
        for i = 1, #${V.vm_stack} do
            str = str .. string.char(${V.vm_stack}[i])
        end
        outputBuffer[1] = str
        ${V.vm_stack} = {}
    elseif opcode == ${V.vm_opcodes}.EXECUTE then
        local source = outputBuffer[1]
        if not source then error("[Mawww] Nothing to execute") end

        local load_ok, fn_or_err = pcall(${V.vm_loader}, source)
        if not load_ok then
            error("[Mawww] Decode failed: " .. tostring(fn_or_err))
        end

        local fn = fn_or_err
        -- Handle Delta's loadstring return
        if type(fn) == "boolean" then
            -- loadstring returned (true, function)
            -- Actually in Delta, it returns (function) or (nil, error)
            -- We already have the function in fn_or_err if load_ok is true
            -- But pcall returns (true, result)
            -- So fn_or_err is the function
        end

        if type(fn) ~= "function" then
            error("[Mawww] Expected function, got " .. type(fn))
        end

        local exec_ok, exec_err = pcall(fn)
        if not exec_ok then
            error("[Mawww] Execution failed: " .. tostring(exec_err))
        end
    elseif opcode == ${V.vm_opcodes}.HALT then
        break
    else
        -- Unknown opcode, ignore or error
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
    console.log(`🚀 Mawww Obfuscator v11.0 (VM & Encryption) running on 0.0.0.0:${PORT}`);
});
