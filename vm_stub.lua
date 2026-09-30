-- Minimal register-based VM skeleton
local function run_vm(bytecode, consts, key)
    local Reg, PC = {}, 1
    local function dec(idx)
        local s = consts[idx]
        if type(s) ~= "string" then return s end
        local out = {}
        for i = 1, #s do
            out[i] = string.char((string.byte(s, i) ~ (key + i * 3)) % 256)
        end
        return table.concat(out)
    end

    while PC <= #bytecode do
        local ins = bytecode[PC]; PC = PC + 1
        local op, a, b, c = ins[1], ins[2], ins[3], ins[4]
        if op == 1 then Reg[a] = dec(b)                    -- LOADK
        elseif op == 2 then Reg[a] = Reg[b]                -- MOVE
        elseif op == 3 then Reg[a] = Reg[b] + Reg[c]       -- ADD
        elseif op == 4 then Reg[a] = Reg[b] - Reg[c]       -- SUB
        elseif op == 5 then Reg[a] = Reg[b] * Reg[c]       -- MUL
        elseif op == 6 then Reg[a] = Reg[b] / Reg[c]       -- DIV
        elseif op == 7 then Reg[a] = Reg[b] == Reg[c]      -- EQ
        elseif op == 8 then Reg[a] = Reg[b] < Reg[c]       -- LT
        elseif op == 9 then PC = b                         -- JMP
        elseif op == 10 then                               -- JMPIF
            if Reg[a] then PC = b end
        elseif op == 11 then                               -- CALL
            local f, args = Reg[a], {}
            for i = 1, b do args[i] = Reg[a + i] end
            local r = { f(table.unpack(args)) }
            for i = 1, c do Reg[a + i - 1] = r[i] end
        elseif op == 12 then return Reg[a]                 -- RETURN
        end
    end
end

return run_vm
