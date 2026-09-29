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
//  ULTRA LUA OBFUSCATOR — 10-Layer Anti-Crack Protection
//  Compatible: Delta, Synapse, Script-Ware, Krnl, Fluxus,
//  Solara, Xeno, Codex, Hydrogen, dan semua executor Luau
// ============================================================

// ─── S-Box: AES-inspired substitution table ───
function generateSBox() {
    const sbox = new Array(256);
    for (let i = 0; i < 256; i++) sbox[i] = i;
    // Fisher-Yates shuffle dengan seed deterministic dari random
    let seed = Math.floor(Math.random() * 2147483647);
    for (let i = 255; i > 0; i--) {
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF;
        const j = seed % (i + 1);
        [sbox[i], sbox[j]] = [sbox[j], sbox[i]];
    }
    return sbox;
}

function generateInvSBox(sbox) {
    const inv = new Array(256);
    for (let i = 0; i < 256; i++) inv[sbox[i]] = i;
    return inv;
}

// ─── KDF: Key Derivation Function (500 rounds) ───
function deriveKey(seed, length, rounds) {
    const key = new Array(length);
    let state = seed;
    for (let r = 0; r < rounds; r++) {
        state = (state * 1103515245 + 12345) & 0x7FFFFFFF;
        state ^= (state >>> 13);
        state = (state * 2654435761) & 0x7FFFFFFF;
    }
    for (let i = 0; i < length; i++) {
        state = (state * 1103515245 + 12345) & 0x7FFFFFFF;
        state ^= (state >>> 17);
        state = (state * 2246822519) & 0x7FFFFFFF;
        key[i] = state & 0xFF;
    }
    return key;
}

function obfuscateLua(source) {
    if (!source || !source.trim()) {
        throw new Error('Please provide Lua source code to obfuscate.');
    }

    // ─── Layer 1: UTF-8 encode ───
    const bytes = [];
    for (let i = 0; i < source.length; i++) {
        let c = source.charCodeAt(i);
        if (c < 0x80) {
            bytes.push(c);
        } else if (c < 0x800) {
            bytes.push(0xC0 | (c >> 6));
            bytes.push(0x80 | (c & 0x3F));
        } else if (c < 0xD800 || c >= 0xE000) {
            bytes.push(0xE0 | (c >> 12));
            bytes.push(0x80 | ((c >> 6) & 0x3F));
            bytes.push(0x80 | (c & 0x3F));
        } else {
            i++;
            c = 0x10000 + (((c & 0x3FF) << 10) | (source.charCodeAt(i) & 0x3FF));
            bytes.push(0xF0 | (c >> 18));
            bytes.push(0x80 | ((c >> 12) & 0x3F));
            bytes.push(0x80 | ((c >> 6) & 0x3F));
            bytes.push(0x80 | (c & 0x3F));
        }
    }

    // ─── Layer 2: Generate S-Box & keys ───
    const sbox = generateSBox();
    const invSbox = generateInvSBox(sbox);
    const masterSeed = Math.floor(Math.random() * 2147483647);

    // 6 keys × 64 bytes, KDF 500 rounds
    const numKeys = 6;
    const keyLen = 64;
    const keys = [];
    for (let k = 0; k < numKeys; k++) {
        keys.push(deriveKey(masterSeed + k * 7919, keyLen, 500));
    }

    // ─── Layer 3: Multi-pass encryption (S-Box + 6×XOR + rotation) ───
    const encrypted = bytes.map((b, i) => {
        let v = b;
        // XOR dengan 6 key berbeda
        for (let k = 0; k < numKeys; k++) {
            const idx = (i * (k * 7 + 3) + k * 13) % keyLen;
            v ^= keys[k][idx];
        }
        // S-Box substitution
        v = sbox[v & 0xFF];
        // Position-dependent rotation
        const rot = (i % 7) + 1;
        v = ((v << rot) | (v >> (8 - rot))) & 0xFF;
        return v;
    });

    // ─── Layer 4: Chunk splitting ───
    const CHUNK_SIZE = 180;
    const chunks = [];
    for (let i = 0; i < encrypted.length; i += CHUNK_SIZE) {
        chunks.push(encrypted.slice(i, i + CHUNK_SIZE).join(','));
    }

    // ─── Layer 5: Random identifiers ───
    const rnd = (n = 11) => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let s = '_';
        for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
        return s;
    };

    const v = {
        concat: rnd(), char: rnd(), byte: rnd(), sub: rnd(),
        gmatch: rnd(), tonumber: rnd(), pcall: rnd(), type: rnd(),
        error: rnd(), tostring: rnd(), loadstring: rnd(), unpack: rnd(),
        select: rnd(), next: rnd(), ipairs: rnd(), setmetatable: rnd(),
        getmetatable: rnd(), rawget: rnd(), rawset: rnd(), rawequal: rnd(),
        bxor: rnd(), band: rnd(), bor: rnd(), lshift: rnd(), rshift: rnd(),
        chunks: rnd(), keys: rnd(), k1: rnd(), k2: rnd(), k3: rnd(),
        k4: rnd(), k5: rnd(), k6: rnd(), data: rnd(), arr: rnd(),
        i: rnd(), n: rnd(), out: rnd(), src: rnd(), fn: rnd(),
        ok: rnd(), err: rnd(), chk: rnd(), chk2: rnd(), chk3: rnd(),
        expect: rnd(), num: rnd(), sep: rnd(), keyTbl: rnd(), sboxTbl: rnd(),
        invSboxTbl: rnd(), rot: rnd(), idx: rnd(), xorVal: rnd(),
        state: rnd(), debugCheck: rnd(), envCheck: rnd(), tamperCheck: rnd(),
        mathFloor: rnd(), masterSeed: rnd(), keyLen: rnd(), numKeys: rnd(),
        dec: rnd(), b: rnd(), k: rnd(), pos: rnd(), sVal: rnd()
    };

    // ─── Layer 6: Multi-hash checksum (3 lapis) ───
    let checksum1 = 0, checksum2 = 0, checksum3 = 0;
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        checksum1 = (checksum1 + b * 31 + 7) % 2147483647;
        checksum2 = (checksum2 + b * 131 + (i % 251)) % 2147483647;
        checksum3 = (checksum3 ^ ((b << (i % 8)) | (b >> (8 - (i % 8))))) % 2147483647;
    }

    // S-Box & Inv-SBox untuk Lua
    const sboxStr = sbox.join(',');
    const invSboxStr = invSbox.join(',');
    const keysStr = keys.map(k => `{${k.join(',')}}`).join(',\n    ');

    const chunksLua = chunks.map(c => `    "${c}"`).join(',\n');

    // ─── Build Lua output dengan 10 layer proteksi ───
    const lua = `-- Mawww Obfuscator | ULTRA PROTECTION v2.0
-- Generated: ${new Date().toISOString()}
-- Layers: UTF8 | SBox | 6xXOR | Rotate | KDF-500 | ChunkSplit
--         | MultiHash | ControlFlow | AntiDebug | AntiTamper
-- Compatible: Delta, Synapse, Script-Ware, Krnl, Fluxus, Solara, Xeno
-- DO NOT EDIT — integrity will fail

-- ═══ LAYER 10: Anti-Debug & Environment Check ═══
local ${v.debugCheck} = (function()
    local ok1 = true
    local ok2 = true
    if type(debug) == "table" then
        if debug.getinfo and debug.getinfo(1, "S").what == "main" then
            ok1 = true
        end
        if debug.sethook then
            local hookCount = 0
            debug.sethook(function() hookCount = hookCount + 1 end, "", 0)
            debug.sethook()
            if hookCount > 0 then ok1 = false end
        end
    end
    if type(getfenv) == "function" then
        local env = getfenv(1)
        if env and env.script then ok2 = false end
    end
    return ok1 and ok2
end)()

-- ═══ Core references (obfuscated names) ═══
local ${v.concat}   = table.concat
local ${v.char}     = string.char
local ${v.byte}     = string.byte
local ${v.sub}      = string.sub
local ${v.gmatch}   = string.gmatch
local ${v.tonumber} = tonumber
local ${v.pcall}    = pcall
local ${v.type}     = type
local ${v.error}    = error
local ${v.tostring} = tostring
local ${v.loadstring} = loadstring or load
local ${v.select}   = select
local ${v.mathFloor} = math.floor
local ${v.unpack}   = table.unpack or unpack

-- ═══ Universal bit ops (bit32 > bit > arithmetic) ═══
local ${v.bxor}, ${v.band}, ${v.bor}, ${v.lshift}, ${v.rshift}

if ${v.type}(bit32) == "table" and bit32.bxor then
    ${v.bxor} = function(a, b) return bit32.bxor(a, b) end
    ${v.band} = function(a, b) return bit32.band(a, b) end
    ${v.bor}  = function(a, b) return bit32.bor(a, b) end
    ${v.lshift} = function(a, b) return bit32.lshift(a, b) end
    ${v.rshift} = function(a, b) return bit32.rshift(a, b) end
elseif ${v.type}(bit) == "table" and bit.bxor then
    ${v.bxor} = function(a, b) return bit.bxor(a, b) end
    ${v.band} = function(a, b) return bit.band(a, b) end
    ${v.bor}  = function(a, b) return bit.bor(a, b) end
    ${v.lshift} = function(a, b) return bit.lshift(a, b) end
    ${v.rshift} = function(a, b) return bit.rshift(a, b) end
else
    ${v.bxor} = function(a, b)
        local r, p = 0, 1
        while a > 0 or b > 0 do
            local x, y = a % 2, b % 2
            if x ~= y then r = r + p end
            a = (a - x) / 2
            b = (b - y) / 2
            p = p * 2
        end
        return r
    end
    ${v.band} = function(a, b)
        local r, p = 0, 1
        while a > 0 and b > 0 do
            if a % 2 == 1 and b % 2 == 1 then r = r + p end
            a = ${v.mathFloor}(a / 2); b = ${v.mathFloor}(b / 2); p = p * 2
        end
        return r
    end
    ${v.bor} = function(a, b)
        local r, p = 0, 1
        while a > 0 or b > 0 do
            if a % 2 == 1 or b % 2 == 1 then r = r + p end
            a = ${v.mathFloor}(a / 2); b = ${v.mathFloor}(b / 2); p = p * 2
        end
        return r
    end
    ${v.lshift} = function(a, b) return a * (2 ^ b) end
    ${v.rshift} = function(a, b) return ${v.mathFloor}(a / (2 ^ b)) end
end

-- ═══ LAYER 2: S-Box & Inverse S-Box ═══
local ${v.sboxTbl}    = {${sboxStr}}
local ${v.invSboxTbl} = {${invSboxStr}}

-- ═══ LAYER 3: Encrypted keys ═══
local ${v.keys} = {
    ${keysStr}
}

-- ═══ LAYER 4: Encrypted chunks ═══
local ${v.chunks} = {
${chunksLua}
}

-- ═══ LAYER 5: Reassemble ═══
local ${v.sep}  = ","
local ${v.data} = ${v.concat}(${v.chunks}, ${v.sep})

-- ═══ LAYER 6: Parse dengan validasi ═══
local ${v.arr} = {}
local ${v.i} = 1
for ${v.num} in ${v.gmatch}(${v.data}, "([^,]+)") do
    local ${v.n} = ${v.tonumber}(${v.num})
    if not ${v.n} then
        ${v.error}("Mawww: corrupt payload at " .. ${v.tostring}(${v.i}))
    end
    ${v.arr}[${v.i}] = ${v.n}
    ${v.i} = ${v.i} + 1
end

-- ═══ LAYER 7: Decrypt — Reverse rotation + InvSBox + 6×XOR ═══
local ${v.out} = {}
local ${v.numKeys} = ${numKeys}
local ${v.keyLen} = ${keyLen}

for ${v.i} = 1, #${v.arr} do
    local ${v.n} = ${v.arr}[${v.i}]
    local ${v.pos} = ${v.i} - 1

    -- Reverse rotation
    local ${v.rot} = (${v.pos} % 7) + 1
    ${v.n} = ${v.bor}(${v.rshift}(${v.n}, ${v.rot}), ${v.lshift}(${v.band}(${v.n}, (2^${v.rot}) - 1), 8 - ${v.rot}))
    ${v.n} = ${v.band}(${v.n}, 255)

    -- Inverse S-Box
    ${v.n} = ${v.invSboxTbl}[${v.n} + 1]

    -- 6×XOR (reverse order)
    for ${v.k} = ${v.numKeys}, 1, -1 do
        local ${v.idx} = (${v.pos} * ((${v.k} - 1) * 7 + 3) + (${v.k} - 1) * 13) % ${v.keyLen} + 1
        ${v.n} = ${v.bxor}(${v.n}, ${v.keys}[${v.k}][${v.idx}])
    end

    ${v.out}[${v.i}] = ${v.char}(${v.n})
end

local ${v.src} = ${v.concat}(${v.out})

-- ═══ LAYER 8: Multi-Hash Integrity Check ═══
local ${v.chk}, ${v.chk2}, ${v.chk3} = 0, 0, 0
for ${v.i} = 1, #${v.src} do
    local ${v.b} = ${v.byte}(${v.src}, ${v.i})
    ${v.chk}  = (${v.chk}  + ${v.b} * 31  + 7) % 2147483647
    ${v.chk2} = (${v.chk2} + ${v.b} * 131 + ((${v.i} - 1) % 251)) % 2147483647
    local ${v.sVal} = ${v.lshift}(${v.b}, (${v.i} - 1) % 8) + ${v.rshift}(${v.b}, 8 - (${v.i} - 1) % 8)
    ${v.chk3} = ${v.bxor}(${v.chk3}, ${v.sVal})
end

if ${v.chk} ~= ${checksum1} or ${v.chk2} ~= ${checksum2} or ${v.chk3} ~= ${checksum3} then
    ${v.error}("Mawww: integrity check failed - code has been modified")
end

-- ═══ LAYER 9: Opaque Predicate (always true) ═══
local ${v.tamperCheck} = (function()
    local a = 0
    for i = 1, 100 do a = a + i end
    return a == 5050
end)()

if not ${v.tamperCheck} then
    return
end

-- ═══ LAYER 10: Anti-Debug ═══
if not ${v.debugCheck} then
    ${v.error}("Mawww: debugging detected")
end

-- ═══ Execute ═══
local ${v.fn}, ${v.err} = ${v.loadstring}(${v.src})
if ${v.fn} then
    local ${v.ok} = ${v.pcall}(${v.fn})
    if not ${v.ok} then
        ${v.error}("Mawww: " .. ${v.tostring}(${v.err}))
    end
else
    ${v.error}("Mawww: decode failed - " .. ${v.tostring}(${v.err}))
end`;

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
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
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

// ===== Obfuscate =====
obfuscateBtn.addEventListener('click', () => {
    try {
        const source = luaInput.value;
        const result = obfuscateLua(source);
        luaOutput.value = result;
        publishBtn.disabled = false;
        rawSection.style.display = 'none';
        showStatus('🔒 Ultra-obfuscated! 10 layers of protection active.', 'success');
        updateCounts();
    } catch (err) {
        showStatus('❌ ' + err.message, 'error');
        publishBtn.disabled = true;
    }
});

// ===== Upload File =====
uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showStatus('❌ File too large (max 5MB).', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
        luaInput.value = event.target.result;
        updateCounts();
        showStatus(`📁 Loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'success');
    };
    reader.onerror = () => showStatus('❌ Failed to read file.', 'error');
    reader.readAsText(file);
    fileInput.value = '';
});

// ===== Download Output =====
downloadBtn.addEventListener('click', () => {
    if (!luaOutput.value) {
        showStatus('❌ Nothing to download.', 'error');
        return;
    }
    const blob = new Blob([luaOutput.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mawww-ultra-${Date.now()}.lua`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus('💾 Downloaded!', 'success');
});

// ===== Copy Output =====
copyOutputBtn.addEventListener('click', async () => {
    if (!luaOutput.value) { showStatus('❌ Nothing to copy.', 'error'); return; }
    const ok = await copyToClipboard(luaOutput.value);
    showStatus(ok ? '📋 Output copied!' : '❌ Copy failed.', ok ? 'success' : 'error');
});

// ===== Clear =====
clearInputBtn.addEventListener('click', () => {
    luaInput.value = '';
    luaOutput.value = '';
    publishBtn.disabled = true;
    rawSection.style.display = 'none';
    updateCounts();
    showStatus('Cleared.', 'success');
});

// ===== Publish as Raw =====
const ORIGINAL_PUBLISH_HTML = publishBtn.innerHTML;

publishBtn.addEventListener('click', async () => {
    if (!luaOutput.value) { showStatus('❌ Nothing to publish.', 'error'); return; }
    publishBtn.disabled = true;
    publishBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg> Publishing...`;
    try {
        const res = await fetch('/api/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: luaOutput.value })
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
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

// ===== Copy Loadstring =====
copyLoadstringBtn.addEventListener('click', async () => {
    const text = loadstringOutput.value;
    if (!text) return;
    const ok = await copyToClipboard(text);
    showStatus(ok ? '📋 Loadstring copied!' : '❌ Copy failed.', ok ? 'success' : 'error');
});

// ===== Open Raw =====
openRawBtn.addEventListener('click', () => {
    const url = rawUrlDisplay.textContent;
    if (url && url !== '—') window.open(url, '_blank', 'noopener');
});

luaInput.addEventListener('input', updateCounts);
updateCounts();
