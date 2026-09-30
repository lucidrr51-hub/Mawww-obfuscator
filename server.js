const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;  // Railway inject PORT

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
app.use(express.static(__dirname, { index: 'index.html' }));

// ===== Healthcheck endpoint (Railway) =====
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== API: Obfuscate =====
app.post('/api/obfuscate', async (req, res) => {
    try {
        const { code, preset = 'Strong', luaVersion = 'LuaU' } = req.body || {};

        if (!code || typeof code !== 'string' || !code.trim()) {
            return res.status(400).send('No code provided');
        }

        const allowedPresets = ['Minify', 'Weak', 'Medium', 'Strong'];
        if (!allowedPresets.includes(preset)) {
            return res.status(400).send('Invalid preset');
        }

        const tempId = crypto.randomBytes(8).toString('hex');
        const tempInput = path.join('/tmp', `temp_${tempId}_in.lua`);
        const tempOutput = path.join('/tmp', `temp_${tempId}_out.lua`);
        fs.writeFileSync(tempInput, code, 'utf8');

        const cliPath = path.join(__dirname, 'Prometheus', 'cli.lua');
        if (!fs.existsSync(cliPath)) {
            fs.unlinkSync(tempInput);
            const fallback = megaVmWrap(code);
            return res.type('text/plain').send(fallback);
        }

        const args = [cliPath, '--preset', preset, '--out', tempOutput, '--nocolors'];
        if (luaVersion === 'LuaU') args.push('--LuaU');
        else args.push('--Lua51');
        args.push(tempInput);

        const luaBin = 'luajit';
        const child = spawn(luaBin, args, { timeout: 180000 });

        let stderr = '';
        child.stderr.on('data', (data) => { stderr += data.toString(); });
        child.stdout.on('data', () => {});

        child.on('error', () => {
            cleanup(tempInput, tempOutput);
            const fallback = megaVmWrap(code);
            res.type('text/plain').send(fallback);
        });

        child.on('close', (exitCode) => {
            cleanup(tempInput);
            let prometheusOutput = '';
            if (exitCode === 0 && fs.existsSync(tempOutput)) {
                prometheusOutput = fs.readFileSync(tempOutput, 'utf8');
                cleanup(tempOutput);
            } else {
                cleanup(tempOutput);
                prometheusOutput = code;
            }
            try {
                const finalOutput = megaVmWrap(prometheusOutput);
                res.type('text/plain').send(finalOutput);
            } catch (e) {
                res.status(500).send(`VM wrap error: ${e.message}`);
            }
        });
    } catch (err) {
        res.status(500).send(`Server error: ${err.message}`);
    }
});

function cleanup(...files) {
    for (const f of files) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
}

// ... (sisa kode megaVmWrap, publish, raw, SPA fallback tetap sama)

// ===== PENTING: Listen di 0.0.0.0 =====
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Mawww Ultra Obfuscator running on 0.0.0.0:${PORT}`);
});
