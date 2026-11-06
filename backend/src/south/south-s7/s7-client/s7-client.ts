// Siemens S7 client over ISO-on-TCP (RFC 1006): connection with the COTP handshake and the S7comm Setup Communication,
// then multi-item Read Var requests. Its connection sequence and read logic are ported to TypeScript from nodeS7
// (https://github.com/plcpeople/nodeS7: connectNow, onTCPConnect, onISOConnectReply, onPDUReply, sendReadPacket,
// readResponse), restructured around promises.
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

import { EventEmitter } from 'node:events';
import net from 'node:net';

import type { S7Address } from './s7-address';
import {
  encodeConnectionRequest,
  encodeReadVarRequest,
  encodeSetupCommunication,
  parseReadVarResponse,
  parseS7Pdu,
  parseSetupCommunicationResponse,
  S7_ROSCTR_ACK,
  S7_ROSCTR_ACK_DATA,
  S7Frame,
  S7FrameDecoder,
  S7Pdu
} from './s7-protocol';
import { planS7Read } from './s7-read-plan';
import { decodeS7Value, S7Value } from './s7-values';

export interface S7ClientOptions {
  host: string;
  port: number;
  /** Calling TSAP, usually 0x0100 */
  localTSAP: number;
  /** Called TSAP, see remoteTSAP() for the one of a CPU in a rack / slot */
  remoteTSAP: number;
  /** Maximum time (ms) for the TCP connection, the COTP handshake and the Setup Communication */
  connectTimeout: number;
  /** Maximum time (ms) to wait for the answer to a request */
  requestTimeout: number;
  /** PDU size requested to the PLC, which may lower it (240 for most S7-300) */
  pduSize?: number;
  /** Number of jobs in parallel requested to the PLC, which may lower it */
  maxParallelJobs?: number;
}

export type S7ReadResult = { value: S7Value } | { error: string };

type ClientState = 'disconnected' | 'connecting' | 'cotp' | 'setup' | 'connected';

interface PendingJob {
  resolve: (pdu: S7Pdu) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

const DEFAULT_PDU_SIZE = 960;
const DEFAULT_MAX_PARALLEL_JOBS = 8;

/**
 * S7 client. Emits `disconnect` (with the error) when an established connection is lost, i.e. not through disconnect().
 */
export default class S7Client extends EventEmitter<{ disconnect: [error: Error] }> {
  private socket: net.Socket | null = null;
  private state: ClientState = 'disconnected';
  private decoder = new S7FrameDecoder();
  private pendingJobs = new Map<number, PendingJob>();
  private pduReference = 0;
  private connection: { resolve: () => void; reject: (error: Error) => void; timeout: NodeJS.Timeout } | null = null;
  private negotiatedPduSize = 0;
  private negotiatedParallelJobs = 1;

  constructor(private readonly options: S7ClientOptions) {
    super();
  }

  get isConnected(): boolean {
    return this.state === 'connected';
  }

  /** PDU size negotiated with the PLC, 0 when not connected */
  get pduSize(): number {
    return this.negotiatedPduSize;
  }

  /** Number of requests sent in parallel, negotiated with the PLC */
  get maxParallelJobs(): number {
    return this.negotiatedParallelJobs;
  }

  connect(): Promise<void> {
    if (this.state !== 'disconnected') {
      return Promise.reject(new Error('S7 client already connected'));
    }
    return new Promise<void>((resolve, reject) => {
      this.state = 'connecting';
      this.decoder = new S7FrameDecoder();
      this.connection = {
        resolve,
        reject,
        timeout: setTimeout(
          () => this.teardown(new Error(`Connection timeout after ${this.options.connectTimeout} ms`)),
          this.options.connectTimeout
        )
      };
      const socket = net.createConnection({ host: this.options.host, port: this.options.port });
      this.socket = socket;
      socket.setNoDelay(true);
      socket.on('connect', () => {
        if (this.socket !== socket) return;
        socket.setKeepAlive(true, 10_000);
        this.state = 'cotp';
        socket.write(encodeConnectionRequest(this.options.localTSAP, this.options.remoteTSAP));
      });
      socket.on('data', (chunk: Buffer) => {
        if (this.socket !== socket) return;
        try {
          for (const frame of this.decoder.push(chunk)) {
            this.handleFrame(frame);
          }
        } catch (error: unknown) {
          this.teardown(error as Error);
        }
      });
      socket.on('error', (error: Error) => {
        if (this.socket !== socket) return;
        this.teardown(error);
      });
      socket.on('close', () => {
        if (this.socket !== socket) return;
        this.teardown(new Error('Connection closed by the PLC'));
      });
    });
  }

  async disconnect(): Promise<void> {
    const socket = this.socket;
    if (!socket) {
      return;
    }
    const closed = new Promise<void>(resolve => socket.once('close', () => resolve()));
    this.teardown(new Error('S7 client disconnected'), false);
    await closed;
  }

  /**
   * Reads the addresses, in as few requests as the PDU size allows. Returns one result per address, in the same order: its
   * value, or the error the PLC returned for it. Rejects when the requests themselves fail (timeout, connection lost...).
   */
  async read(addresses: Array<S7Address>): Promise<Array<S7ReadResult>> {
    if (!this.isConnected) {
      throw new Error('S7 client not connected');
    }
    if (addresses.length === 0) {
      return [];
    }
    const plan = planS7Read(addresses, this.negotiatedPduSize);
    const buffers = plan.blocks.map(block => Buffer.alloc(block.byteLength));
    const blockErrors = new Map<number, string>();

    const queue = [...plan.requests];
    const worker = async () => {
      for (let request = queue.shift(); request; request = queue.shift()) {
        const pdu = await this.sendJob(
          encodeReadVarRequest(
            this.nextPduReference(),
            request.map(chunk => chunk.item)
          )
        );
        const results = parseReadVarResponse(pdu, request.length);
        request.forEach((chunk, index) => {
          const result = results[index];
          if ('error' in result) {
            blockErrors.set(chunk.blockIndex, result.error);
          } else if (result.data.length !== chunk.byteLength) {
            blockErrors.set(chunk.blockIndex, `${result.data.length} bytes received, ${chunk.byteLength} expected`);
          } else {
            result.data.copy(buffers[chunk.blockIndex], chunk.blockOffset);
          }
        });
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.negotiatedParallelJobs, plan.requests.length) }, worker));

    const results = new Array<S7ReadResult>(addresses.length);
    plan.blocks.forEach((block, blockIndex) => {
      const error = blockErrors.get(blockIndex);
      for (const addressIndex of block.addressIndexes) {
        const address = addresses[addressIndex];
        if (error) {
          results[addressIndex] = { error };
          continue;
        }
        const offset = address.area === 'T' || address.area === 'C' ? 0 : address.offset - block.start;
        results[addressIndex] = { value: decodeS7Value(address, buffers[blockIndex].subarray(offset, offset + address.byteLength)) };
      }
    });
    return results;
  }

  private handleFrame(frame: S7Frame): void {
    switch (frame.type) {
      case 'connection-confirm':
        if (this.state !== 'cotp') {
          throw new Error('Unexpected COTP connection confirm');
        }
        this.state = 'setup';
        this.sendJob(
          encodeSetupCommunication(
            this.nextPduReference(),
            this.options.maxParallelJobs ?? DEFAULT_MAX_PARALLEL_JOBS,
            this.options.pduSize ?? DEFAULT_PDU_SIZE
          )
        )
          .then(pdu => this.onSetupCommunication(pdu))
          .catch((error: Error) => this.teardown(error));
        return;
      case 'disconnect-request':
        throw new Error(
          this.state === 'cotp'
            ? 'Connection refused by the PLC (check the rack, the slot and the connection type)'
            : 'Connection closed by the PLC'
        );
      case 'data': {
        const pdu = parseS7Pdu(frame.payload);
        if (pdu.rosctr !== S7_ROSCTR_ACK && pdu.rosctr !== S7_ROSCTR_ACK_DATA) {
          return; // jobs or user data initiated by the PLC are not supported
        }
        const job = this.pendingJobs.get(pdu.pduReference);
        if (job) {
          this.pendingJobs.delete(pdu.pduReference);
          clearTimeout(job.timeout);
          job.resolve(pdu);
        }
      }
    }
  }

  private onSetupCommunication(pdu: S7Pdu): void {
    const { maxParallelJobs, pduSize } = parseSetupCommunicationResponse(pdu);
    this.negotiatedPduSize = Math.min(pduSize, this.options.pduSize ?? DEFAULT_PDU_SIZE);
    this.negotiatedParallelJobs = Math.max(1, Math.min(maxParallelJobs, this.options.maxParallelJobs ?? DEFAULT_MAX_PARALLEL_JOBS));
    this.state = 'connected';
    const connection = this.connection!;
    this.connection = null;
    clearTimeout(connection.timeout);
    connection.resolve();
  }

  private sendJob(frame: Buffer): Promise<S7Pdu> {
    const pduReference = frame.readUInt16BE(11);
    return new Promise<S7Pdu>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingJobs.delete(pduReference);
        const error = new Error(`Request timeout after ${this.options.requestTimeout} ms`);
        reject(error);
        // The connection state is unknown after a lost answer: it is closed
        this.teardown(error);
      }, this.options.requestTimeout);
      this.pendingJobs.set(pduReference, { resolve, reject, timeout });
      this.socket!.write(frame);
    });
  }

  private nextPduReference(): number {
    this.pduReference = (this.pduReference % 0xffff) + 1;
    return this.pduReference;
  }

  private teardown(error: Error, notify = true): void {
    if (this.state === 'disconnected') {
      return;
    }
    const wasConnected = this.state === 'connected';
    this.state = 'disconnected';
    this.negotiatedPduSize = 0;
    for (const job of this.pendingJobs.values()) {
      clearTimeout(job.timeout);
      job.reject(error);
    }
    this.pendingJobs.clear();
    if (this.connection) {
      clearTimeout(this.connection.timeout);
      this.connection.reject(error);
      this.connection = null;
    }
    this.socket?.destroy();
    this.socket = null;
    if (wasConnected && notify) {
      this.emit('disconnect', error);
    }
  }
}
