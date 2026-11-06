// Encoding and decoding of the ISO-on-TCP (RFC 1006 TPKT + ISO 8073 COTP) and S7comm frames used to read a Siemens S7
// PLC. The frame layouts follow the ones of nodeS7 (https://github.com/plcpeople/nodeS7: connectReq, negotiatePDU,
// readReqHeader, S7AddrToBuffer, checkRFCData, processS7Packet), ported to TypeScript and rewritten around a stream
// decoder that reassembles TPKT frames and COTP data fragments.
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

// RFC 1006 TPKT: version 3, reserved, 16-bit length of the whole frame
const TPKT_VERSION = 0x03;
const TPKT_HEADER_LENGTH = 4;

// ISO 8073 COTP TPDU codes (high nibble of the second byte)
const COTP_CONNECTION_REQUEST = 0xe0;
const COTP_CONNECTION_CONFIRM = 0xd0;
const COTP_DISCONNECT_REQUEST = 0x80;
const COTP_DATA = 0xf0;
const COTP_LAST_DATA_UNIT = 0x80;
const COTP_TPDU_SIZE_1024 = 0x0a;

// S7comm
const S7_PROTOCOL_ID = 0x32;
export const S7_ROSCTR_JOB = 0x01;
export const S7_ROSCTR_ACK = 0x02;
export const S7_ROSCTR_ACK_DATA = 0x03;
const S7_FUNCTION_SETUP_COMMUNICATION = 0xf0;
const S7_FUNCTION_READ_VAR = 0x04;
const S7_RETURN_CODE_SUCCESS = 0xff;

// Read Var transport sizes
export const S7_TRANSPORT_SIZE_BYTE = 0x02;
// Read Var response transport sizes whose length is in bits (BIT, BYTE/WORD/DWORD, INTEGER); the others are in bytes
const BIT_LENGTH_TRANSPORT_SIZES = new Set([0x03, 0x04, 0x05]);

/** Bytes of the S7comm header of a job, and of an ack / ack-data (which adds the error class and code) */
export const S7_JOB_HEADER_LENGTH = 10;
export const S7_ACK_HEADER_LENGTH = 12;
/** Bytes of one item of a Read Var request (parameter part) */
export const S7_READ_REQUEST_ITEM_LENGTH = 12;
/** Bytes of the header of one item of a Read Var response (data part): return code, transport size, length */
export const S7_READ_RESPONSE_ITEM_HEADER_LENGTH = 4;
/** Bytes of the parameter part of Read Var: function code, item count */
export const S7_READ_PARAMETER_HEADER_LENGTH = 2;

const RETURN_CODE_MESSAGES: Record<number, string> = {
  0x01: 'hardware fault',
  0x03: 'access to the object not allowed',
  0x05: 'address out of range',
  0x06: 'data type not supported',
  0x07: 'data type inconsistent',
  0x0a: 'object does not exist'
};

const ERROR_CLASS_MESSAGES: Record<number, string> = {
  0x81: 'application relationship error',
  0x82: 'object definition error',
  0x83: 'no resources available',
  0x84: 'error on service processing',
  0x85: 'error on supplies',
  0x87: 'access error'
};

export const describeReturnCode = (returnCode: number): string =>
  RETURN_CODE_MESSAGES[returnCode] ?? `return code 0x${returnCode.toString(16).padStart(2, '0')}`;

const hex = (value: number): string => `0x${value.toString(16).padStart(2, '0')}`;

const tpkt = (payload: Buffer): Buffer => {
  const header = Buffer.from([TPKT_VERSION, 0x00, 0x00, 0x00]);
  header.writeUInt16BE(TPKT_HEADER_LENGTH + payload.length, 2);
  return Buffer.concat([header, payload]);
};

/**
 * COTP Connection Request (CR) with a 1024-byte TPDU size, the local (calling) TSAP and the remote (called) TSAP.
 * See {@link remoteTSAP} for the usual remote TSAP of a CPU.
 */
export function encodeConnectionRequest(localTSAP: number, remoteTSAP: number): Buffer {
  const cotp = Buffer.from([
    0x11, // length of the COTP header, without this byte
    COTP_CONNECTION_REQUEST,
    0x00,
    0x00, // destination reference
    0x00,
    0x01, // source reference
    0x00, // class 0
    0xc0, // parameter: TPDU size
    0x01,
    COTP_TPDU_SIZE_1024,
    0xc1, // parameter: calling (local) TSAP
    0x02,
    0x00,
    0x00,
    0xc2, // parameter: called (remote) TSAP
    0x02,
    0x00,
    0x00
  ]);
  cotp.writeUInt16BE(localTSAP, 12);
  cotp.writeUInt16BE(remoteTSAP, 16);
  return tpkt(cotp);
}

/**
 * Remote TSAP of a CPU: the connection resource (1 = PG, 2 = OP, 3 = S7 Basic) in the high byte, then rack * 32 + slot.
 */
export function remoteTSAP(connectionResource: number, rack: number, slot: number): number {
  return ((connectionResource & 0xff) << 8) | ((rack & 0x07) << 5) | (slot & 0x1f);
}

/** COTP Data (DT, last data unit) carrying an S7comm PDU */
export function encodeData(s7Pdu: Buffer): Buffer {
  return tpkt(Buffer.concat([Buffer.from([0x02, COTP_DATA, COTP_LAST_DATA_UNIT]), s7Pdu]));
}

const encodeJob = (pduReference: number, parameter: Buffer): Buffer => {
  const header = Buffer.alloc(S7_JOB_HEADER_LENGTH);
  header[0] = S7_PROTOCOL_ID;
  header[1] = S7_ROSCTR_JOB;
  header.writeUInt16BE(pduReference, 4);
  header.writeUInt16BE(parameter.length, 6);
  header.writeUInt16BE(0, 8); // no data part
  return Buffer.concat([header, parameter]);
};

/** S7comm Setup Communication job, negotiating the parallel jobs and the PDU size */
export function encodeSetupCommunication(pduReference: number, maxParallelJobs: number, pduSize: number): Buffer {
  const parameter = Buffer.alloc(8);
  parameter[0] = S7_FUNCTION_SETUP_COMMUNICATION;
  parameter.writeUInt16BE(maxParallelJobs, 2); // max AmQ calling
  parameter.writeUInt16BE(maxParallelJobs, 4); // max AmQ called
  parameter.writeUInt16BE(pduSize, 6);
  return encodeData(encodeJob(pduReference, parameter));
}

export interface S7ReadRequestItem {
  areaCode: number;
  dbNumber: number;
  /** Byte offset (bytes transport size) or timer / counter number */
  start: number;
  /** Number of bytes (bytes transport size) or of timers / counters */
  count: number;
  /** {@link S7_TRANSPORT_SIZE_BYTE}, or the area code for timers and counters */
  transportSize: number;
}

/** S7comm Read Var job, reading each item with its S7ANY address */
export function encodeReadVarRequest(pduReference: number, items: Array<S7ReadRequestItem>): Buffer {
  const parameter = Buffer.alloc(S7_READ_PARAMETER_HEADER_LENGTH + items.length * S7_READ_REQUEST_ITEM_LENGTH);
  parameter[0] = S7_FUNCTION_READ_VAR;
  parameter[1] = items.length;
  items.forEach((item, index) => {
    const offset = S7_READ_PARAMETER_HEADER_LENGTH + index * S7_READ_REQUEST_ITEM_LENGTH;
    parameter[offset] = 0x12; // variable specification
    parameter[offset + 1] = 0x0a; // length of the address specification
    parameter[offset + 2] = 0x10; // syntax id: S7ANY
    parameter[offset + 3] = item.transportSize;
    parameter.writeUInt16BE(item.count, offset + 4);
    parameter.writeUInt16BE(item.dbNumber, offset + 6);
    parameter[offset + 8] = item.areaCode;
    // 24-bit address: a bit address (byte * 8) for bytes, the timer / counter number otherwise
    const address = item.transportSize === S7_TRANSPORT_SIZE_BYTE ? item.start * 8 : item.start;
    parameter.writeUIntBE(address & 0xffffff, offset + 9, 3);
  });
  return encodeData(encodeJob(pduReference, parameter));
}

export interface S7Pdu {
  rosctr: number;
  pduReference: number;
  errorClass: number;
  errorCode: number;
  parameter: Buffer;
  data: Buffer;
}

/** Parses an S7comm PDU (the payload of COTP data units) */
export function parseS7Pdu(buffer: Buffer): S7Pdu {
  if (buffer.length < S7_JOB_HEADER_LENGTH || buffer[0] !== S7_PROTOCOL_ID) {
    throw new Error('Invalid S7comm PDU');
  }
  const rosctr = buffer[1];
  const headerLength = rosctr === S7_ROSCTR_ACK || rosctr === S7_ROSCTR_ACK_DATA ? S7_ACK_HEADER_LENGTH : S7_JOB_HEADER_LENGTH;
  if (buffer.length < headerLength) {
    throw new Error('Invalid S7comm PDU');
  }
  const parameterLength = buffer.readUInt16BE(6);
  const dataLength = buffer.readUInt16BE(8);
  if (buffer.length < headerLength + parameterLength + dataLength) {
    throw new Error(`Truncated S7comm PDU: ${buffer.length} bytes, ${headerLength + parameterLength + dataLength} expected`);
  }
  return {
    rosctr,
    pduReference: buffer.readUInt16BE(4),
    errorClass: headerLength === S7_ACK_HEADER_LENGTH ? buffer[10] : 0,
    errorCode: headerLength === S7_ACK_HEADER_LENGTH ? buffer[11] : 0,
    parameter: buffer.subarray(headerLength, headerLength + parameterLength),
    data: buffer.subarray(headerLength + parameterLength, headerLength + parameterLength + dataLength)
  };
}

/** Throws if the PDU is not an ack-data, or if it carries an error */
export function checkAckData(pdu: S7Pdu): void {
  if (pdu.rosctr !== S7_ROSCTR_ACK_DATA && pdu.rosctr !== S7_ROSCTR_ACK) {
    throw new Error(`Unexpected S7comm PDU type ${hex(pdu.rosctr)}`);
  }
  if (pdu.errorClass !== 0 || pdu.errorCode !== 0) {
    const description = ERROR_CLASS_MESSAGES[pdu.errorClass] ?? 'error';
    throw new Error(`The PLC answered with an ${description} (class ${hex(pdu.errorClass)}, code ${hex(pdu.errorCode)})`);
  }
}

export interface S7SetupCommunication {
  maxParallelJobs: number;
  pduSize: number;
}

export function parseSetupCommunicationResponse(pdu: S7Pdu): S7SetupCommunication {
  checkAckData(pdu);
  if (pdu.parameter.length < 8 || pdu.parameter[0] !== S7_FUNCTION_SETUP_COMMUNICATION) {
    throw new Error('Invalid Setup Communication response');
  }
  return {
    // The number of jobs the PLC accepts from us in parallel
    maxParallelJobs: pdu.parameter.readUInt16BE(2),
    pduSize: pdu.parameter.readUInt16BE(6)
  };
}

export type S7ReadResponseItem = { data: Buffer } | { error: string };

/** Parses a Read Var response into one result per requested item */
export function parseReadVarResponse(pdu: S7Pdu, itemCount: number): Array<S7ReadResponseItem> {
  checkAckData(pdu);
  if (pdu.parameter.length < S7_READ_PARAMETER_HEADER_LENGTH || pdu.parameter[0] !== S7_FUNCTION_READ_VAR) {
    throw new Error('Invalid Read Var response');
  }
  if (pdu.parameter[1] !== itemCount) {
    throw new Error(`Read Var response with ${pdu.parameter[1]} items, ${itemCount} expected`);
  }
  const results: Array<S7ReadResponseItem> = [];
  let offset = 0;
  for (let i = 0; i < itemCount; i++) {
    if (offset + S7_READ_RESPONSE_ITEM_HEADER_LENGTH > pdu.data.length) {
      throw new Error('Truncated Read Var response');
    }
    const returnCode = pdu.data[offset];
    offset += S7_READ_RESPONSE_ITEM_HEADER_LENGTH;
    if (returnCode !== S7_RETURN_CODE_SUCCESS) {
      // A failed item has no data, whatever its length field says
      results.push({ error: describeReturnCode(returnCode) });
      continue;
    }
    const transportSize = pdu.data[offset - 3];
    const rawLength = pdu.data.readUInt16BE(offset - 2);
    const length = BIT_LENGTH_TRANSPORT_SIZES.has(transportSize) ? Math.ceil(rawLength / 8) : rawLength;
    if (offset + length > pdu.data.length) {
      throw new Error('Truncated Read Var response');
    }
    results.push({ data: pdu.data.subarray(offset, offset + length) });
    // Every item but the last is padded to an even length
    offset += length + (length % 2);
  }
  return results;
}

export type S7Frame = { type: 'connection-confirm' } | { type: 'disconnect-request' } | { type: 'data'; payload: Buffer };

/**
 * Splits a TCP stream into TPKT frames, and reassembles the COTP data units: a data payload is emitted once the unit
 * flagged as the last one arrives (some PLCs send empty "fast acknowledge" units before the data).
 */
export class S7FrameDecoder {
  private pending: Buffer = Buffer.alloc(0);
  private fragments: Array<Buffer> = [];

  push(chunk: Buffer): Array<S7Frame> {
    this.pending = this.pending.length === 0 ? chunk : Buffer.concat([this.pending, chunk]);
    const frames: Array<S7Frame> = [];
    while (this.pending.length >= TPKT_HEADER_LENGTH) {
      if (this.pending[0] !== TPKT_VERSION) {
        throw new Error(`Invalid TPKT version ${hex(this.pending[0])}`);
      }
      const length = this.pending.readUInt16BE(2);
      if (length < TPKT_HEADER_LENGTH + 2) {
        throw new Error(`Invalid TPKT length ${length}`);
      }
      if (this.pending.length < length) {
        break;
      }
      const frame = this.decodeCotp(this.pending.subarray(TPKT_HEADER_LENGTH, length));
      if (frame) {
        frames.push(frame);
      }
      this.pending = this.pending.subarray(length);
    }
    return frames;
  }

  private decodeCotp(cotp: Buffer): S7Frame | null {
    const headerLength = cotp[0] + 1;
    if (headerLength < 2 || headerLength > cotp.length) {
      throw new Error('Invalid COTP header');
    }
    const tpduCode = cotp[1] & 0xf0;
    switch (tpduCode) {
      case COTP_CONNECTION_CONFIRM:
        return { type: 'connection-confirm' };
      case COTP_DISCONNECT_REQUEST:
        return { type: 'disconnect-request' };
      case COTP_DATA: {
        if (headerLength < 3) {
          throw new Error('Invalid COTP header');
        }
        this.fragments.push(cotp.subarray(headerLength));
        if ((cotp[2] & COTP_LAST_DATA_UNIT) === 0) {
          return null;
        }
        const payload = Buffer.concat(this.fragments);
        this.fragments = [];
        return payload.length > 0 ? { type: 'data', payload } : null;
      }
      default:
        throw new Error(`Unexpected COTP TPDU ${hex(cotp[1])}`);
    }
  }
}
