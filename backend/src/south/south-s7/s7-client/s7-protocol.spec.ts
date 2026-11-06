import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  checkAckData,
  describeReturnCode,
  encodeConnectionRequest,
  encodeData,
  encodeReadVarRequest,
  encodeSetupCommunication,
  parseReadVarResponse,
  parseS7Pdu,
  parseSetupCommunicationResponse,
  remoteTSAP,
  S7FrameDecoder
} from './s7-protocol';

// Frames exchanged with a Snap7 server (docker/s7/s7_server.py)
const fixtures = {
  connectionRequest: '0300001611e00000000100c0010ac1020100c2020101',
  connectionConfirm: '0300001611d00001000100c0010ac1020100c2020101',
  setupCommunicationRequest: '0300001902f08032010000000100080000f0000008000800f0',
  setupCommunicationResponse: '0300001b02f080320300000001000800000000f0000008000800f0',
  // DB1 bytes 0-3, MB0, DB9 bytes 0-3 (missing data block), T0-T1, DB1 byte 16
  readRequest:
    '0300004f02f080320100000002003e00000405' +
    '120a10020004000184000000' +
    '120a10020001000083000000' +
    '120a10020004000984000000' +
    '120a101d000200001d000000' +
    '120a10020001000184000080',
  readResponse:
    '0300003402f0803203000000020002001f00000405' +
    'ff0400204048f5c3' + // 4 bytes, length in bits
    'ff0400085a00' + // 1 byte, padded
    '0a000004' + // object does not exist: no data despite the length field
    'ff09000412341235' + // timers, octet string length in bytes
    'ff040008a5' // last item, not padded
};
const bytes = (hex: string): Buffer => Buffer.from(hex, 'hex');
const payloadOf = (frame: string): Buffer => {
  const frames = new S7FrameDecoder().push(bytes(frame));
  assert.strictEqual(frames.length, 1);
  assert.strictEqual(frames[0].type, 'data');
  return (frames[0] as { payload: Buffer }).payload;
};

describe('S7 protocol', () => {
  it('should encode the COTP connection request', () => {
    assert.strictEqual(encodeConnectionRequest(0x0100, 0x0101).toString('hex'), fixtures.connectionRequest);
    assert.strictEqual(encodeConnectionRequest(0x1000, 0x0302).toString('hex'), '0300001611e00000000100c0010ac1021000c2020302');
  });

  it('should compute the remote TSAP of a rack / slot', () => {
    assert.strictEqual(remoteTSAP(1, 0, 1), 0x0101);
    assert.strictEqual(remoteTSAP(1, 0, 2), 0x0102);
    assert.strictEqual(remoteTSAP(2, 1, 3), 0x0223);
    assert.strictEqual(remoteTSAP(3, 7, 31), 0x03ff);
  });

  it('should encode the setup communication and parse its response', () => {
    assert.strictEqual(encodeSetupCommunication(1, 8, 240).toString('hex'), fixtures.setupCommunicationRequest);

    const pdu = parseS7Pdu(payloadOf(fixtures.setupCommunicationResponse));
    assert.deepStrictEqual(
      { rosctr: pdu.rosctr, pduReference: pdu.pduReference, errorClass: pdu.errorClass, errorCode: pdu.errorCode },
      { rosctr: 3, pduReference: 1, errorClass: 0, errorCode: 0 }
    );
    assert.deepStrictEqual(parseSetupCommunicationResponse(pdu), { maxParallelJobs: 8, pduSize: 240 });
  });

  it('should reject an invalid setup communication response', () => {
    const pdu = parseS7Pdu(payloadOf('0300001502f080320300000001000200000000040a'));
    assert.throws(() => parseSetupCommunicationResponse(pdu), new Error('Invalid Setup Communication response'));
  });

  it('should encode a read var request', () => {
    const request = encodeReadVarRequest(2, [
      { areaCode: 0x84, dbNumber: 1, start: 0, count: 4, transportSize: 0x02 },
      { areaCode: 0x83, dbNumber: 0, start: 0, count: 1, transportSize: 0x02 },
      { areaCode: 0x84, dbNumber: 9, start: 0, count: 4, transportSize: 0x02 },
      { areaCode: 0x1d, dbNumber: 0, start: 0, count: 2, transportSize: 0x1d },
      { areaCode: 0x84, dbNumber: 1, start: 16, count: 1, transportSize: 0x02 }
    ]);
    assert.strictEqual(request.toString('hex'), fixtures.readRequest);
  });

  it('should encode large byte offsets on 24 bits, and timer / counter numbers as is', () => {
    const request = encodeReadVarRequest(0xffff, [
      { areaCode: 0x84, dbNumber: 65535, start: 0x1fffff, count: 2, transportSize: 0x02 },
      { areaCode: 0x1c, dbNumber: 0, start: 300, count: 1, transportSize: 0x1c }
    ]);
    const parameter = request.subarray(17);
    assert.strictEqual(request.readUInt16BE(11), 0xffff);
    assert.strictEqual(parameter.subarray(2, 14).toString('hex'), '120a10020002ffff84fffff8');
    assert.strictEqual(parameter.subarray(14, 26).toString('hex'), '120a101c000100001c00012c');
  });

  it('should parse a read var response', () => {
    const results = parseReadVarResponse(parseS7Pdu(payloadOf(fixtures.readResponse)), 5);
    assert.deepStrictEqual(results, [
      { data: bytes('4048f5c3') },
      { data: bytes('5a') },
      { error: 'object does not exist' },
      { data: bytes('12341235') },
      { data: bytes('a5') }
    ]);
  });

  it('should reject inconsistent read var responses', () => {
    const response = parseS7Pdu(payloadOf(fixtures.readResponse));
    assert.throws(() => parseReadVarResponse(response, 4), new Error('Read Var response with 5 items, 4 expected'));

    const setup = parseS7Pdu(payloadOf(fixtures.setupCommunicationResponse));
    assert.throws(() => parseReadVarResponse(setup, 1), new Error('Invalid Read Var response'));

    // Second item announced but missing
    const truncatedHeader = parseS7Pdu(payloadOf('0300001f02f0803203000000020002000a00000402ff0400204048f5c3ff04'));
    assert.throws(() => parseReadVarResponse(truncatedHeader, 2), new Error('Truncated Read Var response'));
    // 4 bytes announced, 2 sent
    const truncatedData = parseS7Pdu(payloadOf('0300001b02f0803203000000020002000600000401ff0400204048'));
    assert.throws(() => parseReadVarResponse(truncatedData, 1), new Error('Truncated Read Var response'));
  });

  it('should report the PLC errors of an ack data', () => {
    const pdu = parseS7Pdu(payloadOf('0300001302f080320300000002000000008504'));
    assert.throws(() => parseReadVarResponse(pdu, 1), new Error('The PLC answered with an error on supplies (class 0x85, code 0x04)'));
    const unknownClass = parseS7Pdu(payloadOf('0300001302f080320300000002000000009901'));
    assert.throws(() => checkAckData(unknownClass), new Error('The PLC answered with an error (class 0x99, code 0x01)'));
    const job = parseS7Pdu(payloadOf(fixtures.setupCommunicationRequest));
    assert.throws(() => checkAckData(job), new Error('Unexpected S7comm PDU type 0x01'));
  });

  it('should describe the item return codes', () => {
    assert.strictEqual(describeReturnCode(0x05), 'address out of range');
    assert.strictEqual(describeReturnCode(0x0b), 'return code 0x0b');
  });

  it('should parse jobs and reject invalid S7comm PDUs', () => {
    const job = parseS7Pdu(payloadOf(fixtures.setupCommunicationRequest));
    assert.deepStrictEqual(
      { rosctr: job.rosctr, errorClass: job.errorClass, parameter: job.parameter.toString('hex'), data: job.data.length },
      { rosctr: 1, errorClass: 0, parameter: 'f0000008000800f0', data: 0 }
    );
    assert.throws(() => parseS7Pdu(bytes('3301000000010000')), new Error('Invalid S7comm PDU'));
    assert.throws(() => parseS7Pdu(bytes('32030000000100000000')), new Error('Invalid S7comm PDU'));
    assert.throws(() => parseS7Pdu(bytes('3203000000010008000000000000')), new Error('Truncated S7comm PDU: 14 bytes, 20 expected'));
  });

  describe('frame decoder', () => {
    it('should decode connection confirms and disconnect requests', () => {
      const decoder = new S7FrameDecoder();
      assert.deepStrictEqual(decoder.push(bytes(fixtures.connectionConfirm)), [{ type: 'connection-confirm' }]);
      assert.deepStrictEqual(decoder.push(bytes('0300000b06800000000100')), [{ type: 'disconnect-request' }]);
    });

    it('should reassemble frames split over several chunks, or sharing a chunk', () => {
      const decoder = new S7FrameDecoder();
      const stream = Buffer.concat([bytes(fixtures.setupCommunicationResponse), bytes(fixtures.readResponse)]);
      assert.deepStrictEqual(decoder.push(stream.subarray(0, 2)), []);
      assert.deepStrictEqual(decoder.push(stream.subarray(2, 20)), []);
      const frames = decoder.push(stream.subarray(20, 40));
      assert.strictEqual(frames.length, 1);
      assert.strictEqual(parseS7Pdu((frames[0] as { payload: Buffer }).payload).pduReference, 1);
      const next = decoder.push(stream.subarray(40));
      assert.strictEqual(next.length, 1);
      assert.strictEqual(parseS7Pdu((next[0] as { payload: Buffer }).payload).pduReference, 2);
    });

    it('should reassemble COTP data units and skip fast acknowledges', () => {
      const decoder = new S7FrameDecoder();
      const payload = payloadOf(fixtures.setupCommunicationResponse);
      // Fast acknowledge: an empty data unit which is not the last one
      assert.deepStrictEqual(decoder.push(bytes('0300000702f000')), []);
      // The PDU in two data units
      assert.deepStrictEqual(decoder.push(encodeFragment(payload.subarray(0, 5), false)), []);
      assert.deepStrictEqual(decoder.push(encodeFragment(payload.subarray(5), true)), [{ type: 'data', payload }]);
      // An empty last data unit carries nothing
      assert.deepStrictEqual(decoder.push(bytes('0300000702f080')), []);
    });

    it('should reject invalid frames', () => {
      assert.throws(() => new S7FrameDecoder().push(bytes('0400000702f080')), new Error('Invalid TPKT version 0x04'));
      assert.throws(() => new S7FrameDecoder().push(bytes('03000005')), new Error('Invalid TPKT length 5'));
      assert.throws(() => new S7FrameDecoder().push(bytes('0300000708f080')), new Error('Invalid COTP header'));
      assert.throws(() => new S7FrameDecoder().push(bytes('0300000600f0')), new Error('Invalid COTP header'));
      assert.throws(() => new S7FrameDecoder().push(bytes('0300000701f080')), new Error('Invalid COTP header'));
      assert.throws(() => new S7FrameDecoder().push(bytes('0300000702e080')), new Error('Unexpected COTP TPDU 0xe0'));
    });
  });

  it('should wrap an S7comm PDU in a last COTP data unit', () => {
    assert.strictEqual(encodeData(bytes('32')).toString('hex'), '0300000802f08032');
  });
});

function encodeFragment(payload: Buffer, last: boolean): Buffer {
  const frame = encodeData(payload);
  frame[6] = last ? 0x80 : 0x00;
  return frame;
}
