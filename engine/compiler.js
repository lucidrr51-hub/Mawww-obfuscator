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
        this.labels = [];
        this.patches = [];
    }

    // Alokasi register baru
    newReg() {
        const r = this.regTop;
        this.regTop++;
        return r;
    }

    // Mendapatkan register untuk variabel lokal
    getLocal(name) {
        if (this.locals[name] !== undefined) {
            return this.locals[name];
        }
        return null;
    }

    // Menambahkan konstanta ke K array
    addConstant(value) {
        for (let i = 0; i < this.currentProto.K.length; i++) {
            if (this.currentProto.K[i] === value) return i;
        }
        this.currentProto.K.push(value);
        return this.currentProto.K.length - 1;
    }

    // Emit instruksi
    emit(op, a, b, c) {
        this.currentProto.insts.push([op, a || 0, b || 0, c || 0]);
    }

    // Compile node AST
    compileNode(node) {
        if (!node) return;

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
                
                node.body.forEach(stmt => this.compileNode(stmt));
                this.emit(Op.RETURN, 0, 0, 0);
                break;

            case 'LocalStatement':
                node.variables.forEach((v, i) => {
                    if (node.init[i]) {
                        const reg = this.compileNode(node.init[i]);
                        this.locals[v.name] = reg;
                    } else {
                        this.locals[v.name] = this.newReg();
                    }
                });
                break;

            case 'AssignmentStatement':
                node.variables.forEach((v, i) => {
                    const reg = this.compileNode(node.init[i]);
                    if (v.type === 'Identifier') {
                        const target = this.locals[v.name];
                        if (target !== undefined) {
                            this.emit(Op.MOVE, target, reg, 0);
                        } else {
                            const k = this.addConstant(v.name);
                            this.emit(Op.SETGLOBAL, reg, k, 0);
                        }
                    } else if (v.type === 'MemberExpression') {
                        const objReg = this.compileNode(v.base);
                        const keyReg = this.compileNode(v.index);
                        this.emit(Op.SETTABLE, objReg, keyReg, reg);
                    }
                });
                break;

            case 'CallStatement':
                this.compileNode(node.expression);
                break;

            case 'ReturnStatement':
                if (node.arguments.length > 0) {
                    const startReg = this.regTop;
                    node.arguments.forEach(arg => {
                        const r = this.compileNode(arg);
                        this.emit(Op.MOVE, startReg + (this.regTop - startReg), r, 0);
                    });
                    this.emit(Op.RETURN, startReg, node.arguments.length, 0);
                } else {
                    this.emit(Op.RETURN, 0, 0, 0);
                }
                break;

            case 'IfStatement':
                // Implementasi if sederhana (bisa dikembangkan untuk else/elseif)
                const condReg = this.compileNode(node.clauses[0].condition);
                const jmpIdx = this.currentProto.insts.length;
                this.emit(Op.TEST, condReg, 0, 0); 
                // ... Logika jump (perlu implementasi lebih lanjut untuk production)
                break;

            case 'WhileStatement':
                // Implementasi while loop
                break;

            case 'ForNumericStatement':
                // Implementasi for loop
                break;

            case 'FunctionDeclaration':
                // Implementasi deklarasi fungsi
                break;

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
            case 'NilLiteral':
                const constIndex = this.addConstant(node.value);
                const reg = this.newReg();
                this.emit(Op.LOADK, reg, constIndex, 0);
                return reg;

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
                return this.compileCallExpression(node);

            case 'MethodCall':
                return this.compileMethodCall(node);

            default:
                throw new Error(`Unhandled node type: ${node.type}`);
        }
    }

    // Compile pemanggilan fungsi biasa: func(arg1, arg2)
    compileCallExpression(node) {
        const funcReg = this.compileNode(node.base);
        const argStart = this.regTop;
        
        node.arguments.forEach(arg => {
            const r = this.compileNode(arg);
            this.emit(Op.MOVE, this.regTop, r, 0);
            this.newReg();
        });

        const nret = 1; // Asumsi default 1 return value
        this.emit(Op.CALL, funcReg, node.arguments.length, nret);
        
        return funcReg; // Hasil return ada di funcReg
    }

    // PERBAIKAN UTAMA: Compile method call: obj:method(arg1, arg2)
    // Error 'boolean was passed' sebelumnya terjadi karena register untuk 'self' dan argumen bertabrakan.
    compileMethodCall(node) {
        // 1. Compile objek (base)
        const objReg = this.compileNode(node.base);
        
        // 2. Load method name sebagai konstanta
        const methodName = node.identifier.name;
        const kIdx = this.addConstant(methodName);
        
        // 3. Alokasikan register untuk method function dan self
        const mFn = this.newReg(); // Method function
        const self = this.newReg(); // Self (objek itu sendiri)
        
        // Emit GETMETHOD (Opcode 36) yang akan mengisi mFn dan self
        this.emit(Op.GETMETHOD, mFn, objReg, kIdx);
        
        // 4. Alokasikan register untuk argumen, mulai setelah 'self'
        // Pastikan register untuk argumen tidak menimpa 'self' atau 'mFn'
        const argStart = this.regTop;
        node.arguments.forEach(arg => {
            const r = this.compileNode(arg);
            // Pindahkan hasil argumen ke register argumen yang benar
            this.emit(Op.MOVE, this.regTop, r, 0);
            this.newReg();
        });

        // 5. Emit CALL. Argumen dimulai dari mFn + 2 (karena mFn dan self menempati mFn dan mFn+1)
        // Tapi di VM kita, CALL mengambil argumen dari Reg[base + 1] hingga Reg[base + nargs].
        // Karena self ada di Reg[mFn + 1], maka kita panggil dengan base = mFn.
        const nargs = node.arguments.length + 1; // +1 untuk self
        this.emit(Op.CALL, mFn, nargs, 1);
        
        // Hasil return ada di mFn (base + 0)
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
