const fs = require('node:fs/promises')
const { createReadStream, createWriteStream } = require('node:fs')
const zlib = require('node:zlib')
const path = require('node:path')

const minimist = require('minimist')
const { DateTime } = require('luxon')

const COMPRESSION_LEVEL = 9

/**
 * Get config file from console arguments
 * @returns {Object} - the config file and check argument
 */
const getCommandLineArguments = () => {
  const args = minimist(process.argv.slice(2))
  const { config = './oibus.json', check = false } = args
  return { configFile: path.resolve(config), check }
}

/**
 * Method to return a delayed promise.
 * @param {Number} timeout - The delay
 * @return {Promise<any>} - The delay promise
 */
const delay = async (timeout) => new Promise((resolve) => {
  setTimeout(resolve, timeout)
})

/**
 * Compute a list of end interval from a startTime, endTime and maxInterval.
 * @param {Date} startTime - The start of the interval
 * @param {Date} endTime - The end of the interval
 * @param {Number} maxInterval - The interval in s to split the [startTime - endTime] interval into
 * @returns {[{Date, Date}]} - The list of intervals
 */
const generateIntervals = (startTime, endTime, maxInterval) => {
  const originalInterval = endTime.getTime() - startTime.getTime()
  if (maxInterval > 0 && (endTime.getTime() - startTime.getTime()) > 1000 * maxInterval) {
    const numberOfInterval = originalInterval / (maxInterval * 1000)
    const intervalLists = []
    for (let i = 0; i < numberOfInterval; i += 1) {
      // Compute the newStartTime and the newEndTime for each interval
      const newStartTime = new Date(startTime.getTime() + i * 1000 * maxInterval)
      const newEndTime = new Date(startTime.getTime() + (i + 1) * 1000 * maxInterval)

      // If the newEndTime is bigger than the original endTime, the definitive end of the interval must be endTime
      intervalLists.push({
        startTime: newStartTime,
        endTime: newEndTime < endTime ? newEndTime : endTime,
      })
    }
    return intervalLists
  }
  return [{ startTime, endTime }]
}

/**
 * Create a folder if it does not exist
 * @param {String} folder - The folder to create
 * @return {Promise<void>} - The result promise
 */
const createFolder = async (folder) => {
  const folderPath = path.resolve(folder)
  try {
    await fs.stat(folderPath)
  } catch (error) {
    await fs.mkdir(folderPath, { recursive: true })
  }
}

/**
 * Replace the variables such as @CurrentDate in the file name with their values
 * @param {String} filename - The filename to change
 * @param {Number} queryPart - The part of the query being executed
 * @param {String} connectorName - The name of the connector
 * @return {String} - The renamed file name
 */
const replaceFilenameWithVariable = (filename, queryPart, connectorName) => filename.replace('@CurrentDate', DateTime.local()
  .toFormat('yyyy_MM_dd_HH_mm_ss_SSS'))
  .replace('@ConnectorName', connectorName)
  .replace('@QueryPart', `${queryPart}`)

/**
 * Generate date based on the configured format taking into account the timezone configuration.
 * Ex: With timezone "Europe/Paris" the date "2019-01-01 00:00:00" will be converted to "Tue Jan 01 2019 00:00:00 GMT+0100"
 * @param {String} date - The date to parse and format
 * @param {String} timezone - The timezone to use to replace the timezone of the date
 * @param {String} dateFormat - The format of the date
 * @returns {String} - The formatted date with timezone
 */
const generateDateWithTimezone = (date, timezone, dateFormat) => {
  if (DateTime.fromISO(date).isValid) {
    return date
  }
  return DateTime.fromFormat(date, dateFormat, { zone: timezone }).toJSDate().toISOString()
}

/**
 * Compress the specified file
 * @param {String} input - The path of the file to compress
 * @param {String} output - The path to the compressed file
 * @returns {Promise<void>} - The result promise
 */
const compress = async (input, output) => new Promise((resolve, reject) => {
  const readStream = createReadStream(input)
  const writeStream = createWriteStream(output)
  const gzip = zlib.createGzip({ level: COMPRESSION_LEVEL })
  readStream
    .pipe(gzip)
    .pipe(writeStream)
    .on('error', (error) => {
      reject(error)
    })
    .on('finish', () => {
      resolve()
    })
})

/**
 * Check if a file exists in async way
 * @param {String} filePath - The file path to test
 * @returns {Promise<boolean>} - If the file exists or not
 */
const filesExists = async (filePath) => {
  try {
    await fs.stat(filePath)
  } catch {
    return false
  }
  return true
}

module.exports = {
  getCommandLineArguments,
  delay,
  generateIntervals,
  createFolder,
  replaceFilenameWithVariable,
  generateDateWithTimezone,
  compress,
  filesExists,
}
