import { LogLevel, ScopeType } from '../domain/logs.model';

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
   * The unique identifier of the item the log is associated with (e.g., a south connector item ID).
   * Can be `null` if the log is not associated with a specific item.
   * @example "item123"
   */
  itemId: string | null;

  /**
   * The human-readable name of the item the log is associated with.
   * Can be `null` if the log is not associated with a specific item.
   * @example "Temperature sensor"
   */
  itemName: string | null;

  /**
   * The unique identifier of the group the log is associated with (e.g., a south connector item group ID).
   * Can be `null` if the log is not associated with a specific group.
   * @example "group123"
   */
  groupId: string | null;

  /**
   * The human-readable name of the group the log is associated with.
   * Can be `null` if the log is not associated with a specific group.
   * @example "Temperature sensors"
   */
  groupName: string | null;

  /**
   * The log message content, including details about the event or error.
   * @example "Connection failed to host: timeout after 5s"
   */
  message: string;
}
