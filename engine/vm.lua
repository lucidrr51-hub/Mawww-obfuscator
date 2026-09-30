-- ==========================================================
-- Mawww VM Obfuscator - Full Standalone Runtime (Fixed)
-- Perbaikan: Environment fallback, Error handling pcall, 
-- Nil-safety pada GETMETHOD, dan Guard pada Closure.
-- ==========================================================

-- 1. Anti-Tamper & Anti-Dumper (Diperkuat dengan pengecekan tipe loadstring)
do
    local _rawget, _pcall, _type = rawget, pcall, type
    if _type(_rawget) ~= "function" or _type(_pcall) ~= "function" then return end
    
    -- Pengecekan loadstring yang lebih aman (mencegah error jika loadstring nil)
    if islclosure and loadstring and _type(loadstring) == "function" and islclosure(loadstring) then return end
    
    local bad = {"ScriptDumper","ConstantDumper","BytecodeDumper","LuauDumper","SimpleSpy","DarkDex","Hydroxide","TurtleSpy"}
    local env = (getgenv and getgenv()) or _G
    for i = 1, #bad do 
        if env[bad[i]] ~= nil then return end 
    end
    
    if debug and debug.getinfo then
        for lvl = 2, 12 do
            local ok, info = _pcall(debug.getinfo, lvl)
            if not ok or not info then break end
            local s = tostring(info.source or ""):lower()
            if s:find("dump") or s:find("deobf") or s:find("decompile") then return end
        end
    end
end

-- 2. Bytecode & Key (Data Obfuscated Anda)
local __KEY = 236
local function __xor_str(s, k)
    local out = {}
    for i = 1, #s do
        out[i] = string.char((string.byte(s, i) ~ ((k + (i - 1) * 3) % 256)) % 256)
    end
    return table.concat(out)
end

local __PROTOS = {{
        K = {"\132\155\134\133\139\193\209\46\118\102\125\35\119\122\98\113\105\125\87\86\77\89\77\94\90\67\95\83\52\109\37\38\33\96\63\52\47\44\41\22\73\86\90\93\95\62\23\14\11\8\247\245\236\234\250\244\187\229\255\251\211\140\206\204\205\203\193\154\213\218\215\175\235\170\171\186\167\164\190\172\190\170\146\129\137\159\139\223\128\143\142", "\156\140\147\153\148", "\156\157\155\155\140", "\183\162\147\130\143\140\163\33\87\100\120\100\96\103\54\123\121\109\74\68\91\66\66\17\80\94\80\92\44\34\40\34\45\33\124", "\155\142\128\155", "\183\162\147\130\143\140\163\33\67\102\109\108\124\51\122\118\125\123\24"},
        insts = {{1,1,0,0},{2,0,1,0},{22,4,1,0},{29,6,2,0},{2,5,6,0},{24,4,1,1},{2,7,4,0},{2,2,7,0},{2,8,2,0},{28,8,6,0},{22,9,2,0},{1,11,3,0},{2,10,11,0},{24,9,1,1},{2,12,9,0},{26,0,7,0},{22,13,4,0},{1,16,5,0},{2,14,16,0},{2,17,3,0},{2,15,17,0},{24,13,2,1},{2,18,13,0}},
        numParams = 0,
        isVararg = true,
        upvals = {}
    },{
        K = {"\139\142\159\144", "\164\155\134\133\191\158\138", "", "\137\157\128\154\138", "\191\128\135\135\155\158\222\106\107\116\101\99\119\51\119\109\125\106\2\66\73\76\79\93\20\83\83\16\38\38\50\42\36\97", "\128\128\147\145\139\143\140\104\106\96", "\152\150\130\144", "\138\154\156\150\140\146\145\111", "\171\142\149\148\148\219\157\110\105\119\99\97\117\51\101\122\110\118\82\81\6"},
        insts = {{22,1,0,0},{36,2,1,1},{30,5,0,0},{2,4,5,0},{24,2,2,1},{2,6,2,0},{2,0,6,0},{2,7,0,0},{16,8,7,0},{2,9,0,0},{1,10,2,0},{10,11,9,10},{2,12,8,0},{27,12,1,0},{2,12,11,0},{28,12,6,0},{22,13,3,0},{1,15,4,0},{2,14,15,0},{24,13,1,1},{2,16,13,0},{26,0,0,0},{22,18,5,0},{2,20,0,0},{2,19,20,0},{24,18,1,1},{2,21,18,0},{2,17,21,0},{22,22,6,0},{2,24,17,0},{2,23,24,0},{24,22,1,1},{2,25,22,0},{1,26,7,0},{11,27,25,26},{28,27,6,0},{22,28,3,0},{1,30,8,0},{2,29,30,0},{24,28,1,1},{2,31,28,0},{26,0,0,0},{2,32,17,0},{24,32,0,1},{2,33,32,0}},
        numParams = 0,
        isVararg = false,
        upvals = {{parentReg = 0}}
    }}

local function __decrypt_k(p)
    for i = 1, #p.K do
        if type(p.K[i]) == "string" then
            p.K[i] = __xor_str(p.K[i], __KEY)
        end
    end
end
for _, p in ipairs(__PROTOS) do __decrypt_k(p) end
for i = 1, #__PROTOS do __PROTOS[i].P = __PROTOS end

-- 3. VM Runtime (DIPERBAIKI)
local unpack = table.unpack or unpack

local function runVM(proto, upvals, env, varargs)
    local K = proto.K
    local insts = proto.insts
    local Reg = {}
    local PC = 1

    for i = 1, #K do
        local k = K[i]
        if type(k) == "table" and k.__enc then
            K[i] = k.__enc
        end
    end

    varargs = varargs or {}

    -- Perbaikan 1: Guard pada makeClosure untuk mencegah error 'sub' nil
    local function makeClosure(protoIdx)
        local sub = proto.P and proto.P[protoIdx] or nil
        if not sub then 
            return function() end 
        end
        return function(...)
            return runVM(sub, Reg, env, {...})
        end
    end

    local function getIndex(obj, key)
        if obj == nil then error("attempt to index nil value", 2) end
        if type(obj) == "table" or type(obj) == "userdata" then
            return obj[key]
        end
        local mt = getmetatable(obj)
        if mt and mt.__index then
            local idx = mt.__index
            if type(idx) == "function" then return idx(obj, key) end
            return idx[key]
        end
        error("attempt to index " .. type(obj), 2)
    end

    local function setIndex(obj, key, val)
        if obj == nil then error("attempt to index nil value", 2) end
        if type(obj) == "table" then
            obj[key] = val
            return
        end
        local mt = getmetatable(obj)
        if mt and mt.__newindex then
            local ni = mt.__newindex
            if type(ni) == "function" then return ni(obj, key, val) end
            ni[key] = val
            return
        end
        error("attempt to index " .. type(obj), 2)
    end

    -- Perbaikan 2: doCall dibungkus pcall agar error dari fungsi Lua tidak crash total
    local function doCall(base, nargs, nret)
        local f = Reg[base]
        local args = {}
        for i = 1, nargs do args[i] = Reg[base + i] end
        if type(f) ~= "function" then
            local mt = type(f) == "table" and getmetatable(f)
            if mt and mt.__call then f = mt.__call end
            if type(f) ~= "function" then error("attempt to call " .. type(f), 2) end
        end
        
        local success, result = pcall(f, unpack(args, 1, nargs))
        if not success then
            error("Mawww VM Runtime Error: " .. tostring(result), 2)
        end
        
        local r = {result}
        if nret == 0 then return end
        for i = 1, nret do
            Reg[base + i - 1] = r[i]
        end
        return r
    end

    while PC <= #insts do
        local ins = insts[PC]
        local op = ins[1]
        local a, b, c = ins[2], ins[3], ins[4]
        PC = PC + 1

        if op == 1 then
            Reg[a] = K[b + 1]
        elseif op == 2 then
            Reg[a] = Reg[b]
        elseif op == 3 then
            Reg[a] = Reg[b] + Reg[c]
        elseif op == 4 then
            Reg[a] = Reg[b] - Reg[c]
        elseif op == 5 then
            Reg[a] = Reg[b] * Reg[c]
        elseif op == 6 then
            Reg[a] = Reg[b] / Reg[c]
        elseif op == 7 then
            Reg[a] = Reg[b] % Reg[c]
        elseif op == 8 then
            Reg[a] = Reg[b] ^ Reg[c]
        elseif op == 9 then
            Reg[a] = tostring(Reg[b]) .. tostring(Reg[c])
        elseif op == 10 then
            Reg[a] = (Reg[b] == Reg[c])
        elseif op == 11 then
            Reg[a] = (Reg[b] ~= Reg[c])
        elseif op == 12 then
            Reg[a] = (Reg[b] < Reg[c])
        elseif op == 13 then
            Reg[a] = (Reg[b] <= Reg[c])
        elseif op == 14 then
            Reg[a] = (Reg[b] > Reg[c])
        elseif op == 15 then
            Reg[a] = (Reg[b] >= Reg[c])
        elseif op == 16 then
            Reg[a] = not Reg[b]
        elseif op == 17 then
            Reg[a] = #Reg[b]
        elseif op == 18 then
            Reg[a] = -Reg[b]
        elseif op == 19 then
            Reg[a] = {}
        elseif op == 20 then
            setIndex(Reg[a], Reg[b], Reg[c])
        elseif op == 21 then
            Reg[a] = getIndex(Reg[b], Reg[c])
        elseif op == 22 then
            Reg[a] = env[K[b + 1]]
        elseif op == 23 then
            env[K[b + 1]] = Reg[a]
        elseif op == 24 then
            doCall(a, b, c)
        elseif op == 25 then
            local rets = {}
            for i = 1, b do rets[i] = Reg[a + i - 1] end
            return unpack(rets, 1, b)
        elseif op == 26 then
            PC = PC + b
        elseif op == 27 then
            if Reg[a] then PC = PC + b end
        elseif op == 28 then
            if not Reg[a] then PC = PC + b end
        elseif op == 29 then
            Reg[a] = makeClosure(b)
        elseif op == 30 then     -- GETUPVAL
            local uv = proto.upvals and proto.upvals[b + 1]
            if uv then
                Reg[a] = upvals[uv.parentReg]
            else
                Reg[a] = nil
            end
        elseif op == 31 then     -- SETUPVAL
            local uv = proto.upvals and proto.upvals[b + 1]
            if uv then
                upvals[uv.parentReg] = Reg[a]
            end
        elseif op == 32 then
            for i = 1, #varargs do Reg[a + i - 1] = varargs[i] end
        elseif op == 36 then     -- GETMETHOD
            -- Perbaikan 3: Nil-safety pada GETMETHOD
            local obj = Reg[b]
            if obj == nil then
                error("Mawww VM: attempt to index a nil value (GETMETHOD)", 2)
            end
            local key = K[c + 1]
            local m = getIndex(obj, key)
            Reg[a] = m
            Reg[a + 1] = obj
        else
            error("VM: unknown opcode " .. tostring(op), 2)
        end
    end
end

-- 4. Eksekusi Environment (DIPERBAIKI)
-- Perbaikan 4: Environment fallback berlapis (getgenv -> getfenv -> _G)
local __env = (getgenv and getgenv()) or (getfenv and getfenv(0)) or _G
if not __env then 
    error("Mawww: Gagal menemukan environment eksekusi. Pastikan eksekutor mendukung getgenv atau getfenv.") 
end

local __run = runVM

-- Perbaikan 5: Bungkus eksekusi utama dengan pcall untuk mencegah crash diam-diam
local success, err = pcall(function()
    __run(__PROTOS[1], {}, __env, {...})
end)

if not success then
    warn("[Mawww VM] Eksekusi gagal: " .. tostring(err))
end

return runVM
