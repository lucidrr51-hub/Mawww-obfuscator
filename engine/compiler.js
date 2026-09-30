const luaparse = require('luaparse');

// Mapping Opcode VM Mawww
const Op = {
    LOADK: 1, MOVE: 2, ADD: 3, SUB: 4, MUL: 5, DIV: 6, MOD: 7, POW: 8,
    CONCAT: 9, EQ: 10, NEQ: 11, LT: 12, LE: 13, GT: 14, GE: 15,
    NOT: 16, LEN: 17, UNM: 18, NEWTABLE: 19, SETTABLE: 20, GETTABLE: 21,
    GETGLOBAL: 22, SETGLOBAL: 23, CALL: 24, RETURN: 25, JMP: 26,
    TEST: 27, TESTSET: 28, CLOSURE: 29, GETUPVAL: 30, SETUPVAL: 31,
    VARARG: 32, GETMETHOD: 36
};

class Compiler {
    constructor() {
        this.protos = [];
        this.key = Math.floor(Math.random() * 255) + 1;
        this.currentProto = null;
        this.regTop = 0;
        this.locals = {};
        this.upvals = [];
        this.patches = [];
        this.scopeStack = [];
    }

    newReg() {
        const r = this.regTop;
        this.regTop++;
        return r;
    }

    getLocal(name) {
        // Cari dari scope terdalam ke terluar
        for (let i = this.scopeStack.length - 1; i >= 0; i--) {
            if (this.scopeStack[i][name] !== undefined) {
                return this.scopeStack[i][name];
            }
        }
        return null;
    }

    setLocal(name, reg) {
        this.scopeStack[this.scopeStack.length - 1][name] = reg;
    }

    addConstant(value) {
        for (let i = 0; i < this.currentProto.K.length; i++) {
            if (this.currentProto.K[i] === value) return i;
        }
        this.currentProto.K.push(value);
        return this.currentProto.K.length - 1;
    }

    emit(op, a, b, c) {
        this.currentProto.insts.push([op, a || 0, b || 0, c || 0]);
        return this.currentProto.insts.length - 1;
    }

    emitJmp(op, a) {
        const idx = this.emit(op, a || 0, 0, 0);
        this.patches.push(idx);
        return idx;
    }

    patchJmp(idx) {
        const target = this.currentProto.insts.length;
        const pc = idx + 1; // PC setelah instruksi ini
        const offset = target - pc;
        this.currentProto.insts[idx][2] = offset;
    }

    patchAll() {
        this.patches.forEach(idx => this.patchJmp(idx));
        this.patches = [];
    }

    compileNode(node, nret = 1) {
        if (!node) return null;

        switch (node.type) {
            case 'Chunk':
                this.currentProto = {
                    K: [],
                    insts: [],
                    numParams: 0,
                    isVararg: true,
                    upvals: []
                };
                this.protos.push(this.currentProto);
                this.scopeStack.push({});
                
                node.body.forEach(stmt => this.compileNode(stmt));
                this.emit(Op.RETURN, 0, 0, 0);
                this.patchAll();
                this.scopeStack.pop();
                break;

            case 'LocalStatement':
                this.scopeStack.push({});
                node.variables.forEach((v, i) => {
                    const reg = this.newReg();
                    this.setLocal(v.name, reg);
                    if (node.init[i]) {
                        const srcReg = this.compileNode(node.init[i]);
                        if (srcReg !== reg) {
                            this.emit(Op.MOVE, reg, srcReg, 0);
                        }
                    }
                });
                break;

            case 'AssignmentStatement':
                node.variables.forEach((v, i) => {
                    const srcReg = this.compileNode(node.init[i]);
                    if (v.type === 'Identifier') {
                        const target = this.getLocal(v.name);
                        if (target !== null) {
                            this.emit(Op.MOVE, target, srcReg, 0);
                        } else {
                            const k = this.addConstant(v.name);
                            this.emit(Op.SETGLOBAL, srcReg, k, 0);
                        }
                    } else if (v.type === 'MemberExpression') {
                        const objReg = this.compileNode(v.base);
                        const keyReg = this.compileNode(v.index);
                        this.emit(Op.SETTABLE, objReg, keyReg, srcReg);
                    }
                });
                break;

            case 'CallStatement':
                this.compileNode(node.expression, 0);
                break;

            case 'ReturnStatement':
                if (node.arguments.length > 0) {
                    const startReg = this.newReg();
                    node.arguments.forEach((arg, i) => {
                        const r = this.compileNode(arg);
                        this.emit(Op.MOVE, startReg + i, r, 0);
                    });
                    this.emit(Op.RETURN, startReg, node.arguments.length, 0);
                } else {
                    this.emit(Op.RETURN, 0, 0, 0);
                }
                break;

            case 'IfStatement':
                const condReg = this.compileNode(node.clauses[0].condition);
                const elseJmp = this.emitJmp(Op.TESTSET, condReg);
                
                this.scopeStack.push({});
                node.clauses[0].body.forEach(stmt => this.compileNode(stmt));
                this.scopeStack.pop();
                
                const endJmp = this.emitJmp(Op.JMP);
                this.patchJmp(elseJmp);
                
                if (node.clauses.length > 1 && node.clauses[1].type === 'ElseClause') {
                    this.scopeStack.push({});
                    node.clauses[1].body.forEach(stmt => this.compileNode(stmt));
                    this.scopeStack.pop();
                }
                this.patchJmp(endJmp);
                break;

            case 'WhileStatement':
                const loopStart = this.currentProto.insts.length;
                const wCondReg = this.compileNode(node.condition);
                const wExitJmp = this.emitJmp(Op.TESTSET, wCondReg);
                
                this.scopeStack.push({});
                node.body.forEach(stmt => this.compileNode(stmt));
                this.scopeStack.pop();
                
                this.emit(Op.JMP, 0, loopStart - (this.currentProto.insts.length + 1), 0);
                this.patchJmp(wExitJmp);
                break;

            case 'ForNumericStatement':
                // Implementasi sederhana untuk numeric for
                const startReg = this.compileNode(node.start);
                const endReg = this.compileNode(node.end);
                if (node.step) this.compileNode(node.step);
                
                const loopVarReg = this.newReg();
                this.scopeStack.push({});
                this.setLocal(node.variable.name, loopVarReg);
                this.emit(Op.MOVE, loopVarReg, startReg, 0);
                
                const forStart = this.currentProto.insts.length;
                const cond = this.newReg();
                this.emit(Op.LE, cond, loopVarReg, endReg);
                const forExitJmp = this.emitJmp(Op.TESTSET, cond);
                
                node.body.forEach(stmt => this.compileNode(stmt));
                
                this.emit(Op.ADD, loopVarReg, loopVarReg, 1); // step default 1
                this.emit(Op.JMP, 0, forStart - (this.currentProto.insts.length + 1), 0);
                this.patchJmp(forExitJmp);
                this.scopeStack.pop();
                break;

            case 'FunctionDeclaration':
                const newProto = {
                    K: [],
                    insts: [],
                    numParams: node.parameters.length,
                    isVararg: node.isVararg,
                    upvals: []
                };
                const oldProto = this.currentProto;
                this.currentProto = newProto;
                this.protos.push(newProto);
                this.scopeStack.push({});
                
                node.parameters.forEach((p, i) => {
                    this.setLocal(p.name, i);
                });
                
                node.body.forEach(stmt => this.compileNode(stmt));
                this.emit(Op.RETURN, 0, 0, 0);
                this.patchAll();
                this.scopeStack.pop();
                
                this.currentProto = oldProto;
                const closureReg = this.newReg();
                this.emit(Op.CLOSURE, closureReg, this.protos.length - 1, 0);
                return closureReg;

            case 'Identifier':
                const localReg = this.getLocal(node.name);
                if (localReg !== null) {
                    return localReg;
                }
                const k = this.addConstant(node.name);
                const r = this.newReg();
                this.emit(Op.GETGLOBAL, r, k, 0);
                return r;

            case 'StringLiteral':
            case 'NumericLiteral':
            case 'BooleanLiteral':
                const constIndex = this.addConstant(node.value);
                const reg = this.newReg();
                this.emit(Op.LOADK, reg, constIndex, 0);
                return reg;

            case 'NilLiteral':
                const nilReg = this.newReg();
                this.emit(Op.LOADK, nilReg, this.addConstant(null), 0);
                return nilReg;

            case 'BinaryExpression':
                const leftReg = this.compileNode(node.left);
                const rightReg = this.compileNode(node.right);
                const resultReg = this.newReg();
                let opCode = Op.ADD;
                switch(node.operator) {
                    case '+': opCode = Op.ADD; break;
                    case '-': opCode = Op.SUB; break;
                    case '*': opCode = Op.MUL; break;
                    case '/': opCode = Op.DIV; break;
                    case '%': opCode = Op.MOD; break;
                    case '^': opCode = Op.POW; break;
                    case '..': opCode = Op.CONCAT; break;
                    case '==': opCode = Op.EQ; break;
                    case '~=': opCode = Op.NEQ; break;
                    case '<': opCode = Op.LT; break;
                    case '<=': opCode = Op.LE; break;
                    case '>': opCode = Op.GT; break;
                    case '>=': opCode = Op.GE; break;
                }
                this.emit(opCode, resultReg, leftReg, rightReg);
                return resultReg;

            case 'MemberExpression':
                const baseReg = this.compileNode(node.base);
                const idxReg = this.compileNode(node.index);
                const resReg = this.newReg();
                this.emit(Op.GETTABLE, resReg, baseReg, idxReg);
                return resReg;

            case 'CallExpression':
                return this.compileCallExpression(node, nret);

            case 'MethodCall':
                return this.compileMethodCall(node, nret);

            default:
                throw new Error(`Unhandled node type: ${node.type}`);
        }
        return null;
    }

    compileCallExpression(node, nret) {
        const funcReg = this.compileNode(node.base);
        const argStart = funcReg + 1;
        if (this.regTop < argStart) this.regTop = argStart;
        
        node.arguments.forEach((arg, i) => {
            const r = this.compileNode(arg);
            if (r !== argStart + i) {
                this.emit(Op.MOVE, argStart + i, r, 0);
            }
        });
        
        if (this.regTop < argStart + node.arguments.length) {
            this.regTop = argStart + node.arguments.length;
        }

        this.emit(Op.CALL, funcReg, node.arguments.length, nret);
        return funcReg;
    }

    compileMethodCall(node, nret) {
        const objReg = this.compileNode(node.base);
        const methodName = node.identifier.name;
        const kIdx = this.addConstant(methodName);
        
        const mFn = this.newReg(); // Reg[A] = function
        
        // Emit GETMETHOD. VM akan mengisi mFn dan mFn+1 (self)
        this.emit(Op.GETMETHOD, mFn, objReg, kIdx);
        
        // Argumen harus dimulai dari mFn + 2 (setelah self)
        const argStart = mFn + 2;
        if (this.regTop < argStart) {
            this.regTop = argStart;
        }
        
        node.arguments.forEach((arg, i) => {
            const r = this.compileNode(arg);
            if (r !== argStart + i) {
                this.emit(Op.MOVE, argStart + i, r, 0);
            }
        });
        
        if (this.regTop < argStart + node.arguments.length) {
            this.regTop = argStart + node.arguments.length;
        }

        const nargs = node.arguments.length + 1; // +1 untuk self
        this.emit(Op.CALL, mFn, nargs, nret);
        return mFn;
    }
}

function compile(luaCode) {
    const ast = luaparse.parse(luaCode, { luaVersion: '5.1' });
    const compiler = new Compiler();
    compiler.compileNode(ast);
    return { protos: compiler.protos, key: compiler.key };
}

module.exports = { compile };
