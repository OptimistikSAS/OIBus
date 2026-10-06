/**
 * List of possible statuses for a history query.
 * Represents the different states a history query can be in during its lifecycle.
 */
export const HISTORY_QUERY_STATUS = [
  'PENDING', // Query is created but not yet started
  'RUNNING', // Query is actively running
  'PAUSED', // Query execution is paused
  'FINISHED', // Query has completed successfully
  'ERRORED' // Query encountered an error and stopped
] as const;

/**
 * Type representing the possible statuses for a history query.
 *
 * @example 'RUNNING'
 */
export type HistoryQueryStatus = (typeof HISTORY_QUERY_STATUS)[number];

/**
 * Search parameters for history query items.
 * Used for filtering and paginating item lists.
 */
export interface HistoryQueryItemSearchParam {
  /**
   * Name filter for items (partial match).
   * Undefined means no name filtering.
   *
   * @example "temperature"
   */
  name?: string | undefined;

  /**
   * Filter by enabled status.
   * Undefined means no filtering by enabled status.
   *
   * @example true
   */
  enabled?: boolean | undefined;

  /**
   * Page number for pagination (0-based index).
   *
   * @example 0
   */
  page: number;
}
