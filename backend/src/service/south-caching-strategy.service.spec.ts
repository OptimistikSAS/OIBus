import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldCacheValue, CachingStrategyDecisionInput } from './south-caching-strategy.service';

const BASE: CachingStrategyDecisionInput = {
  cachingStrategy: 'allValues',
  thresholdType: null,
  threshold: null,
  rangeLow: null,
  rangeHigh: null,
  maxCachingInterval: null,
  previousCachedValue: null,
  previousCachedInstant: null,
  newValue: null,
  newQueryTime: '2024-01-01T00:00:00.000Z'
};

describe('shouldCacheValue', () => {
  it('always caches the first-ever value regardless of strategy', () => {
    const result = shouldCacheValue({
      ...BASE,
      cachingStrategy: 'threshold',
      thresholdType: 'absolute',
      threshold: 100,
      previousCachedInstant: null,
      previousCachedValue: null,
      newValue: 1
    });

    assert.strictEqual(result, true);
  });

  it('always caches when strategy is allValues', () => {
    const result = shouldCacheValue({
      ...BASE,
      cachingStrategy: 'allValues',
      previousCachedInstant: '2024-01-01T00:00:00.000Z',
      previousCachedValue: 42,
      newValue: 42,
      newQueryTime: '2024-01-01T00:00:01.000Z'
    });

    assert.strictEqual(result, true);
  });

  describe('onChange', () => {
    it('does not cache when the new value is deep-equal to the previous value (nested object)', () => {
      const result = shouldCacheValue({
        ...BASE,
        cachingStrategy: 'onChange',
        previousCachedInstant: '2024-01-01T00:00:00.000Z',
        previousCachedValue: { a: 1, b: { c: [1, 2, 3] } },
        newValue: { a: 1, b: { c: [1, 2, 3] } },
        newQueryTime: '2024-01-01T00:00:01.000Z'
      });

      assert.strictEqual(result, false);
    });

    it('does not cache when the new value is deep-equal to the previous value (array)', () => {
      const result = shouldCacheValue({
        ...BASE,
        cachingStrategy: 'onChange',
        previousCachedInstant: '2024-01-01T00:00:00.000Z',
        previousCachedValue: [1, 2, { x: 'y' }],
        newValue: [1, 2, { x: 'y' }],
        newQueryTime: '2024-01-01T00:00:01.000Z'
      });

      assert.strictEqual(result, false);
    });

    it('caches when the new value differs from the previous value (nested object)', () => {
      const result = shouldCacheValue({
        ...BASE,
        cachingStrategy: 'onChange',
        previousCachedInstant: '2024-01-01T00:00:00.000Z',
        previousCachedValue: { a: 1, b: { c: [1, 2, 3] } },
        newValue: { a: 1, b: { c: [1, 2, 4] } },
        newQueryTime: '2024-01-01T00:00:01.000Z'
      });

      assert.strictEqual(result, true);
    });

    it('caches when the new value differs from the previous value (array)', () => {
      const result = shouldCacheValue({
        ...BASE,
        cachingStrategy: 'onChange',
        previousCachedInstant: '2024-01-01T00:00:00.000Z',
        previousCachedValue: [1, 2, 3],
        newValue: [1, 2, 3, 4],
        newQueryTime: '2024-01-01T00:00:01.000Z'
      });

      assert.strictEqual(result, true);
    });
  });

  describe('threshold - absolute', () => {
    it('does not cache exactly at the boundary (strict >)', () => {
      const result = shouldCacheValue({
        ...BASE,
        cachingStrategy: 'threshold',
        thresholdType: 'absolute',
        threshold: 5,
        previousCachedInstant: '2024-01-01T00:00:00.000Z',
        previousCachedValue: 10,
        newValue: 15, // |15 - 10| = 5, exactly equal to threshold
        newQueryTime: '2024-01-01T00:00:01.000Z'
      });

      assert.strictEqual(result, false);
    });

    it('caches just over the boundary', () => {
      const result = shouldCacheValue({
        ...BASE,
        cachingStrategy: 'threshold',
        thresholdType: 'absolute',
        threshold: 5,
        previousCachedInstant: '2024-01-01T00:00:00.000Z',
        previousCachedValue: 10,
        newValue: 15.01, // |15.01 - 10| = 5.01 > 5
        newQueryTime: '2024-01-01T00:00:01.000Z'
      });

      assert.strictEqual(result, true);
    });
  });

  describe('threshold - percentage', () => {
    // rangeLow = 0, rangeHigh = 200 -> span = 200. threshold = 10% -> cache when |diff| > 20.
    it('does not cache exactly at the percentage boundary', () => {
      const result = shouldCacheValue({
        ...BASE,
        cachingStrategy: 'threshold',
        thresholdType: 'percentage',
        threshold: 10,
        rangeLow: 0,
        rangeHigh: 200,
        previousCachedInstant: '2024-01-01T00:00:00.000Z',
        previousCachedValue: 50,
        newValue: 70, // |70 - 50| = 20 = (10/100) * 200, exactly equal
        newQueryTime: '2024-01-01T00:00:01.000Z'
      });

      assert.strictEqual(result, false);
    });

    it('caches just over the percentage boundary', () => {
      const result = shouldCacheValue({
        ...BASE,
        cachingStrategy: 'threshold',
        thresholdType: 'percentage',
        threshold: 10,
        rangeLow: 0,
        rangeHigh: 200,
        previousCachedInstant: '2024-01-01T00:00:00.000Z',
        previousCachedValue: 50,
        newValue: 70.01, // |70.01 - 50| = 20.01 > 20
        newQueryTime: '2024-01-01T00:00:01.000Z'
      });

      assert.strictEqual(result, true);
    });
  });

  describe('maxCachingInterval', () => {
    it('caches on heartbeat interval even when the value is unchanged (onChange strategy)', () => {
      const result = shouldCacheValue({
        ...BASE,
        cachingStrategy: 'onChange',
        maxCachingInterval: 60000, // 1 minute
        previousCachedInstant: '2024-01-01T00:00:00.000Z',
        previousCachedValue: 42,
        newValue: 42,
        newQueryTime: '2024-01-01T00:01:00.000Z' // exactly 60000ms elapsed
      });

      assert.strictEqual(result, true);
    });

    it('caches on heartbeat interval even when the value is unchanged (threshold strategy)', () => {
      const result = shouldCacheValue({
        ...BASE,
        cachingStrategy: 'threshold',
        thresholdType: 'absolute',
        threshold: 100,
        maxCachingInterval: 60000,
        previousCachedInstant: '2024-01-01T00:00:00.000Z',
        previousCachedValue: 42,
        newValue: 42,
        newQueryTime: '2024-01-01T00:01:05.000Z' // > 60000ms elapsed
      });

      assert.strictEqual(result, true);
    });

    it('does not fire the heartbeat before the interval has elapsed, deferring to onChange', () => {
      const result = shouldCacheValue({
        ...BASE,
        cachingStrategy: 'onChange',
        maxCachingInterval: 60000,
        previousCachedInstant: '2024-01-01T00:00:00.000Z',
        previousCachedValue: 42,
        newValue: 42,
        newQueryTime: '2024-01-01T00:00:30.000Z' // only 30000ms elapsed
      });

      assert.strictEqual(result, false);
    });
  });

  describe('threshold with non-numeric values', () => {
    it('falls back to caching when the new value is not numeric', () => {
      const result = shouldCacheValue({
        ...BASE,
        cachingStrategy: 'threshold',
        thresholdType: 'absolute',
        threshold: 5,
        previousCachedInstant: '2024-01-01T00:00:00.000Z',
        previousCachedValue: 10,
        newValue: 'not-a-number',
        newQueryTime: '2024-01-01T00:00:01.000Z'
      });

      assert.strictEqual(result, true);
    });

    it('falls back to caching when the previous value is not numeric', () => {
      const result = shouldCacheValue({
        ...BASE,
        cachingStrategy: 'threshold',
        thresholdType: 'absolute',
        threshold: 5,
        previousCachedInstant: '2024-01-01T00:00:00.000Z',
        previousCachedValue: { unexpected: 'object' },
        newValue: 20,
        newQueryTime: '2024-01-01T00:00:01.000Z'
      });

      assert.strictEqual(result, true);
    });
  });
});
