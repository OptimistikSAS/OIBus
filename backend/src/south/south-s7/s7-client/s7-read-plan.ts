// Planning of the Read Var requests needed to read a list of S7 addresses, ported to TypeScript from nodeS7
// (https://github.com/plcpeople/nodeS7, prepareReadPacket and itemListSorter): items close to each other in the same
// area are merged into one block, blocks too large for a PDU are split, and the parts are packed into as few requests as
// the negotiated PDU size allows.
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

import type { S7Address } from './s7-address';
import {
  S7_ACK_HEADER_LENGTH,
  S7_JOB_HEADER_LENGTH,
  S7_READ_PARAMETER_HEADER_LENGTH,
  S7_READ_REQUEST_ITEM_LENGTH,
  S7_READ_RESPONSE_ITEM_HEADER_LENGTH,
  S7_TRANSPORT_SIZE_BYTE,
  S7ReadRequestItem
} from './s7-protocol';

/** Largest gap (in bytes) between two items still read as one block */
const MAX_GAP = 5;
/** Most S7 CPUs refuse more than 20 items in one Read Var request */
const MAX_ITEMS_PER_REQUEST = 20;
/** Areas whose bytes can be read as one block (not the peripherals, timers and counters) */
const MERGEABLE_AREAS = new Set(['DB', 'I', 'Q', 'M']);

/** A contiguous range read from the PLC, holding one or more addresses */
export interface S7ReadBlock {
  areaCode: number;
  dbNumber: number;
  /** Byte offset, or number of the first timer / counter */
  start: number;
  byteLength: number;
  /** Indexes of the addresses (in the planned list) read through this block */
  addressIndexes: Array<number>;
}

/** One item of a Read Var request: a part of a block */
export interface S7ReadChunk {
  item: S7ReadRequestItem;
  blockIndex: number;
  /** Where the bytes of this chunk go in the buffer of its block */
  blockOffset: number;
  byteLength: number;
}

export interface S7ReadPlan {
  blocks: Array<S7ReadBlock>;
  /** Read Var requests, each one a list of chunks fitting in one PDU (request and response) */
  requests: Array<Array<S7ReadChunk>>;
}

const isTimerOrCounter = (address: S7Address): boolean => address.area === 'T' || address.area === 'C';

const compareAddresses = (a: S7Address, b: S7Address): number =>
  a.areaCode - b.areaCode || a.dbNumber - b.dbNumber || a.offset - b.offset || b.byteLength - a.byteLength;

const evenLength = (length: number): number => length + (length % 2);

/** Largest number of data bytes a single item of a Read Var response can carry with this PDU size (kept even) */
export const maxChunkLength = (pduSize: number): number =>
  (pduSize - S7_ACK_HEADER_LENGTH - S7_READ_PARAMETER_HEADER_LENGTH - S7_READ_RESPONSE_ITEM_HEADER_LENGTH) & ~1;

const buildBlocks = (addresses: Array<S7Address>, maxLength: number): Array<S7ReadBlock> => {
  const indexes = addresses.map((_address, index) => index).sort((a, b) => compareAddresses(addresses[a], addresses[b]));
  const blocks: Array<S7ReadBlock> = [];
  let current: S7ReadBlock | null = null;
  let currentMergeable = false;
  for (const index of indexes) {
    const address = addresses[index];
    const mergeable = MERGEABLE_AREAS.has(address.area);
    if (
      current &&
      currentMergeable &&
      mergeable &&
      current.areaCode === address.areaCode &&
      current.dbNumber === address.dbNumber &&
      address.offset - (current.start + current.byteLength) <= MAX_GAP &&
      Math.max(current.byteLength, address.offset - current.start + address.byteLength) <= maxLength
    ) {
      current.byteLength = Math.max(current.byteLength, address.offset - current.start + address.byteLength);
      current.addressIndexes.push(index);
      continue;
    }
    current = {
      areaCode: address.areaCode,
      dbNumber: address.dbNumber,
      start: address.offset,
      byteLength: address.byteLength,
      addressIndexes: [index]
    };
    currentMergeable = mergeable;
    blocks.push(current);
  }
  return blocks;
};

const splitBlock = (block: S7ReadBlock, blockIndex: number, timerOrCounter: boolean, maxLength: number): Array<S7ReadChunk> => {
  const chunks: Array<S7ReadChunk> = [];
  // Timers and counters are requested by number (2 bytes each), other areas by byte
  const unitLength = timerOrCounter ? 2 : 1;
  const maxUnits = Math.floor(maxLength / unitLength);
  const totalUnits = block.byteLength / unitLength;
  for (let unit = 0; unit < totalUnits; unit += maxUnits) {
    const count = Math.min(maxUnits, totalUnits - unit);
    chunks.push({
      item: {
        areaCode: block.areaCode,
        dbNumber: block.dbNumber,
        start: block.start + unit,
        count,
        transportSize: timerOrCounter ? block.areaCode : S7_TRANSPORT_SIZE_BYTE
      },
      blockIndex,
      blockOffset: unit * unitLength,
      byteLength: count * unitLength
    });
  }
  return chunks;
};

const packRequests = (chunks: Array<S7ReadChunk>, pduSize: number): Array<Array<S7ReadChunk>> => {
  const maxItems = Math.min(
    MAX_ITEMS_PER_REQUEST,
    Math.floor((pduSize - S7_JOB_HEADER_LENGTH - S7_READ_PARAMETER_HEADER_LENGTH) / S7_READ_REQUEST_ITEM_LENGTH)
  );
  const requests: Array<Array<S7ReadChunk>> = [];
  let current: Array<S7ReadChunk> = [];
  let responseLength = S7_ACK_HEADER_LENGTH + S7_READ_PARAMETER_HEADER_LENGTH;
  for (const chunk of chunks) {
    const chunkResponseLength = S7_READ_RESPONSE_ITEM_HEADER_LENGTH + evenLength(chunk.byteLength);
    if (current.length > 0 && (current.length === maxItems || responseLength + chunkResponseLength > pduSize)) {
      requests.push(current);
      current = [];
      responseLength = S7_ACK_HEADER_LENGTH + S7_READ_PARAMETER_HEADER_LENGTH;
    }
    current.push(chunk);
    responseLength += chunkResponseLength;
  }
  if (current.length > 0) {
    requests.push(current);
  }
  return requests;
};

/** Plans the Read Var requests reading all the addresses with the negotiated PDU size */
export function planS7Read(addresses: Array<S7Address>, pduSize: number): S7ReadPlan {
  const maxLength = maxChunkLength(pduSize);
  if (maxLength < 2) {
    throw new Error(`PDU size ${pduSize} too small`);
  }
  const blocks = buildBlocks(addresses, maxLength);
  const chunks = blocks.flatMap((block, blockIndex) =>
    splitBlock(block, blockIndex, isTimerOrCounter(addresses[block.addressIndexes[0]]), maxLength)
  );
  return { blocks, requests: packRequests(chunks, pduSize) };
}
