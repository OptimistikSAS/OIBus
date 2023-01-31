import { DatetimePipe } from './datetime.pipe';
import { DateTime } from 'luxon';
import { DEFAULT_TZ } from '../../../../shared/model/types';

describe('DatetimePipe', () => {
  let pipe: DatetimePipe;

  describe('in English', () => {
    beforeEach(() => {
      pipe = new DatetimePipe('en');
    });

    it('should format with default format', () => {
      const dateTime = DateTime.fromISO('2021-02-12T13:00:00.000', { zone: DEFAULT_TZ });
      expect(pipe.transform(dateTime)).toBe('12 Feb 2021');
      expect(pipe.transform(dateTime.toJSDate())).toBe('12 Feb 2021');
      expect(pipe.transform(dateTime.toMillis())).toBe('12 Feb 2021');
      expect(pipe.transform(dateTime.toUTC().toISO())).toBe('12 Feb 2021');
    });

    it('should format with custom format', () => {
      const dateTime = DateTime.fromISO('2021-01-12T13:35:00.000', { zone: DEFAULT_TZ });
      expect(pipe.transform(dateTime, 'ff')).toBe('12 Jan 2021, 13:35');
      expect(pipe.transform(dateTime.toJSDate(), 'ff')).toBe('12 Jan 2021, 13:35');
      expect(pipe.transform(dateTime.toMillis(), 'ff')).toBe('12 Jan 2021, 13:35');
      expect(pipe.transform(dateTime.toUTC().toISO(), 'ff')).toBe('12 Jan 2021, 13:35');

      expect(pipe.transform(dateTime, 'f')).toBe('12/01/2021, 13:35');
    });

    it('should format with friendly formats', () => {
      const dateTime = DateTime.fromISO('2021-01-12T13:35:07.000', { zone: DEFAULT_TZ });
      expect(pipe.transform(dateTime, 'short')).toBe('12/01/2021, 13:35');
      expect(pipe.transform(dateTime, 'shortWithSeconds')).toBe('12/01/2021, 13:35:07');
      expect(pipe.transform(dateTime, 'medium')).toBe('12 Jan 2021, 13:35');
      expect(pipe.transform(dateTime, 'mediumWithSeconds')).toBe('12 Jan 2021, 13:35:07');
      expect(pipe.transform(dateTime, 'shortDate')).toBe('12/01/2021');
      expect(pipe.transform(dateTime, 'mediumDate')).toBe('12 Jan 2021');
      expect(pipe.transform(dateTime, 'time')).toBe('13:35');
      expect(pipe.transform(dateTime, 'timeWithSeconds')).toBe('13:35:07');
    });

    it('should format with custom timezone', () => {
      const dateTime = DateTime.fromISO('2021-01-12T13:35:00.000', { zone: 'UTC' });
      expect(pipe.transform(dateTime, 'ff', 'UTC')).toBe('12 Jan 2021, 13:35');
      expect(pipe.transform(dateTime.toJSDate(), 'ff', 'UTC')).toBe('12 Jan 2021, 13:35');
      expect(pipe.transform(dateTime.toMillis(), 'ff', 'UTC')).toBe('12 Jan 2021, 13:35');
      expect(pipe.transform(dateTime.toUTC().toISO(), 'ff', 'UTC')).toBe('12 Jan 2021, 13:35');

      expect(pipe.transform(dateTime, 'f', 'UTC')).toBe('12/01/2021, 13:35');
    });
  });

  describe('in French', () => {
    beforeEach(() => {
      pipe = new DatetimePipe('fr');
    });

    it('should format with default format', () => {
      const dateTime = DateTime.fromISO('2021-02-12T13:00:00.000', { zone: DEFAULT_TZ });
      expect(pipe.transform(dateTime)).toBe('12 févr. 2021');
      expect(pipe.transform(dateTime.toJSDate())).toBe('12 févr. 2021');
      expect(pipe.transform(dateTime.toMillis())).toBe('12 févr. 2021');
      expect(pipe.transform(dateTime.toUTC().toISO())).toBe('12 févr. 2021');
    });

    it('should format with custom format', () => {
      const dateTime = DateTime.fromISO('2021-01-12T13:35:00.000', { zone: DEFAULT_TZ });
      expect(pipe.transform(dateTime, 'ff')).toBe('12 janv. 2021, 13:35');
      expect(pipe.transform(dateTime.toJSDate(), 'ff')).toBe('12 janv. 2021, 13:35');
      expect(pipe.transform(dateTime.toMillis(), 'ff')).toBe('12 janv. 2021, 13:35');
      expect(pipe.transform(dateTime.toUTC().toISO(), 'ff')).toBe('12 janv. 2021, 13:35');

      // the following format changed in Chrome v103, removing the comma
      expect(pipe.transform(dateTime, 'f')).toBe('12/01/2021 13:35');
    });
  });
});
