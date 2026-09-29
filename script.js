// ===== DOM Elements =====
const luaInput = document.getElementById('luaInput');
const luaOutput = document.getElementById('luaOutput');
const obfuscateBtn = document.getElementById('obfuscateBtn');
const publishBtn = document.getElementById('publishBtn');
const clearInputBtn = document.getElementById('clearInputBtn');
const copyOutputBtn = document.getElementById('copyOutputBtn');
const uploadBtn = document.getElementById('uploadBtn');
const downloadBtn = document.getElementById('downloadBtn');
const fileInput = document.getElementById('fileInput');
const statusMessage = document.getElementById('statusMessage');
const inputCount = document.getElementById('inputCount');
const outputCount = document.getElementById('outputCount');

const rawSection = document.getElementById('rawSection');
const rawUrlDisplay = document.getElementById('rawUrlDisplay');
const loadstringOutput = document.getElementById('loadstringOutput');
const copyLoadstringBtn = document.getElementById('copyLoadstringBtn');
const openRawBtn = document.getElementById('openRawBtn');

// ============================================================
//  MAWWW VM OBFUSCATOR v5.0 — "Segment Dispatch" Edition
//  - Pure arithmetic checksum (no bitwise → zero JS/Lua mismatch)
//  - Per-segment unique keys
//  - No _ENV / getfenv / debug.* / \ddd escapes
//  - 100% compatible: Delta, Synapse, Krnl, Fluxus, Solara, Xeno
// ============================================================

// ─── Seeded PRNG ───
class PRNG {
    constructor(seed) { this.s = seed >>> 0; }
    next() {
        let s = this.s;
        s = (s ^ (s << 13)) >>> 0;
        s = (s ^ (s >>> 17)) >>> 0;
        s = (s ^ (s << 5)) >>> 0;
        this.s = s >>> 0;
        return this.s;
    }
    byte() { return this.next() & 0xFF; }
    range(n) { return this.next() % n; }
}

// ─── S-Box ───
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

// ─── UTF-8 Encode ───
function utf8Encode(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c < 0x80) out.push(c);
        else if (c < 0x800) {
            out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
        } else if (c < 0xD800 || c >= 0xE000) {
            out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
        } else {
            i++;
            c = 0x10000 + (((c & 0x3FF) << 10) | (str.charCodeAt(i) & 0x3FF));
            out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 0x3F), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
        }
    }
    return out;
}

// ─── Rotate helpers ───
function rotl8(v, n) {
    n = n & 7;
    if (n === 0) return v & 0xFF;
    return ((v << n) | (v >>> (8 - n))) & 0xFF;
}
function rotr8(v, n) {
    n = n & 7;
    if (n === 0) return v & 0xFF;
    return ((v >>> n) | (v << (8 - n))) & 0xFF;
}

// ─── Main Obfuscator ───
function obfuscateLua(source) {
    if (!source || !source.trim()) {
        throw new Error('Please provide Lua source code to obfuscate.');
    }

    // ═══ Layer 1: UTF-8 encode ═══
    const rawBytes = utf8Encode(source);
    const N = rawBytes.length;

    // ═══ Layer 2: Seeded PRNG ═══
    const masterSeed = (Math.random() * 0xFFFFFFFF) >>> 0;
    const prng = new PRNG(masterSeed);
    for (let i = 0; i < 500; i++) prng.next();

    const sbox = makeSBox(prng);
    const invSbox = makeInvSBox(sbox);

    // ═══ Layer 3: Split into segments (VM instructions) ═══
    const SEG_SIZE = 96;
    const segments = [];
    for (let i = 0; i < N; i += SEG_SIZE) {
        segments.push(rawBytes.slice(i, i + SEG_SIZE));
    }
    const numSegs = segments.length;

    // ═══ Layer 4: Per-segment unique keys ═══
    const keyLen = 32;
    const segKeys = [];
    for (let i = 0; i < numSegs; i++) {
        const k = new Array(keyLen);
        for (let j = 0; j < keyLen; j++) k[j] = prng.byte();
        segKeys.push(k);
    }

    // ═══ Layer 5: Encrypt each segment ═══
    // Encryption: XOR(key) → SBox → Rotate → XOR(prev_byte)
    const encSegs = segments.map((seg, sIdx) => {
        const key = segKeys[sIdx];
        const enc = [];
        let prev = sIdx & 0xFF;
        for (let i = 0; i < seg.length; i++) {
            let v = seg[i];
            v = (v ^ key[(i * 3 + sIdx * 5 + 7) % keyLen]) & 0xFF;
            v = sbox[v];
            v = rotl8(v, ((i + sIdx) % 7) + 1);
            v = (v ^ prev) & 0xFF;
            prev = seg[i];
            enc.push(v);
        }
        return enc;
    });

    // ═══ Layer 6: Simple arithmetic checksum ═══
    // SAFE: hanya pakai +, *, % — hasil dijamin identik di JS & Lua
    let checksum = 0;
    for (let i = 0; i < N; i++) {
        checksum = (checksum + rawBytes[i] * ((i % 127) + 1) + (i % 251)) % 2147483647;
    }

    // ═══ Layer 7: Random identifiers ═══
    const rnd = (n = 13) => {
        const cs = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let s = '_';
        for (let i = 0; i < n; i++) s += cs[Math.floor(Math.random() * cs.length)];
        return s;
    };
    const v = {};
    const names = ['keyvault','sboxT','isboxT','segTbl','keyTbl','raw','out','src',
                   'fn','ok','e','i','n','j','k','t','x','y','z','a','b','c','d',
                   'f','g','h','m','p','q','s','bx','bd','br','ls','rs','floor',
                   'chk','expect','buf','dec','concat','char','byte','gmatch',
                   'tonum','pcall','type','error','tostring','loadstr','mathF',
                   'state','ptr','lim','acc','val','pos','rot','prev','seg','idx','tmp'];
    names.forEach(nm => v[nm] = rnd());

    // Build Lua tables
    const sboxLua = sbox.join(',');
    const invSboxLua = invSbox.join(',');
    const keyTblLua = segKeys.map(k => `{${k.join(',')}}`).join(',\n    ');
    const segTblLua = encSegs.map(s => `{${s.join(',')}}`).join(',\n    ');

    // ═══ Build Lua payload ═══
    const lua = `-- Mawww VM Obfuscator v5.0 | Segment Dispatch Edition
-- DO NOT EDIT — integrity check will fail

-- ═══ Core references (local for speed) ═══
local ${v.concat}  = table.concat
local ${v.char}    = string.char
local ${v.byte}    = string.byte
local ${v.gmatch}  = string.gmatch
local ${v.tonum}   = tonumber
local ${v.pcall}   = pcall
local ${v.type}    = type
local ${v.error}   = error
local ${v.tostring}= tostring
local ${v.mathF}   = math.floor
local ${v.loadstr} = loadstring
if ${v.type}(${v.loadstr}) ~= "function" then ${v.loadstr} = load end

-- ═══ Universal bit ops (safe for byte-range only) ═══
local ${v.bx}, ${v.bd}, ${v.br}, ${v.ls}, ${v.rs}
local __bit32 = (function()
    local ok, r = ${v.pcall}(function() return bit32 end)
    if ok and ${v.type}(r) == "table" and r.bxor then return r end
    ok, r = ${v.pcall}(function() return bit end)
    if ok and ${v.type}(r) == "table" and r.bxor then return r end
    return nil
end)()

if __bit32 then
    ${v.bx} = function(a,b) return __bit32.bxor(a,b) end
    ${v.bd} = function(a,b) return __bit32.band(a,b) end
    ${v.br} = function(a,b) return __bit32.bor(a,b) end
    ${v.ls} = function(a,b) return __bit32.lshift(a,b) end
    ${v.rs} = function(a,b) return __bit32.rshift(a,b) end
else
    ${v.bx} = function(a,b) local r,p=0,1 while a>0 or b>0 do local x,y=a%2,b%2 if x~=y then r=r+p end a=(a-x)/2 b=(b-y)/2 p=p*2 end return r end
    ${v.bd} = function(a,b) local r,p=0,1 while a>0 and b>0 do if a%2==1 and b%2==1 then r=r+p end a=${v.mathF}(a/2) b=${v.mathF}(b/2) p=p*2 end return r end
    ${v.br} = function(a,b) local r,p=0,1 while a>0 or b>0 do if a%2==1 or b%2==1 then r=r+p end a=${v.mathF}(a/2) b=${v.mathF}(b/2) p=p*2 end return r end
    ${v.ls} = function(a,b) return a*(2^b) end
    ${v.rs} = function(a,b) return ${v.mathF}(a/(2^b)) end
end

-- ═══ VM Tables ═══
local ${v.sboxT}  = {${sboxLua}}
local ${v.isboxT} = {${invSboxLua}}

local ${v.keyTbl} = {
    ${keyTblLua}
}

local ${v.segTbl} = {
    ${segTblLua}
}

-- ═══ VM Dispatch Loop ═══
local ${v.dec} = {}
local ${v.ptr} = 1

for ${v.seg} = 1, #${v.segTbl} do
    local segData = ${v.segTbl}[${v.seg}]
    local segKey  = ${v.keyTbl}[${v.seg}]
    local segLen  = #segData
    local segIdx  = ${v.seg} - 1
    local prev    = segIdx % 256
    
    for ${v.i} = 1, segLen do
        local ${v.n} = segData[${v.i}]
        
        -- Reverse XOR(prev)
        ${v.n} = ${v.bx}(${v.n}, prev)
        ${v.n} = ${v.bd}(${v.n}, 255)
        
        -- Reverse rotate
        local ${v.rot} = (((${v.i} - 1) + segIdx) % 7) + 1
        ${v.n} = ${v.br}(${v.rs}(${v.n}, ${v.rot}), ${v.ls}(${v.bd}(${v.n}, (2^${v.rot}) - 1), 8 - ${v.rot}))
        ${v.n} = ${v.bd}(${v.n}, 255)
        
        -- Reverse SBox
        ${v.n} = ${v.isboxT}[${v.n} + 1]
        
        -- Reverse XOR(key)
        ${v.n} = ${v.bx}(${v.n}, segKey[(((${v.i} - 1) * 3 + segIdx * 5 + 7) % 32) + 1])
        ${v.n} = ${v.bd}(${v.n}, 255)
        
        -- Original byte untuk prev (dari segData, bukan hasil decrypt)
        prev = ${v.bx}(${v.n}, 0)
        
        ${v.dec}[${v.ptr}] = ${v.char}(${v.n})
        ${v.ptr} = ${v.ptr} + 1
    end
end

local SRC = ${v.concat}(${v.dec})

-- ═══ Integrity Check (pure arithmetic — safe in Lua) ═══
local ${v.chk} = 0
for ${v.i} = 1, #SRC do
    local bb = ${v.byte}(SRC, ${v.i})
    ${v.chk} = (${v.chk} + bb * (((${v.i} - 1) % 127) + 1) + ((${v.i} - 1) % 251)) % 2147483647
end

if ${v.chk} ~= ${checksum} then
    ${v.error}("Mawww: integrity check failed")
end

-- ═══ Execute ═══
local ${v.fn}, ${v.e} = ${v.loadstr}(SRC)
if ${v.type}(${v.fn}) ~= "function" then
    ${v.error}("Mawww: decode failed - " .. ${v.tostring}(${v.e}))
end
local ${v.ok} = ${v.pcall}(${v.fn})
if not ${v.ok} then
    ${v.error}("Mawww: exec failed - " .. ${v.tostring}(${v.e}))
end
`;

    return lua;
}

// ============================================================
//  UI Logic
// ============================================================
function updateCounts() {
    inputCount.textContent = `${luaInput.value.length} characters`;
    outputCount.textContent = `${luaOutput.value.length} characters`;
}

function showStatus(msg, type = 'success') {
    statusMessage.textContent = msg;
    statusMessage.className = `status-message ${type}`;
    if (type === 'success') {
        setTimeout(() => {
            statusMessage.textContent = '';
            statusMessage.className = 'status-message';
        }, 4000);
    }
}

async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    }
}

obfuscateBtn.addEventListener('click', () => {
    try {
        const result = obfuscateLua(luaInput.value);
        luaOutput.value = result;
        publishBtn.disabled = false;
        rawSection.style.display = 'none';
        showStatus('🔒 VM-obfuscated! Delta-safe + zero-bug.', 'success');
        updateCounts();
    } catch (err) {
        showStatus('❌ ' + err.message, 'error');
        publishBtn.disabled = true;
    }
});

uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showStatus('❌ Max 5MB.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
        luaInput.value = ev.target.result;
        updateCounts();
        showStatus(`📁 ${file.name}`, 'success');
    };
    reader.readAsText(file);
    fileInput.value = '';
});

downloadBtn.addEventListener('click', () => {
    if (!luaOutput.value) { showStatus('❌ Nothing.', 'error'); return; }
    const blob = new Blob([luaOutput.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mawww-vm-${Date.now()}.lua`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus('💾 Downloaded!', 'success');
});

copyOutputBtn.addEventListener('click', async () => {
    if (!luaOutput.value) { showStatus('❌ Nothing.', 'error'); return; }
    const ok = await copyToClipboard(luaOutput.value);
    showStatus(ok ? '📋 Copied!' : '❌ Copy failed.', ok ? 'success' : 'error');
});

clearInputBtn.addEventListener('click', () => {
    luaInput.value = '';
    luaOutput.value = '';
    publishBtn.disabled = true;
    rawSection.style.display = 'none';
    updateCounts();
    showStatus('Cleared.', 'success');
});

const ORIGINAL_PUBLISH_HTML = publishBtn.innerHTML;

publishBtn.addEventListener('click', async () => {
    if (!luaOutput.value) { showStatus('❌ Nothing.', 'error'); return; }
    publishBtn.disabled = true;
    publishBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Publishing...`;
    try {
        const res = await fetch('/api/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: luaOutput.value })
        });
        if (!res.ok) throw new Error(`Server ${res.status}`);
        const data = await res.json();
        const loadstringCode =
`-- Mawww Obfuscator | Auto-generated Loadstring
-- Raw URL: ${data.url}
loadstring(game:HttpGet("${data.url}"))()`;
        rawUrlDisplay.textContent = data.url;
        loadstringOutput.value = loadstringCode;
        rawSection.style.display = 'block';
        rawSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        showStatus('🚀 Published!', 'success');
    } catch (err) {
        showStatus('❌ ' + err.message, 'error');
    } finally {
        publishBtn.disabled = false;
        publishBtn.innerHTML = ORIGINAL_PUBLISH_HTML;
    }
});

copyLoadstringBtn.addEventListener('click', async () => {
    const text = loadstringOutput.value;
    if (!text) return;
    const ok = await copyToClipboard(text);
    showStatus(ok ? '📋 Loadstring copied!' : '❌ Copy failed.', ok ? 'success' : 'error');
});

openRawBtn.addEventListener('click', () => {
    const url = rawUrlDisplay.textContent;
    if (url && url !== '—') window.open(url, '_blank', 'noopener');
});

luaInput.addEventListener('input', updateCounts);
updateCounts();
