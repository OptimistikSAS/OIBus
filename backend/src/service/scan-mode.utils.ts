import { DateTime } from 'luxon';
import { ActivationWindow, IntervalUnit, ScanModeInterval } from '../../shared/model/scan-mode.model';
import { ScanMode } from '../model/scan-mode.model';

/**
 * Smallest accepted interval, in milliseconds. Below this the scheduler would spin without doing
 * useful work, and Node clamps setInterval delays under 1 ms to 1 ms anyway.
 */
export const MIN_INTERVAL_MS = 10;

/**
 * Largest accepted interval, in milliseconds. Node wraps setInterval delays above 2^31-1 back to
 * 1 ms, so an unguarded 30-day interval would turn into a hot loop.
 */
export const MAX_INTERVAL_MS = 2_147_483_647;

const MS_PER_UNIT: Record<IntervalUnit, number> = {
  ms: 1,
  s: 1_000,
  min: 60_000,
  hour: 3_600_000
};

const TIME_OF_DAY_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Resolve an interval to milliseconds.
 */
export const intervalToMs = (interval: ScanModeInterval): number => interval.value * MS_PER_UNIT[interval.unit];

/**
 * Whether an activation window can never let a tick through again, so that the UI can surface a
 * non-blocking warning on the scan mode and on every item using it.
 *
 * Note that a `dateRange.start` in the future is NOT expired — the window simply has not opened
 * yet — and that an empty `daysOfWeek` means "every day" rather than "no day".
 */
export const isActivationWindowExpired = (activationWindow: ActivationWindow | null, nowUtc: DateTime): boolean => {
  if (!activationWindow) {
    return false;
  }

  const { dateRange, recurring } = activationWindow;

  if (dateRange?.end) {
    const end = DateTime.fromISO(dateRange.end, { zone: 'utc' });
    if (!end.isValid || end < nowUtc) {
      return true;
    }
  }
  // A range whose start is after its end can never contain any instant.
  if (dateRange?.start && dateRange?.end && dateRange.start > dateRange.end) {
    return true;
  }

  if (recurring) {
    if (!DateTime.now().setZone(recurring.timezone).isValid) {
      return true;
    }
    const timeOfDay = recurring.timeOfDay;
    if (timeOfDay) {
      if (!TIME_OF_DAY_REGEX.test(timeOfDay.start) || !TIME_OF_DAY_REGEX.test(timeOfDay.end)) {
        return true;
      }
      // The bound check is `start <= now < end`, so a zero-width window never matches.
      if (timeOfDay.start === timeOfDay.end) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Whether a tick occurring at `nowUtc` is allowed through by the scan mode's activation window.
 *
 * A scan mode with no window is always active. The date range is compared as absolute instants; the
 * recurring rule is civil time, re-derived in `recurring.timezone` at every call so it follows DST.
 * `timeOfDay.start` is inclusive and `timeOfDay.end` exclusive.
 *
 * For an overnight window (`end` earlier than `start`) the day-of-week filter applies to the day the
 * window *opened*: "Friday 22:00-02:00" stays active until Saturday 02:00 even though Saturday is
 * not itself selected.
 */
export const isWithinActivationWindow = (scanMode: ScanMode, nowUtc: DateTime): boolean => {
  const activationWindow = scanMode.activationWindow;
  if (!activationWindow) {
    return true;
  }

  const { dateRange, recurring } = activationWindow;

  if (dateRange?.start && nowUtc < DateTime.fromISO(dateRange.start, { zone: 'utc' })) {
    return false;
  }
  if (dateRange?.end && nowUtc > DateTime.fromISO(dateRange.end, { zone: 'utc' })) {
    return false;
  }

  if (!recurring) {
    return true;
  }

  const local = nowUtc.setZone(recurring.timezone);
  if (!local.isValid) {
    // Unknown IANA zone: fail closed rather than firing at an unintended time.
    return false;
  }

  const { daysOfWeek, timeOfDay } = recurring;
  // Luxon numbers weekdays 1 (Monday) to 7 (Sunday); the stored filter uses 0 (Sunday) to 6.
  const dayAllowed = (dateTime: DateTime): boolean => !daysOfWeek?.length || daysOfWeek.includes(dateTime.weekday % 7);

  if (!timeOfDay) {
    return dayAllowed(local);
  }

  const currentTime = local.toFormat('HH:mm');

  if (timeOfDay.end < timeOfDay.start) {
    // Overnight window: either we are past today's opening, or still before yesterday's closing.
    const startedToday = dayAllowed(local) && currentTime >= timeOfDay.start;
    const startedYesterday = dayAllowed(local.minus({ days: 1 })) && currentTime < timeOfDay.end;
    return startedToday || startedYesterday;
  }

  return dayAllowed(local) && currentTime >= timeOfDay.start && currentTime < timeOfDay.end;
};

/**
 * Whether two versions of a scan mode differ in a way that requires the engine to rebuild its
 * scheduler entry. The activation window counts: the engine evaluates it against the scan mode
 * captured in the scheduler callback's closure, so a window edit without a reschedule would keep
 * gating on the previous window.
 */
export const hasScheduleChanged = (previous: ScanMode, next: ScanMode): boolean =>
  previous.type !== next.type ||
  previous.cron !== next.cron ||
  JSON.stringify(previous.interval) !== JSON.stringify(next.interval) ||
  JSON.stringify(previous.activationWindow) !== JSON.stringify(next.activationWindow);
