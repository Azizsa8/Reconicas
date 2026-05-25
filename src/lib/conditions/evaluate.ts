// Safe DSL evaluator — TS port of recon/conditions.py.
//
// Grammar (precedence low → high):
//   orExpr      := andExpr ('or' andExpr)*
//   andExpr     := notExpr ('and' notExpr)*
//   notExpr     := 'not' notExpr | compareExpr
//   compareExpr := addExpr (compareOp addExpr)*       // chained = pairwise AND
//   addExpr     := mulExpr (('+'|'-') mulExpr)*
//   mulExpr     := unaryExpr (('*'|'/'|'%') unaryExpr)*
//   unaryExpr   := ('-'|'+') unaryExpr | primary
//   primary     := NUMBER | STRING | NAME | '(' expression ')' | true | false | null
//
// No member access, no function calls, no subscripts. Names resolve from
// a fixed context dict; unknown names => the expression evaluates to false
// (rather than throwing) so a typo in customer DSL doesn't crash the worker.

export type Value = number | string | boolean | null;
export type Context = Record<string, Value>;

export class ConditionError extends Error {}

type Tok =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "name"; v: string }
  | { t: "op"; v: string }
  | { t: "lpar" }
  | { t: "rpar" }
  | { t: "eof" };

// ───── Tokenizer ──────────────────────────────────────────────────────────
function tokenize(src: string): Tok[] {
  const tokens: Tok[] = [];
  // Normalize SQL-style AND/OR/NOT (Python evaluator does the same).
  const text = src.replace(/\b(AND|OR|NOT)\b/g, (m) => m.toLowerCase());
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c === "(") { tokens.push({ t: "lpar" }); i++; continue; }
    if (c === ")") { tokens.push({ t: "rpar" }); i++; continue; }
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let buf = "";
      while (j < text.length && text[j] !== quote) {
        if (text[j] === "\\" && j + 1 < text.length) {
          buf += text[j + 1];
          j += 2;
        } else {
          buf += text[j];
          j++;
        }
      }
      if (j >= text.length) throw new ConditionError("unterminated string literal");
      tokens.push({ t: "str", v: buf });
      i = j + 1;
      continue;
    }
    if ((c >= "0" && c <= "9") || (c === "." && text[i + 1] >= "0" && text[i + 1] <= "9")) {
      let j = i;
      while (j < text.length && (/[0-9.]/.test(text[j]))) j++;
      const n = Number(text.slice(i, j));
      if (!Number.isFinite(n)) throw new ConditionError(`bad number: ${text.slice(i, j)}`);
      tokens.push({ t: "num", v: n });
      i = j;
      continue;
    }
    // Multi-char operators
    const two = text.slice(i, i + 2);
    if (two === "==" || two === "!=" || two === "<=" || two === ">=") {
      tokens.push({ t: "op", v: two });
      i += 2;
      continue;
    }
    if (c === "<" || c === ">" || c === "+" || c === "-" || c === "*" || c === "/" || c === "%") {
      tokens.push({ t: "op", v: c });
      i++;
      continue;
    }
    // Identifier / keyword
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < text.length && /[A-Za-z0-9_]/.test(text[j])) j++;
      const word = text.slice(i, j);
      tokens.push({ t: "name", v: word });
      i = j;
      continue;
    }
    throw new ConditionError(`unexpected character '${c}' at offset ${i}`);
  }
  tokens.push({ t: "eof" });
  return tokens;
}

// ───── AST + Parser ───────────────────────────────────────────────────────
type Node =
  | { kind: "num"; v: number }
  | { kind: "str"; v: string }
  | { kind: "bool"; v: boolean }
  | { kind: "null" }
  | { kind: "name"; v: string }
  | { kind: "not"; e: Node }
  | { kind: "neg"; e: Node }
  | { kind: "bin"; op: string; l: Node; r: Node }
  | { kind: "cmp"; op: string; l: Node; r: Node }
  | { kind: "and"; l: Node; r: Node }
  | { kind: "or"; l: Node; r: Node };

const KEYWORDS = new Set(["and", "or", "not", "in", "true", "false", "null", "none", "True", "False", "None"]);
const CMP_OPS = new Set(["==", "!=", "<", "<=", ">", ">="]);

class Parser {
  i = 0;
  toks: Tok[];
  constructor(toks: Tok[]) { this.toks = toks; }

  peek(): Tok { return this.toks[this.i]; }
  next(): Tok { return this.toks[this.i++]; }
  eatOp(op: string): boolean {
    const t = this.peek();
    if (t.t === "op" && t.v === op) { this.i++; return true; }
    return false;
  }
  eatKw(kw: string): boolean {
    const t = this.peek();
    if (t.t === "name" && t.v === kw) { this.i++; return true; }
    return false;
  }
  expect(cond: boolean, msg: string) {
    if (!cond) throw new ConditionError(msg);
  }

  parseAll(): Node {
    const e = this.parseOr();
    this.expect(this.peek().t === "eof", `unexpected token near offset ${this.i}`);
    return e;
  }

  parseOr(): Node {
    let left = this.parseAnd();
    while (this.eatKw("or")) {
      const right = this.parseAnd();
      left = { kind: "or", l: left, r: right };
    }
    return left;
  }
  parseAnd(): Node {
    let left = this.parseNot();
    while (this.eatKw("and")) {
      const right = this.parseNot();
      left = { kind: "and", l: left, r: right };
    }
    return left;
  }
  parseNot(): Node {
    if (this.eatKw("not")) {
      return { kind: "not", e: this.parseNot() };
    }
    return this.parseCmp();
  }
  parseCmp(): Node {
    const left = this.parseAdd();
    const t = this.peek();
    // 'in' / 'not in' — handle via name lookahead
    if (t.t === "name" && t.v === "in") {
      this.i++;
      const r = this.parseAdd();
      return { kind: "cmp", op: "in", l: left, r };
    }
    if (t.t === "op" && CMP_OPS.has(t.v)) {
      const op = (this.next() as { t: "op"; v: string }).v;
      const right = this.parseAdd();
      // Disallow chained comparisons for clarity; users can write `a > 0 and a < 10`.
      const next = this.peek();
      if (next.t === "op" && CMP_OPS.has(next.v)) {
        throw new ConditionError("chained comparisons not supported — use 'and'");
      }
      return { kind: "cmp", op, l: left, r: right };
    }
    return left;
  }
  parseAdd(): Node {
    let left = this.parseMul();
    while (true) {
      if (this.eatOp("+")) left = { kind: "bin", op: "+", l: left, r: this.parseMul() };
      else if (this.eatOp("-")) left = { kind: "bin", op: "-", l: left, r: this.parseMul() };
      else break;
    }
    return left;
  }
  parseMul(): Node {
    let left = this.parseUnary();
    while (true) {
      if (this.eatOp("*")) left = { kind: "bin", op: "*", l: left, r: this.parseUnary() };
      else if (this.eatOp("/")) left = { kind: "bin", op: "/", l: left, r: this.parseUnary() };
      else if (this.eatOp("%")) left = { kind: "bin", op: "%", l: left, r: this.parseUnary() };
      else break;
    }
    return left;
  }
  parseUnary(): Node {
    if (this.eatOp("-")) return { kind: "neg", e: this.parseUnary() };
    if (this.eatOp("+")) return this.parseUnary();
    return this.parsePrimary();
  }
  parsePrimary(): Node {
    const t = this.peek();
    if (t.t === "num") { this.i++; return { kind: "num", v: t.v }; }
    if (t.t === "str") { this.i++; return { kind: "str", v: t.v }; }
    if (t.t === "lpar") {
      this.i++;
      const e = this.parseOr();
      this.expect(this.peek().t === "rpar", "missing ')'");
      this.i++;
      return e;
    }
    if (t.t === "name") {
      // boolean / null literals first
      if (t.v === "true" || t.v === "True") { this.i++; return { kind: "bool", v: true }; }
      if (t.v === "false" || t.v === "False") { this.i++; return { kind: "bool", v: false }; }
      if (t.v === "null" || t.v === "None" || t.v === "none") { this.i++; return { kind: "null" }; }
      if (KEYWORDS.has(t.v)) throw new ConditionError(`unexpected keyword '${t.v}'`);
      this.i++;
      return { kind: "name", v: t.v };
    }
    throw new ConditionError(`expected value, got ${t.t}`);
  }
}

// ───── Evaluator ──────────────────────────────────────────────────────────
function asNumber(v: Value): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? 1 : 0;
  return null;
}
function asString(v: Value): string | null {
  return typeof v === "string" ? v : null;
}
function isTruthy(v: Value): boolean {
  if (v == null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v.length > 0;
  return Boolean(v);
}

function evalNode(n: Node, ctx: Context, unknown: { hit: boolean }): Value {
  switch (n.kind) {
    case "num": return n.v;
    case "str": return n.v;
    case "bool": return n.v;
    case "null": return null;
    case "name":
      if (n.v in ctx) return ctx[n.v];
      unknown.hit = true;
      return null;
    case "not":
      return !isTruthy(evalNode(n.e, ctx, unknown));
    case "neg": {
      const v = asNumber(evalNode(n.e, ctx, unknown));
      return v == null ? null : -v;
    }
    case "bin": {
      const a = asNumber(evalNode(n.l, ctx, unknown));
      const b = asNumber(evalNode(n.r, ctx, unknown));
      if (a == null || b == null) return null;
      switch (n.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return b === 0 ? null : a / b;
        case "%": return b === 0 ? null : a % b;
      }
      return null;
    }
    case "cmp": {
      const a = evalNode(n.l, ctx, unknown);
      const b = evalNode(n.r, ctx, unknown);
      if (n.op === "in") {
        if (typeof b === "string") return typeof a === "string" && b.includes(a);
        return false;
      }
      // Equality across types: only the same primitive types compare;
      // null compared to anything (other than null) is false.
      if (n.op === "==") return a === b;
      if (n.op === "!=") return a !== b;
      // Ordering: numeric only. Either operand null/non-numeric => false (no fire).
      const an = asNumber(a);
      const bn = asNumber(b);
      if (an == null || bn == null) {
        // Allow string ordering too, for predictability with literal strings.
        const as = asString(a);
        const bs = asString(b);
        if (as != null && bs != null) {
          switch (n.op) {
            case "<": return as < bs;
            case "<=": return as <= bs;
            case ">": return as > bs;
            case ">=": return as >= bs;
          }
        }
        return false;
      }
      switch (n.op) {
        case "<": return an < bn;
        case "<=": return an <= bn;
        case ">": return an > bn;
        case ">=": return an >= bn;
      }
      return false;
    }
    case "and": {
      const a = evalNode(n.l, ctx, unknown);
      if (!isTruthy(a)) return false;
      return isTruthy(evalNode(n.r, ctx, unknown));
    }
    case "or": {
      const a = evalNode(n.l, ctx, unknown);
      if (isTruthy(a)) return true;
      return isTruthy(evalNode(n.r, ctx, unknown));
    }
  }
}

export type EvaluateResult = {
  fired: boolean;
  explanation: string;
  unknownName?: boolean;
  error?: string;
};

export function compileExpression(expr: string): Node {
  const toks = tokenize(expr);
  return new Parser(toks).parseAll();
}

export function evaluate(expr: string, ctx: Context): EvaluateResult {
  let tree: Node;
  try {
    tree = compileExpression(expr);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { fired: false, explanation: `invalid expression: ${msg}`, error: msg };
  }
  const unknown = { hit: false };
  const result = evalNode(tree, ctx, unknown);
  const fired = isTruthy(result);
  if (fired) {
    // Show only the variables that materially drove the decision.
    const present = Object.entries(ctx)
      .filter(([, v]) => v !== null && v !== "")
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(", ");
    return {
      fired: true,
      explanation: `${expr.trim()}  ==>  TRUE  (state: { ${present} })`,
    };
  }
  return {
    fired: false,
    explanation: unknown.hit
      ? `${expr.trim()}  ==>  False  (one or more referenced fields were missing)`
      : `${expr.trim()}  ==>  False`,
    unknownName: unknown.hit,
  };
}
