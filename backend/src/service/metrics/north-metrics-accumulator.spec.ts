import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CacheMetadata } from '../../../shared/model/engine.model';
import {
  applyNorthCacheContentSize,
  applyNorthConnect,
  applyNorthRunEnd,
  applyNorthRunStart,
  NorthMetricsState
} from './north-metrics-accumulator';

/** A zeroed state, fresh for each test. */
function emptyState(): NorthMetricsState {
  return {
    lastConnection: null,
    lastRunStart: null,
    lastRunDuration: null,
    lastContentSent: null,
    contentSentSize: 0,
    contentCachedSize: 0,
    contentErroredSize: 0,
    contentArchivedSize: 0
  };
}

/** Build a valid CacheMetadata with the two fields the accumulator reads. */
function meta(contentFile: string, contentSize: number): CacheMetadata {
  return { contentFile, contentSize, createdAt: '2025-01-01T00:00:00.000Z', numberOfElement: 0, contentType: 'any' };
}

describe('north-metrics-accumulator', () => {
  it('applyNorthConnect sets lastConnection', () => {
    const state = emptyState();
    applyNorthConnect(state, { lastConnection: '2025-01-01T00:00:00.000Z' });
    assert.strictEqual(state.lastConnection, '2025-01-01T00:00:00.000Z');
  });

  it('applyNorthRunStart sets lastRunStart', () => {
    const state = emptyState();
    applyNorthRunStart(state, { lastRunStart: '2025-02-02T00:00:00.000Z' });
    assert.strictEqual(state.lastRunStart, '2025-02-02T00:00:00.000Z');
  });

  it('applyNorthCacheContentSize accumulates', () => {
    const state = emptyState();
    applyNorthCacheContentSize(state, 100);
    applyNorthCacheContentSize(state, 23);
    assert.strictEqual(state.contentCachedSize, 123);
  });

  describe('applyNorthRunEnd', () => {
    it('action "sent" grows contentSentSize and sets lastContentSent', () => {
      const state = emptyState();
      applyNorthRunEnd(state, { lastRunDuration: 42, metadata: meta('a.csv', 10), action: 'sent' });
      assert.strictEqual(state.lastRunDuration, 42);
      assert.strictEqual(state.lastContentSent, 'a.csv');
      assert.strictEqual(state.contentSentSize, 10);
      assert.strictEqual(state.contentArchivedSize, 0);
      assert.strictEqual(state.contentErroredSize, 0);
    });

    it('action "archived" grows BOTH contentArchivedSize and contentSentSize', () => {
      const state = emptyState();
      applyNorthRunEnd(state, { lastRunDuration: 5, metadata: meta('b.csv', 7), action: 'archived' });
      assert.strictEqual(state.lastContentSent, 'b.csv');
      assert.strictEqual(state.contentArchivedSize, 7);
      assert.strictEqual(state.contentSentSize, 7, 'archived content is also counted as sent');
      assert.strictEqual(state.contentErroredSize, 0);
    });

    it('action "errored" grows only contentErroredSize and leaves lastContentSent untouched', () => {
      const state = emptyState();
      applyNorthRunEnd(state, { lastRunDuration: 9, metadata: meta('c.csv', 3), action: 'errored' });
      assert.strictEqual(state.contentErroredSize, 3);
      assert.strictEqual(state.contentSentSize, 0);
      assert.strictEqual(state.contentArchivedSize, 0);
      assert.strictEqual(state.lastContentSent, null);
    });

    it('accumulates across multiple run-ends', () => {
      const state = emptyState();
      applyNorthRunEnd(state, { lastRunDuration: 1, metadata: meta('a', 10), action: 'sent' });
      applyNorthRunEnd(state, { lastRunDuration: 2, metadata: meta('b', 5), action: 'archived' });
      applyNorthRunEnd(state, { lastRunDuration: 3, metadata: meta('c', 4), action: 'errored' });
      assert.strictEqual(state.contentSentSize, 15); // 10 + 5 (archived counts as sent)
      assert.strictEqual(state.contentArchivedSize, 5);
      assert.strictEqual(state.contentErroredSize, 4);
      assert.strictEqual(state.lastContentSent, 'b'); // errored did not overwrite
      assert.strictEqual(state.lastRunDuration, 3);
    });
  });
});
