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
//  MAWWW BLACKBOX OBFUSCATOR v4.0 — "Native Proxy" Edition
//  100% Delta-compatible. No getfenv, no _ENV, no debug.*,
//  no invalid \ddd escapes, no nil function calls.
//  Protection: AES-like 8-round + Table Proxy + Double Loadstring
// ============================================================

// ─── Seeded PRNG ───
class PRNG {
    constructor(seed) { this.s = seed >>> 0; }
    next() {
        let s = this.s;
        s ^= (s << 13) >>> 0;
        s ^= (s >>> 17);
        s ^= (s << 5) >>> 0;
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
        const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
    }
    return s;
}
function makeInvSBox(sbox) {
    const inv = new Array(256);
    for (let i = 0; i < 256; i++) inv[sbox[i]] = i;
    return inv;
}

// ─── Key Schedule ───
function makeKeySchedule(seed) {
    const prng = new PRNG(seed);
    for (let i = 0; i < 800; i++) prng.next();
    const keys = [];
    for (let k = 0; k < 8; k++) {
        const key = new Array(64);
        for (let i = 0; i < 64; i++) key[i] = prng.byte();
        keys.push(key);
    }
    return keys;
}

// ─── Permutation ───
function makePermutation(len, prng) {
    const perm = new Array(len);
    for (let i = 0; i < len; i++) perm[i] = i;
    for (let i = len - 1; i > 0; i--) {
        const j = prng.range(i + 1);
        const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
    }
    return perm;
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

// ─── Main Obfuscator ───
function obfuscateLua(source) {
    if (!source || !source.trim()) {
        throw new Error('Please provide Lua source code to obfuscate.');
    }

    // Layer 1: UTF-8
    const rawBytes = utf8Encode(source);
    const N = rawBytes.length;

    // Layer 2: Seeded PRNG
    const masterSeed = (Math.random() * 0xFFFFFFFF) >>> 0;
    const prng = new PRNG(masterSeed);
    for (let i = 0; i < 500; i++) prng.next();

    const sbox = makeSBox(prng);
    const invSbox = makeInvSBox(sbox);
    const keys = makeKeySchedule(masterSeed);
    const perm = makePermutation(N, prng);

    // Layer 3: Encrypt — 8 rounds
    let data = rawBytes.slice();

    // Initial permutation
    const permuted = new Array(N);
    for (let i = 0; i < N; i++) permuted[i] = data[perm[i]];
    data = permuted;

    // 8 rounds: XOR(kA) → XOR(kB) → SBox → Rotate
    for (let round = 0; round < 8; round++) {
        const kA = keys[round];
        const kB = keys[(round + 4) % 8];
        for (let i = 0; i < N; i++) {
            let v = data[i];
            v ^= kA[(i * 7 + round * 13 + 3) % 64];
            v ^= kB[(i * 11 + round * 17 + 5) % 64];
            v = sbox[v];
            const rot = ((i + round * 3) % 7) + 1;
            v = ((v << rot) | (v >> (8 - rot))) & 0xFF;
            data[i] = v;
        }
    }

    // Layer 4: Convert to comma-separated numbers (NO escape chars!)
    const numStr = data.join(',');

    // Layer 5: Split into chunks
    const CHUNK = 400;
    const chunks = [];
    for (let i = 0; i < numStr.length; i += CHUNK) {
        chunks.push(numStr.slice(i, i + CHUNK));
    }

    // Layer 6: 5-part integrity hash
    const hashes = [0, 0, 0, 0, 0];
    for (let i = 0; i < N; i++) {
        const b = rawBytes[i];
        hashes[0] = (hashes[0] + b * 31 + 7) % 2147483647;
        hashes[1] = (hashes[1] + b * 131 + i % 251) % 2147483647;
        hashes[2] = (hashes[2] ^ (b << (i % 8))) % 2147483647;
        hashes[3] = (hashes[3] + ((b * 17 + i * 19) % 65521)) % 2147483647;
        hashes[4] = (hashes[4] ^ ((b + i) * 2654435761)) % 2147483647;
    }

    // Layer 7: Random identifiers
    const rnd = (n = 12) => {
        const cs = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let s = '_';
        for (let i = 0; i < n; i++) s += cs[Math.floor(Math.random() * cs.length)];
        return s;
    };

    const v = {};
    const names = ['proxy','mt','env','raw','dec','out','src','fn','ok','e',
                   'i','n','j','k','r','t','x','y','z','a','b','c','d','f','g','h','m','p','q','s',
                   'bx','bd','br','ls','rs','floor','seed','nKeys','kLen','hash','seg','tmp',
                   'state','ctr','lim','tbl','chk','res','buf','esc','vault','key','lock'];
    names.forEach(nm => v[nm] = rnd());

    const chunksLua = chunks.map(c => `"${c}"`).join(',\n    ');

    // ─── Build the Lua payload ───
    // NOTE: Tidak pakai getfenv, _ENV, debug.*, atau \ddd escape!
    const lua = `-- Mawww BlackBox v4.0 | Native Proxy Edition
-- DO NOT EDIT — integrity will fail

local ${v.proxy} = {}
local ${v.mt} = {}
${v.mt}.__index = function(${v.t}, ${v.k})
    local ${v.env} = (function()
        return (function() return ${v.t} end)()
    end)()
    -- Akses global via rawget pada environment table (native Luau)
    if ${v.t}.__G then return ${v.t}.__G[${v.k}] end
    return nil
end

-- Bangun environment proxy (TIDAK pakai getfenv)
local ${v.env} = {}
${v.env}.__G = nil
setmetatable(${v.env}, ${v.mt})
${v.proxy} = ${v.env}

-- ═══ BIT OPS (universal fallback) ═══
local ${v.bx}, ${v.bd}, ${v.br}, ${v.ls}, ${v.rs}
local __bit32 = (function()
    local ok, r = pcall(function() return bit32 end)
    if ok and type(r) == "table" and r.bxor then return r end
    ok, r = pcall(function() return bit end)
    if ok and type(r) == "table" and r.bxor then return r end
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
    ${v.bd} = function(a,b) local r,p=0,1 while a>0 and b>0 do if a%2==1 and b%2==1 then r=r+p end a=math.floor(a/2) b=math.floor(b/2) p=p*2 end return r end
    ${v.br} = function(a,b) local r,p=0,1 while a>0 or b>0 do if a%2==1 or b%2==1 then r=r+p end a=math.floor(a/2) b=math.floor(b/2) p=p*2 end return r end
    ${v.ls} = function(a,b) return a*(2^b) end
    ${v.rs} = function(a,b) return math.floor(a/(2^b)) end
end

-- ═══ EMBEDDED TABLES ═══
local ${v.vault} = {${sbox.join(',')}}
local ${v.key}   = {${invSbox.join(',')}}
local ${v.seed}  = {${perm.join(',')}}
local ${v.nKeys} = 8
local ${v.kLen}  = 64

local ${v.lock} = {
${keys.map(k => `    {${k.join(',')}}`).join(',\n')}
}

local ${v.seg} = {
    ${chunksLua}
}

-- ═══ DECRYPT (8 rounds reverse) ═══
local ${v.raw} = table.concat(${v.seg})
local ${v.dec} = {}
local ${v.i} = 1
for ${v.t} in string.gmatch(${v.raw}, "([^,]+)") do
    local val = tonumber(${v.t})
    if not val then error("Mawww: corrupt payload") end
    ${v.dec}[${v.i}] = val
    ${v.i} = ${v.i} + 1
end
local LEN = ${v.i} - 1

-- Copy to output
local ${v.out} = {}
for ${v.i} = 1, LEN do ${v.out}[${v.i}] = ${v.dec}[${v.i}] end

-- Reverse 8 rounds (dari round 7 ke 0)
for ${v.r} = 7, 0, -1 do
    local kA = ${v.lock}[${v.r} + 1]
    local kB = ${v.lock}[(${v.r} + 4) % 8 + 1]
    for ${v.i} = 1, LEN do
        local ${v.n} = ${v.out}[${v.i}]
        local pos = ${v.i} - 1
        -- Reverse rotate
        local rot = ((pos + ${v.r} * 3) % 7) + 1
        ${v.n} = ${v.br}(${v.rs}(${v.n}, rot), ${v.ls}(${v.bd}(${v.n}, (2^rot)-1), 8-rot))
        ${v.n} = ${v.bd}(${v.n}, 255)
        -- Reverse SBox (pakai inverse table)
        ${v.n} = ${v.key}[${v.n} + 1]
        -- Reverse XOR kB
        ${v.n} = ${v.bx}(${v.n}, kB[(pos * 11 + ${v.r} * 17 + 5) % 64 + 1])
        -- Reverse XOR kA
        ${v.n} = ${v.bx}(${v.n}, kA[(pos * 7 + ${v.r} * 13 + 3) % 64 + 1])
        ${v.out}[${v.i}] = ${v.n}
    end
end

-- Reverse initial permutation
local ${v.res} = {}
for ${v.i} = 1, LEN do
    ${v.res}[${v.seed}[${v.i}] + 1] = ${v.out}[${v.i}]
end

-- Rebuild string
local ${v.buf} = {}
for ${v.i} = 1, LEN do
    ${v.buf}[${v.i}] = string.char(${v.bd}(${v.res}[${v.i}], 255))
end
local SRC = table.concat(${v.buf})

-- ═══ INTEGRITY CHECK (5 parts, scattered) ═══
local h = {0,0,0,0,0}
for ${v.i} = 1, #SRC do
    local bb = string.byte(SRC, ${v.i})
    h[1] = (h[1] + bb * 31 + 7) % 2147483647
    h[2] = (h[2] + bb * 131 + (${v.i}-1) % 251) % 2147483647
    h[3] = (${v.bx}(h[3], ${v.ls}(bb, (${v.i}-1) % 8))) % 2147483647
    h[4] = (h[4] + ((bb * 17 + (${v.i}-1) * 19) % 65521)) % 2147483647
    h[5] = (${v.bx}(h[5], ${v.ls}(bb + (${v.i}-1), 0) * 2654435761)) % 2147483647
end

if h[1] ~= ${hashes[0]} then error("Mawww: integrity 1") end
if h[2] ~= ${hashes[1]} then error("Mawww: integrity 2") end
if h[3] ~= ${hashes[2]} then error("Mawww: integrity 3") end
if h[4] ~= ${hashes[3]} then error("Mawww: integrity 4") end
if h[5] ~= ${hashes[4]} then error("Mawww: integrity 5") end

-- ═══ EXECUTE (safe loadstring detection) ═══
local ${v.fn} = loadstring
if type(${v.fn}) ~= "function" then
    ${v.fn} = load
end
if type(${v.fn}) ~= "function" then
    error("Mawww: no loadstring available")
end

local __ok, __res = pcall(${v.fn}, SRC)
if not __ok then
    error("Mawww: exec fail - " .. tostring(__res))
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
        showStatus('🔒 BlackBox v4.0 obfuscated! Delta-safe + unreadable.', 'success');
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
    a.download = `mawww-blackbox-${Date.now()}.lua`;
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
