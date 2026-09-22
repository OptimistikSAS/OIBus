/**
 * A Map-like cache with a hard size limit, used for caches keyed by connector configuration
 * (proxy settings, AAD credentials, …) that would otherwise grow for as long as the process
 * runs, one entry per distinct config ever seen — connectors get reconfigured over weeks/months
 * of uptime with no hook here to evict a stale entry when that happens. Bounding the size and
 * evicting least-recently-used entries keeps that growth capped regardless.
 */
export class BoundedCache<K, V> {
  private readonly map = new Map<K, V>();

  constructor(
    private readonly maxSize: number,
    private readonly onEvict?: (value: V) => void
  ) {}

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      // Refresh recency: delete + re-set moves the entry to the end of Map's iteration order.
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      const oldestKey = this.map.keys().next().value as K;
      const oldestValue = this.map.get(oldestKey)!;
      this.map.delete(oldestKey);
      this.onEvict?.(oldestValue);
    }
    this.map.set(key, value);
  }

  clear(): void {
    if (this.onEvict) {
      for (const value of this.map.values()) {
        this.onEvict(value);
      }
    }
    this.map.clear();
  }
}
