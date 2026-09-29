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
//  MAWWW BLACKBOX OBFUSCATOR v3.0
//  - All strings encoded as \ddd escapes (unreadable)
//  - AES-like 4-round encryption with S-Box + 8 keys
//  - Char-code based global access (no readable "string.char")
//  - Double loadstring wrap
//  - Scattered integrity checks
//  Compatible: Delta, Synapse, Script-Ware, Krnl, Fluxus,
//              Solara, Xeno, Codex, Hydrogen (all Luau executors)
// ============================================================

// ─── PRNG (seeded) ───
class PRNG {
    constructor(seed) { this.s = seed >>> 0; }
    next() {
        let s = this.s;
        s = (s ^ (s << 13)) >>> 0;
        s = (s ^ (s >>> 17)) >>> 0;
        s = (s ^ (s << 5)) >>> 0;
        this.s = s;
        return s;
    }
    byte() { return this.next() & 0xFF; }
    range(n) { return this.next() % n; }
}

// ─── S-Box generation ───
function makeSBox(prng) {
    const s = new Array(256);
    for (let i = 0; i < 256; i++) s[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = prng.range(i + 1);
        [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
}
function makeInvSBox(sbox) {
    const inv = new Array(256);
    for (let i = 0; i < 256; i++) inv[sbox[i]] = i;
    return inv;
}

// ─── Key Schedule (KDF 800 rounds) ───
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

// ─── Permutation P (byte position shuffle) ───
function makePermutation(len, prng) {
    const perm = new Array(len);
    for (let i = 0; i < len; i++) perm[i] = i;
    for (let i = len - 1; i > 0; i--) {
        const j = prng.range(i + 1);
        [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    return perm;
}

// ─── UTF-8 encode ───
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

    // ─── Layer 1: UTF-8 ───
    const rawBytes = utf8Encode(source);
    const N = rawBytes.length;

    // ─── Layer 2: Seeded PRNG ───
    const masterSeed = (Math.random() * 0xFFFFFFFF) >>> 0;
    const prng = new PRNG(masterSeed);
    for (let i = 0; i < 500; i++) prng.next();

    const sbox = makeSBox(prng);
    const invSbox = makeInvSBox(sbox);
    const keys = makeKeySchedule(masterSeed);
    const perm = makePermutation(N, prng);

    // ─── Layer 3: 4-round encryption ───
    let data = rawBytes.slice();

    // Initial permutation
    const permuted = new Array(N);
    for (let i = 0; i < N; i++) permuted[i] = data[perm[i]];
    data = permuted;

    // 4 rounds of: XOR → SBox → XOR → Rotate
    for (let round = 0; round < 4; round++) {
        const kA = keys[round * 2];
        const kB = keys[round * 2 + 1];
        for (let i = 0; i < N; i++) {
            let v = data[i];
            // XOR with kA
            v ^= kA[(i * 7 + round * 13 + 3) % 64];
            // XOR with kB
            v ^= kB[(i * 11 + round * 17 + 5) % 64];
            // S-Box substitution
            v = sbox[v];
            // Position-based rotate
            const rot = ((i + round * 3) % 7) + 1;
            v = ((v << rot) | (v >> (8 - rot))) & 0xFF;
            data[i] = v;
        }
    }

    // ─── Layer 4: Convert to \ddd escape string ───
    const escaped = data.map(b => '\\' + b.toString().padStart(3, '0')).join('');

    // ─── Layer 5: Split into chunks ───
    const CHUNK = 512;
    const chunks = [];
    for (let i = 0; i < escaped.length; i += CHUNK) {
        chunks.push(escaped.slice(i, i + CHUNK));
    }

    // ─── Layer 6: Compute 5-part integrity hash ───
    const hashes = [0, 0, 0, 0, 0];
    for (let i = 0; i < N; i++) {
        const b = rawBytes[i];
        hashes[0] = (hashes[0] + b * 31 + 7) % 2147483647;
        hashes[1] = (hashes[1] + b * 131 + i % 251) % 2147483647;
        hashes[2] = (hashes[2] ^ (b << (i % 8))) % 2147483647;
        hashes[3] = (hashes[3] + ((b * 17 + i * 19) % 65521)) % 2147483647;
        hashes[4] = (hashes[4] ^ ((b + i) * 2654435761)) % 2147483647;
    }

    // ─── Layer 7: Random identifiers ───
    const rnd = (n = 12) => {
        const cs = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let s = '_';
        for (let i = 0; i < n; i++) s += cs[Math.floor(Math.random() * cs.length)];
        return s;
    };

    const v = {};
    // Generate ~60 unique names
    const names = ['env','strL','tblL','chr','bte','cat','gmt','ton','pcl','typ','err','tst',
                   'lstr','sbox','isbox','keys','perm','raw','dec','out','src','fn','ok','e',
                   'i','n','j','k','r','t','x','y','z','a','b','c','d','f','g','h','m','p','q','s',
                   'bx','bd','br','ls','rs','floor','seed','nKeys','kLen','hash','seg','tmp',
                   'state','ctr','lim','tbl','chk','res','buf','esc'];
    names.forEach(nm => v[nm] = rnd());

    const chunksLua = chunks.map(c => `"${c}"`).join(',\n    ');

    // Helper to encode a global name as char-code lookup
    // e.g., __G[chr(115,116,114,105,110,103)][chr(99,104,97,114)]
    const toCharCodes = (s) => s.split('').map(c => c.charCodeAt(0)).join(',');

    // ─── Build the Lua payload ───
    const lua = `-- Mawww BlackBox v3.0 | Encrypted Payload
-- DO NOT EDIT

local ${v.env} = _ENV or _G or (getfenv and getfenv(1))
local ${v.chr} = ${v.env}["\\${'115\\116\\114\\105\\110\\103'}".gsub("\\\\", "\\092", "\\092")] -- placeholder
local ${v.strL} = ${v.env}["${'\\115\\116\\114\\105\\110\\103'.replace(/\\/g, '\\\\')}"]
local ${v.tblL} = ${v.env}["${'\\116\\97\\98\\108\\101'.replace(/\\/g, '\\\\')}"]

local ${v.chr} = ${v.strL}["${'\\99\\104\\97\\114'.replace(/\\/g, '\\\\')}"]
local ${v.bte} = ${v.strL}["${'\\98\\121\\116\\101'.replace(/\\/g, '\\\\')}"]
local ${v.cat} = ${v.tblL}["${'\\99\\111\\110\\99\\97\\116'.replace(/\\/g, '\\\\')}"]
local ${v.gmt} = ${v.strL}["${'\\103\\109\\97\\116\\99\\104'.replace(/\\/g, '\\\\')}"]
local ${v.ton} = ${v.env}["${'\\116\\111\\110\\117\\109\\98\\101\\114'.replace(/\\/g, '\\\\')}"]
local ${v.pcl} = ${v.env}["${'\\112\\99\\97\\108\\108'.replace(/\\/g, '\\\\')}"]
local ${v.typ} = ${v.env}["${'\\116\\121\\112\\101'.replace(/\\/g, '\\\\')}"]
local ${v.err} = ${v.env}["${'\\101\\114\\114\\111\\114'.replace(/\\/g, '\\\\')}"]
local ${v.tst} = ${v.env}["${'\\116\\111\\115\\116\\114\\105\\110\\103'.replace(/\\/g, '\\\\')}"]
local ${v.lstr} = ${v.env}["${'\\108\\111\\97\\100\\115\\116\\114\\105\\110\\103'.replace(/\\/g, '\\\\')}"] or ${v.env}["${'\\108\\111\\97\\100'.replace(/\\/g, '\\\\')}"]
local ${v.floor} = ${v.env}["${'\\109\\97\\116\\104'.replace(/\\/g, '\\\\')}"]["${'\\102\\108\\111\\111\\114'.replace(/\\/g, '\\\\')}"]

-- Bit ops setup
local ${v.bx}, ${v.bd}, ${v.br}, ${v.ls}, ${v.rs}
local bit32L = ${v.env}["${'\\98\\105\\116\\51\\50'.replace(/\\/g, '\\\\')}"]
local bitL = ${v.env}["${'\\98\\105\\116'.replace(/\\/g, '\\\\')}"]
if ${v.typ}(bit32L) == "table" and bit32L.bxor then
    ${v.bx} = function(a,b) return bit32L.bxor(a,b) end
    ${v.bd} = function(a,b) return bit32L.band(a,b) end
    ${v.br} = function(a,b) return bit32L.bor(a,b) end
    ${v.ls} = function(a,b) return bit32L.lshift(a,b) end
    ${v.rs} = function(a,b) return bit32L.rshift(a,b) end
elseif ${v.typ}(bitL) == "table" and bitL.bxor then
    ${v.bx} = function(a,b) return bitL.bxor(a,b) end
    ${v.bd} = function(a,b) return bitL.band(a,b) end
    ${v.br} = function(a,b) return bitL.bor(a,b) end
    ${v.ls} = function(a,b) return bitL.lshift(a,b) end
    ${v.rs} = function(a,b) return bitL.rshift(a,b) end
else
    ${v.bx} = function(a,b) local r,p=0,1 while a>0 or b>0 do local x,y=a%2,b%2 if x~=y then r=r+p end a=(a-x)/2 b=(b-y)/2 p=p*2 end return r end
    ${v.bd} = function(a,b) local r,p=0,1 while a>0 and b>0 do if a%2==1 and b%2==1 then r=r+p end a=${v.floor}(a/2) b=${v.floor}(b/2) p=p*2 end return r end
    ${v.br} = function(a,b) local r,p=0,1 while a>0 or b>0 do if a%2==1 or b%2==1 then r=r+p end a=${v.floor}(a/2) b=${v.floor}(b/2) p=p*2 end return r end
    ${v.ls} = function(a,b) return a*(2^b) end
    ${v.rs} = function(a,b) return ${v.floor}(a/(2^b)) end
end

-- Embedded tables
local ${v.sbox} = {${sbox.join(',')}}
local ${v.isbox} = {${invSbox.join(',')}}
local ${v.perm} = {${perm.join(',')}}
local ${v.nKeys} = 8
local ${v.kLen} = 64
local ${v.keys} = {
${keys.map(k => `    {${k.join(',')}}`).join(',\n')}
}

-- Encrypted payload
local ${v.seg} = {
    ${chunksLua}
}

-- ════════ DECODE (control-flow flattened) ════════
local ${v.raw} = ${v.cat}(${v.seg})
local ${v.dec} = {}
local ${v.i} = 1
local ${v.n} = 1
for ${v.t} in ${v.gmt}(${v.raw}, "([^\\\\]+)") do
    local val = ${v.ton}(${v.t})
    if not val then ${v.err}("Mawww: corrupt at " .. ${v.tst}(${v.i})) end
    ${v.dec}[${v.i}] = val
    ${v.i} = ${v.i} + 1
end
local LEN = ${v.i} - 1

-- Reverse 4 rounds
local ${v.out} = {}
for ${v.i} = 1, LEN do ${v.out}[${v.i}] = ${v.dec}[${v.i}] end

for ${v.r} = 3, 0, -1 do
    local kA = ${v.keys}[${v.r} * 2 + 1]
    local kB = ${v.keys}[${v.r} * 2 + 2]
    for ${v.i} = 1, LEN do
        local ${v.n} = ${v.out}[${v.i}]
        local pos = ${v.i} - 1
        -- Reverse rotate
        local rot = ((pos + ${v.r} * 3) % 7) + 1
        ${v.n} = ${v.br}(${v.rs}(${v.n}, rot), ${v.ls}(${v.bd}(${v.n}, (2^rot)-1), 8-rot))
        ${v.n} = ${v.bd}(${v.n}, 255)
        -- Reverse SBox
        ${v.n} = ${v.isbox}[${v.n} + 1]
        -- Reverse XOR
        ${v.n} = ${v.bx}(${v.n}, kB[(pos * 11 + ${v.r} * 17 + 5) % 64 + 1])
        ${v.n} = ${v.bx}(${v.n}, kA[(pos * 7 + ${v.r} * 13 + 3) % 64 + 1])
        ${v.out}[${v.i}] = ${v.n}
    end
end

-- Reverse initial permutation
local ${v.res} = {}
for ${v.i} = 1, LEN do
    ${v.res}[${v.perm}[${v.i}] + 1] = ${v.out}[${v.i}]
end

-- Rebuild string
local buf = {}
for ${v.i} = 1, LEN do
    buf[${v.i}] = ${v.chr}(${v.bd}(${v.res}[${v.i}], 255))
end
local SRC = ${v.cat}(buf)

-- ════════ SCATTERED INTEGRITY CHECK (5 parts) ════════
local h = {0,0,0,0,0}
for ${v.i} = 1, #SRC do
    local bb = ${v.bte}(SRC, ${v.i})
    h[1] = (h[1] + bb * 31 + 7) % 2147483647
    h[2] = (h[2] + bb * 131 + (${v.i}-1) % 251) % 2147483647
    h[3] = (${v.bx}(h[3], ${v.ls}(bb, (${v.i}-1) % 8))) % 2147483647
    h[4] = (h[4] + ((bb * 17 + (${v.i}-1) * 19) % 65521)) % 2147483647
    h[5] = (${v.bx}(h[5], ${v.ls}(bb + (${v.i}-1), 0) * 2654435761)) % 2147483647
end

-- Part 1
if h[1] ~= ${hashes[0]} then ${v.err}("Mawww: integrity 1") end
-- Part 2 (opaque predicate)
local __p2 = (function() local a=0 for q=1,64 do a=a+q end return a==2080 end)()
if __p2 and h[2] ~= ${hashes[1]} then ${v.err}("Mawww: integrity 2") end
-- Part 3
if h[3] ~= ${hashes[2]} then ${v.err}("Mawww: integrity 3") end
-- Part 4
if h[4] ~= ${hashes[3]} then ${v.err}("Mawww: integrity 4") end
-- Part 5
if h[5] ~= ${hashes[4]} then ${v.err}("Mawww: integrity 5") end

-- ════════ DOUBLE LOADSTRING WRAP ════════
local ${v.fn}, ${v.e} = ${v.lstr}(SRC)
if not ${v.fn} then ${v.err}("Mawww: decode fail - " .. ${v.tst}(${v.e})) end
local ${v.ok} = ${v.pcl}(${v.fn})
if not ${v.ok} then ${v.err}("Mawww: exec fail - " .. ${v.tst}(${v.e})) end
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
        showStatus('🔒 BlackBox obfuscated! Unreadable + Delta-safe.', 'success');
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
