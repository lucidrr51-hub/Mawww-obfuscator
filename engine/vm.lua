-- Mawww VM Runtime
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

    -- upvals here is the PARENT function's Reg table (passed by reference)
    local function makeClosure(protoIdx)
        local sub = proto.P and proto.P[protoIdx] or nil
        if not sub then return function() end end
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

    local function doCall(base, nargs, nret)
        local f = Reg[base]
        local args = {}
        for i = 1, nargs do args[i] = Reg[base + i] end
        if type(f) ~= "function" then
            local mt = type(f) == "table" and getmetatable(f)
            if mt and mt.__call then f = mt.__call end
            if type(f) ~= "function" then error("attempt to call " .. type(f), 2) end
        end
        local r = {f(unpack(args, 1, nargs))}
        if nret == 0 then return r end
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
        elseif op == 30 then     -- GETUPVAL: read from parent's Reg
            local uv = proto.upvals and proto.upvals[b + 1]
            if uv then
                Reg[a] = upvals[uv.parentReg]
            else
                Reg[a] = nil
            end
        elseif op == 31 then     -- SETUPVAL: write to parent's Reg
            local uv = proto.upvals and proto.upvals[b + 1]
            if uv then
                upvals[uv.parentReg] = Reg[a]
            end
        elseif op == 32 then
            for i = 1, #varargs do Reg[a + i - 1] = varargs[i] end
        elseif op == 36 then     -- GETMETHOD
            local obj = Reg[b]
            local key = K[c + 1]
            local m = getIndex(obj, key)
            Reg[a] = m
            Reg[a + 1] = obj
        else
            error("VM: unknown opcode " .. tostring(op), 2)
        end
    end
end

return runVM
