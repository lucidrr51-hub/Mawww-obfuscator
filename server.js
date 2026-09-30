const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

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
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname, { index: 'index.html' }));

// ===== API: Obfuscate (Prometheus) =====
app.post('/api/obfuscate', async (req, res) => {
    try {
        const { code, preset = 'Strong', luaVersion = 'LuaU' } = req.body || {};

        if (!code || typeof code !== 'string' || !code.trim()) {
            return res.status(400).send('No code provided');
        }

        // Validasi preset
        const allowedPresets = ['Minify', 'Weak', 'Medium', 'Strong'];
        if (!allowedPresets.includes(preset)) {
            return res.status(400).send('Invalid preset');
        }

        // Tulis input ke file temporary
        const tempId = crypto.randomBytes(8).toString('hex');
        const tempInput = path.join(__dirname, `temp_${tempId}_in.lua`);
        const tempOutput = path.join(__dirname, `temp_${tempId}_out.lua`);
        fs.writeFileSync(tempInput, code, 'utf8');

        // Path ke CLI Prometheus
        const cliPath = path.join(__dirname, 'Prometheus', 'cli.lua');
        if (!fs.existsSync(cliPath)) {
            fs.unlinkSync(tempInput);
            return res.status(500).send('Prometheus CLI not found. Deploy with Dockerfile.');
        }

        // Argumen CLI
        const args = [
            cliPath,
            '--preset', preset,
            '--out', tempOutput,
            '--nocolors'
        ];
        if (luaVersion === 'LuaU') {
            args.push('--LuaU');
        } else {
            args.push('--Lua51');
        }
        args.push(tempInput);

        // Jalankan LuaJIT / Lua
        const luaBin = process.env.LUA_BIN || 'luajit';
        const child = spawn(luaBin, args, { timeout: 120000 });

        let stderr = '';
        child.stderr.on('data', (data) => { stderr += data.toString(); });
        child.stdout.on('data', () => {}); // abaikan stdout

        child.on('error', (err) => {
            cleanup(tempInput, tempOutput);
            return res.status(500).send(`Spawn error: ${err.message}`);
        });

        child.on('close', (exitCode) => {
            cleanup(tempInput);

            if (exitCode !== 0) {
                cleanup(tempOutput);
                return res.status(500).send(
                    `Prometheus error (exit ${exitCode}):\n${stderr || 'Unknown error'}`
                );
            }

            if (!fs.existsSync(tempOutput)) {
                return res.status(500).send('Prometheus produced no output file');
            }

            try {
                const result = fs.readFileSync(tempOutput, 'utf8');
                cleanup(tempOutput);
                res.type('text/plain').send(result);
            } catch (e) {
                cleanup(tempOutput);
                res.status(500).send(`Read error: ${e.message}`);
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

// ===== API: Publish code → returns random raw URL =====
app.post('/api/publish', (req, res) => {
    const { code } = req.body || {};
    if (!code || typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ error: 'No code provided' });
    }

    const random = crypto.randomBytes(6).toString('hex');
    const id = `${Date.now().toString(36)}${random}`;

    const db = loadDB();
    db[id] = {
        code,
        createdAt: new Date().toISOString(),
        size: Buffer.byteLength(code, 'utf8')
    };
    saveDB(db);

    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const rawUrl = `${proto}://${host}/raw/${id}.lua`;

    res.json({ id, url: rawUrl, size: db[id].size });
});

// ===== Raw endpoint =====
app.get('/raw/:id', (req, res) => {
    const id = req.params.id.replace(/\.lua$/i, '');
    const db = loadDB();
    const entry = db[id];

    if (!entry) {
        res.status(404).type('text/plain').send('-- Script not found or expired.');
        return;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(entry.code);
});

// ===== Stats =====
app.get('/api/stats', (req, res) => {
    const db = loadDB();
    res.json({ total: Object.keys(db).length });
});

// ===== SPA fallback =====
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Mawww Obfuscator (Prometheus) running on port ${PORT}`);
});
