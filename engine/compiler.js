// Opcodes:
// 1  LOADK   a b c   Reg[a] = K[b]
// 2  MOVE    a b c   Reg[a] = Reg[b]
// 3  ADD     a b c
// 4  SUB     a b c
// 5  MUL     a b c
// 6  DIV     a b c
// 7  MOD     a b c
// 8  POW     a b c
// 9  CONCAT  a b c
// 10 EQ      a b c
// 11 NEQ     a b c
// 12 LT      a b c
// 13 LE      a b c
// 14 GT      a b c
// 15 GE      a b c
// 16 NOT     a b c
// 17 LEN     a b c
// 18 NEG     a b c
// 19 NEWTABLE a b c  Reg[a] = {}
// 20 SETTABLE a b c  Reg[a][Reg[b]] = Reg[c]
// 21 GETTABLE a b c  Reg[a] = Reg[b][Reg[c]]
// 22 GETGLOBAL a b c  Reg[a] = Env[K[b]]
// 23 SETGLOBAL a b c  Env[K[b]] = Reg[a]
// 24 CALL    a b c   Reg[a](Reg[a+1..a+b]) ; c = 0 multi-return
// 25 RETURN  a b      return Reg[a..a+b-1]
// 26 JUMP    a b      PC += b
// 27 JMPIF   a b      if Reg[a] then PC += b
// 28 JMPIFNOT a b     if not Reg[a] then PC += b
// 29 CLOSURE a b c    Reg[a] = closure(P[b])
// 30 GETUPVAL a b     Reg[a] = upvals[b]
// 31 SETUPVAL a b     upvals[b] = Reg[a]
// 32 VARARG  a b      Reg[a..] = ...
// 33 FORPREP a b      for loop setup
// 34 FORLOOP a b      for loop next
// 35 CONCATMULTI a b c
// 36 GETMETHOD a b c  Reg[a] = Reg[b][K[c]] ; Reg[a+1] = Reg[b]

class Compiler {
  constructor() {
    this.protos = [];
  }

  compile(ast) {
    this.protos = [];
    const main = this.compileFunction({ body: ast.body, params: [], vararg: true }, true);
    this.protos.unshift(main); // proto 0 = main
    return {
      protos: this.protos,
      mainIndex: 0
    };
  }

  compileFunction(fn, isMain = false) {
    const K = [];      // constants
    const upvals = []; // upvalue names (from parent)
    const insts = [];
    const locals = {}; // name -> regIndex
    let regTop = 0;
    let regMax = 1;
    const blockStack = []; // for local scoping

    const KINT = (v) => {
      for (let i = 0; i < K.length; i++) {
        if (K[i] === v && typeof K[i] === typeof v) return i;
      }
      K.push(v); return K.length - 1;
    };

    const newReg = () => {
      const r = regTop++;
      if (regTop > regMax) regMax = regTop;
      return r;
    };

    const freeReg = (r) => {
      if (r + 1 === regTop) regTop--;
    };

    const emit = (...ins) => { insts.push(ins); return insts.length - 1; };

    const patch = (idx, offset) => {
      insts[idx][2] = offset;
    };

    // resolve variable: local, upvalue, or global
    const resolveVar = (name) => {
      if (locals[name] !== undefined) return { kind: 'local', reg: locals[name] };
      // check parent
      const up = this.resolveUpval(fn, name);
      if (up !== null) return up;
      return { kind: 'global', name };
    };

    // placeholder for upvalue resolution
    this._upvalStack = this._upvalStack || [];
    this._upvalStack.push({ fn, locals, upvals });

    const loadVar = (name, dest) => {
      const v = resolveVar(name);
      if (v.kind === 'local') emit(2, dest, v.reg, 0); // MOVE
      else if (v.kind === 'upvalue') emit(30, dest, v.idx, 0); // GETUPVAL
      else emit(22, dest, KINT(name), 0); // GETGLOBAL
    };

    const storeVar = (name, src) => {
      const v = resolveVar(name);
      if (v.kind === 'local') emit(2, v.reg, src, 0); // MOVE
      else if (v.kind === 'upvalue') emit(31, src, v.idx, 0); // SETUPVAL
      else emit(23, src, KINT(name), 0); // SETGLOBAL
    };

    // -- Expression compile --
    const cExpr = (e) => {
      switch (e.type) {
        case 'Number': { const r = newReg(); emit(1, r, KINT(e.value), 0); return r; }
        case 'String': { const r = newReg(); emit(1, r, KINT(e.value), 0); return r; }
        case 'Bool': { const r = newReg(); emit(1, r, KINT(e.value), 0); return r; }
        case 'Nil': { const r = newReg(); emit(1, r, KINT(null), 0); return r; }
        case 'Name': { const r = newReg(); loadVar(e.name, r); return r; }
        case 'Paren': { return cExpr(e.expr); }
        case 'Vararg': { const r = newReg(); emit(32, r, 0, 0); return r; }
        case 'BinOp': {
          const l = cExpr(e.left);
          const r = cExpr(e.right);
          const d = newReg();
          const ops = { '+':3, '-':4, '*':5, '/':6, '%':7, '^':8, '..':9,
                        '==':10, '~=':11, '<':12, '<=':13, '>':14, '>=':15 };
          if (e.op === 'and') {
            // if l is false, result is l, else r
            emit(2, d, l, 0);
            const j = emit(28, d, 0, 0); // JMPIFNOT d +offset
            emit(2, d, r, 0);
            patch(j, insts.length - j - 1);
          } else if (e.op === 'or') {
            emit(2, d, l, 0);
            const j = emit(27, d, 0, 0);
            emit(2, d, r, 0);
            patch(j, insts.length - j - 1);
          } else {
            emit(ops[e.op] || 3, d, l, r);
          }
          freeReg(r); freeReg(l);
          // move d to l's slot (to compact)
          return d;
        }
        case 'UnOp': {
          const r = cExpr(e.expr);
          const d = newReg();
          if (e.op === 'not') emit(16, d, r, 0);
          else if (e.op === '-') emit(18, d, r, 0);
          else if (e.op === '#') emit(17, d, r, 0);
          freeReg(r);
          return d;
        }
        case 'Function': {
          const idx = this.compileFunction(e, false);
          const r = newReg();
          emit(29, r, idx, 0);
          return r;
        }
        case 'Table': {
          const r = newReg();
          emit(19, r, 0, 0);
          let arrayIdx = 1;
          for (const f of e.fields) {
            if (f.kind === 'key') {
              const k = cExpr(f.key);
              const v = cExpr(f.value);
              emit(20, r, k, v);
              freeReg(v); freeReg(k);
            } else {
              const v = cExpr(f.value);
              const ki = newReg();
              emit(1, ki, KINT(arrayIdx), 0);
              emit(20, r, ki, v);
              freeReg(ki); freeReg(v);
              arrayIdx++;
            }
          }
          return r;
        }
        case 'Index': {
          const o = cExpr(e.obj);
          const k = cExpr(e.key);
          const d = newReg();
          emit(21, d, o, k);
          freeReg(k); freeReg(o);
          return d;
        }
        case 'Call': {
          const f = cExpr(e.fn);
          const argRegs = e.args.map(cExpr);
          const d = newReg();
          // Move args to be contiguous starting at d+1
          // Simplification: emit CALL with fn at f, args in place; VM handles
          // We'll place fn at d, args after; but for simplicity, call with f
          // Actually let's build contiguous: fn at regN, args at regN+1..
          // Use the fn's reg as call base
          const base = f;
          // freeReg any beyond
          // For simplicity, emit args right after base
          emit(24, base, argRegs.length, 1); // result in base
          Reg_move(d, base, emit);
          argRegs.forEach(freeReg);
          return d;
        }
        case 'MethodCall': {
          const o = cExpr(e.obj);
          const mIdx = KINT(e.method);
          const mFn = newReg();
          emit(36, mFn, o, mIdx); // GETMETHOD
          const argRegs = e.args.map(cExpr);
          const d = mFn;
          emit(24, mFn, argRegs.length + 1, 1);
          argRegs.forEach(freeReg);
          return d;
        }
      }
      throw new Error('Compiler: unknown expr ' + e.type);
    };

    const Reg_move = (d, s, emitFn) => { emitFn(2, d, s, 0); };

    // -- Statement compile --
    const cStmt = (s) => {
      switch (s.type) {
        case 'Local': {
          const regs = s.names.map(() => newReg());
          s.exprs.forEach((e, i) => {
            const r = cExpr(e);
            if (i < regs.length) emit(2, regs[i], r, 0);
            freeReg(r);
          });
          s.names.forEach((n, i) => { locals[n] = regs[i]; });
          break;
        }
        case 'LocalFunction': {
          const r = newReg();
          locals[s.name] = r;
          const idx = this.compileFunction(s.fn, false);
          emit(29, r, idx, 0);
          break;
        }
        case 'Assign': {
          const regs = s.exprs.map(cExpr);
          s.targets.forEach((t, i) => {
            const r = regs[i] !== undefined ? regs[i] : newReg();
            if (t.type === 'Name') storeVar(t.name, r);
            else if (t.type === 'Index') {
              const o = cExpr(t.obj);
              const k = cExpr(t.key);
              emit(20, o, k, r);
              freeReg(k); freeReg(o);
            }
          });
          regs.forEach(freeReg);
          break;
        }
        case 'ExprStatement': cExpr(s.expr); break;
        case 'Return': {
          const rs = s.exprs.map(cExpr);
          if (rs.length === 0) emit(25, 0, 0, 0);
          else {
            // Move to contiguous
            const base = rs[0];
            for (let i = 1; i < rs.length; i++) emit(2, base + i, rs[i], 0);
            emit(25, base, rs.length, 0);
          }
          rs.forEach(freeReg);
          break;
        }
        case 'If': {
          const endJumps = [];
          const c = cExpr(s.clauses[0].cond);
          let j1 = emit(28, c, 0, 0);
          cStmtsBlock(s.clauses[0].body);
          endJumps.push(emit(26, 0, 0, 0));
          patch(j1, insts.length - j1 - 1);
          for (const cl of s.elseifs) {
            const cc = cExpr(cl.cond);
            const jj = emit(28, cc, 0, 0);
            cStmtsBlock(cl.body);
            endJumps.push(emit(26, 0, 0, 0));
            patch(jj, insts.length - jj - 1);
          }
          if (s.elseBody) cStmtsBlock(s.elseBody);
          for (const j of endJumps) patch(j, insts.length - j - 1);
          break;
        }
        case 'While': {
          const loopStart = insts.length;
          const c = cExpr(s.cond);
          const jout = emit(28, c, 0, 0);
          cStmtsBlock(s.body);
          emit(26, 0, loopStart - insts.length - 1, 0);
          patch(jout, insts.length - jout - 1);
          break;
        }
        case 'Repeat': {
          const loopStart = insts.length;
          cStmtsBlock(s.body);
          const c = cExpr(s.cond);
          emit(28, c, loopStart - insts.length - 1, 0);
          break;
        }
        case 'NumericFor': {
          const start = cExpr(s.start);
          const stop = cExpr(s.stop);
          const step = s.step ? cExpr(s.step) : (() => { const r = newReg(); emit(1, r, KINT(1), 0); return r; })();
          const base = newReg();
          // copy start/stop/step to base, base+1, base+2
          emit(2, base, start, 0);
          const stopR = newReg();
          emit(2, stopR, stop, 0);
          const stepR = newReg();
          emit(2, stepR, step, 0);
          const varR = newReg();
          const saved = locals[s.var];
          locals[s.var] = varR;
          const loopStart = insts.length;
          // if var > stop then exit (for positive step)
          // Simplify: compare var to stop
          const condR = newReg();
          emit(13, condR, varR, stopR); // var <= stop
          const jout = emit(28, condR, 0, 0);
          cStmtsBlock(s.body);
          emit(3, varR, varR, stepR); // var = var + step
          emit(26, 0, loopStart - insts.length - 1, 0);
          patch(jout, insts.length - jout - 1);
          if (saved !== undefined) locals[s.var] = saved; else delete locals[s.var];
          break;
        }
        case 'GenericFor': {
          // Simplified: only supports pairs/ipairs with a single or multiple vars
          const iterExpr = cExpr(s.exprs[0]);
          // We'll use a runtime helper: IterState
          const vars = s.names.map(() => newReg());
          const stateR = newReg();
          emit(1, stateR, KINT(0), 0);
          const loopStart = insts.length;
          // Simulate iterator: call pairs/ipairs via runtime
          // We emit a special GENERIC_FOR instruction handled by VM
          // opcode 40 = GENERIC_FOR a b  ; a=iter function reg, b = #vars
          // Emit: iter function loaded, then call next
          const nextR = newReg();
          // load global 'next'
          emit(22, nextR, KINT('next'), 0);
          // call next(iterExpr, state)
          const base = nextR;
          emit(2, base + 1, iterExpr, 0);
          emit(2, base + 2, stateR, 0);
          emit(24, base, 2, vars.length);
          // store results into vars
          for (let i = 0; i < vars.length; i++) {
            emit(2, vars[i], base + i, 0);
            locals[s.names[i]] = vars[i];
          }
          emit(27, vars[0], 0, 0); // if vars[0] then continue
          const jout = emit(28, vars[0], 0, 0);
          cStmtsBlock(s.body);
          emit(26, 0, loopStart - insts.length - 1, 0);
          patch(jout, insts.length - jout - 1);
          for (const n of s.names) delete locals[n];
          break;
        }
        case 'Break': emit(26, 0, 0, 0); break;
        case 'Do': cStmtsBlock(s.body); break;
      }
    };

    const cStmtsBlock = (body) => {
      const saved = Object.assign({}, locals);
      for (const st of body) cStmt(st);
      // restore locals declared inside block
      const keys = Object.keys(locals);
      for (const k of keys) if (saved[k] === undefined) delete locals[k];
    };

    for (const st of fn.body) cStmt(st);

    return { K, insts, numParams: fn.params.length, isVararg: fn.vararg, upvals, numRegs: regMax };
  }

  // Simple upvalue resolution: look up in parent scopes
  resolveUpval(fn, name) {
    // Simplified: don't support upvalues across closures in v1
    // Can be extended later
    return null;
  }
}

module.exports = { Compiler };
