import { Instant } from './types';

/**
 * List of possible scope types.
 */
export const SCOPE_TYPES = ['south', 'north', 'history-query', 'internal', 'web-server'] as const;
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
 * Data Transfer Object for a log entry.
 * Represents a log with its metadata, severity level, scope, and message content.
 */
export interface LogDTO {
  /**
   * The timestamp of the log entry in ISO 8601 format.
   * @example "2023-10-31T12:34:56.789Z"
   */
  timestamp: string;

  /**
   * The severity level of the log entry.
   * @example "error"
   */
  level: LogLevel;

  /**
   * The type of scope the log is associated with (e.g., 'south', 'north').
   * @example "south"
   */
  scopeType: ScopeType;

  /**
   * The unique identifier of the scope (e.g., connector ID).
   * Can be `null` if the log is not associated with a specific scope.
   * @example "connector123"
   */
  scopeId: string | null;

  /**
   * The human-readable name of the scope.
   * Can be `null` if the log is not associated with a specific scope.
   * @example "South Connector 1"
   */
  scopeName: string | null;

  /**
   * The log message content, including details about the event or error.
   * @example "Connection failed to host: timeout after 5s"
   */
  message: string;
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
   * A substring to search for within log messages.
   * Can be `undefined` to ignore message content filtering.
   * @example "Connection failed"
   */
  messageContent: string | undefined;
}
