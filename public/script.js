const $ = (id) => document.getElementById(id);

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

function copyOutput() {
    const out = $('output');
    out.select();
    document.execCommand('copy');
    $('status').textContent = 'Copied to clipboard.';
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

// wire buttons
document.addEventListener('DOMContentLoaded', () => {
    $('obfBtn')?.addEventListener('click', obfuscate);
    $('copyBtn')?.addEventListener('click', copyOutput);
    $('dlBtn')?.addEventListener('click', downloadOutput);
    $('fileInput')?.addEventListener('change', uploadFile);
});
