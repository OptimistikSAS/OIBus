import csv from 'papaparse'
import { DateTime } from 'luxon'

/**
 * Format date taking into account the timezone configuration.
 * Since we don't know how the date is actually stored in the database, we read it as UTC time
 * and format it as it would be in the configured timezone.
 * Ex: With timezone "Europe/Paris" the date "2019-01-01 00:00:00" will be converted to "Tue Jan 01 2019 00:00:00 GMT+0100"
 * @param {Date} date - The date to format
 * @param {String} timezone - The timezone to use to replace the timezone of the date
 * @param {String} dateFormat - The format of the date to use for the return result
 * @returns {String} - The formatted date with timezone
 */
const formatDateWithTimezone = (date, timezone, dateFormat) => DateTime.fromJSDate(date, { zone: 'utc' }).toFormat(dateFormat)

/**
 * Generate CSV file from the values.
 * @param {Object[]} result - The query result
 * @param {String} timezone - The timezone of the database
 * @param {String} dateFormat - The date format for the date fields
 * @param {String} delimiter - The delimiter to use for the CSV
 * @returns {Promise<String>} - The CSV content
 */
const generateCSV = (result, timezone, dateFormat, delimiter) => {
  // loop through each value and format date to timezone if value is Date
  result.forEach((row) => {
    Object.keys(row).forEach((key) => {
      const value = row[key]
      if (value instanceof Date) {
        row[key] = formatDateWithTimezone(value, timezone, dateFormat)
      }
    })
  })
  const options = {
    header: true,
    delimiter,
  }
  return csv.unparse(result, options)
}

/**
 * Parse an entry list and get the most recent date
 * @param {Object[]} entryList - The SQL results
 * @param {Date} startTime - The reference date
 * @param {String} timeColumn - The time column to look for in the entry list
 * @param {String} timezone - The timezone of the database
 * @return {Date} - The most recent date
 */
const getMostRecentDate = (entryList, startTime, timeColumn, timezone) => {
  let newLastCompletedAt = startTime
  entryList.forEach((entry) => {
    if (entry[timeColumn]) {
      let entryDate
      if (entry[timeColumn] instanceof Date) {
        entryDate = entry[timeColumn]
      } else if (typeof entry[timeColumn] === 'number') {
        entryDate = DateTime.fromMillis(entry[timeColumn], { zone: timezone })
          .setZone('utc')
          .toJSDate()
      } else if (DateTime.fromISO(entry[timeColumn], { zone: timezone }).isValid) {
        entryDate = DateTime.fromISO(entry[timeColumn], { zone: timezone })
          .setZone('utc')
          .toJSDate()
      } else if (DateTime.fromSQL(entry[timeColumn], { zone: timezone }).isValid) {
        entryDate = DateTime.fromSQL(entry[timeColumn], { zone: timezone })
          .setZone('utc')
          .toJSDate()
      }
      if (entryDate > new Date(newLastCompletedAt)) {
        newLastCompletedAt = DateTime.fromMillis(entryDate.setMilliseconds(entryDate.getMilliseconds() + 1))
          .setZone('utc')
          .toJSDate()
      }
    }
  })
  return newLastCompletedAt
}

/**
 * Get all occurrences of a substring with a value
 * @param {String} str - The string to look for occurrences in
 * @param {String} keyword - The keyword
 * @param {Object} value - The value to assign to the occurrences index
 * @return {Object[]} - The result as { index, value}
 */
const getOccurrences = (str, keyword, value) => {
  const occurrences = []
  let occurrenceIndex = str.indexOf(keyword, 0)
  while (occurrenceIndex > -1) {
    occurrences.push({
      index: occurrenceIndex,
      value,
    })
    occurrenceIndex = str.indexOf(keyword, occurrenceIndex + 1)
  }
  return occurrences
}

/**
 * Generate replacements parameters
 * @param {String} query - The query
 * @param {Date} startTime - The StartTime
 * @param {Date} endTime - The EndTime
 * @return {Object[]} - The replacement parameters
 */
const generateReplacementParameters = (query, startTime, endTime) => {
  const startTimeOccurrences = getOccurrences(query, '@StartTime', startTime)
  const endTimeOccurrences = getOccurrences(query, '@EndTime', endTime)
  const occurrences = startTimeOccurrences.concat(endTimeOccurrences)
  occurrences.sort((a, b) => (a.index - b.index))
  return occurrences.map((occurrence) => occurrence.value)
}

export { generateCSV, getMostRecentDate, generateReplacementParameters }
