import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyFieldOperations } from '../../../../transformers/field-process';
import { expressionToOperations } from './expression-operations';

describe('expressionToOperations', () => {
  it('should give no operation for an empty expression, or the value itself', () => {
    assert.deepStrictEqual(expressionToOperations(''), []);
    assert.deepStrictEqual(expressionToOperations('   '), []);
    assert.deepStrictEqual(expressionToOperations('value'), []);
    assert.deepStrictEqual(expressionToOperations('(value);'), []);
  });

  it('should turn the string methods into operations', () => {
    assert.deepStrictEqual(expressionToOperations('value.toUpperCase()'), [{ type: 'uppercase' }]);
    assert.deepStrictEqual(expressionToOperations('value.toLowerCase()'), [{ type: 'lowercase' }]);
    assert.deepStrictEqual(expressionToOperations('value?.trim()'), [{ type: 'trim' }]);
    assert.deepStrictEqual(expressionToOperations('value.toString()'), [{ type: 'convert', to: 'string' }]);
    assert.deepStrictEqual(expressionToOperations('String(value)'), [{ type: 'convert', to: 'string' }]);
    assert.deepStrictEqual(expressionToOperations('value.substring(2, 5)'), [{ type: 'substring', start: 2, end: 5 }]);
    assert.deepStrictEqual(expressionToOperations('value.substring(5, 2)'), [{ type: 'substring', start: 2, end: 5 }]);
    assert.deepStrictEqual(expressionToOperations('value.substring(3)'), [{ type: 'substring', start: 3, end: null }]);
    assert.deepStrictEqual(expressionToOperations('value.slice(-3)'), [{ type: 'substring', start: -3, end: null }]);
    assert.deepStrictEqual(expressionToOperations('value.slice(1, -1)'), [{ type: 'substring', start: 1, end: -1 }]);
    assert.deepStrictEqual(expressionToOperations('value.substr(1, 3)'), [{ type: 'substring', start: 1, end: 4 }]);
    assert.deepStrictEqual(expressionToOperations('value.replace(".", ",")'), [{ type: 'replace', search: '.', replacement: ',' }]);
    assert.deepStrictEqual(expressionToOperations("value.replaceAll('/', '\\'')"), [{ type: 'replace', search: '/', replacement: "'" }]);
  });

  it('should turn the additions of text into a single operation', () => {
    assert.deepStrictEqual(expressionToOperations("'plant.' + value"), [{ type: 'add-to-string', prefix: 'plant.', suffix: '' }]);
    assert.deepStrictEqual(expressionToOperations("value + '_raw'"), [{ type: 'add-to-string', prefix: '', suffix: '_raw' }]);
    assert.deepStrictEqual(expressionToOperations('"[" + value + "]"'), [{ type: 'add-to-string', prefix: '[', suffix: ']' }]);
    assert.deepStrictEqual(expressionToOperations('`plant.${value}.raw`'), [{ type: 'add-to-string', prefix: 'plant.', suffix: '.raw' }]);
    assert.deepStrictEqual(expressionToOperations('`${value.trim()}`'), [
      { type: 'trim' },
      { type: 'add-to-string', prefix: '', suffix: '' }
    ]);
  });

  it('should turn the number operations into operations', () => {
    assert.deepStrictEqual(expressionToOperations('value * 2'), [{ type: 'number-operation', operator: 'multiply', operand: 2 }]);
    assert.deepStrictEqual(expressionToOperations('2 * value'), [{ type: 'number-operation', operator: 'multiply', operand: 2 }]);
    assert.deepStrictEqual(expressionToOperations('value / 1e3'), [{ type: 'number-operation', operator: 'divide', operand: 1000 }]);
    assert.deepStrictEqual(expressionToOperations('value + 273.15'), [{ type: 'number-operation', operator: 'add', operand: 273.15 }]);
    assert.deepStrictEqual(expressionToOperations('value - -1'), [{ type: 'number-operation', operator: 'subtract', operand: -1 }]);
    assert.deepStrictEqual(expressionToOperations('Number(value)'), [{ type: 'convert', to: 'number' }]);
    assert.deepStrictEqual(expressionToOperations('+value'), [{ type: 'convert', to: 'number' }]);
    assert.deepStrictEqual(expressionToOperations('parseFloat(value)'), [{ type: 'convert', to: 'number' }]);
    assert.deepStrictEqual(expressionToOperations('parseInt(value, 10)'), [
      { type: 'convert', to: 'number' },
      { type: 'round', decimals: 0 }
    ]);
    assert.deepStrictEqual(expressionToOperations('Math.round(value)'), [{ type: 'round', decimals: 0 }]);
    assert.deepStrictEqual(expressionToOperations('Math.round(value * 100) / 100'), [{ type: 'round', decimals: 2 }]);
    assert.deepStrictEqual(expressionToOperations('Math.round(1000 * value) / 1000'), [{ type: 'round', decimals: 3 }]);
    assert.deepStrictEqual(expressionToOperations('value.toFixed(1)'), [{ type: 'round', decimals: 1 }]);
  });

  it('should chain the operations, in the order they apply', () => {
    assert.deepStrictEqual(expressionToOperations('value.trim().toUpperCase()'), [{ type: 'trim' }, { type: 'uppercase' }]);
    assert.deepStrictEqual(expressionToOperations("'ref_' + value.replace('/', '.').toLowerCase()"), [
      { type: 'replace', search: '/', replacement: '.' },
      { type: 'lowercase' },
      { type: 'add-to-string', prefix: 'ref_', suffix: '' }
    ]);
    assert.deepStrictEqual(expressionToOperations('Math.round(parseFloat(value) / 1000 * 10) / 10'), [
      { type: 'convert', to: 'number' },
      { type: 'number-operation', operator: 'divide', operand: 1000 },
      { type: 'round', decimals: 1 }
    ]);
  });

  it('should do what the expression did', () => {
    const check = (expression: string, value: unknown, expected: unknown) =>
      assert.strictEqual(applyFieldOperations(value, expressionToOperations(expression)!), expected, expression);
    check("'[' + value.trim().toUpperCase() + ']'", ' temp ', '[TEMP]');
    check('Math.round(value * 100) / 100', 3.14159, 3.14);
    check('value.substring(0, 4)', 'Plant/Reactor', 'Plan');
    check('value / 1000', '1500', 1.5);
  });

  it('should not understand what no operation does', () => {
    for (const expression of [
      "value.split('/').pop()",
      'value.length',
      'Math.abs(value)',
      '10 - value',
      '1 / value',
      'value + value',
      "'constant'",
      '42',
      'value.replace(/\\./g, ",")',
      "value.replace('a', value)",
      'parseInt(value, 16)',
      'value ? 1 : 0',
      '`${value}-${value}`',
      "value.padStart(4, '0')",
      'value.substring(',
      "'unterminated",
      'require("fs")'
    ]) {
      assert.strictEqual(expressionToOperations(expression), null, expression);
    }
  });
});
