import type { CacheSize } from './engine.model';

/** Events published by a cache service's `cacheSizeEventEmitter`. */
export interface CacheSizeEvents {
  /** Current on-disk sizes of the cache/error/archive folders (a gauge). */
  'cache-size': CacheSize;
  /** Size delta of a single file just added to the cache (a counter increment). */
  'cache-content-size': number;
}
