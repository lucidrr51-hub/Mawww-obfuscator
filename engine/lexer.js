const TT = {
  NUMBER: 'number', STRING: 'string', NAME: 'name',
  KEYWORD: 'keyword', OP: 'op', EOF: 'eof'
};

const KEYWORDS = new Set([
  'and','break','do','else','elseif','end','false','for','function',
  'if','in','local','nil','not','or','repeat','return','then','true',
  'until','while'
]);

const OPS = [
  '...','..','==','~=','<=','>=','//','::','<<','>>',
  '+','-','*','/','%','^','#','<','>','=','(',')','{','}','[',']',
  ';',':',',','.','&','|','~'
];

class Lexer {
  constructor(src) { this.src = src; this.pos = 0; this.line = 1; this.tokens = []; }

  tokenize() {
    while (this.pos < this.src.length) {
      this.skipWsComments();
      if (this.pos >= this.src.length) break;
      const c = this.src[this.pos];
      if (c === '"' || c === "'") this.readString(c);
      else if (c === '[' && this.src[this.pos+1] === '[') this.readLongString();
      else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(this.src[this.pos+1]))) this.readNumber();
      else if (/[a-zA-Z_]/.test(c)) this.readName();
      else this.readOp();
    }
    this.tokens.push({ type: TT.EOF, value: '<eof>', line: this.line });
    return this.tokens;
  }

  skipWsComments() {
    while (this.pos < this.src.length) {
      const c = this.src[this.pos];
      if (c === ' ' || c === '\t' || c === '\r') { this.pos++; continue; }
      if (c === '\n') { this.line++; this.pos++; continue; }
      if (c === '-' && this.src[this.pos+1] === '-') {
        this.pos += 2;
        if (this.src[this.pos] === '[' && this.src[this.pos+1] === '[') {
          this.readLongString();
        } else {
          while (this.pos < this.src.length && this.src[this.pos] !== '\n') this.pos++;
        }
        continue;
      }
      break;
    }
  }

  readString(q) {
    const ln = this.line; this.pos++;
    let s = '';
    while (this.pos < this.src.length) {
      const c = this.src[this.pos];
      if (c === '\\') {
        this.pos++;
        const e = this.src[this.pos];
        if (e === 'x') { s += String.fromCharCode(parseInt(this.src.substr(this.pos+1,2),16)); this.pos += 3; continue; }
        if (e === 'n') s += '\n';
        else if (e === 't') s += '\t';
        else if (e === 'r') s += '\r';
        else if (e === '\\') s += '\\';
        else if (e === '"') s += '"';
        else if (e === "'") s += "'";
        else s += e;
        this.pos++;
      } else if (c === q) { this.pos++; break; }
      else if (c === '\n') { this.line++; s += c; this.pos++; }
      else { s += c; this.pos++; }
    }
    this.tokens.push({ type: TT.STRING, value: s, line: ln });
  }

  readLongString() {
    const ln = this.line; this.pos += 2;
    let lvl = 0;
    while (this.src[this.pos] === '=') { lvl++; this.pos++; }
    if (this.src[this.pos] !== '[') return;
    this.pos++;
    const close = ']' + '='.repeat(lvl) + ']';
    let s = '';
    while (this.pos < this.src.length) {
      if (this.src.substr(this.pos, close.length) === close) { this.pos += close.length; break; }
      if (this.src[this.pos] === '\n') this.line++;
      s += this.src[this.pos++];
    }
    this.tokens.push({ type: TT.STRING, value: s, line: ln });
  }

  readNumber() {
    const ln = this.line;
    if (this.src[this.pos] === '0' && /[xX]/.test(this.src[this.pos+1])) {
      this.pos += 2; let h = '';
      while (this.pos < this.src.length && /[0-9a-fA-F]/.test(this.src[this.pos])) h += this.src[this.pos++];
      this.tokens.push({ type: TT.NUMBER, value: parseInt(h, 16), line: ln });
      return;
    }
    let s = '';
    while (this.pos < this.src.length && /[0-9.]/.test(this.src[this.pos])) s += this.src[this.pos++];
    if (/[eE]/.test(this.src[this.pos] || '')) {
      s += this.src[this.pos++];
      if (/[+-]/.test(this.src[this.pos])) s += this.src[this.pos++];
      while (this.pos < this.src.length && /[0-9]/.test(this.src[this.pos])) s += this.src[this.pos++];
    }
    this.tokens.push({ type: TT.NUMBER, value: parseFloat(s), line: ln });
  }

  readName() {
    const ln = this.line; let s = '';
    while (this.pos < this.src.length && /[a-zA-Z0-9_]/.test(this.src[this.pos])) s += this.src[this.pos++];
    this.tokens.push({ type: KEYWORDS.has(s) ? TT.KEYWORD : TT.NAME, value: s, line: ln });
  }

  readOp() {
    const ln = this.line;
    for (const op of OPS) {
      if (this.src.substr(this.pos, op.length) === op) {
        this.pos += op.length;
        this.tokens.push({ type: TT.OP, value: op, line: ln });
        return;
      }
    }
    throw new Error(`Lexer: unknown char '${this.src[this.pos]}' at line ${this.line}`);
  }
}

module.exports = { Lexer, TT };
