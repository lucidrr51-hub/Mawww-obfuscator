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
app.use(express.json({ limit: '20mb' }));

app.use(express.static(path.join(__dirname), {
    index: 'index.html',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
        else if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        else if (filePath.endsWith('.html')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
}));

// ============================================================
//  Prometheus-powered obfuscation (Lua-native)
//  Presets: Weak, Medium, Strong, Minify
//  Luau mode: --LuaU (untuk Roblox executor)
// ============================================================
const PROMETHEUS_DIR = '/app/Prometheus';
const PROMETHEUS_CLI = 'cli.lua';

function runPrometheus(source, preset) {
    return new Promise((resolve, reject) => {
        const id = crypto.randomBytes(8).toString('hex');
        const tmpIn = path.join('/tmp', `in_${id}.lua`);
        const tmpOut = path.join('/tmp', `out_${id}.lua`);

        try {
            fs.writeFileSync(tmpIn, source, 'utf8');
        } catch (e) {
            return reject(new Error(`Write temp failed: ${e.message}`));
        }

        const args = [
            PROMETHEUS_CLI,
            '--preset', preset,
            '--LuaU',
            '--nocolors',
            '--out', tmpOut,
            tmpIn
        ];

        let child;
        try {
            child = spawn('luajit', args, {
                cwd: PROMETHEUS_DIR,
                timeout: 180000
            });
        } catch (e) {
            cleanup(tmpIn, tmpOut);
            return reject(new Error(`Spawn failed: ${e.message}`));
        }

        let stderr = '';
        child.stderr.on('data', (d) => { stderr += d.toString(); });
        child.stdout.on('data', () => {});

        child.on('error', (err) => {
            cleanup(tmpIn, tmpOut);
            reject(new Error(`Process error: ${err.message}`));
        });

        child.on('close', (exitCode) => {
            cleanup(tmpIn);

            if (exitCode !== 0) {
                cleanup(tmpOut);
                return reject(new Error(
                    `Prometheus exited with code ${exitCode}\n${stderr || '(no stderr)'}`
                ));
            }

            if (!fs.existsSync(tmpOut)) {
                return reject(new Error('Prometheus produced no output file'));
            }

            let result;
            try {
                result = fs.readFileSync(tmpOut, 'utf8');
            } catch (e) {
                cleanup(tmpOut);
                return reject(new Error(`Read output failed: ${e.message}`));
            }
            cleanup(tmpOut);
            resolve(result);
        });
    });
}

function cleanup(...files) {
    for (const f of files) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
}

// ===== Healthcheck =====
app.get('/health', (req, res) => {
    const prometheusExists = fs.existsSync(path.join(PROMETHEUS_DIR, PROMETHEUS_CLI));
    res.status(200).json({
        status: 'ok',
        prometheus: prometheusExists ? 'ready' : 'missing',
        timestamp: new Date().toISOString()
    });
});

// ===== API: Obfuscate =====
app.post('/api/obfuscate', async (req, res) => {
    try {
        const { code, preset = 'Strong' } = req.body || {};

        if (!code || typeof code !== 'string' || !code.trim()) {
            return res.status(400).send('No code provided');
        }

        const allowedPresets = ['Minify', 'Weak', 'Medium', 'Strong'];
        const chosen = allowedPresets.includes(preset) ? preset : 'Strong';

        if (code.length > 500000) {
            return res.status(413).send('Code too large (max 500KB)');
        }

        const result = await runPrometheus(code, chosen);
        res.type('text/plain').send(result);
    } catch (err) {
        console.error('[obfuscate]', err);
        res.status(500).send(`Obfuscation error: ${err.message}`);
    }
});

// ===== API: Publish =====
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
    if (path.extname(req.path)) {
        return res.status(404).send('Not found');
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== Listen =====
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Mawww Obfuscator (Prometheus-powered) running on 0.0.0.0:${PORT}`);
    console.log(`   Prometheus dir: ${PROMETHEUS_DIR}`);
    console.log(`   Prometheus ready: ${fs.existsSync(path.join(PROMETHEUS_DIR, PROMETHEUS_CLI))}`);
});
