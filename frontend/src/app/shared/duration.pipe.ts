import { Inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { formatNumber } from '@angular/common';

/**
 * Pipe which transforms a DurationInMillis (i.e. a number of milliseconds), supposed to be
 * an integer number of seconds, into a readable value. For example:
 * - 120 000 -> 2 minutes
 * - 3 600 000 -> 1 hour
 * - 5 400 000 -> 1 hour 30 minutes
 *
 * If the duration is not an integer number of seconds, then too bad: it's truncated to the second.
 */
@Pipe({
  name: 'duration',
  standalone: true
})
export class DurationPipe implements PipeTransform {
  constructor(
    private translateService: TranslateService,
    @Inject(LOCALE_ID) private locale: string
  ) {}

  transform(value: number, style: 'long' | 'short' = 'long', type?: undefined | 'hourMinute'): string {
    if (value == null) {
      return '';
    }

    const totalSeconds = Math.trunc(value / 1_000);
    const hours = Math.trunc(totalSeconds / 3_600);
    const minutes = Math.trunc((totalSeconds - 3_600 * hours) / 60);
    const seconds = totalSeconds - 3_600 * hours - 60 * minutes;

    const formattedHours = formatNumber(hours, this.locale);
    const formattedMinutes = formatNumber(minutes, this.locale);
    const formattedSeconds = formatNumber(seconds, this.locale);

    const hourKey = `duration-pipe.${style}.${hours <= 1 ? 'hour' : 'hours'}`;
    const hourPart = this.translateService.instant(hourKey, { hours: formattedHours });

    const minuteKey = `duration-pipe.${style}.${minutes <= 1 ? 'minute' : 'minutes'}`;
    const minutePart = this.translateService.instant(minuteKey, { minutes: formattedMinutes });

    const secondKey = `duration-pipe.${style}.${seconds <= 1 ? 'second' : 'seconds'}`;
    const secondPart = this.translateService.instant(secondKey, { seconds: formattedSeconds });

    if (type === 'hourMinute') {
      return this.translateService.instant('duration-pipe.hours-and-minutes', { hours: hourPart, minutes: minutePart });
    }

    if (hours === 0 && minutes === 0) {
      return secondPart;
    } else if (hours === 0 && seconds === 0) {
      return minutePart;
    } else if (hours === 0) {
      return this.translateService.instant('duration-pipe.minutes-and-seconds', {
        minutes: minutePart,
        seconds: secondPart
      });
    } else if (minutes === 0 && seconds === 0) {
      return hourPart;
    } else if (minutes === 0) {
      return this.translateService.instant('duration-pipe.hours-and-seconds', { hours: hourPart, seconds: secondPart });
    } else if (seconds === 0) {
      return this.translateService.instant('duration-pipe.hours-and-minutes', { hours: hourPart, minutes: minutePart });
    } else {
      return this.translateService.instant('duration-pipe.hours-and-minutes-and-seconds', {
        hours: hourPart,
        minutes: minutePart,
        seconds: secondPart
      });
    }
  }
}
