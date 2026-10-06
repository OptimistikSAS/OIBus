import { Instant, LocalTime, Timezone } from '../common/types';

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
