import { OIBusContent } from '../common/content.model';
import { Instant } from '../common/types';

/**
 * Recovery strategy used when a south connector reconnects after a long disconnection.
 * - 'oldest': fill the gap from oldest to newest (default behaviour).
 * - 'newest': fill the gap from newest to oldest so that recent data arrives first.
 */
export type SouthHistoryRecoveryStrategy = 'oldest' | 'newest';

/**
 * Per-item caching strategy for IoT-family south connectors.
 * - 'allValues': every value read/received is cached (default behaviour).
 * - 'onChange': a value is only cached when it differs from the last cached value.
 * - 'threshold': a value is only cached when it differs from the last cached value by more than a threshold.
 */
export type SouthCachingStrategy = 'allValues' | 'onChange' | 'threshold';

/**
 * The kind of threshold used by the 'threshold' caching strategy.
 * - 'absolute': the threshold is an absolute numeric difference.
 * - 'percentage': the threshold is a percentage of the value's configured range (rangeHigh - rangeLow).
 */
export type SouthCachingThresholdType = 'absolute' | 'percentage';

/**
 * Settings for testing a South connector item.
 * Used when manually testing data collection for an item.
 *
 * @example
 * {
 *   "history": undefined
 * }
 */
export interface SouthConnectorItemTestingSettings {
  /**
   * Historical data range for testing.
   * Undefined when testing real-time data collection (which for folder-scanner means last file).
   */
  history:
    | {
        /**
         * Start time for historical data test (ISO 8601 format).
         * Not applicable for folder-scanner as it doesn't support history mode.
         */
        startTime: string;

        /**
         * End time for historical data test (ISO 8601 format).
         * Not applicable for folder-scanner as it doesn't support history mode.
         */
        endTime: string;
      }
    | undefined;

  /**
   * Optional transformer to run the raw test result through before returning it.
   * When omitted, the raw collected value is returned (default behavior).
   * `transformerId` references a transformer in the global catalog; `options` are the
   * per-binding options to apply.
   */
  transformer?: {
    transformerId: string;
    options: Record<string, unknown>;
  };
}

/**
 * What a South connector's `testItem()` returns: the collected content, plus how long it took to
 * connect to the source (0 when an already-open connection was reused) and how long the query/read
 * itself took. Lets the UI/OIAnalytics distinguish a slow connection from a slow query.
 */
export interface SouthConnectorItemQueryResult {
  result: OIBusContent;
  connectionDuration: number;
  queryDuration: number;
}

/**
 * A single entry returned while exploring/discovering a South connector's data source.
 * Represents an OPC-UA node or a file-system entry. Kept intentionally generic and
 * extensible so item creation and item synchronisation can build on it later.
 */
export interface SouthConnectorExploreEntry {
  /**
   * Stable identifier of the entry, passed back to expand it.
   * OPC-UA node id (e.g. "ns=1;s=Temperature") or a folder-relative path.
   */
  id: string;

  /**
   * Human-readable label (OPC-UA display name or file/folder name).
   */
  name: string;

  /**
   * Additional data linked to the entry
   */
  metadata: Record<string, string | number>;

  /**
   * Optional per-field rendering hint for {@link metadata} — a `metadata` key listed here should be
   * displayed with the matching format (e.g. a localized date/time, a human-readable byte size) instead
   * of as plain text. A key with no entry here (the common case — units, counts, types, ...) just
   * renders as-is.
   */
  metadataKinds?: Partial<Record<string, SouthConnectorExploreFieldKind>>;

  /**
   * Whether the entry can be expanded to reveal children in the explore tree.
   */
  hasChildren: boolean;
}

/**
 * How a {@link SouthConnectorExploreEntry.metadata} field should be displayed — see
 * {@link SouthConnectorExploreEntry.metadataKinds}.
 */
export type SouthConnectorExploreFieldKind = 'instant' | 'size';

/**
 * Last value information for a South connector item.
 * Stores the last received value and metadata per item.
 */
export interface SouthItemLastValue {
  /**
   * The ID of the item.
   *
   * @example "item-123"
   */
  itemId: string;

  /**
   * The name of the item.
   *
   * @example "Temperature Sensor 1"
   */
  itemName: string;

  /**
   * The ID of the group.
   *
   * @example "group-123"
   */
  groupId: string | null;

  /**
   * The name of the group.
   *
   * @example "Temperature Group"
   */
  groupName: string;

  /**
   * The timestamp when the data was last queried (ISO 8601 format).
   *
   * @example "2024-02-02T12:00:00.000Z"
   */
  queryTime: Instant | null;

  /**
   * The cached value (JSON-serialized, structure depends on connector type).
   * For file-based connectors: array of {filename, modifiedTime}
   * For history connectors: {maxInstant}
   */
  value: unknown;

  /**
   * The tracked instant from group/item (ISO 8601 format).
   * Can be null for non-history connectors.
   *
   * @example "2024-02-02T12:00:00.000Z"
   */
  trackedInstant: Instant | null;
}

/**
 * Search parameters for South connector items.
 * Used for filtering and paginating item lists.
 */
export interface SouthConnectorItemSearchParam {
  /**
   * Name filter for items (partial match).
   * Undefined means no name filtering.
   *
   * @example "temperature"
   */
  name?: string;

  /**
   * Filter by scan mode ID.
   * Undefined means no filtering by scan mode.
   *
   * @example "periodic-5min"
   */
  scanModeId?: string;

  /**
   * Filter by enabled status.
   * Undefined means no filtering by enabled status.
   *
   * @example true
   */
  enabled?: boolean;

  /**
   * Page number for pagination (0-based index).
   *
   * @example 0
   */
  page: number;
}
