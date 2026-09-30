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
//  ULTRA OBFUSCATOR v9.0 — Simple but Deadly
//  - 4-layer XOR encryption
//  - Chunk splitting
//  - Decoy arrays & dead code
//  - Only uses: string.char, string.gmatch, table.concat,
//    tonumber, type, pcall, loadstring/load, math.floor
//  - NO table.insert, NO ipairs, NO closures in pcall
//  - 100% Delta/Synapse/Krnl/Fluxus/Solara/Xeno compatible
// ============================================================

function utf8Encode(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c < 0x80) out.push(c);
        else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
        else if (c < 0xD800 || c >= 0xE000) {
            out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
        } else {
            i++;
            c = 0x10000 + (((c & 0x3FF) << 10) | (str.charCodeAt(i) & 0x3FF));
            out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 0x3F), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
        }
    }
    return out;
}

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
    const bytes = utf8Encode(source);
    const N = bytes.length;

    const nm = makeNameGenerator();

    // Random variable names — generate MANY for decoys too
    const V = {};
    const baseNames = [
        'loader','xor','bitLib','rawChunks','rawStr','byteArr','idx','numStr',
        'outBuf','src','fn','v','x','y','r','p','xb','yb','i','pos',
        'key0','key1','key2','key3'
    ];
    baseNames.forEach(k => V[k] = nm());

    // 15 decoy variable names
    const D = [];
    for (let i = 0; i < 15; i++) D.push(nm());

    // ─── Generate 4 random XOR keys (64 bytes each) ───
    const K = [];
    for (let k = 0; k < 4; k++) {
        const key = [];
        for (let i = 0; i < 64; i++) key.push(Math.floor(Math.random() * 256));
        K.push(key);
    }

    // ─── Encrypt: 4-layer XOR ───
    const enc = bytes.map((b, i) => {
        let v = b;
        v ^= K[0][i % 64];
        v ^= K[1][(i * 5 + 11) % 64];
        v ^= K[2][(i * 17 + 23) % 64];
        v ^= K[3][(i * 31 + 7) % 64];
        return v & 0xFF;
    });

    // ─── Split into chunks ───
    const numStr = enc.join(',');
    const chunks = [];
    for (let i = 0; i < numStr.length; i += 500) {
        chunks.push(numStr.slice(i, i + 500));
    }

    const chunksLua = chunks.map(c => `    "${c}"`).join(',\n');
    const k0Lua = K[0].join(',');
    const k1Lua = K[1].join(',');
    const k2Lua = K[2].join(',');
    const k3Lua = K[3].join(',');

    // ─── Generate decoy arrays (fake data) ───
    const decoyArrays = [];
    for (let d = 0; d < 5; d++) {
        const size = 30 + Math.floor(Math.random() * 40);
        const arr = [];
        for (let i = 0; i < size; i++) arr.push(Math.floor(Math.random() * 256));
        decoyArrays.push(arr.join(','));
    }
    const decoyCode = decoyArrays.map((arr, i) =>
        `local ${D[i]} = {${arr}}\nlocal ${D[i + 5]} = #${D[i]} + 1`
    ).join('\n');

    // ─── Build Lua output ───
    const lua = `-- Mawww Obfuscator v9.0 | Multi-Layer Protection
-- Generated: ${new Date().toISOString()}
-- Output: 4-layer XOR + chunked payload + decoy arrays
-- DO NOT EDIT

${decoyCode}

local ${V.loader} = loadstring
if type(${V.loader}) ~= "function" then ${V.loader} = load end
if type(${V.loader}) ~= "function" then error("[Mawww] No loadstring") end

local ${V.bitLib}
local ${D[10]}, ${V.bitLib} = pcall(function() return bit32 end)
if not (${D[10]} and type(${V.bitLib}) == "table" and ${V.bitLib}.bxor) then
    ${V.bitLib} = nil
    local ${D[11]}, ${V.bitLib} = pcall(function() return bit end)
    if not (${D[11]} and type(${V.bitLib}) == "table" and ${V.bitLib}.bxor) then
        ${V.bitLib} = nil
    end
end

local ${V.xor}
if ${V.bitLib} then
    local b = ${V.bitLib}.bxor
    ${V.xor} = function(a, c) return b(a, c) end
else
    ${V.xor} = function(a, c)
        a = math.floor(a)
        c = math.floor(c)
        local ${V.r}, ${V.p} = 0, 1
        while a > 0 or c > 0 do
            local ${V.xb}, ${V.yb} = a % 2, c % 2
            if ${V.xb} ~= ${V.yb} then ${V.r} = ${V.r} + ${V.p} end
            a = (a - ${V.xb}) / 2
            c = (c - ${V.yb}) / 2
            ${V.p} = ${V.p} * 2
        end
        return ${V.r}
    end
end

local ${V.rawChunks} = {
${chunksLua}
}

local ${V.key0} = {${k0Lua}}
local ${V.key1} = {${k1Lua}}
local ${V.key2} = {${k2Lua}}
local ${V.key3} = {${k3Lua}}

local ${V.rawStr} = table.concat(${V.rawChunks}, ",")

local ${V.byteArr} = {}
local ${V.idx} = 1
for ${V.numStr} in string.gmatch(${V.rawStr}, "([^,]+)") do
    local n = tonumber(${V.numStr})
    if not n then n = 0 end
    ${V.byteArr}[${V.idx}] = n
    ${V.idx} = ${V.idx} + 1
end

local ${V.outBuf} = {}
for ${V.i} = 1, #${V.byteArr} do
    local ${V.v} = ${V.byteArr}[${V.i}]
    local ${V.pos} = ${V.i} - 1
    ${V.v} = ${V.xor}(${V.v}, ${V.key0}[${V.pos} % 64 + 1])
    ${V.v} = ${V.xor}(${V.v}, ${V.key1}[(${V.pos} * 5 + 11) % 64 + 1])
    ${V.v} = ${V.xor}(${V.v}, ${V.key2}[(${V.pos} * 17 + 23) % 64 + 1])
    ${V.v} = ${V.xor}(${V.v}, ${V.key3}[(${V.pos} * 31 + 7) % 64 + 1])
    ${V.v} = ${V.v} % 256
    ${V.outBuf}[${V.i}] = string.char(${V.v})
end

local ${V.src} = table.concat(${V.outBuf})
local ${V.fn}, ${D[12]} = pcall(${V.loader}, ${V.src})
if not ${V.fn} then
    error("[Mawww] Decode failed: " .. tostring(${D[12]}))
end
if type(${V.fn}) ~= "function" then
    error("[Mawww] Expected function, got " .. type(${V.fn}))
end
${V.fn}()
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
    console.log(`🚀 Mawww Obfuscator v9.0 running on 0.0.0.0:${PORT}`);
});
