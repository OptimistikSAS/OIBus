import { BaseEntity, Instant, LocalTime, Timezone } from './types';

export const SCAN_MODE_TYPES = ['cron', 'interval'] as const;
/**
 * How a scan mode decides when to tick.
 * - `cron`: driven by a cron expression (the historical behaviour).
 * - `interval`: driven by a fixed period between ticks.
 */
export type ScanModeType = (typeof SCAN_MODE_TYPES)[number];

export const INTERVAL_UNITS = ['ms', 's', 'min', 'hour'] as const;
export type IntervalUnit = (typeof INTERVAL_UNITS)[number];

/**
 * Fixed period between two ticks of an `interval` scan mode.
 */
export interface ScanModeInterval {
  /**
   * How many `unit`s between two ticks.
   * @example 30
   */
  value: number;

  /**
   * The unit `value` is expressed in.
   * @example "s"
   */
  unit: IntervalUnit;
}

/**
 * Absolute bounds of an activation window. Each side is independently optional: an absent bound
 * means the window is open-ended on that side.
 */
export interface ActivationWindowDateRange {
  /**
   * Inclusive start instant, ISO UTC.
   * @example "2026-08-01T00:00:00.000Z"
   */
  start?: Instant | null;

  /**
   * Inclusive end instant, ISO UTC.
   * @example "2026-08-31T00:00:00.000Z"
   */
  end?: Instant | null;
}

/**
 * Local time-of-day bounds. `start` is inclusive, `end` is exclusive. When `end` is earlier than
 * `start` the window is overnight and spans into the following day.
 */
export interface ActivationWindowTimeOfDay {
  /**
   * @example "22:00"
   */
  start: LocalTime;

  /**
   * @example "02:00"
   */
  end: LocalTime;
}

/**
 * A civil-time recurrence rule. Unlike the date range, this is not a pair of instants: "Thursday
 * 12:00" shifts by an hour across DST transitions, so the rule carries the IANA timezone it is
 * expressed in and is re-derived at every evaluation.
 */
export interface ActivationWindowRecurring {
  /**
   * IANA timezone the day and time filters are expressed in, captured from the user's account
   * setting when the scan mode was saved.
   * @example "Europe/Paris"
   */
  timezone: Timezone;

  /**
   * Days on which the window is active, 0 = Sunday … 6 = Saturday.
   * Absent or empty means every day.
   * @example [6, 0]
   */
  daysOfWeek?: Array<number> | null;

  /**
   * Time-of-day bounds. Absent means all day.
   */
  timeOfDay?: ActivationWindowTimeOfDay | null;
}

/**
 * Optional gate applied on top of the schedule. A tick only fires when it satisfies every
 * configured criterion; the two criteria below are combined with AND. A tick falling outside the
 * window is skipped silently — it is never queued or deferred.
 */
export interface ActivationWindow {
  /**
   * Absolute bounds. Absent means unbounded on both sides.
   */
  dateRange?: ActivationWindowDateRange | null;

  /**
   * Recurring day-of-week and time-of-day rule. Absent means no recurrence restriction.
   */
  recurring?: ActivationWindowRecurring | null;
}

/**
 * Data Transfer Object for a scan mode.
 * Represents a configured scan mode with its metadata and schedule.
 */
export interface ScanModeDTO extends BaseEntity {
  /**
   * The name of the scan mode.
   * @example "Daily Backup Scan"
   */
  name: string;

  /**
   * A description of the scan mode's purpose or behavior.
   * @example "Scans for new backup data every day at midnight"
   */
  description: string;

  /**
   * Which scheduling mechanism drives this scan mode.
   * @example "cron"
   */
  type: ScanModeType;

  /**
   * A cron expression defining the scan schedule. Empty when `type` is `"interval"`.
   * @example "0 0 * * *"
   */
  cron: string;

  /**
   * The fixed period between two ticks. `null` when `type` is `"cron"`.
   */
  interval: ScanModeInterval | null;

  /**
   * Optional activation window gating every tick. `null` means always active.
   */
  activationWindow: ActivationWindow | null;

  /**
   * Whether the activation window can never trigger again (for instance its end date is already
   * past). Computed server-side; drives a non-blocking warning in the UI.
   * @example false
   */
  activationWindowExpired: boolean;
}

/**
 * Command DTO for creating or updating a scan mode.
 * Used as the request body for scan mode creation/update endpoints.
 */
export interface ScanModeCommandDTO {
  /**
   * The name of the scan mode.
   * @example "Daily Backup Scan"
   */
  name: string;

  /**
   * A description of the scan mode's purpose or behavior.
   * @example "Scans for new backup data every day at midnight"
   */
  description: string;

  /**
   * Which scheduling mechanism drives this scan mode.
   * @example "cron"
   */
  type: ScanModeType;

  /**
   * A cron expression defining the scan schedule. Ignored when `type` is `"interval"`.
   * @example "0 0 * * *"
   */
  cron: string;

  /**
   * The fixed period between two ticks. Required when `type` is `"interval"`.
   */
  interval: ScanModeInterval | null;

  /**
   * Optional activation window gating every tick. `null` means always active.
   */
  activationWindow: ActivationWindow | null;
}

/**
 * Result of validating a cron expression.
 * Includes validation status, error messages, and execution details.
 */
export interface ValidatedCronExpression {
  /**
   * Whether the cron expression is valid.
   * @example true
   */
  isValid: boolean;

  /**
   * Error message if the cron expression is invalid.
   * Empty string if the expression is valid.
   * @example ""
   */
  errorMessage: string;

  /**
   * The next 3 execution times for the cron expression.
   * Empty array if the expression is invalid.
   * @example ["2024-01-01T00:00:00.000Z", "2024-01-02T00:00:00.000Z", "2024-01-03T00:00:00.000Z"]
   */
  nextExecutions: Array<Instant>;

  /**
   * A human-readable description of the cron expression.
   * @example "At 00:00 every day"
   */
  humanReadableForm: string;
}
