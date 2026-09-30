const express = require('express');
const rateLimit = require('express-rate-limit');
const PQueue = require('p-queue').default;
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- CONFIG ----------
const PROMETHEUS_DIR = path.join(__dirname, 'Prometheus');
const PROMETHEUS_CLI = path.join(PROMETHEUS_DIR, 'cli.lua');
const TEMP_DIR = path.join(os.tmpdir(), 'mawww-obs');
const MAX_INPUT_BYTES = 15 * 1024 * 1024; // 15 MB
const EXEC_TIMEOUT_MS = 180000;

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ---------- MIDDLEWARE ----------
app.use(express.json({ limit: '20mb' }));

// Serve static files from ROOT (bukan 'public')
app.use(express.static(__dirname));

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, slow down.' }
});
app.use('/api/', limiter);

// ---------- QUEUE (max 2 concurrent jobs) ----------
const queue = new PQueue({ concurrency: 2 });

// ---------- HEALTH CHECK ----------
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        queue: { pending: queue.pending, size: queue.size }
    });
});

// ---------- ROOT ROUTE ----------
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ---------- CORE: run Prometheus ----------
function runPrometheus(inputPath, outputPath, preset) {
    return new Promise((resolve, reject) => {
        const args = [
            PROMETHEUS_CLI,
            '--preset', preset,
            '--LuaU',
            '--nocolors',
            '--out', outputPath,
            inputPath
        ];
        const child = spawn('luajit', args, {
            cwd: PROMETHEUS_DIR,
            timeout: EXEC_TIMEOUT_MS
        });

        let stderr = '';
        child.stderr.on('data', d => { stderr += d.toString(); });
        child.on('error', reject);
        child.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`Prometheus exited with ${code}: ${stderr.slice(0, 500)}`));
        });
    });
}

// ---------- STRING ENCRYPTION (per-build XOR) ----------
function encryptString(str, key) {
    const bytes = Buffer.from(str, 'utf8');
    const out = Buffer.alloc(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
        out[i] = bytes[i] ^ ((key + i * 3) & 0xFF);
    }
    return out.toString('base64');
}

// ---------- GUARD INJECTION ----------
function buildGuard() {
    return `
-- Mawww Guard Layer
do
    local _rawget, _pcall, _type = rawget, pcall, type
    local function _verify_env()
        if _type(_rawget) ~= "function" or _type(_pcall) ~= "function" then
            return false
        end
        return true
    end
    if not _verify_env() then return end

    if debug and debug.getinfo then
        for lvl = 2, 15 do
            local ok, info = _pcall(debug.getinfo, lvl)
            if not ok or not info then break end
            local src = tostring(info.source or ""):lower()
            local name = tostring(info.name or ""):lower()
            if src:find("dump") or src:find("spy") or src:find("deobf")
                or src:find("decompile") or src:find("saveinstance")
                or name:find("dump") or name:find("deobf") then
                return
            end
        end
    end

    if islclosure and loadstring and islclosure(loadstring) then return end

    local bad = {
        "ScriptDumper","ConstantDumper","BytecodeDumper","LuauDumper",
        "SimpleSpy","DarkDex","Hydroxide","TurtleSpy","DexOutput"
    }
    local env = (getgenv and getgenv()) or _G
    for i = 1, #bad do
        if env[bad[i]] ~= nil then return end
    end
end
`;
}

// ---------- WRAP: guard + encrypted constants ----------
function wrapOutput(luaCode, buildKey) {
    const guard = buildGuard();
    const keyHex = buildKey.toString('hex');

    // Encrypt the entire body as a base64 string
    const encryptedBody = encryptString(luaCode, buildKey.readUInt32BE(0));

    return `${guard}
-- Build key: ${keyHex}
local __MAWWW_KEY = tonumber("${keyHex}", 16) or 0
local __MAWWW_CHUNK = [==[${encryptedBody}]==]
local function __mawww_decrypt(s, k)
    local b = {}
    for i = 1, #s do
        b[i] = string.char((string.byte(s, i) ~ (k + i * 3)) % 256)
    end
    return table.concat(b)
end
local __mawww_loaded = loadstring or load
local __mawww_decoded = __mawww_decrypt(__MAWWW_CHUNK, __MAWWW_KEY % 256)
__mawww_loaded(__mawww_decoded)()
`;
}

// ---------- CLEANUP ----------
function safeUnlink(p) {
    try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
}

// ---------- API: OBFUSCATE ----------
app.post('/api/obfuscate', async (req, res) => {
    const { code, preset } = req.body || {};
    if (typeof code !== 'string' || code.trim().length === 0) {
        return res.status(400).json({ error: 'No code provided.' });
    }
    if (Buffer.byteLength(code, 'utf8') > MAX_INPUT_BYTES) {
        return res.status(413).json({ error: 'Input too large (max 15MB).' });
    }

    const allowedPresets = ['Weak', 'Medium', 'Strong', 'Minify'];
    const chosen = allowedPresets.includes(preset) ? preset : 'Strong';

    const id = uuidv4();
    const inPath = path.join(TEMP_DIR, `${id}_in.lua`);
    const outPath = path.join(TEMP_DIR, `${id}_out.lua`);

    try {
        fs.writeFileSync(inPath, code, 'utf8');

        const buildKey = crypto.randomBytes(16);

        const result = await queue.add(async () => {
            await runPrometheus(inPath, outPath, chosen);
            const raw = fs.readFileSync(outPath, 'utf8');
            return wrapOutput(raw, buildKey);
        });

        res.json({ success: true, output: result, buildId: id });
    } catch (err) {
        console.error('[obfuscate]', err.message);
        res.status(500).json({ error: err.message || 'Obfuscation failed.' });
    } finally {
        safeUnlink(inPath);
        safeUnlink(outPath);
    }
});

// ---------- API: QUEUE STATUS ----------
app.get('/api/status', (req, res) => {
    res.json({ pending: queue.pending, size: queue.size, concurrency: queue.concurrency });
});

// ---------- START ----------
app.listen(PORT, () => {
    console.log(`[mawww] listening on ${PORT}`);
});
