// Decoding of the S7 data types, ported to TypeScript from nodeS7 (https://github.com/plcpeople/nodeS7,
// processS7ReadItem, readDT and readDTL) and extended with the LREAL, LINT, ULINT and SINT data types.
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

import type { S7Address, S7DataType } from './s7-address';

export type S7ScalarValue = boolean | number | bigint | string | Date;
export type S7Value = S7ScalarValue | Array<S7ScalarValue>;

const fromBCD = (value: number): number => (value >> 4) * 10 + (value & 0x0f);

/** DATE_AND_TIME: 8 BCD bytes (year, month, day, hour, minute, second, ms / 10, ms % 10 << 4 | weekday) */
const readDT = (buffer: Buffer, offset: number, utc: boolean): Date => {
  const twoDigitYear = fromBCD(buffer[offset]);
  const year = (twoDigitYear >= 90 ? 1900 : 2000) + twoDigitYear;
  const fields = [
    year,
    fromBCD(buffer[offset + 1]) - 1,
    fromBCD(buffer[offset + 2]),
    fromBCD(buffer[offset + 3]),
    fromBCD(buffer[offset + 4]),
    fromBCD(buffer[offset + 5]),
    fromBCD(buffer[offset + 6]) * 10 + (buffer[offset + 7] >> 4)
  ] as const;
  return utc ? new Date(Date.UTC(...fields)) : new Date(...fields);
};

/** DTL: year (UInt16), month, day, weekday, hour, minute, second, nanoseconds (UInt32) */
const readDTL = (buffer: Buffer, offset: number, utc: boolean): Date => {
  const fields = [
    buffer.readUInt16BE(offset),
    buffer[offset + 2] - 1,
    buffer[offset + 3],
    buffer[offset + 5],
    buffer[offset + 6],
    buffer[offset + 7],
    Math.floor(buffer.readUInt32BE(offset + 8) / 1e6)
  ] as const;
  return utc ? new Date(Date.UTC(...fields)) : new Date(...fields);
};

/** S7 STRING: maximum length, actual length, then the characters (one byte each) */
const readString = (buffer: Buffer, offset: number, elementLength: number): string => {
  const length = Math.min(buffer[offset + 1], elementLength - 2);
  return buffer.toString('latin1', offset + 2, offset + 2 + length);
};

const readScalar = (dataType: Exclude<S7DataType, 'X' | 'CHAR'>, elementLength: number, buffer: Buffer, offset: number): S7ScalarValue => {
  switch (dataType) {
    case 'BYTE':
      return buffer.readUInt8(offset);
    case 'SINT':
      return buffer.readInt8(offset);
    case 'WORD':
      return buffer.readUInt16BE(offset);
    case 'INT':
    case 'TIMER':
    case 'COUNTER':
      return buffer.readInt16BE(offset);
    case 'DWORD':
      return buffer.readUInt32BE(offset);
    case 'DINT':
      return buffer.readInt32BE(offset);
    case 'REAL':
      return buffer.readFloatBE(offset);
    case 'LINT':
      return buffer.readBigInt64BE(offset);
    case 'ULINT':
      return buffer.readBigUInt64BE(offset);
    case 'LREAL':
      return buffer.readDoubleBE(offset);
    case 'STRING':
      return readString(buffer, offset, elementLength);
    case 'DT':
    case 'DTZ':
      return readDT(buffer, offset, dataType === 'DTZ');
    case 'DTL':
    case 'DTLZ':
      return readDTL(buffer, offset, dataType === 'DTLZ');
  }
};

/**
 * Decodes the value of an address from the `address.byteLength` bytes read at its offset. Arrays are returned as arrays,
 * except CHAR arrays which are returned as one string. DT and DTL are local times, DTZ and DTLZ UTC.
 */
export function decodeS7Value(address: S7Address, buffer: Buffer): S7Value {
  if (buffer.length < address.byteLength) {
    throw new Error(`Expected ${address.byteLength} bytes for "${address.address}", got ${buffer.length}`);
  }
  if (address.dataType === 'X') {
    const bits: Array<boolean> = [];
    for (let i = 0; i < address.arrayLength; i++) {
      const bit = address.bitOffset + i;
      bits.push(((buffer[bit >> 3] >> (bit & 7)) & 1) === 1);
    }
    return address.arrayLength === 1 ? bits[0] : bits;
  }
  if (address.dataType === 'CHAR') {
    return buffer.toString('latin1', 0, address.arrayLength);
  }
  const dataType = address.dataType;
  if (address.arrayLength === 1) {
    return readScalar(dataType, address.elementLength, buffer, 0);
  }
  const values: Array<S7ScalarValue> = [];
  for (let i = 0; i < address.arrayLength; i++) {
    values.push(readScalar(dataType, address.elementLength, buffer, i * address.elementLength));
  }
  return values;
}

const formatScalar = (value: S7ScalarValue): string => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
  }
  return String(value);
};

/** Formats a value as text: dates in ISO 8601 (UTC), arrays as comma separated values */
export function formatS7Value(value: S7Value): string {
  return Array.isArray(value) ? value.map(formatScalar).join(',') : formatScalar(value);
}
