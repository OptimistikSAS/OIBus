import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toModbusValue } from './modbus-value';

describe('toModbusValue', () => {
  it('should convert values into coils', () => {
    assert.strictEqual(toModbusValue(true, 'coil'), true);
    assert.strictEqual(toModbusValue(false, 'coil'), false);
    assert.strictEqual(toModbusValue(1, 'coil'), true);
    assert.strictEqual(toModbusValue(0, 'coil'), false);
    assert.strictEqual(toModbusValue('1', 'coil'), true);
    assert.strictEqual(toModbusValue('0', 'coil'), false);
    assert.strictEqual(toModbusValue('True', 'coil'), true);
    assert.strictEqual(toModbusValue(' false ', 'coil'), false);
  });

  it('should convert values into registers', () => {
    assert.strictEqual(toModbusValue(12, 'register'), 12);
    assert.strictEqual(toModbusValue(12.7, 'register'), 12);
    assert.strictEqual(toModbusValue('42', 'register'), 42);
    assert.strictEqual(toModbusValue('1e3', 'register'), 1000);
    assert.strictEqual(toModbusValue(true, 'register'), 1);
    assert.strictEqual(toModbusValue('false', 'register'), 0);
  });

  it('should not convert values that are not numbers or booleans', () => {
    assert.strictEqual(toModbusValue('on', 'coil'), null);
    assert.strictEqual(toModbusValue('', 'register'), null);
    assert.strictEqual(toModbusValue('abc', 'register'), null);
    assert.strictEqual(toModbusValue(null, 'register'), null);
    assert.strictEqual(toModbusValue(Infinity, 'register'), null);
  });
});
