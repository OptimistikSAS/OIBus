import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseS7Address } from './s7-address';
import { decodeS7Value, formatS7Value } from './s7-values';

const decode = (address: string, hex: string) => decodeS7Value(parseS7Address(address), Buffer.from(hex, 'hex'));

describe('S7 values', () => {
  it('should decode the numeric data types', () => {
    assert.strictEqual(decode('DB1,REAL0', '4048f5c3'), Math.fround(3.14));
    assert.strictEqual(decode('DB1,LREAL0', '4005bf0a8b04919b'), 2.718281828);
    assert.strictEqual(decode('DB1,INT0', 'fb2e'), -1234);
    assert.strictEqual(decode('DB1,WORD0', 'beef'), 0xbeef);
    assert.strictEqual(decode('DB1,DINT0', 'f8a432eb'), -123456789);
    assert.strictEqual(decode('DB1,DWORD0', 'deadbeef'), 0xdeadbeef);
    assert.strictEqual(decode('DB1,BYTE0', 'fb'), 251);
    assert.strictEqual(decode('DB1,SINT0', 'fb'), -5);
    assert.strictEqual(decode('DB1,LINT0', 'ffe0068c35058000'), -9000000000000000n);
    assert.strictEqual(decode('DB1,ULINT0', 'f9ccd8a1c5080000'), 18000000000000000000n);
    assert.strictEqual(decode('T0', '1234'), 0x1234);
    assert.strictEqual(decode('C0', '0042'), 0x42);
  });

  it('should decode bits and bit arrays', () => {
    assert.strictEqual(decode('DB1,X0.0', 'a5'), true);
    assert.strictEqual(decode('DB1,X0.1', 'a5'), false);
    assert.strictEqual(decode('M0.7', '80'), true);
    assert.deepStrictEqual(decode('DB1,X0.0.8', 'a5'), [true, false, true, false, false, true, false, true]);
    // Bit array crossing a byte: bits 6 and 7 of the first byte, bit 0 of the second one
    assert.deepStrictEqual(decode('DB1,X0.6.3', '4001'), [true, false, true]);
  });

  it('should decode characters and strings', () => {
    assert.strictEqual(decode('DB1,CHAR0', '5a'), 'Z');
    assert.strictEqual(decode('DB1,C0.3', '5a0a05'), 'Z\n\u0005');
    assert.strictEqual(decode('DB1,CHAR0', 'e9'), 'é');
    // Maximum length 10, actual length 5
    assert.strictEqual(decode('DB1,S0.10', '0a0568656c6c6f0000000000'), 'hello');
    // Actual length greater than the maximum one: truncated
    assert.strictEqual(decode('DB1,S0.2', '02056869'), 'hi');
    assert.deepStrictEqual(decode('DB1,S0.2.2', '02016100020262e9'), ['a', 'bé']);
  });

  it('should decode arrays', () => {
    assert.deepStrictEqual(decode('DB1,REAL0.3', '3fc00000402000004060000'.padEnd(24, '0')), [1.5, 2.5, 3.5]);
    assert.deepStrictEqual(decode('DB1,INT0.4', '0001000200030004'), [1, 2, 3, 4]);
    assert.deepStrictEqual(decode('T0.2', '12341235'), [0x1234, 0x1235]);
  });

  it('should decode DATE_AND_TIME in local time, or in UTC', () => {
    assert.deepStrictEqual(decode('DB1,DT0', '2403151234567896'), new Date(2024, 2, 15, 12, 34, 56, 789));
    assert.deepStrictEqual(decode('DB1,DTZ0', '2403151234567896'), new Date(Date.UTC(2024, 2, 15, 12, 34, 56, 789)));
    // Two-digit years from 90 are in the 20th century
    assert.deepStrictEqual(decode('DB1,DTZ0', '9512312359590000'), new Date(Date.UTC(1995, 11, 31, 23, 59, 59, 0)));
  });

  it('should decode DTL in local time, or in UTC', () => {
    assert.deepStrictEqual(decode('DB1,DTL0', '07e8030f060c22382f072f40'), new Date(2024, 2, 15, 12, 34, 56, 789));
    assert.deepStrictEqual(decode('DB1,DTLZ0', '07e8030f060c22382f072f40'), new Date(Date.UTC(2024, 2, 15, 12, 34, 56, 789)));
  });

  it('should reject a buffer shorter than the address', () => {
    assert.throws(() => decode('DB1,REAL0', '4048'), new Error('Expected 4 bytes for "DB1,REAL0", got 2'));
  });

  it('should format values as text', () => {
    assert.strictEqual(formatS7Value(Math.fround(3.14)), '3.140000104904175');
    assert.strictEqual(formatS7Value(true), 'true');
    assert.strictEqual(formatS7Value(-9000000000000000n), '-9000000000000000');
    assert.strictEqual(formatS7Value('hello'), 'hello');
    assert.strictEqual(formatS7Value(new Date(Date.UTC(2024, 2, 15, 12, 34, 56, 789))), '2024-03-15T12:34:56.789Z');
    assert.strictEqual(formatS7Value(new Date(NaN)), 'Invalid Date');
    assert.strictEqual(formatS7Value([1.5, 2.5, 3.5]), '1.5,2.5,3.5');
    assert.strictEqual(formatS7Value([true, false]), 'true,false');
  });
});
