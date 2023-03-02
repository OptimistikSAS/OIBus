import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

import minimist from 'minimist';
import { DateTime } from 'luxon';

import { Instant, Interval, Timezone } from '../../shared/model/types';

const COMPRESSION_LEVEL = 9;

/**
 * Get config file from console arguments
 * @returns {Object} - the config file and check argument
 */
const getCommandLineArguments = () => {
  const args = minimist(process.argv.slice(2));
  const { config = './', check = false } = args;
  return { configFile: path.resolve(config), check };
};

/**
 * Method to return a delayed promise.
 */
const delay = async (timeout: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, timeout);
  });

/**
 * Compute a list of end interval from a start, end and maxInterval.
 */
const generateIntervals = (start: Instant, end: Instant, maxInterval: number): Array<Interval> => {
  const startTime = DateTime.fromISO(start);
  const endTime = DateTime.fromISO(end);
  const originalInterval = endTime.toMillis() - startTime.toMillis();
  if (maxInterval > 0 && endTime.toMillis() - startTime.toMillis() > 1000 * maxInterval) {
    const numberOfInterval = originalInterval / (maxInterval * 1000);
    const intervalLists: Array<Interval> = [];
    for (let i = 0; i < numberOfInterval; i += 1) {
      // Compute the newStartTime and the newEndTime for each interval
      const newStartTime = DateTime.fromMillis(startTime.toMillis() + i * 1000 * maxInterval);
      const newEndTime = DateTime.fromMillis(startTime.toMillis() + (i + 1) * 1000 * maxInterval);

      // If the newEndTime is bigger than the original end, the definitive end of the interval must be end
      intervalLists.push({
        start: newStartTime.toUTC().toISO(),
        end: newEndTime < endTime ? newEndTime.toUTC().toISO() : endTime.toUTC().toISO()
      });
    }
    return intervalLists;
  }
  return [{ start: startTime.toUTC().toISO(), end: endTime.toUTC().toISO() }];
};

/**
 * Create a folder if it does not exist
 */
const createFolder = async (folder: string): Promise<void> => {
  const folderPath = path.resolve(folder);
  try {
    await fs.stat(folderPath);
  } catch (error) {
    await fs.mkdir(folderPath, { recursive: true });
  }
};

/**
 * Replace the variables such as @CurrentDate in the file name with their values
 */
const replaceFilenameWithVariable = (filename: string, queryPart: number, connectorName: string): string =>
  filename
    .replace('@CurrentDate', DateTime.local().toFormat('yyyy_MM_dd_HH_mm_ss_SSS'))
    .replace('@ConnectorName', connectorName)
    .replace('@QueryPart', `${queryPart}`);

/**
 * Generate date based on the configured format taking into account the timezone configuration.
 * Ex: With timezone "Europe/Paris" the date "2019-01-01 00:00:00" will be converted to "Tue Jan 01 2019 00:00:00 GMT+0100"
 */
const generateDateWithTimezone = (date: string, timezone: Timezone, dateFormat: string): string => {
  if (DateTime.fromISO(date).isValid) {
    return date;
  }
  return DateTime.fromFormat(date, dateFormat, { zone: timezone }).toJSDate().toISOString();
};

/**
 * Compress the specified file
 */
const compress = async (input: string, output: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const readStream = createReadStream(input);
    const writeStream = createWriteStream(output);
    const gzip = zlib.createGzip({ level: COMPRESSION_LEVEL });
    readStream
      .pipe(gzip)
      .pipe(writeStream)
      .on('error', error => {
        reject(error);
      })
      .on('finish', () => {
        resolve();
      });
  });

/**
 * Check if a file exists in async way
 */
const filesExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.stat(filePath);
  } catch {
    return false;
  }
  return true;
};

const CHARACTER_SET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const RANDOM_LENGTH = 16;

export const generateRandomId = (size = RANDOM_LENGTH): string => {
  let randomId = '';
  for (let i = 0; i < size; i += 1) {
    randomId += CHARACTER_SET[Math.floor(Math.random() * CHARACTER_SET.length)];
  }
  return randomId;
};

export {
  getCommandLineArguments,
  delay,
  generateIntervals,
  createFolder,
  replaceFilenameWithVariable,
  generateDateWithTimezone,
  compress,
  filesExists
};
