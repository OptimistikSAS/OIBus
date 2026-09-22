import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { BoundedCache } from './bounded-cache';

describe('BoundedCache', () => {
  it('should get and set entries like a normal cache', () => {
    const cache = new BoundedCache<string, number>(2);
    cache.set('a', 1);
    assert.strictEqual(cache.get('a'), 1);
    assert.strictEqual(cache.get('missing'), undefined);
  });

  it('should evict the least-recently-set entry once maxSize is exceeded', () => {
    const cache = new BoundedCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    assert.strictEqual(cache.get('a'), undefined);
    assert.strictEqual(cache.get('b'), 2);
    assert.strictEqual(cache.get('c'), 3);
  });

  it('should treat a get() as refreshing recency, protecting it from the next eviction', () => {
    const cache = new BoundedCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // 'a' is now the most recently used, 'b' becomes the oldest
    cache.set('c', 3);

    assert.strictEqual(cache.get('a'), 1);
    assert.strictEqual(cache.get('b'), undefined);
    assert.strictEqual(cache.get('c'), 3);
  });

  it('should call onEvict with the evicted value', () => {
    const onEvict = mock.fn();
    const cache = new BoundedCache<string, number>(1, onEvict);
    cache.set('a', 1);
    cache.set('b', 2);

    assert.strictEqual(onEvict.mock.calls.length, 1);
    assert.strictEqual(onEvict.mock.calls[0].arguments[0], 1);
  });

  it('should not evict or duplicate when re-setting an existing key', () => {
    const onEvict = mock.fn();
    const cache = new BoundedCache<string, number>(2, onEvict);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 10);

    assert.strictEqual(onEvict.mock.calls.length, 0);
    assert.strictEqual(cache.get('a'), 10);
    assert.strictEqual(cache.get('b'), 2);
  });

  it('should call onEvict for every entry on clear()', () => {
    const onEvict = mock.fn();
    const cache = new BoundedCache<string, number>(5, onEvict);
    cache.set('a', 1);
    cache.set('b', 2);

    cache.clear();

    assert.strictEqual(onEvict.mock.calls.length, 2);
    assert.strictEqual(cache.get('a'), undefined);
    assert.strictEqual(cache.get('b'), undefined);
  });

  it('should clear without an onEvict callback', () => {
    const cache = new BoundedCache<string, number>(5);
    cache.set('a', 1);

    cache.clear();

    assert.strictEqual(cache.get('a'), undefined);
  });
});
