import assert from 'node:assert/strict';
import net from 'node:net';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { parseS7Address } from './s7-address';
import S7Client, { S7ClientOptions } from './s7-client';
import { encodeData, parseS7Pdu, S7FrameDecoder } from './s7-protocol';

const CONNECTION_CONFIRM = Buffer.from('0300001611d00001000100c0010ac1020100c2020101', 'hex');
const DISCONNECT_REQUEST = Buffer.from('0300000b06800000000100', 'hex');

interface ReadItem {
  transportSize: number;
  count: number;
  dbNumber: number;
  areaCode: number;
  address: number;
}

const ackData = (pduReference: number, parameter: Buffer, data: Buffer, errorClass = 0, errorCode = 0): Buffer => {
  const header = Buffer.alloc(12);
  header[0] = 0x32;
  header[1] = 0x03;
  header.writeUInt16BE(pduReference, 4);
  header.writeUInt16BE(parameter.length, 6);
  header.writeUInt16BE(data.length, 8);
  header[10] = errorClass;
  header[11] = errorCode;
  return encodeData(Buffer.concat([header, parameter, data]));
};

/**
 * A fake PLC: answers the COTP connection, the Setup Communication and the Read Var requests from its memory, one
 * buffer per area / data block. Its behaviour can be changed per test.
 */
class FakePlc {
  server = net.createServer(socket => this.onConnection(socket));
  sockets: Array<net.Socket> = [];
  connectionRequests: Array<Buffer> = [];
  readRequests: Array<Array<ReadItem>> = [];
  memory = new Map<string, Buffer>();
  pduSize = 240;
  maxParallelJobs = 2;
  inFlight = 0;
  maxInFlight = 0;
  answerDelay = 0;
  onConnectionRequest: 'confirm' | 'refuse' | 'ignore' = 'confirm';
  onSetupCommunication: 'answer' | 'error' | 'ignore' = 'answer';
  onRead: 'answer' | 'ignore' | 'close' = 'answer';

  async start(): Promise<number> {
    await new Promise<void>(resolve => this.server.listen(0, '127.0.0.1', resolve));
    return (this.server.address() as net.AddressInfo).port;
  }

  async stop(): Promise<void> {
    for (const socket of this.sockets) socket.destroy();
    await new Promise<void>(resolve => this.server.close(() => resolve()));
  }

  private onConnection(socket: net.Socket) {
    this.sockets.push(socket);
    const decoder = new S7FrameDecoder();
    socket.on('error', () => undefined);
    socket.on('data', (chunk: Buffer) => {
      if (chunk[5] === 0xe0) {
        this.connectionRequests.push(chunk);
        if (this.onConnectionRequest === 'confirm') socket.write(CONNECTION_CONFIRM);
        if (this.onConnectionRequest === 'refuse') socket.write(DISCONNECT_REQUEST);
        return;
      }
      for (const frame of decoder.push(chunk)) {
        if (frame.type === 'data') this.onJob(socket, parseS7Pdu(frame.payload));
      }
    });
  }

  private onJob(socket: net.Socket, job: ReturnType<typeof parseS7Pdu>) {
    if (job.parameter[0] === 0xf0) {
      if (this.onSetupCommunication === 'ignore') return;
      const parameter = Buffer.from([0xf0, 0x00, 0, 0, 0, 0, 0, 0]);
      parameter.writeUInt16BE(this.maxParallelJobs, 2);
      parameter.writeUInt16BE(this.maxParallelJobs, 4);
      parameter.writeUInt16BE(this.pduSize, 6);
      socket.write(ackData(job.pduReference, parameter, Buffer.alloc(0), ...(this.onSetupCommunication === 'error' ? [0x81, 0x04] : [])));
      return;
    }
    const items: Array<ReadItem> = [];
    for (let i = 0; i < job.parameter[1]; i++) {
      const item = job.parameter.subarray(2 + i * 12, 14 + i * 12);
      items.push({
        transportSize: item[3],
        count: item.readUInt16BE(4),
        dbNumber: item.readUInt16BE(6),
        areaCode: item[8],
        address: item.readUIntBE(9, 3)
      });
    }
    this.readRequests.push(items);
    if (this.onRead === 'ignore') return;
    if (this.onRead === 'close') {
      socket.destroy();
      return;
    }
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    setTimeout(() => {
      this.inFlight--;
      socket.write(ackData(job.pduReference, Buffer.from([0x04, items.length]), this.readData(items)));
    }, this.answerDelay);
  }

  private readData(items: Array<ReadItem>): Buffer {
    const parts = items.map((item, index) => {
      const timerOrCounter = item.transportSize !== 0x02;
      const memory = this.memory.get(`${item.areaCode}:${item.dbNumber}`);
      const start = timerOrCounter ? item.address * 2 : item.address / 8;
      const length = timerOrCounter ? item.count * 2 : item.count;
      if (!memory || start + length > memory.length) {
        return Buffer.from([0x0a, 0x00, 0x00, 0x00]);
      }
      const header = Buffer.from([0xff, timerOrCounter ? 0x09 : 0x04, 0, 0]);
      header.writeUInt16BE(timerOrCounter ? length : length * 8, 2);
      const padding = index < items.length - 1 && length % 2 === 1 ? Buffer.alloc(1) : Buffer.alloc(0);
      return Buffer.concat([header, memory.subarray(start, start + length), padding]);
    });
    return Buffer.concat(parts);
  }
}

describe('S7 client', () => {
  let plc: FakePlc;
  let options: S7ClientOptions;
  let client: S7Client;

  beforeEach(async () => {
    plc = new FakePlc();
    const db1 = Buffer.alloc(1200);
    db1.writeFloatBE(3.14, 0);
    db1.writeInt16BE(-1234, 4);
    db1[16] = 0xa5;
    for (let i = 0; i < 250; i++) db1.writeFloatBE(i * 0.5, 200 + i * 4);
    plc.memory.set('132:1', db1);
    plc.memory.set('131:0', Buffer.from([0x5a, 0, 0, 0, 0x3f, 0xa0, 0, 0]));
    plc.memory.set('29:0', Buffer.from([0x12, 0x34, 0x12, 0x35]));
    const port = await plc.start();
    options = { host: '127.0.0.1', port, localTSAP: 0x0100, remoteTSAP: 0x0102, connectTimeout: 200, requestTimeout: 200 };
    client = new S7Client(options);
  });

  afterEach(async () => {
    await client.disconnect();
    await plc.stop();
  });

  const read = async (addresses: Array<string>) => client.read(addresses.map(parseS7Address));

  it('should connect and negotiate the PDU size and the parallel jobs', async () => {
    await client.connect();

    assert.strictEqual(client.isConnected, true);
    assert.strictEqual(client.pduSize, 240);
    assert.strictEqual(client.maxParallelJobs, 2);
    assert.strictEqual(plc.connectionRequests[0].toString('hex'), '0300001611e00000000100c0010ac1020100c2020102');
  });

  it('should keep the requested PDU size and parallel jobs when the PLC allows more', async () => {
    plc.pduSize = 960;
    plc.maxParallelJobs = 16;
    client = new S7Client({ ...options, pduSize: 480, maxParallelJobs: 4 });

    await client.connect();

    assert.strictEqual(client.pduSize, 480);
    assert.strictEqual(client.maxParallelJobs, 4);
  });

  it('should reject a second connection', async () => {
    await client.connect();
    await assert.rejects(client.connect(), new Error('S7 client already connected'));
  });

  it('should reject a connection refused by the PLC', async () => {
    plc.onConnectionRequest = 'refuse';
    await assert.rejects(client.connect(), new Error('Connection refused by the PLC (check the rack, the slot and the connection type)'));
    assert.strictEqual(client.isConnected, false);
  });

  it('should time out when the PLC does not answer the connection request', async () => {
    plc.onConnectionRequest = 'ignore';
    await assert.rejects(client.connect(), new Error('Connection timeout after 200 ms'));
    assert.strictEqual(client.isConnected, false);
  });

  it('should time out when the PLC does not answer the setup communication', async () => {
    plc.onSetupCommunication = 'ignore';
    client = new S7Client({ ...options, requestTimeout: 1000 });
    await assert.rejects(client.connect(), new Error('Connection timeout after 200 ms'));
  });

  it('should reject a setup communication error', async () => {
    plc.onSetupCommunication = 'error';
    await assert.rejects(client.connect(), new Error('The PLC answered with an application relationship error (class 0x81, code 0x04)'));
  });

  it('should keep the code of the socket errors', async () => {
    const port = options.port;
    await plc.stop();
    plc = new FakePlc();
    await plc.start();
    client = new S7Client({ ...options, port });
    await assert.rejects(client.connect(), (error: Error & { code?: string }) => error.code === 'ECONNREFUSED');
  });

  it('should read values and per item errors', async () => {
    await client.connect();

    const results = await read(['DB1,REAL0', 'DB1,INT4', 'DB1,X16.0', 'MB0', 'MR4', 'T0.2', 'DB9,REAL0', 'DB1,S16.2']);

    assert.deepStrictEqual(results, [
      { value: Math.fround(3.14) },
      { value: -1234 },
      { value: true },
      { value: 0x5a },
      { value: 1.25 },
      { value: [0x1234, 0x1235] },
      { error: 'object does not exist' },
      { value: '' }
    ]);
    // DB1 0-5 and 16-19 merged, MB0-MR4 merged, the timers, DB9: one request
    assert.deepStrictEqual(
      plc.readRequests.map(request => request.length),
      [5]
    );
  });

  it('should read a large array over several requests, in parallel up to the negotiated jobs', async () => {
    plc.answerDelay = 20;
    await client.connect();

    const [result] = await read(['DB1,REAL200.250']);

    assert.deepStrictEqual(result, { value: Array.from({ length: 250 }, (_value, index) => index * 0.5) });
    assert.strictEqual(plc.readRequests.length, 5);
    assert.strictEqual(plc.maxInFlight, 2);
  });

  it('should report an error for every address of a block when a part of it fails', async () => {
    plc.memory.set('132:2', Buffer.alloc(300));
    await client.connect();

    // DB2 is 300 bytes long: the second part of the array (bytes 222-399) does not exist
    assert.deepStrictEqual(await read(['DB2,B0.400', 'DB1,INT4']), [{ error: 'object does not exist' }, { value: -1234 }]);
  });

  it('should return no result for no address, and reject a read when not connected', async () => {
    await assert.rejects(read(['DB1,REAL0']), new Error('S7 client not connected'));
    await client.connect();
    assert.deepStrictEqual(await read([]), []);
    assert.strictEqual(plc.readRequests.length, 0);
  });

  it('should close the connection when a request times out', async () => {
    await client.connect();
    plc.onRead = 'ignore';
    const disconnected = new Promise<Error>(resolve => client.once('disconnect', resolve));

    await assert.rejects(read(['DB1,REAL0']), new Error('Request timeout after 200 ms'));

    assert.deepStrictEqual(await disconnected, new Error('Request timeout after 200 ms'));
    assert.strictEqual(client.isConnected, false);
  });

  it('should reject the pending requests and notify when the PLC closes the connection', async () => {
    await client.connect();
    plc.onRead = 'close';
    const disconnected = new Promise<Error>(resolve => client.once('disconnect', resolve));

    await assert.rejects(read(['DB1,REAL0']), new Error('Connection closed by the PLC'));

    assert.deepStrictEqual(await disconnected, new Error('Connection closed by the PLC'));
  });

  it('should notify when the PLC sends a disconnect request or an invalid frame', async () => {
    await client.connect();
    let disconnected = new Promise<Error>(resolve => client.once('disconnect', resolve));
    plc.sockets[0].write(DISCONNECT_REQUEST);
    assert.deepStrictEqual(await disconnected, new Error('Connection closed by the PLC'));

    await client.connect();
    disconnected = new Promise<Error>(resolve => client.once('disconnect', resolve));
    plc.sockets[1].write(Buffer.from('0400000702f080', 'hex'));
    assert.deepStrictEqual(await disconnected, new Error('Invalid TPKT version 0x04'));

    await client.connect();
    disconnected = new Promise<Error>(resolve => client.once('disconnect', resolve));
    plc.sockets[2].write(CONNECTION_CONFIRM);
    assert.deepStrictEqual(await disconnected, new Error('Unexpected COTP connection confirm'));
  });

  it('should ignore the PDUs it did not ask for', async () => {
    await client.connect();
    // A job from the PLC, and an answer to an unknown request
    plc.sockets[0].write(encodeData(Buffer.from('32010000000100000000', 'hex')));
    plc.sockets[0].write(ackData(999, Buffer.from([0x04, 0x00]), Buffer.alloc(0)));

    assert.deepStrictEqual(await read(['DB1,INT4']), [{ value: -1234 }]);
  });

  it('should disconnect without notifying', async () => {
    await client.connect();
    let notified = false;
    client.on('disconnect', () => {
      notified = true;
    });

    await client.disconnect();
    await client.disconnect();

    assert.strictEqual(client.isConnected, false);
    assert.strictEqual(client.pduSize, 0);
    assert.strictEqual(notified, false);
  });
});
