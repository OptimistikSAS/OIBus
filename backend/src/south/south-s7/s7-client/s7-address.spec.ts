import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseS7Address } from './s7-address';

// [address, area, db, data type, offset, bit offset, array length, element length, byte length]
const validAddresses: Array<[string, string, number, string, number, number, number, number, number]> = [
  // Data blocks, every data type and its aliases
  ['DB1,REAL0', 'DB', 1, 'REAL', 0, 0, 1, 4, 4],
  ['DB1,R0', 'DB', 1, 'REAL', 0, 0, 1, 4, 4],
  ['DB1,INT2', 'DB', 1, 'INT', 2, 0, 1, 2, 2],
  ['DB1,I2', 'DB', 1, 'INT', 2, 0, 1, 2, 2],
  ['DB1,DINT6', 'DB', 1, 'DINT', 6, 0, 1, 4, 4],
  ['DB1,DI6', 'DB', 1, 'DINT', 6, 0, 1, 4, 4],
  ['DB1,WORD10', 'DB', 1, 'WORD', 10, 0, 1, 2, 2],
  ['DB1,W10', 'DB', 1, 'WORD', 10, 0, 1, 2, 2],
  ['DB1,UINT10', 'DB', 1, 'WORD', 10, 0, 1, 2, 2],
  ['DB1,DWORD12', 'DB', 1, 'DWORD', 12, 0, 1, 4, 4],
  ['DB1,DW12', 'DB', 1, 'DWORD', 12, 0, 1, 4, 4],
  ['DB1,D12', 'DB', 1, 'DWORD', 12, 0, 1, 4, 4],
  ['DB1,UDINT12', 'DB', 1, 'DWORD', 12, 0, 1, 4, 4],
  ['DB1,BYTE16', 'DB', 1, 'BYTE', 16, 0, 1, 1, 1],
  ['DB1,B16', 'DB', 1, 'BYTE', 16, 0, 1, 1, 1],
  ['DB1,USINT16', 'DB', 1, 'BYTE', 16, 0, 1, 1, 1],
  ['DB1,SINT16', 'DB', 1, 'SINT', 16, 0, 1, 1, 1],
  ['DB1,CHAR17', 'DB', 1, 'CHAR', 17, 0, 1, 1, 1],
  ['DB1,C17', 'DB', 1, 'CHAR', 17, 0, 1, 1, 1],
  ['DB1,LREAL30', 'DB', 1, 'LREAL', 30, 0, 1, 8, 8],
  ['DB1,LR30', 'DB', 1, 'LREAL', 30, 0, 1, 8, 8],
  ['DB1,LINT30', 'DB', 1, 'LINT', 30, 0, 1, 8, 8],
  ['DB1,LI30', 'DB', 1, 'LINT', 30, 0, 1, 8, 8],
  ['DB1,ULINT30', 'DB', 1, 'ULINT', 30, 0, 1, 8, 8],
  ['DB1,LWORD30', 'DB', 1, 'ULINT', 30, 0, 1, 8, 8],
  ['DB1,DT58', 'DB', 1, 'DT', 58, 0, 1, 8, 8],
  ['DB1,DTZ58', 'DB', 1, 'DTZ', 58, 0, 1, 8, 8],
  ['DB1,DTL66', 'DB', 1, 'DTL', 66, 0, 1, 12, 12],
  ['DB1,DTLZ66', 'DB', 1, 'DTLZ', 66, 0, 1, 12, 12],
  // Bits, bit arrays
  ['DB1,X4.0', 'DB', 1, 'X', 4, 0, 1, 1, 1],
  ['DB1,BOOL4.7', 'DB', 1, 'X', 4, 7, 1, 1, 1],
  ['DB1,X4.6.3', 'DB', 1, 'X', 4, 6, 3, 1, 2],
  ['DB1,X4.0.16', 'DB', 1, 'X', 4, 0, 16, 1, 2],
  // Strings, string arrays
  ['DB1,S18.10', 'DB', 1, 'STRING', 18, 0, 1, 12, 12],
  ['DB1,STRING18.254', 'DB', 1, 'STRING', 18, 0, 1, 256, 256],
  ['DB1,S18.10.2', 'DB', 1, 'STRING', 18, 0, 2, 12, 24],
  // Arrays
  ['DB1,REAL0.20', 'DB', 1, 'REAL', 0, 0, 20, 4, 80],
  ['DB1,C17.3', 'DB', 1, 'CHAR', 17, 0, 3, 1, 3],
  // Case, spaces, large data block
  ['db12,real4', 'DB', 12, 'REAL', 4, 0, 1, 4, 4],
  [' DB65535 , Int2 ', 'DB', 65535, 'INT', 2, 0, 1, 2, 2],
  // Merkers
  ['M32.2', 'M', 0, 'X', 32, 2, 1, 1, 1],
  ['M0.0.3', 'M', 0, 'X', 0, 0, 3, 1, 1],
  ['MB0', 'M', 0, 'BYTE', 0, 0, 1, 1, 1],
  ['MB0.3', 'M', 0, 'BYTE', 0, 0, 3, 1, 3],
  ['MC0', 'M', 0, 'CHAR', 0, 0, 1, 1, 1],
  ['MW8', 'M', 0, 'WORD', 8, 0, 1, 2, 2],
  ['MI8', 'M', 0, 'INT', 8, 0, 1, 2, 2],
  ['MD4', 'M', 0, 'DWORD', 4, 0, 1, 4, 4],
  ['MDW4', 'M', 0, 'DWORD', 4, 0, 1, 4, 4],
  ['MDI4', 'M', 0, 'DINT', 4, 0, 1, 4, 4],
  ['MR4', 'M', 0, 'REAL', 4, 0, 1, 4, 4],
  ['MLR4', 'M', 0, 'LREAL', 4, 0, 1, 8, 8],
  ['MLI4', 'M', 0, 'LINT', 4, 0, 1, 8, 8],
  // Inputs and outputs, English and German mnemonics
  ['I0.1', 'I', 0, 'X', 0, 1, 1, 1, 1],
  ['E0.1', 'I', 0, 'X', 0, 1, 1, 1, 1],
  ['IB0', 'I', 0, 'BYTE', 0, 0, 1, 1, 1],
  ['EW2', 'I', 0, 'WORD', 2, 0, 1, 2, 2],
  ['Q0.4', 'Q', 0, 'X', 0, 4, 1, 1, 1],
  ['A0.4', 'Q', 0, 'X', 0, 4, 1, 1, 1],
  ['QB0', 'Q', 0, 'BYTE', 0, 0, 1, 1, 1],
  ['AD0', 'Q', 0, 'DWORD', 0, 0, 1, 4, 4],
  // Peripherals
  ['PIW256', 'P', 0, 'WORD', 256, 0, 1, 2, 2],
  ['PEB256', 'P', 0, 'BYTE', 256, 0, 1, 1, 1],
  ['PQD256', 'P', 0, 'DWORD', 256, 0, 1, 4, 4],
  ['PAR256', 'P', 0, 'REAL', 256, 0, 1, 4, 4],
  // Timers and counters
  ['T3', 'T', 0, 'TIMER', 3, 0, 1, 2, 2],
  ['T0.2', 'T', 0, 'TIMER', 0, 0, 2, 2, 4],
  ['C1', 'C', 0, 'COUNTER', 1, 0, 1, 2, 2]
];

const invalidAddresses: Array<[string, string]> = [
  ['DB1,REAL0,1', 'too many commas'],
  ['DBX1,REAL0', 'a data block must be written DB<number>'],
  ['DB0,REAL0', 'the data block number must be between 1 and 65535'],
  ['DB65536,REAL0', 'the data block number must be between 1 and 65535'],
  ['DB1,REAL', 'expected <type><offset>[.<bit or length>][.<array length>]'],
  ['DB1.DBX0.0', 'expected <type><offset>[.<bit or length>][.<array length>]'],
  ['DB1,REAL0.1.2.3', 'expected <type><offset>[.<bit or length>][.<array length>]'],
  ['', 'expected <type><offset>[.<bit or length>][.<array length>]'],
  ['DB1,DBX0.0', 'unknown data type "DBX"'],
  ['DB1,TIMER0', 'unknown data type "TIMER"'],
  ['V0', 'unknown memory area or data type "V"'],
  ['IX0.0', 'unknown memory area or data type "IX"'],
  ['DB1,X4', 'a bit address requires a bit offset (e.g. M32.2)'],
  ['M32', 'a bit address requires a bit offset (e.g. M32.2)'],
  ['DB1,X4.8', 'the bit offset must be between 0 and 7'],
  ['DB1,X4.0.0', 'the array length must be between 1 and 65535'],
  ['DB1,S10', 'a string requires its maximum length (e.g. DB1,S10.20)'],
  ['DB1,S10.0', 'the string length must be between 1 and 254'],
  ['DB1,S10.255', 'the string length must be between 1 and 254'],
  ['DB1,S10.20.0', 'the array length must be between 1 and 65535'],
  ['DB1,REAL0.0', 'the array length must be between 1 and 65535'],
  ['DB1,REAL0.2.3', 'only bits and strings accept two suffixes'],
  ['DB1,REAL2097152', 'the offset must not exceed 2097151']
];

describe('S7 address', () => {
  for (const [address, area, dbNumber, dataType, offset, bitOffset, arrayLength, elementLength, byteLength] of validAddresses) {
    it(`should parse ${address}`, () => {
      const parsed = parseS7Address(address);
      assert.deepStrictEqual(
        [parsed.address, parsed.area, parsed.dbNumber, parsed.dataType, parsed.offset, parsed.bitOffset],
        [address, area, dbNumber, dataType, offset, bitOffset]
      );
      assert.deepStrictEqual([parsed.arrayLength, parsed.elementLength, parsed.byteLength], [arrayLength, elementLength, byteLength]);
    });
  }

  it('should give the S7comm area codes', () => {
    assert.deepStrictEqual(
      ['PIB0', 'IB0', 'QB0', 'MB0', 'DB1,B0', 'C0', 'T0'].map(address => parseS7Address(address).areaCode),
      [0x80, 0x81, 0x82, 0x83, 0x84, 0x1c, 0x1d]
    );
  });

  for (const [address, reason] of invalidAddresses) {
    it(`should reject "${address}"`, () => {
      assert.throws(() => parseS7Address(address), new Error(`Invalid S7 address "${address}": ${reason}`));
    });
  }
});
