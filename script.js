const $ = (id) => document.getElementById(id);

let lastOutput = '';

// ---------- Fetch dari raw URL ----------
async function loadFromUrl() {
    const url = $('rawUrl').value.trim();
    if (!url) {
        $('status').textContent = 'Masukkan raw URL dulu.';
        return;
    }
    if (!/^https?:\/\//i.test(url)) {
        $('status').textContent = 'URL harus diawali http:// atau https://';
        return;
    }

    $('status').textContent = 'Fetching ' + url + ' ...';
    try {
        const res = await fetch('/api/fetch-raw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            $('status').textContent = 'Fetch gagal: ' + (data.error || 'unknown');
            return;
        }
        $('input').value = data.code;
        $('status').textContent = `Berhasil load ${data.code.length} bytes dari URL.`;
    } catch (err) {
        $('status').textContent = 'Fetch error: ' + err.message;
    }
}

// ---------- Obfuscate ----------
async function obfuscate() {
    const code = $('input').value.trim();
    const preset = $('preset')?.value || 'Strong';
    const btn = $('obfBtn');
    const out = $('output');

    if (!code) {
        out.value = 'ERROR: No code provided.';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Obfuscating...';
    out.value = 'Processing on server...';

    const startTime = Date.now();

    try {
        const res = await fetch('/api/obfuscate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, preset })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            out.value = 'ERROR: ' + (data.error || 'Unknown error');
            return;
        }

        out.value = data.output;
        lastOutput = data.output;

        // Generate loadstring
        generateLoadstring();

        const ms = Date.now() - startTime;
        $('status').textContent =
            `Done in ${ms}ms • Build: ${data.buildId.slice(0, 8)} • Size: ${data.output.length} bytes`;
    } catch (err) {
        out.value = 'ERROR: ' + err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Obfuscate';
    }
}

// ---------- Loadstring generator ----------
function generateLoadstring() {
    const box = $('lsBox');
    const ls = $('lsOutput');
    const rawUrl = $('rawUrl').value.trim();

    // Kalau user udah masukin raw URL, pakai itu. Kalau belum, pakai placeholder.
    const url = rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : 'YOUR_RAW_URL_HERE';

    const snippet =
`loadstring(game:HttpGet("${url}"))()`;

    ls.value = snippet;
    box.classList.add('visible');
}

// ---------- Copy / Download ----------
function copyOutput() {
    const out = $('output');
    out.select();
    document.execCommand('copy');
    $('status').textContent = 'Output copied to clipboard.';
}

function copyLoadstring() {
    const ls = $('lsOutput');
    ls.select();
    document.execCommand('copy');
    $('status').textContent = 'Loadstring copied to clipboard.';
}

function downloadOutput() {
    const out = $('output').value;
    if (!out) return;
    const blob = new Blob([out], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mawww_${Date.now()}.lua`;
    a.click();
    URL.revokeObjectURL(url);
}

function uploadFile(ev) {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { $('input').value = e.target.result; };
    reader.readAsText(file);
}

// ---------- Wire buttons ----------
document.addEventListener('DOMContentLoaded', () => {
    $('fetchBtn')?.addEventListener('click', loadFromUrl);
    $('obfBtn')?.addEventListener('click', obfuscate);
    $('copyBtn')?.addEventListener('click', copyOutput);
    $('copyLsBtn')?.addEventListener('click', copyLoadstring);
    $('dlBtn')?.addEventListener('click', downloadOutput);
    $('fileInput')?.addEventListener('change', uploadFile);
});
