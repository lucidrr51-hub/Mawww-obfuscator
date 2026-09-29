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
//  HEAVY LUA OBFUSCATOR — Multi-Layer Protection
//  Compatible with ALL Roblox executors (Lua 5.1 / Luau)
// ============================================================
function obfuscateLua(source) {
    if (!source || !source.trim()) {
        throw new Error('Please provide Lua source code to obfuscate.');
    }

    // ─── Layer 1: UTF-8 encode source to bytes ───
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
            // Surrogate pair
            i++;
            c = 0x10000 + (((c & 0x3FF) << 10) | (source.charCodeAt(i) & 0x3FF));
            bytes.push(0xF0 | (c >> 18));
            bytes.push(0x80 | ((c >> 12) & 0x3F));
            bytes.push(0x80 | ((c >> 6) & 0x3F));
            bytes.push(0x80 | (c & 0x3F));
        }
    }

    // ─── Layer 2: Generate 4 random XOR keys (32 bytes each) ───
    const keys = [];
    for (let k = 0; k < 4; k++) {
        const key = [];
        for (let i = 0; i < 32; i++) key.push(Math.floor(Math.random() * 256));
        keys.push(key);
    }

    // ─── Layer 3: Multi-pass XOR encryption ───
    const encrypted = bytes.map((b, i) => {
        let v = b;
        v ^= keys[0][i % 32];
        v ^= keys[1][(i * 5 + 11) % 32];
        v ^= keys[2][(i * 17 + 23) % 32];
        v ^= keys[3][(i * 31 + 7) % 32];
        return v;
    });

    // ─── Layer 4: Chunk splitting (anti-pattern) ───
    const CHUNK_SIZE = 250;
    const chunks = [];
    for (let i = 0; i < encrypted.length; i += CHUNK_SIZE) {
        chunks.push(encrypted.slice(i, i + CHUNK_SIZE).join(','));
    }

    // ─── Layer 5: Random identifier generator ───
    const rnd = (n = 9) => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let s = '_';
        for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
        return s;
    };

    const v = {
        bxor: rnd(), concat: rnd(), char: rnd(), byte: rnd(),
        sub: rnd(), gmatch: rnd(), tonumber: rnd(), pcall: rnd(),
        loadstring: rnd(), type: rnd(), error: rnd(), tostring: rnd(),
        chunks: rnd(), k1: rnd(), k2: rnd(), k3: rnd(), k4: rnd(),
        data: rnd(), arr: rnd(), i: rnd(), n: rnd(), out: rnd(),
        src: rnd(), fn: rnd(), ok: rnd(), err: rnd(), chk: rnd(),
        expect: rnd()
    };

    // ─── Layer 6: Integrity checksum ───
    let checksum = 0;
    for (const b of bytes) {
        checksum = (checksum + b * 31 + 7) % 2147483647;
    }

    // ─── Build Lua decoder ───
    const chunksLua = chunks.map(c => `    "${c}"`).join(',\n');

    const lua = `-- Mawww Obfuscator | Heavy Protection
-- Generated: ${new Date().toISOString()}
-- Layers: UTF8 > 4xXOR > ChunkSplit > Checksum > RuntimeDecode
-- Universal Executor Compatible

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

-- Universal XOR (bit32 > bit > arithmetic fallback)
local ${v.bxor} = (function()
    if ${v.type}(bit32) == "table" and bit32.bxor then
        return function(a, b) return bit32.bxor(a, b) end
    end
    if ${v.type}(bit) == "table" and bit.bxor then
        return function(a, b) return bit.bxor(a, b) end
    end
    return function(a, b)
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
end)()

-- Encrypted chunks
local ${v.chunks} = {
${chunksLua}
}

-- Multi-layer keys
local ${v.k1} = {${keys[0].join(',')}}
local ${v.k2} = {${keys[1].join(',')}}
local ${v.k3} = {${keys[2].join(',')}}
local ${v.k4} = {${keys[3].join(',')}}

-- Reassemble
local ${v.data} = ${v.concat}(${v.chunks})

-- Parse byte array
local ${v.arr} = {}
local ${v.i} = 1
for ${v.n} in ${v.gmatch}(${v.data}, "([^,]+)") do
    ${v.arr}[${v.i}] = ${v.tonumber}(${v.n}) or 0
    ${v.i} = ${v.i} + 1
end

-- Multi-layer XOR decrypt
local ${v.out} = {}
for ${v.i} = 1, #${v.arr} do
    local ${v.n} = ${v.arr}[${v.i}]
    ${v.n} = ${v.bxor}(${v.n}, ${v.k1}[ ((${v.i} - 1) % 32) + 1 ])
    ${v.n} = ${v.bxor}(${v.n}, ${v.k2}[ (((${v.i} - 1) * 5  + 11) % 32) + 1 ])
    ${v.n} = ${v.bxor}(${v.n}, ${v.k3}[ (((${v.i} - 1) * 17 + 23) % 32) + 1 ])
    ${v.n} = ${v.bxor}(${v.n}, ${v.k4}[ (((${v.i} - 1) * 31 + 7 ) % 32) + 1 ])
    ${v.out}[${v.i}] = ${v.char}(${v.n})
end

-- Reconstruct source
local ${v.src} = ${v.concat}(${v.out})

-- Integrity check
local ${v.chk} = 0
for ${v.i} = 1, #${v.src} do
    ${v.chk} = (${v.chk} + ${v.byte}(${v.src}, ${v.i}) * 31 + 7) % 2147483647
end
if ${v.chk} ~= ${checksum} then
    ${v.error}("Mawww: integrity check failed")
end

-- Execute
local ${v.fn}, ${v.err} = ${v.loadstring}(${v.src})
if ${v.fn} then
    ${v.ok} = ${v.pcall}(${v.fn})
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
        showStatus('✅ Script obfuscated with heavy protection!', 'success');
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
        showStatus('❌ Nothing to download. Obfuscate a script first.', 'error');
        return;
    }

    const blob = new Blob([luaOutput.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mawww-obfuscated-${Date.now()}.lua`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus('💾 Downloaded obfuscated file!', 'success');
});

// ===== Copy Output =====
copyOutputBtn.addEventListener('click', async () => {
    if (!luaOutput.value) {
        showStatus('❌ Nothing to copy.', 'error');
        return;
    }
    const ok = await copyToClipboard(luaOutput.value);
    showStatus(ok ? '📋 Output copied!' : '❌ Copy failed.', ok ? 'success' : 'error');
});

// ===== Clear Input =====
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
    if (!luaOutput.value) {
        showStatus('❌ Nothing to publish. Obfuscate a script first.', 'error');
        return;
    }

    publishBtn.disabled = true;
    publishBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>
        Publishing...
    `;

    try {
        const res = await fetch('/api/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: luaOutput.value })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Server error ${res.status}: ${errText}`);
        }

        const data = await res.json();

        const loadstringCode =
`-- Mawww Obfuscator | Auto-generated Loadstring
-- Raw URL: ${data.url}
loadstring(game:HttpGet("${data.url}"))()`;

        rawUrlDisplay.textContent = data.url;
        loadstringOutput.value = loadstringCode;
        rawSection.style.display = 'block';
        rawSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        showStatus('🚀 Published! Loadstring is ready below.', 'success');
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
    showStatus(ok ? '📋 Loadstring copied! Paste into executor.' : '❌ Copy failed.', ok ? 'success' : 'error');
});

// ===== Open Raw URL =====
openRawBtn.addEventListener('click', () => {
    const url = rawUrlDisplay.textContent;
    if (url && url !== '—') {
        window.open(url, '_blank', 'noopener');
    }
});

// ===== Live counts =====
luaInput.addEventListener('input', updateCounts);

// Init
updateCounts();
