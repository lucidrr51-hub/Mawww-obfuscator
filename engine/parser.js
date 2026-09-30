const { TT } = require('./lexer');

class Parser {
  constructor(tokens) { this.t = tokens; this.i = 0; }

  peek(k = 0) { return this.t[this.i + k]; }
  next() { return this.t[this.i++]; }
  isOp(v) { const t = this.peek(); return t.type === TT.OP && t.value === v; }
  isKw(v) { const t = this.peek(); return t.type === TT.KEYWORD && t.value === v; }
  isName(v) { const t = this.peek(); return t.type === TT.NAME && (v === undefined || t.value === v); }
  expectOp(v) { if (!this.isOp(v)) throw new Error(`Parser: expected '${v}' at line ${this.peek().line}`); return this.next(); }
  expectKw(v) { if (!this.isKw(v)) throw new Error(`Parser: expected '${v}' at line ${this.peek().line}`); return this.next(); }
  expectName() { if (this.peek().type !== TT.NAME) throw new Error(`Parser: expected name at line ${this.peek().line}`); return this.next().value; }

  parse() {
    const body = this.parseBlock();
    if (this.peek().type !== TT.EOF) throw new Error(`Parser: unexpected token '${this.peek().value}' at line ${this.peek().line}`);
    return { type: 'Chunk', body };
  }

  parseBlock() {
    const stmts = [];
    while (this.peek().type !== TT.EOF) {
      if (this.isKw('end') || this.isKw('else') || this.isKw('elseif') || this.isKw('until')) break;
      if (this.isOp(';')) { this.next(); continue; }
      const s = this.parseStatement();
      if (s) stmts.push(s);
    }
    return stmts;
  }

  parseStatement() {
    if (this.isOp(';')) { this.next(); return null; }
    if (this.isKw('local')) return this.parseLocal();
    if (this.isKw('if')) return this.parseIf();
    if (this.isKw('while')) return this.parseWhile();
    if (this.isKw('for')) return this.parseFor();
    if (this.isKw('function')) return this.parseFunctionStatement();
    if (this.isKw('return')) return this.parseReturn();
    if (this.isKw('break')) { this.next(); return { type: 'Break' }; }
    if (this.isKw('do')) { this.next(); const b = this.parseBlock(); this.expectKw('end'); return { type: 'Do', body: b }; }
    if (this.isKw('repeat')) return this.parseRepeat();
    return this.parseExprStatement();
  }

  parseLocal() {
    this.expectKw('local');
    if (this.isKw('function')) {
      this.next();
      const name = this.expectName();
      const fn = this.parseFunctionBody();
      return { type: 'LocalFunction', name, fn };
    }
    const names = [this.expectName()];
    while (this.isOp(',')) { this.next(); names.push(this.expectName()); }
    let exprs = [];
    if (this.isOp('=')) {
      this.next();
      exprs.push(this.parseExpr());
      while (this.isOp(',')) { this.next(); exprs.push(this.parseExpr()); }
    }
    return { type: 'Local', names, exprs };
  }

  parseIf() {
    this.expectKw('if');
    const cond = this.parseExpr();
    this.expectKw('then');
    const body = this.parseBlock();
    const clauses = [{ cond, body }];
    const elseifs = [];
    while (this.isKw('elseif')) {
      this.next();
      const c = this.parseExpr();
      this.expectKw('then');
      elseifs.push({ cond: c, body: this.parseBlock() });
    }
    let elseBody = null;
    if (this.isKw('else')) { this.next(); elseBody = this.parseBlock(); }
    this.expectKw('end');
    return { type: 'If', clauses, elseifs, elseBody };
  }

  parseWhile() {
    this.expectKw('while');
    const cond = this.parseExpr();
    this.expectKw('do');
    const body = this.parseBlock();
    this.expectKw('end');
    return { type: 'While', cond, body };
  }

  parseRepeat() {
    this.expectKw('repeat');
    const body = this.parseBlock();
    this.expectKw('until');
    const cond = this.parseExpr();
    return { type: 'Repeat', body, cond };
  }

  parseFor() {
    this.expectKw('for');
    const first = this.expectName();
    if (this.isOp('=')) {
      this.next();
      const start = this.parseExpr();
      this.expectOp(',');
      const stop = this.parseExpr();
      let step = null;
      if (this.isOp(',')) { this.next(); step = this.parseExpr(); }
      this.expectKw('do');
      const body = this.parseBlock();
      this.expectKw('end');
      return { type: 'NumericFor', var: first, start, stop, step, body };
    }
    const names = [first];
    while (this.isOp(',')) { this.next(); names.push(this.expectName()); }
    this.expectKw('in');
    const exprs = [this.parseExpr()];
    while (this.isOp(',')) { this.next(); exprs.push(this.parseExpr()); }
    this.expectKw('do');
    const body = this.parseBlock();
    this.expectKw('end');
    return { type: 'GenericFor', names, exprs, body };
  }

  parseFunctionStatement() {
    this.expectKw('function');
    let target = { type: 'Name', name: this.expectName() };
    while (this.isOp('.')) {
      this.next();
      target = { type: 'Index', obj: target, key: { type: 'String', value: this.expectName() } };
    }
    let method = null;
    if (this.isOp(':')) {
      this.next();
      method = this.expectName();
      target = { type: 'Index', obj: target, key: { type: 'String', value: method } };
    }
    const fn = this.parseFunctionBody(method !== null);
    return { type: 'Assign', targets: [target], exprs: [fn] };
  }

  parseFunctionBody(isMethod = false) {
    this.expectOp('(');
    const params = [];
    if (isMethod) params.push('self');
    let vararg = false;
    if (!this.isOp(')')) {
      while (true) {
        if (this.isOp('...')) { this.next(); vararg = true; break; }
        params.push(this.expectName());
        if (this.isOp(',')) this.next();
        else break;
      }
    }
    this.expectOp(')');
    const body = this.parseBlock();
    this.expectKw('end');
    return { type: 'Function', params, vararg, body };
  }

  parseReturn() {
    this.expectKw('return');
    const exprs = [];
    if (!this.isKw('end') && !this.isKw('else') && !this.isKw('elseif') && !this.isKw('until') && this.peek().type !== TT.EOF && !this.isOp(';')) {
      exprs.push(this.parseExpr());
      while (this.isOp(',')) { this.next(); exprs.push(this.parseExpr()); }
    }
    if (this.isOp(';')) this.next();
    return { type: 'Return', exprs };
  }

  parseExprStatement() {
    const start = this.parsePrefixExpr();
    if (this.isOp('=') || this.isOp(',')) {
      const targets = [start];
      while (this.isOp(',')) { this.next(); targets.push(this.parsePrefixExpr()); }
      this.expectOp('=');
      const exprs = [this.parseExpr()];
      while (this.isOp(',')) { this.next(); exprs.push(this.parseExpr()); }
      return { type: 'Assign', targets, exprs };
    }
    if (start.type === 'Call' || start.type === 'MethodCall') {
      return { type: 'ExprStatement', expr: start };
    }
    throw new Error(`Parser: invalid statement at line ${this.peek().line}`);
  }

  parseExpr() { return this.parseOr(); }

  parseOr() {
    let left = this.parseAnd();
    while (this.isKw('or')) {
      this.next();
      left = { type: 'BinOp', op: 'or', left, right: this.parseAnd() };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseCompare();
    while (this.isKw('and')) {
      this.next();
      left = { type: 'BinOp', op: 'and', left, right: this.parseCompare() };
    }
    return left;
  }

  parseCompare() {
    let left = this.parseConcat();
    while (this.isOp('==') || this.isOp('~=') || this.isOp('<') || this.isOp('>') || this.isOp('<=') || this.isOp('>=')) {
      const op = this.next().value;
      left = { type: 'BinOp', op, left, right: this.parseConcat() };
    }
    return left;
  }

  parseConcat() {
    let left = this.parseAdd();
    if (this.isOp('..')) {
      this.next();
      left = { type: 'BinOp', op: '..', left, right: this.parseConcat() };
    }
    return left;
  }

  parseAdd() {
    let left = this.parseMul();
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next().value;
      left = { type: 'BinOp', op, left, right: this.parseMul() };
    }
    return left;
  }

  parseMul() {
    let left = this.parseUnary();
    while (this.isOp('*') || this.isOp('/') || this.isOp('%') || this.isOp('//')) {
      const op = this.next().value;
      left = { type: 'BinOp', op, left, right: this.parseUnary() };
    }
    return left;
  }

  parseUnary() {
    if (this.isKw('not')) { this.next(); return { type: 'UnOp', op: 'not', expr: this.parseUnary() }; }
    if (this.isOp('-')) { this.next(); return { type: 'UnOp', op: '-', expr: this.parseUnary() }; }
    if (this.isOp('#')) { this.next(); return { type: 'UnOp', op: '#', expr: this.parseUnary() }; }
    return this.parsePow();
  }

  parsePow() {
    const left = this.parseSimpleExpr();
    if (this.isOp('^')) {
      this.next();
      return { type: 'BinOp', op: '^', left, right: this.parseUnary() };
    }
    return left;
  }

  parseSimpleExpr() {
    if (this.peek().type === TT.NUMBER) return { type: 'Number', value: this.next().value };
    if (this.peek().type === TT.STRING) return { type: 'String', value: this.next().value };
    if (this.isKw('nil')) { this.next(); return { type: 'Nil' }; }
    if (this.isKw('true')) { this.next(); return { type: 'Bool', value: true }; }
    if (this.isKw('false')) { this.next(); return { type: 'Bool', value: false }; }
    if (this.isKw('function')) { this.next(); return this.parseFunctionBody(); }
    if (this.isOp('...')) { this.next(); return { type: 'Vararg' }; }
    if (this.isOp('{')) return this.parseTable();
    return this.parsePrefixExpr();
  }

  parseTable() {
    this.expectOp('{');
    const fields = [];
    while (!this.isOp('}')) {
      if (this.isOp('[')) {
        this.next();
        const k = this.parseExpr();
        this.expectOp(']');
        this.expectOp('=');
        fields.push({ kind: 'key', key: k, value: this.parseExpr() });
      } else if (this.peek().type === TT.NAME && this.isOp('=') === false && this.t[this.i+1].type === TT.OP && this.t[this.i+1].value === '=') {
        const k = this.next().value;
        this.next();
        fields.push({ kind: 'key', key: { type: 'String', value: k }, value: this.parseExpr() });
      } else {
        fields.push({ kind: 'array', value: this.parseExpr() });
      }
      if (this.isOp(',') || this.isOp(';')) this.next();
      else break;
    }
    this.expectOp('}');
    return { type: 'Table', fields };
  }

  parsePrefixExpr() {
    let expr;
    if (this.peek().type === TT.NAME) {
      expr = { type: 'Name', name: this.next().value };
    } else if (this.isOp('(')) {
      this.next();
      const e = this.parseExpr();
      this.expectOp(')');
      expr = { type: 'Paren', expr: e };
    } else {
      throw new Error(`Parser: expected prefix expression at line ${this.peek().line}`);
    }
    while (true) {
      if (this.isOp('.')) {
        this.next();
        const k = this.expectName();
        expr = { type: 'Index', obj: expr, key: { type: 'String', value: k } };
      } else if (this.isOp('[')) {
        this.next();
        const k = this.parseExpr();
        this.expectOp(']');
        expr = { type: 'Index', obj: expr, key: k };
      } else if (this.isOp(':')) {
        this.next();
        const m = this.expectName();
        const args = this.parseCallArgs();
        expr = { type: 'MethodCall', obj: expr, method: m, args };
      } else if (this.isOp('(') || this.peek().type === TT.STRING || this.isOp('{')) {
        const args = this.parseCallArgs();
        expr = { type: 'Call', fn: expr, args };
      } else break;
    }
    return expr;
  }

  parseCallArgs() {
    if (this.isOp('(')) {
      this.next();
      const args = [];
      if (!this.isOp(')')) {
        args.push(this.parseExpr());
        while (this.isOp(',')) { this.next(); args.push(this.parseExpr()); }
      }
      this.expectOp(')');
      return args;
    }
    if (this.peek().type === TT.STRING) return [{ type: 'String', value: this.next().value }];
    if (this.isOp('{')) return [this.parseTable()];
    throw new Error(`Parser: expected call args at line ${this.peek().line}`);
  }
}

module.exports = { Parser };
