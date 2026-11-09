import { FieldNumberOperator, FieldOperation } from '../../../../../shared/model/connector/field-process.model';

/**
 * Up to 3.9, a field of a transformer was processed by a JavaScript expression on `value`. From 3.10, it is processed by
 * operations only (upper case, substring, number operation...): the expressions used were string and number operations,
 * which `expressionToOperations` turns into the operations doing the same.
 *
 * The expression is parsed, never evaluated. Only a chain of operations on `value` with constant arguments is understood:
 *  - `value.toUpperCase()`, `value.toLowerCase()`, `value.trim()`
 *  - `value.substring(start, end)`, `value.slice(start, end)`, `value.substr(start, length)`
 *  - `value.replace('a', 'b')`, `value.replaceAll('a', 'b')` (every occurrence is replaced)
 *  - `value.toString()`, `String(value)`, `Number(value)`, `parseFloat(value)`, `parseInt(value)` (rounded)
 *  - `value * 2`, `value / 1000`, `value + 10`, `value - 10`
 *  - `Math.round(value)`, `Math.round(value * 100) / 100`, `value.toFixed(2)`
 *  - `'prefix' + value + 'suffix'`, `` `prefix${value}suffix` ``
 * each possibly applied to the result of another one (`value.trim().toUpperCase()`).
 */

type Operation = FieldOperation;

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'template'; strings: Array<string>; expressions: Array<string> }
  | { kind: 'identifier'; value: string }
  | { kind: 'punctuation'; value: string };

type Node =
  | { kind: 'value' }
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'template'; strings: Array<string>; expressions: Array<Node> }
  | { kind: 'call'; callee: string; args: Array<Node> }
  | { kind: 'method'; target: Node; name: string; args: Array<Node> }
  | { kind: 'binary'; operator: string; left: Node; right: Node };

class UnsupportedExpression extends Error {}

/**
 * The operations doing what a JavaScript expression on `value` did, or null when it does something no operation does
 * (e.g. `value.split('/').pop()`). An empty expression did nothing: no operation.
 *
 * @example
 *   expressionToOperations("value.trim().toUpperCase()") // → [{ type: 'trim' }, { type: 'uppercase' }]
 *   expressionToOperations("value / 1000")               // → [{ type: 'number-operation', operator: 'divide', operand: 1000 }]
 */
export function expressionToOperations(expression: string): Array<Operation> | null {
  const source = expression.trim().replace(/;+$/, '').trim();
  if (!source) {
    return [];
  }
  try {
    return mergeAddToString(toOperations(parse(source)));
  } catch {
    return null;
  }
}

function parse(source: string): Node {
  const parser = new Parser(tokenize(source));
  const node = parser.parseExpression();
  parser.expectEnd();
  return node;
}

const PUNCTUATION = new Set(['.', '(', ')', ',', '+', '-', '*', '/']);

function tokenize(source: string): Array<Token> {
  const tokens: Array<Token> = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index++;
    } else if (/\d/.test(char) || (char === '.' && /\d/.test(source[index + 1] ?? ''))) {
      const match = /^(\d*\.?\d+(?:[eE][+-]?\d+)?|\d+\.)/.exec(source.slice(index))!;
      tokens.push({ kind: 'number', value: Number(match[0]) });
      index += match[0].length;
    } else if (/[A-Za-z_$]/.test(char)) {
      const match = /^[A-Za-z_$][\w$]*/.exec(source.slice(index))!;
      tokens.push({ kind: 'identifier', value: match[0] });
      index += match[0].length;
    } else if (char === "'" || char === '"') {
      const [value, end] = readString(source, index + 1, char);
      tokens.push({ kind: 'string', value });
      index = end;
    } else if (char === '`') {
      const [token, end] = readTemplate(source, index + 1);
      tokens.push(token);
      index = end;
    } else if (char === '?' && source[index + 1] === '.') {
      // optional chaining: `value?.trim()` processes a value just like `value.trim()` - an empty one is not processed
      tokens.push({ kind: 'punctuation', value: '.' });
      index += 2;
    } else if (PUNCTUATION.has(char)) {
      tokens.push({ kind: 'punctuation', value: char });
      index++;
    } else {
      throw new UnsupportedExpression(`unexpected character "${char}"`);
    }
  }
  return tokens;
}

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0' };

/** The text of a string literal starting at `start` (after its opening quote), and the index after its closing quote */
function readString(source: string, start: number, quote: string): [string, number] {
  let value = '';
  let index = start;
  while (index < source.length) {
    const char = source[index];
    if (char === quote) {
      return [value, index + 1];
    }
    if (char === '\\') {
      const escaped = source[index + 1];
      if (escaped === undefined || escaped === 'u' || escaped === 'x') {
        throw new UnsupportedExpression('unsupported escape sequence');
      }
      value += ESCAPES[escaped] ?? escaped;
      index += 2;
    } else {
      value += char;
      index++;
    }
  }
  throw new UnsupportedExpression('unterminated string');
}

/** A template literal starting at `start` (after its opening backtick): its texts and the source of its expressions */
function readTemplate(source: string, start: number): [Token, number] {
  const strings: Array<string> = [];
  const expressions: Array<string> = [];
  let current = '';
  let index = start;
  while (index < source.length) {
    const char = source[index];
    if (char === '`') {
      strings.push(current);
      return [{ kind: 'template', strings, expressions }, index + 1];
    }
    if (char === '\\') {
      const escaped = source[index + 1];
      if (escaped === undefined || escaped === 'u' || escaped === 'x') {
        throw new UnsupportedExpression('unsupported escape sequence');
      }
      current += ESCAPES[escaped] ?? escaped;
      index += 2;
    } else if (char === '$' && source[index + 1] === '{') {
      // Expressions with braces or nested templates are not understood anyway
      const end = source.indexOf('}', index + 2);
      if (end === -1 || source.slice(index + 2, end).includes('`')) {
        throw new UnsupportedExpression('unsupported template expression');
      }
      strings.push(current);
      current = '';
      expressions.push(source.slice(index + 2, end));
      index = end + 1;
    } else {
      current += char;
      index++;
    }
  }
  throw new UnsupportedExpression('unterminated template');
}

/** additive := multiplicative (('+' | '-') multiplicative)* ; multiplicative := unary (('*' | '/') unary)* */
class Parser {
  private index = 0;

  constructor(private readonly tokens: Array<Token>) {}

  parseExpression(): Node {
    let node = this.parseMultiplicative();
    while (this.isPunctuation('+') || this.isPunctuation('-')) {
      const operator = this.nextPunctuation();
      node = { kind: 'binary', operator, left: node, right: this.parseMultiplicative() };
    }
    return node;
  }

  expectEnd(): void {
    if (this.index < this.tokens.length) {
      throw new UnsupportedExpression('unexpected token');
    }
  }

  private parseMultiplicative(): Node {
    let node = this.parseUnary();
    while (this.isPunctuation('*') || this.isPunctuation('/')) {
      const operator = this.nextPunctuation();
      node = { kind: 'binary', operator, left: node, right: this.parseUnary() };
    }
    return node;
  }

  private parseUnary(): Node {
    if (this.isPunctuation('-')) {
      this.next();
      const operand = this.parseUnary();
      if (operand.kind !== 'number') {
        throw new UnsupportedExpression('unsupported negation');
      }
      return { kind: 'number', value: -operand.value };
    }
    if (this.isPunctuation('+')) {
      // `+value` converts the value into a number
      this.next();
      return { kind: 'call', callee: 'Number', args: [this.parseUnary()] };
    }
    return this.parsePostfix();
  }

  /** A primary, with the methods called on it: `value.trim().toUpperCase()` */
  private parsePostfix(): Node {
    let node = this.parsePrimary();
    while (this.isPunctuation('.')) {
      this.next();
      const name = this.expectIdentifier();
      node = { kind: 'method', target: node, name, args: this.parseArguments() };
    }
    return node;
  }

  private parsePrimary(): Node {
    const token = this.next();
    switch (token.kind) {
      case 'number':
        return { kind: 'number', value: token.value };
      case 'string':
        return { kind: 'string', value: token.value };
      case 'template':
        return { kind: 'template', strings: token.strings, expressions: token.expressions.map(expression => parse(expression)) };
      case 'identifier': {
        if (token.value === 'value') {
          return { kind: 'value' };
        }
        // A global function: `Number(value)`, `Math.round(value)`...
        let callee = token.value;
        while (this.isPunctuation('.')) {
          this.next();
          callee += `.${this.expectIdentifier()}`;
        }
        return { kind: 'call', callee, args: this.parseArguments() };
      }
      case 'punctuation': {
        if (token.value !== '(') {
          throw new UnsupportedExpression('unexpected token');
        }
        const node = this.parseExpression();
        this.expectPunctuation(')');
        return node;
      }
    }
  }

  private parseArguments(): Array<Node> {
    this.expectPunctuation('(');
    const args: Array<Node> = [];
    if (this.isPunctuation(')')) {
      this.next();
      return args;
    }
    args.push(this.parseExpression());
    while (this.isPunctuation(',')) {
      this.next();
      args.push(this.parseExpression());
    }
    this.expectPunctuation(')');
    return args;
  }

  private nextPunctuation(): string {
    const token = this.next();
    return token.kind === 'punctuation' ? token.value : '';
  }

  private next(): Token {
    const token = this.tokens[this.index++];
    if (!token) {
      throw new UnsupportedExpression('unexpected end');
    }
    return token;
  }

  private isPunctuation(value: string): boolean {
    const token = this.tokens[this.index];
    return token?.kind === 'punctuation' && token.value === value;
  }

  private expectPunctuation(value: string): void {
    if (!this.isPunctuation(value)) {
      throw new UnsupportedExpression(`"${value}" expected`);
    }
    this.next();
  }

  private expectIdentifier(): string {
    const token = this.next();
    if (token.kind !== 'identifier') {
      throw new UnsupportedExpression('identifier expected');
    }
    return token.value;
  }
}

/** Whether a node depends on the value - the other ones are constants */
function usesValue(node: Node): boolean {
  switch (node.kind) {
    case 'value':
      return true;
    case 'number':
    case 'string':
      return false;
    case 'template':
      return node.expressions.some(usesValue);
    case 'call':
      return node.args.some(usesValue);
    case 'method':
      return usesValue(node.target) || node.args.some(usesValue);
    case 'binary':
      return usesValue(node.left) || usesValue(node.right);
  }
}

function numberArgument(node: Node | undefined): number {
  if (node?.kind !== 'number') {
    throw new UnsupportedExpression('number expected');
  }
  return node.value;
}

function integerArgument(node: Node | undefined): number {
  const value = numberArgument(node);
  if (!Number.isInteger(value)) {
    throw new UnsupportedExpression('integer expected');
  }
  return value;
}

function stringArgument(node: Node | undefined): string {
  if (node?.kind === 'string') {
    return node.value;
  }
  if (node?.kind === 'template' && node.expressions.length === 0) {
    return node.strings[0];
  }
  throw new UnsupportedExpression('string expected');
}

/** The number of decimals `factor` (10, 100, 1000...) rounds to, in `Math.round(value * factor) / factor` */
function decimalsOf(factor: number): number | null {
  const decimals = Math.log10(factor);
  return Number.isInteger(decimals) && decimals >= 0 ? decimals : null;
}

/** The operations of a node depending on the value: those of what it applies to, then its own */
function toOperations(node: Node): Array<Operation> {
  switch (node.kind) {
    case 'value':
      return [];
    case 'number':
    case 'string':
      throw new UnsupportedExpression('constant');
    case 'template':
      return templateOperations(node);
    case 'method':
      return [...toOperations(node.target), ...methodOperations(node.name, node.args)];
    case 'call':
      return callOperations(node.callee, node.args);
    case 'binary':
      return binaryOperations(node.operator, node.left, node.right);
  }
}

function templateOperations(node: Extract<Node, { kind: 'template' }>): Array<Operation> {
  if (node.expressions.length !== 1) {
    throw new UnsupportedExpression('unsupported template');
  }
  return [...toOperations(node.expressions[0]), { type: 'add-to-string', prefix: node.strings[0], suffix: node.strings[1] }];
}

function methodOperations(name: string, args: Array<Node>): Array<Operation> {
  if (args.some(usesValue)) {
    throw new UnsupportedExpression('unsupported argument');
  }
  switch (name) {
    case 'toUpperCase':
    case 'toLocaleUpperCase':
      return [{ type: 'uppercase' }];
    case 'toLowerCase':
    case 'toLocaleLowerCase':
      return [{ type: 'lowercase' }];
    case 'trim':
      return [{ type: 'trim' }];
    case 'toString':
      if (args.length > 0) break;
      return [{ type: 'convert', to: 'string' }];
    case 'slice':
      return [
        {
          type: 'substring',
          start: integerArgument(args[0] ?? { kind: 'number', value: 0 }),
          end: args[1] ? integerArgument(args[1]) : null
        }
      ];
    case 'substring': {
      // `substring` counts a negative index as 0, and swaps its indexes when the start is after the end
      const start = Math.max(0, integerArgument(args[0] ?? { kind: 'number', value: 0 }));
      if (!args[1]) {
        return [{ type: 'substring', start, end: null }];
      }
      const end = Math.max(0, integerArgument(args[1]));
      return [{ type: 'substring', start: Math.min(start, end), end: Math.max(start, end) }];
    }
    case 'substr': {
      const start = integerArgument(args[0] ?? { kind: 'number', value: 0 });
      if (start < 0) break;
      return [{ type: 'substring', start, end: args[1] ? start + Math.max(0, integerArgument(args[1])) : null }];
    }
    case 'replace':
    case 'replaceAll':
      if (args.length !== 2) break;
      return [{ type: 'replace', search: stringArgument(args[0]), replacement: stringArgument(args[1]) }];
    case 'toFixed':
      return [{ type: 'round', decimals: args[0] ? integerArgument(args[0]) : 0 }];
  }
  throw new UnsupportedExpression(`unsupported method "${name}"`);
}

function callOperations(callee: string, args: Array<Node>): Array<Operation> {
  const [argument, ...others] = args;
  if (!argument) {
    throw new UnsupportedExpression('argument expected');
  }
  switch (callee) {
    case 'String':
      if (others.length > 0) break;
      return [...toOperations(argument), { type: 'convert', to: 'string' }];
    case 'Number':
    case 'parseFloat':
      if (others.length > 0) break;
      return [...toOperations(argument), { type: 'convert', to: 'number' }];
    case 'parseInt':
      if (others.length > 1 || (others[0] && numberArgument(others[0]) !== 10)) break;
      return [...toOperations(argument), { type: 'convert', to: 'number' }, { type: 'round', decimals: 0 }];
    case 'Math.round':
      if (others.length > 0) break;
      return [...toOperations(argument), { type: 'round', decimals: 0 }];
  }
  throw new UnsupportedExpression(`unsupported function "${callee}"`);
}

const NUMBER_OPERATORS: Record<string, FieldNumberOperator> = { '+': 'add', '-': 'subtract', '*': 'multiply', '/': 'divide' };

function binaryOperations(operator: string, left: Node, right: Node): Array<Operation> {
  // `Math.round(value * 100) / 100` rounds to 2 decimals
  if (
    operator === '/' &&
    right.kind === 'number' &&
    left.kind === 'call' &&
    left.callee === 'Math.round' &&
    left.args.length === 1 &&
    left.args[0].kind === 'binary' &&
    left.args[0].operator === '*'
  ) {
    const product = left.args[0];
    const factor = product.right.kind === 'number' ? product.right : product.left.kind === 'number' ? product.left : null;
    const decimals = factor && factor.value === right.value ? decimalsOf(factor.value) : null;
    if (decimals !== null) {
      return [...toOperations(factor === product.right ? product.left : product.right), { type: 'round', decimals }];
    }
  }
  const leftUsesValue = usesValue(left);
  if (leftUsesValue === usesValue(right)) {
    throw new UnsupportedExpression('one operand must be the value, the other a constant');
  }
  const [operand, constant] = leftUsesValue ? [left, right] : [right, left];
  if (operator === '+' && (constant.kind === 'string' || constant.kind === 'template')) {
    const text = stringArgument(constant);
    return [...toOperations(operand), { type: 'add-to-string', prefix: leftUsesValue ? '' : text, suffix: leftUsesValue ? text : '' }];
  }
  // `10 - value` and `10 / value` are not operations on the value
  if (!leftUsesValue && (operator === '-' || operator === '/')) {
    throw new UnsupportedExpression('unsupported operation');
  }
  return [...toOperations(operand), { type: 'number-operation', operator: NUMBER_OPERATORS[operator], operand: numberArgument(constant) }];
}

/** `'a' + value + 'b'` adds a prefix then a suffix: a single operation adding both */
function mergeAddToString(operations: Array<Operation>): Array<Operation> {
  const merged: Array<Operation> = [];
  for (const operation of operations) {
    const last = merged.at(-1);
    if (operation.type === 'add-to-string' && last?.type === 'add-to-string') {
      merged[merged.length - 1] = {
        type: 'add-to-string',
        prefix: `${operation.prefix}${last.prefix}`,
        suffix: `${last.suffix}${operation.suffix}`
      };
    } else {
      merged.push(operation);
    }
  }
  return merged;
}
