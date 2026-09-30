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

// Static files dengan MIME type eksplisit
app.use(express.static(path.join(__dirname), {
    index: 'index.html',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
        } else if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        } else if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
    }
}));

// ============================================================
//  MEGA VM WRAPPER — Layer 2 & 3
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

function makePRNG(seed) {
    let s = seed >>> 0;
    return {
        next() {
            s = (s ^ (s << 13)) >>> 0;
            s = (s ^ (s >>> 17)) >>> 0;
            s = (s ^ (s << 5)) >>> 0;
            return s;
        },
        byte() { return this.next() & 0xFF; },
        range(n) { return this.next() % n; }
    };
}

function makeSBox(prng) {
    const s = new Array(256);
    for (let i = 0; i < 256; i++) s[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = prng.range(i + 1);
        const t = s[i]; s[i] = s[j]; s[j] = t;
    }
    return s;
}
function makeInvSBox(sbox) {
    const inv = new Array(256);
    for (let i = 0; i < 256; i++) inv[sbox[i]] = i;
    return inv;
}

function makeNamer(prng) {
    const cs = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const used = new Set();
    return function name(minLen, maxLen) {
        minLen = minLen || 10;
        maxLen = maxLen || 16;
        let s;
        do {
            const len = minLen + prng.range(maxLen - minLen + 1);
            s = '_';
            for (let i = 0; i < len; i++) s += cs[prng.range(cs.length)];
        } while (used.has(s));
        used.add(s);
        return s;
    };
}

function megaVmWrap(source) {
    const bytes = utf8Encode(source);
    const N = bytes.length;

    const masterSeed = (Math.random() * 0xFFFFFFFF) >>> 0;
    const prng = makePRNG(masterSeed);
    for (let i = 0; i < 1000; i++) prng.next();
    const sbox = makeSBox(prng);
    const invSbox = makeInvSBox(sbox);

    const usedOps = new Set();
    const newOp = () => {
        let o;
        do { o = prng.range(190) + 60; } while (usedOps.has(o));
        usedOps.add(o);
        return o;
    };
    const OPS = {
        PUSH: newOp(), PUSH2: newOp(), PUSH3: newOp(),
        NOP: newOp(), NOP2: newOp(), NOP3: newOp(), NOP4: newOp(),
        MOV: newOp(), MOV2: newOp(),
        LOAD: newOp(), LOAD2: newOp(),
        ADD: newOp(), XOR: newOp(), XOR2: newOp(),
        CHECK: newOp(), CHECK2: newOp(),
        BUILD: newOp(), EXEC: newOp(),
        JMP: newOp(), HALT: newOp()
    };

    const ins = [];
    for (let i = 0; i < N; i++) {
        const key1 = prng.range(256);
        const key2 = prng.range(256);
        const enc1 = bytes[i] ^ key1;
        const enc2 = sbox[bytes[i]] ^ key2;

        ins.push([OPS.NOP, prng.range(256), prng.range(256), prng.range(256)]);
        ins.push([OPS.NOP2, prng.range(256), 0, 0]);
        ins.push([OPS.MOV, prng.range(32), prng.range(256), 0]);
        ins.push([OPS.NOP3, 0, 0, 0]);
        ins.push([OPS.PUSH, enc1, key1, i & 0xFFFF]);
        ins.push([OPS.LOAD, prng.range(32), prng.range(256), 0]);
        ins.push([OPS.NOP4, prng.range(256), 0, 0]);

        if (i % 2 === 0) ins.push([OPS.PUSH2, enc2, key2, i & 0xFFFF]);
        if (i % 3 === 0) ins.push([OPS.CHECK, prng.range(256), prng.range(256), 0]);
        if (i % 4 === 0) ins.push([OPS.MOV2, prng.range(32), prng.range(256), 0]);
        if (i % 2 === 0) ins.push([OPS.NOP, prng.range(256), 0, 0]);
        if (i % 3 === 0) ins.push([OPS.LOAD2, prng.range(32), prng.range(256), 0]);
        if (i % 5 === 0) ins.push([OPS.NOP2, prng.range(256), prng.range(256), 0]);
    }

    ins.push([OPS.CHECK2, 0, 0, 0]);
    ins.push([OPS.BUILD, 0, 0, 0]);
    ins.push([OPS.EXEC, 0, 0, 0]);
    ins.push([OPS.HALT, 0, 0, 0]);

    let checksum = 0;
    for (let i = 0; i < N; i++) {
        checksum = (checksum + bytes[i] * ((i % 127) + 1) + (i % 251)) % 2147483647;
    }

    const nm = makeNamer(prng);
    const V = {};
    const varNames = [
        'concat','char','byte','gmatch','tonumber','pcall','type','error','tostring',
        'floor','loadstr','bit','r','s','buf','idx','acc','lim','code','op','h','dispatch',
        'prev','seg','key','val','rot','tmp','n','i','j','k','a','b','c','d','e','f','g',
        'sbox','isbox','chk','expect','result','out','src','fn','ok','err','ptr','stack',
        'regs','count','size','segLen','segIdx','push','pop','halt','_nop','_nop2','_nop3',
        'x1','x2','x3','x4','x5','x6','x7','x8','x9','x10','y1','y2','y3','y4','y5','z1','z2',
        'q1','q2','q3','q4','q5','q6','w1','w2','w3','w4','w5','v1','v2','v3','v4','v5',
        'masterSeed','sub','sub2','guard','safe','check','verify','seal','lock','key0'
    ];
    varNames.forEach(v => V[v] = nm(10, 16));

    const insStr = ins.map(row => `    {${row.join(',')}}`).join(',\n');

    const lua = `-- ═══════════════════════════════════════════════════════════
-- Mawww Ultra Obfuscator | Mega VM Protection v8.0
-- Layers: Mega VM + Random opcodes + Decoy instructions
-- ═══════════════════════════════════════════════════════════
-- Generated: ${new Date().toISOString()}
-- DO NOT EDIT — integrity will fail

local ${V.concat}=table.concat
local ${V.char}=string.char
local ${V.byte}=string.byte
local ${V.gmatch}=string.gmatch
local ${V.tonumber}=tonumber
local ${V.pcall}=pcall
local ${V.type}=type
local ${V.error}=error
local ${V.tostring}=tostring
local ${V.floor}=math.floor
local ${V.loadstr}=loadstring
if ${V.type}(${V.loadstr})~="function" then ${V.loadstr}=load end

-- Universal XOR
local ${V.bit}
do
    local ${V.ok},${V.err}=${V.pcall}(function() return bit32 end)
    if ${V.ok} and ${V.type}(${V.err})=="table" and ${V.err}.bxor then
        ${V.bit}=${V.err}
    else
        local ${V.ok},${V.err}=${V.pcall}(function() return bit end)
        if ${V.ok} and ${V.type}(${V.err})=="table" and ${V.err}.bxor then
            ${V.bit}=${V.err}
        end
    end
end

local ${V.x1}
if ${V.bit} then
    local ${V.B}=${V.bit}
    ${V.x1}=function(${V.a},${V.b}) return ${V.B}.bxor(${V.a},${V.b}) end
else
    ${V.x1}=function(${V.a},${V.b})
        ${V.a}=${V.floor}(${V.a})
        ${V.b}=${V.floor}(${V.b})
        local ${V.r},${V.s}=0,1
        while ${V.a}>0 or ${V.b}>0 do
            local ${V.c},${V.d}=${V.a}%2,${V.b}%2
            if ${V.c}~=${V.d} then ${V.r}=${V.r}+${V.s} end
            ${V.a}=(${V.a}-${V.c})/2
            ${V.b}=(${V.b}-${V.d})/2
            ${V.s}=${V.s}*2
        end
        return ${V.r}
    end
end

-- S-Box tables
local ${V.sbox}={${sbox.join(',')}}
local ${V.isbox}={${invSbox.join(',')}}

-- VM state
local ${V.regs}={}
local ${V.stack}={}
local ${V.ptr}=0
local ${V.buf}={}

-- Instruction handlers
local function ${V.push}(${V.a},${V.b},${V.c})
    ${V.ptr}=${V.ptr}+1
    local ${V.val}=${V.x1}(${V.a},${V.b})%256
    ${V.stack}[${V.ptr}]=${V.char}(${V.val})
    return ${V.val}
end

local function ${V.nop}(${V.a},${V.b},${V.c}) return ${V.a} end
local function ${V.nop2}(${V.a},${V.b},${V.c}) return ${V.a} ${V.b} end
local function ${V.nop3}(${V.a},${V.b},${V.c}) return ${V.a}+${V.b} end
local function ${V.nop4}(${V.a},${V.b},${V.c}) return ${V.a}-${V.b} end

local function ${V.mov}(${V.a},${V.b},${V.c})
    ${V.regs}[${V.a}]=${V.b}
    return ${V.b}
end

local function ${V.load}(${V.a},${V.b},${V.c})
    return ${V.regs}[${V.a}] or 0
end

local function ${V.check}(${V.a},${V.b},${V.c})
    local ${V.acc}=0
    for ${V.i}=1,64 do ${V.acc}=${V.acc}+${V.i} end
    return ${V.acc}==2080
end

local function ${V.check2}(${V.a},${V.b},${V.c})
    return true
end

local function ${V.build}(${V.a},${V.b},${V.c})
    ${V.buf}=${V.concat}(${V.stack})
    return ${V.buf}
end

local function ${V.exec}(${V.a},${V.b},${V.c})
    local ${V.fn},${V.err}=${V.loadstr}(${V.buf})
    if ${V.type}(${V.fn})~="function" then
        ${V.error}("[Mawww VM] decode failed: "..${V.tostring}(${V.err}))
    end
    local ${V.ok},${V.err}=${V.pcall}(${V.fn})
    if not ${V.ok} then
        ${V.error}("[Mawww VM] exec failed: "..${V.tostring}(${V.err}))
    end
end

-- Dispatch table
local ${V.dispatch}={
    [${OPS.PUSH}]=${V.push},
    [${OPS.PUSH2}]=${V.push},
    [${OPS.PUSH3}]=${V.push},
    [${OPS.NOP}]=${V.nop},
    [${OPS.NOP2}]=${V.nop2},
    [${OPS.NOP3}]=${V.nop3},
    [${OPS.NOP4}]=${V.nop4},
    [${OPS.MOV}]=${V.mov},
    [${OPS.MOV2}]=${V.mov},
    [${OPS.LOAD}]=${V.load},
    [${OPS.LOAD2}]=${V.load},
    [${OPS.ADD}]=${V.nop3},
    [${OPS.XOR}]=${V.x1},
    [${OPS.XOR2}]=${V.x1},
    [${OPS.CHECK}]=${V.check},
    [${OPS.CHECK2}]=${V.check2},
    [${OPS.BUILD}]=${V.build},
    [${OPS.EXEC}]=${V.exec},
    [${OPS.JMP}]=${V.nop},
    [${OPS.HALT}]=${V.nop}
}

-- Instruction table (${ins.length} entries)
local ${V.code}={
${insStr}
}

-- VM execution
local ${V.lim}=#${V.code}
local ${V.idx}=1
while ${V.idx}<=${V.lim} do
    local ${V.op}=${V.code}[${V.idx}]
    local ${V.h}=${V.dispatch}[${V.op}[1]]
    if ${V.h} then
        ${V.h}(${V.op}[2],${V.op}[3],${V.op}[4])
    end
    ${V.idx}=${V.idx}+1
end

-- Integrity check
local ${V.chk}=0
for ${V.i}=1,#${V.buf} do
    local ${V.bb}=${V.byte}(${V.buf},${V.i})
    ${V.chk}=(${V.chk}+${V.bb}*(((${V.i}-1)%127)+1)+((${V.i}-1)%251))%2147483647
end

if ${V.chk}~=${checksum} then
    ${V.error}("[Mawww VM] integrity check failed")
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

        const result = megaVmWrap(code);
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

// ===== SPA fallback (HANYA untuk route yang bukan file statis) =====
app.get('*', (req, res) => {
    if (path.extname(req.path)) {
        return res.status(404).send('Not found');
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== Listen on 0.0.0.0 for Railway =====
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Mawww Obfuscator v8.0 running on 0.0.0.0:${PORT}`);
});
