const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { compile } = require('./engine/compiler');

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi Multer untuk menerima file upload
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fungsi untuk membangun output Lua akhir
function buildLuaOutput(protos, key) {
    const vmRuntimePath = path.join(__dirname, 'engine', 'vm.lua');
    
    // Baca file vm.lua
    let vmRuntime = fs.readFileSync(vmRuntimePath, 'utf8');

    // PENTING: JANGAN HAPUS `return runVM` DARI vm.lua!
    // Kode lama Anda menghapus baris ini, yang menyebabkan VM tidak pernah berjalan.
    // Kita biarkan vm.lua apa adanya.

    const bytecode = `-- Mawww VM Bytecode (Build Key: ${key.toString(16)})
local __KEY = ${key}
local function __xor_str(s, k)
    local out = {}
    for i = 1, #s do
        out[i] = string.char((string.byte(s, i) ~ ((k + (i - 1) * 3) % 256)) % 256)
    end
    return table.concat(out)
end
local __PROTOS = ${JSON.stringify(protos, null, 4)}
local function __decrypt_k(p)
    for i = 1, #p.K do
        if type(p.K[i]) == "string" then
            p.K[i] = __xor_str(p.K[i], __KEY)
        end
    end
end
for _, p in ipairs(__PROTOS) do __decrypt_k(p) end
for i = 1, #__PROTOS do __PROTOS[i].P = __PROTOS end
`;

    // Fallback environment yang kuat untuk Delta dan eksekutor lainnya
    const runner = `
local __env = (getgenv and getgenv()) or (getfenv and getfenv(0)) or _G
local __run = runVM
__run(__PROTOS[1], {}, __env, {...})
`;

    return `-- Mawww Obfuscated Script\n${vmRuntime}\n${bytecode}\n${runner}`;
}

// Endpoint untuk obfuscate
app.post('/obfuscate', upload.single('script'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No script file uploaded.' });
        }

        const luaCode = req.file.buffer.toString('utf8');
        
        // Compile Lua ke bytecode Mawww
        const { protos, key } = compile(luaCode);
        
        // Bangun output akhir
        const finalScript = buildLuaOutput(protos, key);

        res.setHeader('Content-Type', 'text/plain');
        res.send(finalScript);
    } catch (err) {
        console.error('Compilation Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint untuk health check
app.get('/', (req, res) => {
    res.send('Mawww Obfuscator Server is running.');
});

app.listen(PORT, () => {
    console.log(`Mawww Server berjalan di http://localhost:${PORT}`);
});
