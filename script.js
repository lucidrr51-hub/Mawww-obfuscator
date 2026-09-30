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
//  MAWWW CUSTOM VM v6.0 — Bytecode Machine
//  - Random opcodes per obfuscation
//  - Register file + Stack + Dispatch table
//  - Decoy instructions (huge output, unreadable)
//  - Delta-safe: no getfenv/_ENV/debug.*/\ddd escapes
// ============================================================

function utf8Encode(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c < 0x80) out.push(c);
        else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
        else if (c < 0xD800 || c >= 0xE000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
        else {
            i++;
            c = 0x10000 + (((c & 0x3FF) << 10) | (str.charCodeAt(i) & 0x3FF));
            out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 0x3F), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
        }
    }
    return out;
}

function obfuscateLua(source) {
    if (!source || !source.trim()) {
        throw new Error('Please provide Lua source code to obfuscate.');
    }

    // ─── UTF-8 encode ───
    const bytes = utf8Encode(source);

    // ─── PRNG ───
    let seed = (Math.random() * 0xFFFFFFFF) >>> 0;
    const nxt = () => {
        let s = seed;
        s = (s ^ (s << 13)) >>> 0;
        s = (s ^ (s >>> 17)) >>> 0;
        s = (s ^ (s << 5)) >>> 0;
        seed = s;
        return seed;
    };
    const ri = (n) => nxt() % n;

    // ─── Random name generator ───
    const nm = (len) => {
        const cs = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let s = '_';
        for (let i = 0; i < (len || 10); i++) s += cs[ri(cs.length)];
        return s;
    };

    // ─── Unique random opcodes ───
    const usedOps = new Set();
    const newOp = () => {
        let o;
        do { o = ri(200) + 50; } while (usedOps.has(o));
        usedOps.add(o);
        return o;
    };

    const OPS = {
        PUSH:  newOp(), PUSH2: newOp(),
        NOP:   newOp(), NOP2:  newOp(),
        MOV:   newOp(), LOAD:  newOp(),
        ADD:   newOp(), XOR:   newOp(),
        CHECK: newOp(), BUILD: newOp(),
        EXEC:  newOp(), JMP:   newOp(),
        HALT:  newOp()
    };

    // ─── Build instruction table ───
    const ins = [];
    for (let i = 0; i < bytes.length; i++) {
        const key = ri(256);
        const enc = bytes[i] ^ key;

        // Decoy NOP
        ins.push([OPS.NOP, ri(256), ri(256), ri(256)]);
        // Decoy MOV
        ins.push([OPS.MOV, ri(16), ri(256), 0]);
        // Real PUSH
        ins.push([OPS.PUSH, enc, key, i & 0xFF]);
        // Decoy CHECK (setiap 3 byte)
        if (i % 3 === 0) ins.push([OPS.CHECK, ri(256), ri(256), 0]);
        // Decoy NOP2 (setiap 2 byte)
        if (i % 2 === 0) ins.push([OPS.NOP2, 0, 0, 0]);
        // Decoy LOAD tambahan (setiap 5 byte)
        if (i % 5 === 0) ins.push([OPS.LOAD, ri(16), ri(256), 0]);
    }

    // Final
    ins.push([OPS.BUILD, 0, 0, 0]);
    ins.push([OPS.EXEC,  0, 0, 0]);
    ins.push([OPS.HALT,  0, 0, 0]);

    // ─── Random variable names ───
    const N = {};
    ['r','s','n','p','buf','floor','chr','concat','pcall','type','err','tostr',
     'bx','ok1','t1','ok2','t2','B','hPush','hNop','hMov','hLoad','hAdd','hXor',
     'hCheck','hBuild','hExec','hJmp','hHalt','dispatch','code','lim','ins','o','h',
     'loadstr','fn','er','ok','i','a','b','c','x','y','acc','r2','p2']
    .forEach(k => N[k] = nm(11 + ri(4)));

    const insStr = ins.map(row => `    {${row.join(',')}}`).join(',\n');

    // ─── Output Lua ───
    const lua = `-- Mawww Custom VM v6.0
-- Generated: ${new Date().toISOString()}
-- Random opcodes | Register file | Dispatch table | Decoy instructions

local ${N.r}={}
local ${N.s}={}
local ${N.n}=0
local ${N.p}=1
local ${N.buf}=""
local ${N.floor}=math.floor
local ${N.chr}=string.char
local ${N.concat}=table.concat
local ${N.pcall}=pcall
local ${N.type}=type
local ${N.err}=error
local ${N.tostr}=tostring

-- Universal XOR
local ${N.bx}
do
    local ${N.ok1},${N.t1}=${N.pcall}(function() return bit32 end)
    if ${N.ok1} and ${N.type}(${N.t1})=="table" and ${N.t1}.bxor then
        local ${N.B}=${N.t1}
        ${N.bx}=function(${N.a},${N.b}) return ${N.B}.bxor(${N.a},${N.b}) end
    else
        local ${N.ok2},${N.t2}=${N.pcall}(function() return bit end)
        if ${N.ok2} and ${N.type}(${N.t2})=="table" and ${N.t2}.bxor then
            local ${N.B}=${N.t2}
            ${N.bx}=function(${N.a},${N.b}) return ${N.B}.bxor(${N.a},${N.b}) end
        else
            ${N.bx}=function(${N.a},${N.b})
                ${N.a}=${N.floor}(${N.a})
                ${N.b}=${N.floor}(${N.b})
                local ${N.r2},${N.p2}=0,1
                while ${N.a}>0 or ${N.b}>0 do
                    local ${N.x},${N.y}=${N.a}%2,${N.b}%2
                    if ${N.x}~=${N.y} then ${N.r2}=${N.r2}+${N.p2} end
                    ${N.a}=(${N.a}-${N.x})/2
                    ${N.b}=(${N.b}-${N.y})/2
                    ${N.p2}=${N.p2}*2
                end
                return ${N.r2}
            end
        end
    end
end

-- Instruction handlers
local ${N.hPush}=function(${N.a},${N.b},${N.c})
    ${N.n}=${N.n}+1
    ${N.s}[${N.n}]=${N.chr}(${N.floor}(${N.bx}(${N.a},${N.b})%256))
end
local ${N.hNop}=function(${N.a},${N.b},${N.c}) return ${N.a} end
local ${N.hMov}=function(${N.a},${N.b},${N.c}) ${N.r}[${N.a}]=${N.b} return ${N.b} end
local ${N.hLoad}=function(${N.a},${N.b},${N.c}) return ${N.r}[${N.a}] or 0 end
local ${N.hAdd}=function(${N.a},${N.b},${N.c}) return ${N.a}+${N.b} end
local ${N.hXor}=function(${N.a},${N.b},${N.c}) return ${N.bx}(${N.a},${N.b}) end
local ${N.hCheck}=function(${N.a},${N.b},${N.c})
    local ${N.acc}=0
    for ${N.i}=1,64 do ${N.acc}=${N.acc}+${N.i} end
    return ${N.acc}==2080
end
local ${N.hBuild}=function(${N.a},${N.b},${N.c})
    ${N.buf}=${N.concat}(${N.s})
    return ${N.buf}
end
local ${N.hExec}=function(${N.a},${N.b},${N.c})
    local ${N.loadstr}=loadstring
    if ${N.type}(${N.loadstr})~="function" then ${N.loadstr}=load end
    if ${N.type}(${N.loadstr})~="function" then
        ${N.err}("[VM] loadstring unavailable")
    end
    local ${N.fn},${N.er}=${N.loadstr}(${N.buf})
    if ${N.type}(${N.fn})~="function" then
        ${N.err}("[VM] decode failed: "..${N.tostr}(${N.er}))
    end
    local ${N.ok},${N.er}=${N.pcall}(${N.fn})
    if not ${N.ok} then
        ${N.err}("[VM] exec failed: "..${N.tostr}(${N.er}))
    end
end
local ${N.hJmp}=function(${N.a},${N.b},${N.c}) return ${N.a} end
local ${N.hHalt}=function(${N.a},${N.b},${N.c}) return nil end

-- Dispatch table
local ${N.dispatch}={
    [${OPS.PUSH}]=${N.hPush},
    [${OPS.PUSH2}]=${N.hPush},
    [${OPS.NOP}]=${N.hNop},
    [${OPS.NOP2}]=${N.hNop},
    [${OPS.MOV}]=${N.hMov},
    [${OPS.LOAD}]=${N.hLoad},
    [${OPS.ADD}]=${N.hAdd},
    [${OPS.XOR}]=${N.hXor},
    [${OPS.CHECK}]=${N.hCheck},
    [${OPS.BUILD}]=${N.hBuild},
    [${OPS.EXEC}]=${N.hExec},
    [${OPS.JMP}]=${N.hJmp},
    [${OPS.HALT}]=${N.hHalt},
}

-- Instruction table
local ${N.code}={
${insStr}
}

-- VM execution loop
local ${N.lim}=#${N.code}
while ${N.p}<=${N.lim} do
    local ${N.ins}=${N.code}[${N.p}]
    local ${N.o}=${N.ins}[1]
    local ${N.h}=${N.dispatch}[${N.o}]
    if ${N.h} then
        ${N.h}(${N.ins}[2],${N.ins}[3],${N.ins}[4])
    end
    ${N.p}=${N.p}+1
end
`;

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
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
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

obfuscateBtn.addEventListener('click', () => {
    try {
        const result = obfuscateLua(luaInput.value);
        luaOutput.value = result;
        publishBtn.disabled = false;
        rawSection.style.display = 'none';
        showStatus(`🔒 VM v6 obfuscated! Output: ${result.length.toLocaleString()} chars.`, 'success');
        updateCounts();
    } catch (err) {
        showStatus('❌ ' + err.message, 'error');
        publishBtn.disabled = true;
    }
});

uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showStatus('❌ Max 5MB.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
        luaInput.value = ev.target.result;
        updateCounts();
        showStatus(`📁 ${file.name}`, 'success');
    };
    reader.readAsText(file);
    fileInput.value = '';
});

downloadBtn.addEventListener('click', () => {
    if (!luaOutput.value) { showStatus('❌ Nothing.', 'error'); return; }
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

copyOutputBtn.addEventListener('click', async () => {
    if (!luaOutput.value) { showStatus('❌ Nothing.', 'error'); return; }
    const ok = await copyToClipboard(luaOutput.value);
    showStatus(ok ? '📋 Copied!' : '❌ Copy failed.', ok ? 'success' : 'error');
});

clearInputBtn.addEventListener('click', () => {
    luaInput.value = '';
    luaOutput.value = '';
    publishBtn.disabled = true;
    rawSection.style.display = 'none';
    updateCounts();
    showStatus('Cleared.', 'success');
});

const ORIGINAL_PUBLISH_HTML = publishBtn.innerHTML;

publishBtn.addEventListener('click', async () => {
    if (!luaOutput.value) { showStatus('❌ Nothing.', 'error'); return; }
    publishBtn.disabled = true;
    publishBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Publishing...`;
    try {
        const res = await fetch('/api/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: luaOutput.value })
        });
        if (!res.ok) throw new Error(`Server ${res.status}`);
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

copyLoadstringBtn.addEventListener('click', async () => {
    const text = loadstringOutput.value;
    if (!text) return;
    const ok = await copyToClipboard(text);
    showStatus(ok ? '📋 Loadstring copied!' : '❌ Copy failed.', ok ? 'success' : 'error');
});

openRawBtn.addEventListener('click', () => {
    const url = rawUrlDisplay.textContent;
    if (url && url !== '—') window.open(url, '_blank', 'noopener');
});

luaInput.addEventListener('input', updateCounts);
updateCounts();
