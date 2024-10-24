import { DatetimePipe } from './datetime.pipe';
import { DateTime } from 'luxon';
import { DEFAULT_TZ, Instant } from '../../../../backend/shared/model/types';
import { CurrentUserService } from './current-user.service';
import { createMock } from 'ngx-speculoos';
import { TestBed } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';

describe('DatetimePipe', () => {
  let currentUserService: jasmine.SpyObj<CurrentUserService>;
  let pipe: DatetimePipe;

  beforeEach(() => {
    currentUserService = createMock(CurrentUserService);
    currentUserService.getTimezone.and.returnValue(DEFAULT_TZ);
  });

  describe('in English', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          { provide: CurrentUserService, useValue: currentUserService },
          { provide: LOCALE_ID, useValue: 'en' }
        ]
      });
      pipe = TestBed.runInInjectionContext(() => new DatetimePipe());
    });

    it('should format with default format', () => {
      const dateTime = DateTime.fromISO('2021-02-12T13:00:00.000', { zone: DEFAULT_TZ });
      expect(pipe.transform(dateTime)).toBe('12 Feb 2021');
      expect(pipe.transform(dateTime.toJSDate())).toBe('12 Feb 2021');
      expect(pipe.transform(dateTime.toMillis())).toBe('12 Feb 2021');
      expect(pipe.transform(dateTime.toUTC().toISO() as Instant)).toBe('12 Feb 2021');
    });

    it('should format with custom format', () => {
      const dateTime = DateTime.fromISO('2021-01-12T13:35:00.000', { zone: DEFAULT_TZ });
      expect(pipe.transform(dateTime, 'ff')).toBe('12 Jan 2021, 13:35');
      expect(pipe.transform(dateTime.toJSDate(), 'ff')).toBe('12 Jan 2021, 13:35');
      expect(pipe.transform(dateTime.toMillis(), 'ff')).toBe('12 Jan 2021, 13:35');
      expect(pipe.transform(dateTime.toUTC().toISO() as Instant, 'ff')).toBe('12 Jan 2021, 13:35');

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
      expect(pipe.transform(dateTime.toUTC().toISO() as Instant, 'ff', 'UTC')).toBe('12 Jan 2021, 13:35');

      expect(pipe.transform(dateTime, 'f', 'UTC')).toBe('12/01/2021, 13:35');
    });
  });

  describe('in French', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          { provide: CurrentUserService, useValue: currentUserService },
          { provide: LOCALE_ID, useValue: 'fr' }
        ]
      });
      pipe = TestBed.runInInjectionContext(() => new DatetimePipe());
    });

    it('should format with default format', () => {
      const dateTime = DateTime.fromISO('2021-02-12T13:00:00.000', { zone: DEFAULT_TZ });
      expect(pipe.transform(dateTime)).toBe('12 févr. 2021');
      expect(pipe.transform(dateTime.toJSDate())).toBe('12 févr. 2021');
      expect(pipe.transform(dateTime.toMillis())).toBe('12 févr. 2021');
      expect(pipe.transform(dateTime.toUTC().toISO() as Instant)).toBe('12 févr. 2021');
    });

    it('should format with custom format', () => {
      const dateTime = DateTime.fromISO('2021-01-12T13:35:00.000', { zone: DEFAULT_TZ });
      expect(pipe.transform(dateTime, 'ff')).toBe('12 janv. 2021, 13:35');
      expect(pipe.transform(dateTime.toJSDate(), 'ff')).toBe('12 janv. 2021, 13:35');
      expect(pipe.transform(dateTime.toMillis(), 'ff')).toBe('12 janv. 2021, 13:35');
      expect(pipe.transform(dateTime.toUTC().toISO() as Instant, 'ff')).toBe('12 janv. 2021, 13:35');

      // the following format changed in Chrome v103, removing the comma
      expect(pipe.transform(dateTime, 'f')).toBe('12/01/2021 13:35');
    });
  });
});
