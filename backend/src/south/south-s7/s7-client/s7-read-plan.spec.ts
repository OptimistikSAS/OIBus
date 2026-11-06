import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseS7Address } from './s7-address';
import { maxChunkLength, planS7Read, S7ReadPlan } from './s7-read-plan';

const plan = (addresses: Array<string>, pduSize = 240) => planS7Read(addresses.map(parseS7Address), pduSize);

// [area code, db, start, byte length, address indexes] per block
const blocksOf = (readPlan: S7ReadPlan) =>
  readPlan.blocks.map(block => [block.areaCode, block.dbNumber, block.start, block.byteLength, block.addressIndexes]);
// [area code, db, start, count, transport size, block index, offset in the block] per item, per request
const requestsOf = (readPlan: S7ReadPlan) =>
  readPlan.requests.map(request =>
    request.map(chunk => [
      chunk.item.areaCode,
      chunk.item.dbNumber,
      chunk.item.start,
      chunk.item.count,
      chunk.item.transportSize,
      chunk.blockIndex,
      chunk.blockOffset
    ])
  );

describe('S7 read plan', () => {
  it('should compute the largest item of a response', () => {
    assert.strictEqual(maxChunkLength(240), 222);
    assert.strictEqual(maxChunkLength(480), 462);
    assert.strictEqual(maxChunkLength(19), 0);
    assert.throws(() => plan(['DB1,REAL0'], 19), new Error('PDU size 19 too small'));
  });

  it('should merge close items of the same data block, sorted by offset', () => {
    const readPlan = plan(['DB1,INT10', 'DB1,REAL0', 'DB1,X4.1', 'DB1,REAL6', 'DB1,BYTE20', 'DB2,REAL0']);
    // DB1 0-11 in one block (gap of 1 byte after X4.1, then INT10 adjacent), BYTE20 after a gap of 8: another block
    assert.deepStrictEqual(blocksOf(readPlan), [
      [0x84, 1, 0, 12, [1, 2, 3, 0]],
      [0x84, 1, 20, 1, [4]],
      [0x84, 2, 0, 4, [5]]
    ]);
    assert.deepStrictEqual(requestsOf(readPlan), [
      [
        [0x84, 1, 0, 12, 0x02, 0, 0],
        [0x84, 1, 20, 1, 0x02, 1, 0],
        [0x84, 2, 0, 4, 0x02, 2, 0]
      ]
    ]);
  });

  it('should merge an item contained in another one', () => {
    assert.deepStrictEqual(blocksOf(plan(['DB1,REAL0.4', 'DB1,INT4'])), [[0x84, 1, 0, 16, [0, 1]]]);
  });

  it('should merge items of the same area outside data blocks, but not across areas', () => {
    // MB0 and MW4 are 3 bytes apart, MW12 6 bytes after MW4
    assert.deepStrictEqual(blocksOf(plan(['MW4', 'MB0', 'IB0', 'QB0', 'QB1', 'MW12'])), [
      [0x81, 0, 0, 1, [2]],
      [0x82, 0, 0, 2, [3, 4]],
      [0x83, 0, 0, 6, [1, 0]],
      [0x83, 0, 12, 2, [5]]
    ]);
  });

  it('should not merge peripherals, timers and counters', () => {
    const readPlan = plan(['PIW0', 'PIW2', 'T0', 'T1', 'C0']);
    assert.deepStrictEqual(blocksOf(readPlan), [
      [0x1c, 0, 0, 2, [4]],
      [0x1d, 0, 0, 2, [2]],
      [0x1d, 0, 1, 2, [3]],
      [0x80, 0, 0, 2, [0]],
      [0x80, 0, 2, 2, [1]]
    ]);
    // Timers and counters are requested by number with their own transport size
    assert.deepStrictEqual(requestsOf(readPlan)[0].slice(0, 3), [
      [0x1c, 0, 0, 1, 0x1c, 0, 0],
      [0x1d, 0, 0, 1, 0x1d, 1, 0],
      [0x1d, 0, 1, 1, 0x1d, 2, 0]
    ]);
  });

  it('should not merge items into a block larger than a response item', () => {
    // 222 bytes max with a 240-byte PDU: REAL200 would make the block 204 bytes long, REAL220 224
    assert.deepStrictEqual(blocksOf(plan(['DB1,REAL0', 'DB1,REAL4.49', 'DB1,REAL200', 'DB1,REAL220'])), [
      [0x84, 1, 0, 204, [0, 1, 2]],
      [0x84, 1, 220, 4, [3]]
    ]);
  });

  it('should split a large item over several requests', () => {
    // 250 REAL = 1000 bytes, 222 bytes per item: 4 full chunks and one of 112 bytes, each alone in its response
    const readPlan = plan(['DB1,REAL200.250']);
    assert.deepStrictEqual(blocksOf(readPlan), [[0x84, 1, 200, 1000, [0]]]);
    assert.deepStrictEqual(requestsOf(readPlan), [
      [[0x84, 1, 200, 222, 0x02, 0, 0]],
      [[0x84, 1, 422, 222, 0x02, 0, 222]],
      [[0x84, 1, 644, 222, 0x02, 0, 444]],
      [[0x84, 1, 866, 222, 0x02, 0, 666]],
      [[0x84, 1, 1088, 112, 0x02, 0, 888]]
    ]);
    // With a 960-byte PDU (942 bytes per item): 2 chunks, both in one response would be too large
    assert.deepStrictEqual(requestsOf(plan(['DB1,REAL200.250'], 960)), [
      [[0x84, 1, 200, 942, 0x02, 0, 0]],
      [[0x84, 1, 1142, 58, 0x02, 0, 942]]
    ]);
  });

  it('should split timer arrays by timer', () => {
    // 222 bytes per item: 111 timers
    assert.deepStrictEqual(requestsOf(plan(['T0.200'])), [[[0x1d, 0, 0, 111, 0x1d, 0, 0]], [[0x1d, 0, 111, 89, 0x1d, 0, 222]]]);
  });

  it('should pack items in requests by response size, counting the padding', () => {
    // Responses: 14 bytes of headers, then 4 + 50 bytes per item (49 bytes padded): 4 items fit in 230 bytes, not 5
    const addresses = Array.from({ length: 5 }, (_value, index) => `DB${index + 1},B0.49`);
    assert.deepStrictEqual(
      plan(addresses).requests.map(request => request.length),
      [4, 1]
    );
  });

  it('should pack at most 20 items per request, and fewer when the request itself would not fit', () => {
    const addresses = Array.from({ length: 45 }, (_value, index) => `DB${index + 1},B0`);
    assert.deepStrictEqual(
      plan(addresses, 960).requests.map(request => request.length),
      [20, 20, 5]
    );
    // A 240-byte PDU holds a request of 19 items: 10 + 2 + 19 * 12 = 240
    assert.deepStrictEqual(
      plan(addresses, 240).requests.map(request => request.length),
      [19, 19, 7]
    );
  });

  it('should plan nothing for no address', () => {
    assert.deepStrictEqual(plan([]), { blocks: [], requests: [] });
  });
});
