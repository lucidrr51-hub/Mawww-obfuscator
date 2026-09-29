// ===== DOM Elements =====
const luaInput = document.getElementById('luaInput');
const luaOutput = document.getElementById('luaOutput');
const obfuscateBtn = document.getElementById('obfuscateBtn');
const publishBtn = document.getElementById('publishBtn');
const clearInputBtn = document.getElementById('clearInputBtn');
const copyOutputBtn = document.getElementById('copyOutputBtn');
const statusMessage = document.getElementById('statusMessage');
const inputCount = document.getElementById('inputCount');
const outputCount = document.getElementById('outputCount');

// ===== Lua Obfuscator Core =====
// This is a basic obfuscator that wraps code in a loadstring-compatible format.
// For production use, consider integrating a more advanced obfuscation library.

function obfuscateLua(source) {
    if (!source || source.trim().length === 0) {
        throw new Error('Please provide Lua source code to obfuscate.');
    }

    // Step 1: Convert source to a safe string literal
    const escaped = source
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');

    // Step 2: Generate a random variable name for the payload
    const randVar = '_' + Math.random().toString(36).substring(2, 10);

    // Step 3: Generate a simple XOR key
    const key = Math.floor(Math.random() * 200) + 20;

    // Step 4: XOR-encode the string bytes for basic obfuscation
    let encoded = '';
    for (let i = 0; i < escaped.length; i++) {
        encoded += String.fromCharCode(escaped.charCodeAt(i) ^ (key + i % 7));
    }

    // Step 5: Build the obfuscated output
    // This produces a loadstring-compatible result
    const obfuscated = `-- Mawww Obfuscator | Roblox Raw Publisher
-- Generated: ${new Date().toISOString()}
-- Protected with XOR encryption

local ${randVar} = "${encodeToLuaString(encoded)}"
local ${randVar}_key = ${key}
local ${randVar}_decoded = ""
for i = 1, #${randVar} do
    ${randVar}_decoded = ${randVar}_decoded .. string.char(
        string.byte(${randVar}, i) ~ (${randVar}_key + (i - 1) % 7)
    )
end
local ${randVar}_fn = loadstring(${randVar}_decoded)
if ${randVar}_fn then
    ${randVar}_fn()
end`;

    return obfuscated;
}

// Helper: encode a string safely for Lua
function encodeToLuaString(str) {
    let result = '';
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code > 126 || code < 32) {
            result += '\\' + code;
        } else if (str[i] === '"') {
            result += '\\"';
        } else if (str[i] === '\\') {
            result += '\\\\';
        } else {
            result += str[i];
        }
    }
    return result;
}

// ===== UI Handlers =====
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

// Obfuscate button
obfuscateBtn.addEventListener('click', () => {
    try {
        const source = luaInput.value;
        const result = obfuscateLua(source);
        luaOutput.value = result;
        publishBtn.disabled = false;
        showStatus('✅ Script obfuscated successfully!', 'success');
        updateCounts();
    } catch (err) {
        showStatus('❌ ' + err.message, 'error');
        publishBtn.disabled = true;
    }
});

// Publish button (copies raw output)
publishBtn.addEventListener('click', async () => {
    if (!luaOutput.value) {
        showStatus('❌ Nothing to publish. Obfuscate a script first.', 'error');
        return;
    }
    try {
        await navigator.clipboard.writeText(luaOutput.value);
        showStatus('📋 Raw loadstring copied to clipboard! Paste it into your executor.', 'success');
    } catch {
        // Fallback for older browsers
        luaOutput.select();
        document.execCommand('copy');
        showStatus('📋 Copied to clipboard!', 'success');
    }
});

// Clear input
clearInputBtn.addEventListener('click', () => {
    luaInput.value = '';
    luaOutput.value = '';
    publishBtn.disabled = true;
    updateCounts();
    showStatus('Cleared.', 'success');
});

// Copy output
copyOutputBtn.addEventListener('click', async () => {
    if (!luaOutput.value) {
        showStatus('❌ Nothing to copy.', 'error');
        return;
    }
    try {
        await navigator.clipboard.writeText(luaOutput.value);
        showStatus('📋 Output copied!', 'success');
    } catch {
        luaOutput.select();
        document.execCommand('copy');
        showStatus('📋 Output copied!', 'success');
    }
});

// Live character count
luaInput.addEventListener('input', updateCounts);
luaOutput.addEventListener('input', updateCounts);

// Initialize
updateCounts();
