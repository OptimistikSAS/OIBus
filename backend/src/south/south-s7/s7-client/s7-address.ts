// S7 address parser, ported to TypeScript from nodeS7 (https://github.com/plcpeople/nodeS7, stringToS7Addr) and
// extended with the LREAL, LINT, ULINT, SINT, USINT, UINT and UDINT data types.
//
// The MIT License (MIT)
//
// Copyright (c) 2013 Dana Moffit
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

/** S7 memory areas, with their S7comm area code */
export const S7_AREA_CODES = {
  P: 0x80, // peripheral inputs / outputs
  I: 0x81, // inputs (process image)
  Q: 0x82, // outputs (process image)
  M: 0x83, // merkers (flags)
  DB: 0x84, // data blocks
  C: 0x1c, // counters
  T: 0x1d // timers
} as const;

export type S7Area = keyof typeof S7_AREA_CODES;

export type S7DataType =
  | 'X'
  | 'BYTE'
  | 'SINT'
  | 'CHAR'
  | 'WORD'
  | 'INT'
  | 'DWORD'
  | 'DINT'
  | 'REAL'
  | 'LINT'
  | 'ULINT'
  | 'LREAL'
  | 'STRING'
  | 'DT'
  | 'DTZ'
  | 'DTL'
  | 'DTLZ'
  | 'TIMER'
  | 'COUNTER';

export interface S7Address {
  /** The address as configured */
  address: string;
  area: S7Area;
  areaCode: number;
  /** The data block number, 0 outside a data block */
  dbNumber: number;
  dataType: S7DataType;
  /** Byte offset in the area, or the timer / counter number */
  offset: number;
  /** Bit offset (0-7) of the first bit for the X data type, 0 otherwise */
  bitOffset: number;
  /** Number of consecutive values to read, 1 for a single value */
  arrayLength: number;
  /** Length in bytes of one value (for STRING, the maximum length + the 2 header bytes) */
  elementLength: number;
  /** Total number of bytes read from the PLC */
  byteLength: number;
}

const ELEMENT_LENGTHS: Record<Exclude<S7DataType, 'STRING'>, number> = {
  X: 1,
  BYTE: 1,
  SINT: 1,
  CHAR: 1,
  WORD: 2,
  INT: 2,
  TIMER: 2,
  COUNTER: 2,
  DWORD: 4,
  DINT: 4,
  REAL: 4,
  LINT: 8,
  ULINT: 8,
  LREAL: 8,
  DT: 8,
  DTZ: 8,
  DTL: 12,
  DTLZ: 12
};

/** Data type names accepted after `DB<n>,` */
const DB_DATA_TYPES: Record<string, S7DataType> = {
  X: 'X',
  BOOL: 'X',
  B: 'BYTE',
  BYTE: 'BYTE',
  USINT: 'BYTE',
  SINT: 'SINT',
  C: 'CHAR',
  CHAR: 'CHAR',
  W: 'WORD',
  WORD: 'WORD',
  UINT: 'WORD',
  I: 'INT',
  INT: 'INT',
  D: 'DWORD',
  DW: 'DWORD',
  DWORD: 'DWORD',
  UDINT: 'DWORD',
  DI: 'DINT',
  DINT: 'DINT',
  R: 'REAL',
  REAL: 'REAL',
  LI: 'LINT',
  LINT: 'LINT',
  ULINT: 'ULINT',
  LWORD: 'ULINT',
  LR: 'LREAL',
  LREAL: 'LREAL',
  S: 'STRING',
  STRING: 'STRING',
  DT: 'DT',
  DTZ: 'DTZ',
  DTL: 'DTL',
  DTLZ: 'DTLZ'
};

/** Data type suffixes accepted after an area prefix outside data blocks (`MB0`, `IW2`, `QD4`...). No suffix is a bit. */
const AREA_DATA_TYPES: Record<string, S7DataType> = {
  '': 'X',
  B: 'BYTE',
  C: 'CHAR',
  W: 'WORD',
  I: 'INT',
  D: 'DWORD',
  DW: 'DWORD',
  DI: 'DINT',
  R: 'REAL',
  LI: 'LINT',
  LR: 'LREAL'
};

const AREA_PREFIXES: Record<string, S7Area> = {
  I: 'I',
  E: 'I',
  Q: 'Q',
  A: 'Q',
  M: 'M',
  PI: 'P',
  PE: 'P',
  PQ: 'P',
  PA: 'P'
};

/** Prefixes outside data blocks (`MW`, `PIB`, `T`...) with their area and data type */
const NON_DB_PREFIXES: Record<string, { area: S7Area; dataType: S7DataType }> = {
  T: { area: 'T', dataType: 'TIMER' },
  C: { area: 'C', dataType: 'COUNTER' }
};
for (const [areaPrefix, area] of Object.entries(AREA_PREFIXES)) {
  for (const [typeSuffix, dataType] of Object.entries(AREA_DATA_TYPES)) {
    NON_DB_PREFIXES[areaPrefix + typeSuffix] = { area, dataType };
  }
}

const DB_PART = /^DB(\d+)$/;
const ITEM_PART = /^([A-Z]+)(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;
const MAX_STRING_LENGTH = 254;
// The S7comm address field holds a 24-bit bit address
const MAX_OFFSET = 0x1fffff;

const invalid = (address: string, reason: string): Error => new Error(`Invalid S7 address "${address}": ${reason}`);

const toPositiveInteger = (address: string, value: string, name: string, max: number): number => {
  const result = parseInt(value, 10);
  if (result < 1 || result > max) {
    throw invalid(address, `${name} must be between 1 and ${max}`);
  }
  return result;
};

/**
 * Parses an S7 address: `DB<n>,<type><offset>[.<bit | length>][.<array length>]` inside a data block (`DB1,REAL0`,
 * `DB1,X4.0`, `DB1,S10.20`, `DB1,INT2.5`), or `<area><type><offset>[.<bit | array length>][.<array length>]` outside
 * (`MW8`, `M32.2`, `IB0`, `QR4`, `PIW256`, `T3`, `C1`). Case insensitive.
 */
export function parseS7Address(address: string): S7Address {
  const normalized = address.trim().toUpperCase();
  const parts = normalized.split(',');
  if (parts.length > 2) {
    throw invalid(address, 'too many commas');
  }

  let area: S7Area;
  let dbNumber = 0;
  let dataType: S7DataType;
  let itemPart: string;
  if (parts.length === 2) {
    const dbMatch = DB_PART.exec(parts[0].trim());
    if (!dbMatch) {
      throw invalid(address, 'a data block must be written DB<number>');
    }
    dbNumber = toPositiveInteger(address, dbMatch[1], 'the data block number', 65535);
    itemPart = parts[1].trim();
  } else {
    itemPart = parts[0];
  }

  const itemMatch = ITEM_PART.exec(itemPart);
  if (!itemMatch) {
    throw invalid(address, 'expected <type><offset>[.<bit or length>][.<array length>]');
  }
  const [, typeName, offsetText, firstSuffix, secondSuffix] = itemMatch;

  if (parts.length === 2) {
    const dbDataType = DB_DATA_TYPES[typeName];
    if (!dbDataType) {
      throw invalid(address, `unknown data type "${typeName}"`);
    }
    area = 'DB';
    dataType = dbDataType;
  } else {
    const prefix = NON_DB_PREFIXES[typeName];
    if (!prefix) {
      throw invalid(address, `unknown memory area or data type "${typeName}"`);
    }
    area = prefix.area;
    dataType = prefix.dataType;
  }

  const offset = parseInt(offsetText, 10);
  if (offset > MAX_OFFSET) {
    throw invalid(address, `the offset must not exceed ${MAX_OFFSET}`);
  }
  let bitOffset = 0;
  let arrayLength = 1;
  let elementLength: number;
  if (dataType === 'X') {
    if (firstSuffix === undefined) {
      throw invalid(address, 'a bit address requires a bit offset (e.g. M32.2)');
    }
    bitOffset = parseInt(firstSuffix, 10);
    if (bitOffset > 7) {
      throw invalid(address, 'the bit offset must be between 0 and 7');
    }
    if (secondSuffix !== undefined) {
      arrayLength = toPositiveInteger(address, secondSuffix, 'the array length', 65535);
    }
    elementLength = ELEMENT_LENGTHS.X;
  } else if (dataType === 'STRING') {
    if (firstSuffix === undefined) {
      throw invalid(address, 'a string requires its maximum length (e.g. DB1,S10.20)');
    }
    elementLength = toPositiveInteger(address, firstSuffix, 'the string length', MAX_STRING_LENGTH) + 2;
    if (secondSuffix !== undefined) {
      arrayLength = toPositiveInteger(address, secondSuffix, 'the array length', 65535);
    }
  } else {
    if (secondSuffix !== undefined) {
      throw invalid(address, 'only bits and strings accept two suffixes');
    }
    if (firstSuffix !== undefined) {
      arrayLength = toPositiveInteger(address, firstSuffix, 'the array length', 65535);
    }
    elementLength = ELEMENT_LENGTHS[dataType];
  }

  const byteLength = dataType === 'X' ? Math.ceil((bitOffset + arrayLength) / 8) : arrayLength * elementLength;
  return {
    address,
    area,
    areaCode: S7_AREA_CODES[area],
    dbNumber,
    dataType,
    offset,
    bitOffset,
    arrayLength,
    elementLength,
    byteLength
  };
}
