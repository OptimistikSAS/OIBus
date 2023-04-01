import csv from 'papaparse';
import { DateTime } from 'luxon';
import { Instant, Timezone } from '../../../../shared/model/types';

/**
 * Format date taking into account the timezone configuration.
 * Since we don't know how the date is actually stored in the database, we read it as UTC time
 * and format it as it would be in the configured timezone.
 * Ex: With timezone "Europe/Paris" the date "2019-01-01 00:00:00" will be converted to "Tue Jan 01 2019 00:00:00 GMT+0100"
 */
const formatDateWithTimezone = (date: Date, timezone: Timezone, dateFormat: string) =>
  DateTime.fromJSDate(date, { zone: 'utc' }).toFormat(dateFormat);

/**
 * Generate CSV file from the values.
 */
const generateCSV = (result: Array<any>, timezone: Timezone, dateFormat: string, delimiter: string): string => {
  // loop through each value and format date to timezone if value is Date
  result.forEach(row => {
    Object.keys(row).forEach(key => {
      const value = row[key];
      if (value instanceof Date) {
        row[key] = formatDateWithTimezone(value, timezone, dateFormat);
      }
    });
  });
  const options = {
    header: true,
    delimiter
  };
  return csv.unparse(result, options);
};

/**
 * Parse an entry list and get the most recent date
 */
const getMostRecentDate = (entryList: Array<any>, startTime: Instant, timeColumn: string, timezone: Timezone): Instant => {
  let newLastCompletedAt = startTime;
  entryList.forEach(entry => {
    if (entry[timeColumn]) {
      let entryDate;
      if (entry[timeColumn] instanceof Date) {
        entryDate = entry[timeColumn];
      } else if (typeof entry[timeColumn] === 'number') {
        entryDate = DateTime.fromMillis(entry[timeColumn], { zone: timezone }).setZone('utc').toJSDate();
      } else if (DateTime.fromISO(entry[timeColumn], { zone: timezone }).isValid) {
        entryDate = DateTime.fromISO(entry[timeColumn], { zone: timezone }).setZone('utc').toJSDate();
      } else if (DateTime.fromSQL(entry[timeColumn], { zone: timezone }).isValid) {
        entryDate = DateTime.fromSQL(entry[timeColumn], { zone: timezone }).setZone('utc').toJSDate();
      }
      if (entryDate > new Date(newLastCompletedAt)) {
        newLastCompletedAt = DateTime.fromMillis(entryDate.setMilliseconds(entryDate.getMilliseconds() + 1))
          .toUTC()
          .toISO();
      }
    }
  });
  return newLastCompletedAt;
};

/**
 * Get all occurrences of a substring with a value
 */
const getOccurrences = (str: string, keyword: string, value: any): Array<{ index: number; value: any }> => {
  const occurrences = [];
  let occurrenceIndex = str.indexOf(keyword, 0);
  while (occurrenceIndex > -1) {
    occurrences.push({
      index: occurrenceIndex,
      value
    });
    occurrenceIndex = str.indexOf(keyword, occurrenceIndex + 1);
  }
  return occurrences;
};

/**
 * Generate replacements parameters
 */
const generateReplacementParameters = (query: string, startTime: Instant, endTime: Instant) => {
  const startTimeOccurrences = getOccurrences(query, '@StartTime', startTime);
  const endTimeOccurrences = getOccurrences(query, '@EndTime', endTime);
  const occurrences = startTimeOccurrences.concat(endTimeOccurrences);
  occurrences.sort((a, b) => a.index - b.index);
  return occurrences.map(occurrence => occurrence.value);
};

export { generateCSV, getMostRecentDate, generateReplacementParameters };
