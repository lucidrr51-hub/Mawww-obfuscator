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
const presetSelect = document.getElementById('presetSelect');

const rawSection = document.getElementById('rawSection');
const rawUrlDisplay = document.getElementById('rawUrlDisplay');
const loadstringOutput = document.getElementById('loadstringOutput');
const copyLoadstringBtn = document.getElementById('copyLoadstringBtn');
const openRawBtn = document.getElementById('openRawBtn');

// ============================================================
//  UI Helpers
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
        }, 5000);
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

// ============================================================
//  Obfuscate (kirim ke server)
// ============================================================
async function obfuscateLua(source) {
    if (!source || !source.trim()) {
        throw new Error('Please provide Lua source code to obfuscate.');
    }
    const preset = presetSelect ? presetSelect.value : 'Strong';
    const response = await fetch('/api/obfuscate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: source, preset })
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Server error ${response.status}`);
    }
    return await response.text();
}

obfuscateBtn.addEventListener('click', async () => {
    if (!luaInput.value.trim()) {
        showStatus('❌ Please provide Lua source code.', 'error');
        return;
    }

    const originalHTML = obfuscateBtn.innerHTML;
    obfuscateBtn.disabled = true;
    obfuscateBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
        </svg>
        Obfuscating...
    `;
    showStatus('⏳ Memproses obfuscation...', 'info');

    try {
        const result = await obfuscateLua(luaInput.value);
        luaOutput.value = result;
        publishBtn.disabled = false;
        rawSection.style.display = 'none';
        showStatus(`🔒 Obfuscated! Output: ${result.length.toLocaleString()} chars.`, 'success');
        updateCounts();
    } catch (err) {
        showStatus('❌ ' + err.message, 'error');
        publishBtn.disabled = true;
    } finally {
        obfuscateBtn.disabled = false;
        obfuscateBtn.innerHTML = originalHTML;
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
    if (!luaOutput.value) { showStatus('❌ Nothing to download.', 'error'); return; }
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

// ===== Open Raw URL =====
openRawBtn.addEventListener('click', () => {
    const url = rawUrlDisplay.textContent;
    if (url && url !== '—') window.open(url, '_blank', 'noopener');
});

// ===== Live counts =====
luaInput.addEventListener('input', updateCounts);

// Init
updateCounts();
