import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import {
  MAX_INTERVAL_MS,
  MIN_INTERVAL_MS,
  hasScheduleChanged,
  intervalToMs,
  isActivationWindowExpired,
  isWithinActivationWindow
} from './scan-mode.utils';
import { ScanMode } from '../model/scan-mode.model';
import { ActivationWindow } from '../../shared/model/scan-mode.model';

const baseScanMode: ScanMode = {
  id: 'id',
  name: 'scan mode',
  description: '',
  type: 'cron',
  cron: '* * * * * *',
  interval: null,
  activationWindow: null,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
};

const withWindow = (activationWindow: ActivationWindow | null): ScanMode => ({ ...baseScanMode, activationWindow });
const utc = (iso: string): DateTime => DateTime.fromISO(iso, { zone: 'utc' });

describe('scan-mode utils', () => {
  describe('intervalToMs', () => {
    it('should convert every unit', () => {
      assert.strictEqual(intervalToMs({ value: 250, unit: 'ms' }), 250);
      assert.strictEqual(intervalToMs({ value: 30, unit: 's' }), 30_000);
      assert.strictEqual(intervalToMs({ value: 5, unit: 'min' }), 300_000);
      assert.strictEqual(intervalToMs({ value: 2, unit: 'hour' }), 7_200_000);
    });

    it('should expose bounds matching the scheduler limits', () => {
      assert.strictEqual(MIN_INTERVAL_MS, 10);
      // Node wraps setInterval delays past this back to 1 ms.
      assert.strictEqual(MAX_INTERVAL_MS, 2_147_483_647);
    });
  });

  describe('isWithinActivationWindow', () => {
    const now = utc('2026-08-05T12:00:00.000Z'); // a Wednesday

    it('should always be active without a window', () => {
      assert.strictEqual(isWithinActivationWindow(baseScanMode, now), true);
    });

    it('should honour an open-ended date range on either side', () => {
      assert.strictEqual(isWithinActivationWindow(withWindow({ dateRange: { start: '2026-08-01T00:00:00.000Z' } }), now), true);
      assert.strictEqual(isWithinActivationWindow(withWindow({ dateRange: { end: '2026-08-31T00:00:00.000Z' } }), now), true);
      assert.strictEqual(isWithinActivationWindow(withWindow({ dateRange: { start: '2026-09-01T00:00:00.000Z' } }), now), false);
      assert.strictEqual(isWithinActivationWindow(withWindow({ dateRange: { end: '2026-08-01T00:00:00.000Z' } }), now), false);
    });

    it('should combine the date range and the recurring rule with AND', () => {
      const window: ActivationWindow = {
        dateRange: { start: '2026-08-01T00:00:00.000Z', end: '2026-08-31T00:00:00.000Z' },
        // Wednesday is 3
        recurring: { timezone: 'Europe/Paris', daysOfWeek: [3] }
      };
      assert.strictEqual(isWithinActivationWindow(withWindow(window), now), true);
      // Inside the recurring rule but outside the date range.
      assert.strictEqual(isWithinActivationWindow(withWindow(window), utc('2026-09-02T12:00:00.000Z')), false);
    });

    it('should treat an absent or empty day filter as every day', () => {
      assert.strictEqual(isWithinActivationWindow(withWindow({ recurring: { timezone: 'UTC' } }), now), true);
      assert.strictEqual(isWithinActivationWindow(withWindow({ recurring: { timezone: 'UTC', daysOfWeek: [] } }), now), true);
    });

    it('should filter on the day of week, with Sunday as 0', () => {
      const sundayOnly = withWindow({ recurring: { timezone: 'UTC', daysOfWeek: [0] } });
      assert.strictEqual(isWithinActivationWindow(sundayOnly, utc('2026-08-09T12:00:00.000Z')), true);
      assert.strictEqual(isWithinActivationWindow(sundayOnly, utc('2026-08-10T12:00:00.000Z')), false);
    });

    it('should apply a same-day time range with an inclusive start and an exclusive end', () => {
      const window = withWindow({ recurring: { timezone: 'UTC', timeOfDay: { start: '08:00', end: '18:00' } } });
      assert.strictEqual(isWithinActivationWindow(window, utc('2026-08-05T08:00:00.000Z')), true);
      assert.strictEqual(isWithinActivationWindow(window, utc('2026-08-05T17:59:00.000Z')), true);
      assert.strictEqual(isWithinActivationWindow(window, utc('2026-08-05T18:00:00.000Z')), false);
      assert.strictEqual(isWithinActivationWindow(window, utc('2026-08-05T07:59:00.000Z')), false);
    });

    it('should span midnight when the end time is before the start time', () => {
      const window = withWindow({ recurring: { timezone: 'UTC', timeOfDay: { start: '22:00', end: '02:00' } } });
      assert.strictEqual(isWithinActivationWindow(window, utc('2026-08-05T23:30:00.000Z')), true);
      assert.strictEqual(isWithinActivationWindow(window, utc('2026-08-06T01:30:00.000Z')), true);
      assert.strictEqual(isWithinActivationWindow(window, utc('2026-08-06T03:00:00.000Z')), false);
    });

    it('should anchor an overnight window to the day it opened', () => {
      // "Friday 22:00-02:00" stays active into Saturday even though Saturday is not selected.
      const fridayNight = withWindow({ recurring: { timezone: 'UTC', daysOfWeek: [5], timeOfDay: { start: '22:00', end: '02:00' } } });
      assert.strictEqual(isWithinActivationWindow(fridayNight, utc('2026-08-07T23:00:00.000Z')), true, 'Friday 23:00');
      assert.strictEqual(isWithinActivationWindow(fridayNight, utc('2026-08-08T01:00:00.000Z')), true, 'Saturday 01:00, opened Friday');
      // Saturday 23:00 would open a Saturday window, which is not selected.
      assert.strictEqual(isWithinActivationWindow(fridayNight, utc('2026-08-08T23:00:00.000Z')), false, 'Saturday 23:00');
      assert.strictEqual(isWithinActivationWindow(fridayNight, utc('2026-08-09T01:00:00.000Z')), false, 'Sunday 01:00, opened Saturday');
    });

    it('should re-derive local time across a DST transition', () => {
      // Europe/Paris is UTC+1 in winter and UTC+2 in summer; "09:00 local" is a different instant
      // on either side of the change, which is exactly why the rule stores a zone and not an offset.
      const window = withWindow({ recurring: { timezone: 'Europe/Paris', timeOfDay: { start: '09:00', end: '10:00' } } });
      // 2026-03-29 is the spring-forward date.
      assert.strictEqual(isWithinActivationWindow(window, utc('2026-03-28T08:30:00.000Z')), true, 'winter: 09:30 local');
      assert.strictEqual(isWithinActivationWindow(window, utc('2026-03-30T08:30:00.000Z')), false, 'summer: 10:30 local');
      assert.strictEqual(isWithinActivationWindow(window, utc('2026-03-30T07:30:00.000Z')), true, 'summer: 09:30 local');
    });

    it('should fail closed on an unknown timezone', () => {
      assert.strictEqual(isWithinActivationWindow(withWindow({ recurring: { timezone: 'Not/AZone' } }), now), false);
    });
  });

  describe('isActivationWindowExpired', () => {
    const now = utc('2026-08-05T12:00:00.000Z');

    it('should not flag an absent window', () => {
      assert.strictEqual(isActivationWindowExpired(null, now), false);
    });

    it('should flag a range whose end is past', () => {
      assert.strictEqual(isActivationWindowExpired({ dateRange: { end: '2026-08-01T00:00:00.000Z' } }, now), true);
    });

    it('should not flag a window that has simply not opened yet', () => {
      assert.strictEqual(isActivationWindowExpired({ dateRange: { start: '2026-09-01T00:00:00.000Z' } }, now), false);
    });

    it('should flag a range whose start is after its end', () => {
      const window = { dateRange: { start: '2026-09-10T00:00:00.000Z', end: '2026-09-01T00:00:00.000Z' } };
      assert.strictEqual(isActivationWindowExpired(window, now), true);
    });

    it('should flag a zero-length time of day', () => {
      const window = { recurring: { timezone: 'UTC', timeOfDay: { start: '08:00', end: '08:00' } } };
      assert.strictEqual(isActivationWindowExpired(window, now), true);
    });

    it('should not flag an overnight time of day', () => {
      const window = { recurring: { timezone: 'UTC', timeOfDay: { start: '22:00', end: '02:00' } } };
      assert.strictEqual(isActivationWindowExpired(window, now), false);
    });

    it('should not flag an empty day filter, which means every day', () => {
      assert.strictEqual(isActivationWindowExpired({ recurring: { timezone: 'UTC', daysOfWeek: [] } }, now), false);
    });

    it('should flag an unknown timezone, which can never be evaluated', () => {
      assert.strictEqual(isActivationWindowExpired({ recurring: { timezone: 'Not/AZone' } }, now), true);
    });
  });

  describe('hasScheduleChanged', () => {
    it('should ignore changes that do not affect scheduling', () => {
      assert.strictEqual(hasScheduleChanged(baseScanMode, { ...baseScanMode, name: 'renamed', description: 'new' }), false);
    });

    it('should detect a cron, type, interval or window change', () => {
      assert.strictEqual(hasScheduleChanged(baseScanMode, { ...baseScanMode, cron: '0 * * * * *' }), true);
      assert.strictEqual(hasScheduleChanged(baseScanMode, { ...baseScanMode, type: 'interval', interval: { value: 30, unit: 's' } }), true);
      assert.strictEqual(
        hasScheduleChanged(
          { ...baseScanMode, type: 'interval', interval: { value: 30, unit: 's' } },
          { ...baseScanMode, type: 'interval', interval: { value: 60, unit: 's' } }
        ),
        true
      );
      assert.strictEqual(hasScheduleChanged(baseScanMode, withWindow({ recurring: { timezone: 'UTC' } })), true);
    });
  });
});
