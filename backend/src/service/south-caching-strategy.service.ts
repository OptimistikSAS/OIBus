import { DateTime } from 'luxon';
import { isDeepStrictEqual } from 'node:util';
import { Instant } from '../model/types';
import { SouthCachingStrategy, SouthCachingThresholdType } from '../../shared/model/south-connector.model';

export interface CachingStrategyDecisionInput {
  cachingStrategy: SouthCachingStrategy;
  thresholdType: SouthCachingThresholdType | null;
  threshold: number | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  maxCachingInterval: number | null;
  previousCachedValue: unknown;
  previousCachedInstant: Instant | null;
  newValue: unknown;
  newQueryTime: Instant;
}

/**
 * Decides whether a newly read/received value should be cached, based on the item's per-item
 * caching strategy (`allValues`, `onChange`, `threshold`) and the optional `maxCachingInterval`
 * heartbeat. Pure function, usable without instantiation.
 */
export function shouldCacheValue(input: CachingStrategyDecisionInput): boolean {
  // Never cached before: always cache the first value.
  if (input.previousCachedInstant === null) {
    return true;
  }

  if (input.cachingStrategy === 'allValues') {
    return true;
  }

  // Heartbeat check applies before onChange/threshold comparisons: a stable point still produces
  // periodic proof-of-life data.
  if (input.maxCachingInterval !== null) {
    const elapsedMs = DateTime.fromISO(input.newQueryTime).diff(DateTime.fromISO(input.previousCachedInstant)).as('milliseconds');
    if (elapsedMs >= input.maxCachingInterval) {
      return true;
    }
  }

  if (input.cachingStrategy === 'onChange') {
    return !isDeepStrictEqual(input.newValue, input.previousCachedValue);
  }

  // threshold
  const newNumber = Number(input.newValue);
  const previousNumber = Number(input.previousCachedValue);
  if (Number.isNaN(newNumber) || Number.isNaN(previousNumber)) {
    // Defensive fallback only: the config layer already prevents `threshold` on connectors (e.g. MQTT)
    // whose values aren't guaranteed numeric.
    return true;
  }

  const diff = Math.abs(newNumber - previousNumber);
  if (input.thresholdType === 'percentage') {
    const span = (input.rangeHigh ?? 0) - (input.rangeLow ?? 0);
    return diff > ((input.threshold ?? 0) / 100) * span;
  }
  // absolute
  return diff > (input.threshold ?? 0);
}
