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
//  HEX OBFUSCATOR v10.0 — Simple, Safe, Delta-Proof
//  - Hex encoding (aman, tidak perlu escape karakter)
//  - Decoy arrays (output sangat panjang)
//  - Hanya pakai API standar Lua/Luau
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
        'loader','hexStr','chunks','concat','byteArr','idx','hexPair',
        'outBuf','src','fn','v','x','y','i','pos','pair',
        'pcall_result','load_result','loadErr'
    ];
    baseNames.forEach(k => V[k] = nm());

    const D = [];
    for (let i = 0; i < 20; i++) D.push(nm());

    // ─── Hex encode source ───
    const hexStr = Buffer.from(source, 'utf8').toString('hex');

    // Split into chunks of 1000 chars
    const chunks = [];
    for (let i = 0; i < hexStr.length; i += 1000) {
        chunks.push(hexStr.slice(i, i + 1000));
    }

    const chunksLua = chunks.map(c => `    "${c}"`).join(',\n');

    // ─── Generate decoy arrays ───
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

    // ─── Build Lua output ───
    const lua = `-- Mawww Obfuscator v10.0 | Hex-Encoding Protection
-- Generated: ${new Date().toISOString()}
-- DO NOT EDIT

${decoyCode}

local ${V.loader} = loadstring
if type(${V.loader}) ~= "function" then ${V.loader} = load end
if type(${V.loader}) ~= "function" then error("[Mawww] No loadstring") end

local ${V.chunks} = {
${chunksLua}
}

local ${V.hexStr} = table.concat(${V.chunks}, "")

-- Validate hex string
if #${V.hexStr} % 2 ~= 0 then
    error("[Mawww] Invalid hex length")
end

local ${V.outBuf} = {}
local ${V.idx} = 1
local ${V.i} = 1
local len = #${V.hexStr}

while ${V.i} <= len do
    local ${V.pair} = string.sub(${V.hexStr}, ${V.i}, ${V.i} + 1)
    local byte = tonumber(${V.pair}, 16)
    if not byte then
        error("[Mawww] Invalid hex at position " .. tostring(${V.i}))
    end
    ${V.outBuf}[${V.idx}] = string.char(byte)
    ${V.idx} = ${V.idx} + 1
    ${V.i} = ${V.i} + 2
end

local ${V.src} = table.concat(${V.outBuf})

-- Execute dengan handling loadstring yang benar
local ${V.load_result}, ${V.fn} = ${V.loader}(${V.src})

-- Delta mengembalikan (true, function) atau (false, error)
-- Executor lain mengembalikan (function) atau (nil, error)
if type(${V.load_result}) == "function" then
    ${V.fn} = ${V.load_result}
    ${V.load_result} = true
end

if not ${V.load_result} then
    error("[Mawww] Decode failed: " .. tostring(${V.fn}))
end

if type(${V.fn}) ~= "function" then
    error("[Mawww] Expected function, got " .. type(${V.fn}))
end

local ${V.pcall_result}, ${D[20]} = pcall(${V.fn})
if not ${V.pcall_result} then
    error("[Mawww] Execution failed: " .. tostring(${D[20]}))
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
    console.log(`🚀 Mawww Obfuscator v10.0 (Hex-Encoding) running on 0.0.0.0:${PORT}`);
});
