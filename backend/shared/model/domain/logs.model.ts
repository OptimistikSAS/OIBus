import { Instant } from '../common/types';

/**
 * List of possible scope types.
 */
export const SCOPE_TYPES = ['south', 'north', 'history-query', 'internal'] as const;
/**
 * Type representing a scope type.
 * @example 'south'
 */
export type ScopeType = (typeof SCOPE_TYPES)[number];

/**
 * List of possible log levels.
 */
export const LOG_LEVELS = ['silent', 'error', 'warn', 'info', 'debug', 'trace'] as const;
/**
 * Type representing a log level.
 * @example 'info'
 */
export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * Represents an item associated with log entries.
 * An item is a data point or query within a south connector.
 */
export interface Item {
  /**
   * The unique identifier of the item (e.g., south connector item ID).
   * @example "item123"
   */
  itemId: string;

  /**
   * The human-readable name of the item.
   * @example "Temperature sensor"
   */
  itemName: string;

  /**
   * The unique identifier of the scope owning this item (e.g., connector ID).
   * @example "connector123"
   */
  scopeId: string;

  /**
   * The human-readable name of the scope owning this item (e.g., connector or history query name).
   * @example "South Connector 1"
   */
  scopeName: string;
}

/**
 * Represents a group associated with log entries.
 * A group is a set of south connector items queried together.
 */
export interface Group {
  /**
   * The unique identifier of the group (e.g., south connector item group ID).
   * @example "group123"
   */
  groupId: string;

  /**
   * The human-readable name of the group.
   * @example "Temperature sensors"
   */
  groupName: string;

  /**
   * The unique identifier of the scope owning this group (e.g., connector ID).
   * @example "connector123"
   */
  scopeId: string;

  /**
   * The human-readable name of the scope owning this group (e.g., connector or history query name).
   * @example "South Connector 1"
   */
  scopeName: string;
}

/**
 * Represents a scope associated with log entries.
 * A scope can be a connector, service, or module.
 */
export interface Scope {
  /**
   * The unique identifier of the scope (e.g., connector ID, service ID).
   * @example "connector123"
   */
  scopeId: string;

  /**
   * The human-readable name of the scope.
   * @example "South Connector 1"
   */
  scopeName: string;
}

/**
 * Parameters for searching or filtering log entries.
 * Used to query logs based on criteria such as time range, log level, or scope.
 */
export interface LogSearchParam {
  /**
   * The page number for paginated results.
   * @example 1
   */
  page: number;

  /**
   * The start timestamp for the log search in ISO 8601 format.
   * Can be `undefined` to ignore the start time filter.
   * @example "2023-10-31T00:00:00Z"
   */
  start: Instant | undefined;

  /**
   * The end timestamp for the log search in ISO 8601 format.
   * Can be `undefined` to ignore the end time filter.
   * @example "2023-10-31T23:59:59Z"
   */
  end: Instant | undefined;

  /**
   * An array of log levels to filter by.
   * @example ["error", "warn"]
   */
  levels: Array<LogLevel>;

  /**
   * An array of scope IDs to filter logs by specific components.
   * @example ["connector123", "connector456"]
   */
  scopeIds: Array<string>;

  /**
   * An array of scope types to filter logs (e.g., 'south', 'north').
   * @example ["south", "north"]
   */
  scopeTypes: Array<ScopeType>;

  /**
   * An array of item IDs to filter logs by specific items.
   * @example ["item123", "item456"]
   */
  itemIds: Array<string>;

  /**
   * An array of group IDs to filter logs by specific item groups.
   * @example ["group123", "group456"]
   */
  groupIds: Array<string>;

  /**
   * A substring to search for within log messages.
   * Can be `undefined` to ignore message content filtering.
   * @example "Connection failed"
   */
  messageContent: string | undefined;
}
