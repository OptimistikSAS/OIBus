import { Inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';
import { DateTime } from 'luxon';
import { DEFAULT_TZ, Timezone } from '../../../../shared/model/types';

const FRIENDLY_FORMATS = {
  short: 'f',
  shortWithSeconds: 'F',
  medium: 'ff',
  mediumWithSeconds: 'FF',
  shortDate: 'D',
  mediumDate: 'DD',
  time: 't',
  timeWithSeconds: 'tt'
} as const;
type FriendlyFormat = keyof typeof FRIENDLY_FORMATS;

export function formatDateTime(
  value: string | Date | number | DateTime,
  locale: string,
  timezone: Timezone,
  format: FriendlyFormat | string = 'mediumDate'
): string | null {
  if (value == null || value === '' || value !== value) {
    return null;
  }

  let dateTime: DateTime;
  if (value instanceof Date) {
    dateTime = DateTime.fromJSDate(value);
  } else if (value instanceof DateTime) {
    dateTime = value as DateTime;
  } else if (typeof value === 'number') {
    dateTime = DateTime.fromMillis(value as number);
  } else {
    dateTime = DateTime.fromISO(value as string);
  }

  if (!dateTime.isValid) {
    throw new Error(`Invalid date time value: ${value}`);
  }

  dateTime = dateTime.setLocale(locale === 'en' ? 'en-GB' : locale).setZone(timezone);
  const actualFormat = FRIENDLY_FORMATS[format as FriendlyFormat] ?? format;
  return dateTime.toFormat(actualFormat);
}

/**
 * An alternative to the standard date pipe that uses the user timezone by default
 * or a provided timezone, and which uses Luxon under the hood, which itself uses Intl.
 * the format is typically one of the following friendly formats:
 * - short
 * - shortWithSeconds
 * - medium
 * - mediumWithSeconds
 * - shortDate
 * - mediumDate
 * - shortTime
 * - shortTimeWithSeconds
 * But in the rare cases where the format needs to be something else, see https://moment.github.io/luxon/#/formatting?id=table-of-tokens
 * for the list of supported free formats.
 * Pay a special attention to the "localized" formats, which allow choosing a format which fits the current locale.
 *
 * The default format used by this pipe is similar to the one used by default by the date pipe: 'DD' (localized medium date).
 * The values accepted by this pipe are also similar to the ones accepted by the date pipe: a Date object, an ISO string,
 * or a timestamp in milliseconds. But it also accepts instances of DateTime.
 */
@Pipe({
  name: 'datetime',
  standalone: true
})
export class DatetimePipe implements PipeTransform {
  constructor(@Inject(LOCALE_ID) private locale: string) {}

  transform(
    value: string | Date | number | DateTime,
    format: FriendlyFormat | string = 'mediumDate',
    timezone: Timezone = DEFAULT_TZ
  ): string | null {
    return formatDateTime(value, this.locale, timezone, format);
  }
}
