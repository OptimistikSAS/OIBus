import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

import minimist from 'minimist';
import { DateTime } from 'luxon';

import { Instant, Interval, Timezone } from '../../../shared/model/types';
import csv from 'papaparse';
import { OibusItemDTO } from '../../../shared/model/south-connector.model';
import pino from 'pino';

const COMPRESSION_LEVEL = 9;

/**
 * Get config file from console arguments
 * @returns {Object} - the config file and check argument
 */
export const getCommandLineArguments = () => {
  const args = minimist(process.argv.slice(2));
  const { config = './', check = false } = args;
  return { configFile: path.resolve(config), check };
};

/**
 * Method to return a delayed promise.
 */
export const delay = async (timeout: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, timeout);
  });

/**
 * Compute a list of end interval from a start, end and maxInterval.
 */
export const generateIntervals = (start: Instant, end: Instant, maxInterval: number): Array<Interval> => {
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
        start: newStartTime.toUTC().toISO() as Instant,
        end: newEndTime < endTime ? (newEndTime.toUTC().toISO() as Instant) : (endTime.toUTC().toISO() as Instant)
      });
    }
    return intervalLists;
  }
  return [{ start: startTime.toUTC().toISO() as Instant, end: endTime.toUTC().toISO() as Instant }];
};

/**
 * Create a folder if it does not exist
 */
export const createFolder = async (folder: string): Promise<void> => {
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
export const replaceFilenameWithVariable = (filename: string, queryPart: number, connectorName: string): string =>
  filename
    .replace('@CurrentDate', DateTime.local().toFormat('yyyy_MM_dd_HH_mm_ss_SSS'))
    .replace('@ConnectorName', connectorName)
    .replace('@QueryPart', `${queryPart}`);

/**
 * Compress the specified file
 */
export const compress = async (input: string, output: string): Promise<void> =>
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
export const filesExists = async (filePath: string): Promise<boolean> => {
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

export const dirSize = async (dir: string): Promise<number> => {
  const files = await fs.readdir(dir, { withFileTypes: true });

  const paths = files.map(async file => {
    const filePath = path.join(dir, file.name);

    if (file.isDirectory()) {
      return await dirSize(filePath);
    }

    if (file.isFile()) {
      try {
        const { size } = await fs.stat(filePath);
        return size;
      } catch {
        return 0;
      }
    }

    return 0;
  });

  return (await Promise.all(paths)).flat(Infinity).reduce((i, size) => i + size, 0);
};

/**
 * Generate CSV file from the values.
 */
export const generateCSV = (result: Array<any>, delimiter: string): string => {
  const options = {
    header: true,
    delimiter
  };
  return csv.unparse(result, options);
};

/**
 * Parse an entry list and get the most recent date
 */
export const getMostRecentDate = (entryList: Array<any>, startTime: Instant, timeColumn: string, timezone: Timezone): Instant => {
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
          .toISO() as Instant;
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
export const generateReplacementParameters = (query: string, startTime: Instant, endTime: Instant) => {
  const startTimeOccurrences = getOccurrences(query, '@StartTime', startTime);
  const endTimeOccurrences = getOccurrences(query, '@EndTime', endTime);
  const occurrences = startTimeOccurrences.concat(endTimeOccurrences);
  occurrences.sort((a, b) => a.index - b.index);
  return occurrences.map(occurrence => occurrence.value);
};

export const writeResults = async (
  data: Array<any>,
  settings: any,
  compression: boolean,
  connectorName: string,
  tmpFolder: string,
  addFileFn: (filePath: string) => Promise<void>,
  logger: pino.Logger
): Promise<void> => {
  const csvContent = generateCSV(data, settings.delimiter);
  const filename = replaceFilenameWithVariable(settings.filename, 0, connectorName);
  const filePath = path.join(tmpFolder, filename);
  logger.debug(`Writing CSV file at "${filePath}"`);
  await fs.writeFile(filePath, csvContent);

  if (compression) {
    // Compress and send the compressed file
    const gzipPath = `${filePath}.gz`;
    await compress(filePath, gzipPath);

    try {
      await fs.unlink(filePath);
      logger.info(`File "${filePath}" compressed and deleted`);
    } catch (unlinkError) {
      logger.error(`Error when deleting file "${filePath}" after compression. ${unlinkError}`);
    }

    logger.debug(`Sending compressed file "${gzipPath}" to Engine`);
    await addFileFn(gzipPath);
    try {
      await fs.unlink(gzipPath);
      logger.trace(`File "${gzipPath}" deleted`);
    } catch (unlinkError) {
      logger.error(`Error when deleting compressed file "${gzipPath}" after caching it. ${unlinkError}`);
    }
  } else {
    logger.debug(`Sending file "${filePath}" to Engine`);
    await addFileFn(filePath);
    try {
      await fs.unlink(filePath);
      logger.trace(`File ${filePath} deleted`);
    } catch (unlinkError) {
      logger.error(`Error when deleting file "${filePath}" after caching it. ${unlinkError}`);
    }
  }
};

/**
 * Log the executed query with replacements values for query variables
 */
export const logQuery = (query: string, startTime: Instant, endTime: Instant, logger: pino.Logger): void => {
  const startTimeLog = query.indexOf('@StartTime') !== -1 ? `@StartTime = ${startTime}` : '';
  const endTimeLog = query.indexOf('@EndTime') !== -1 ? `@EndTime = ${endTime}` : '';
  let log = `Sending "${query}"`;
  if (startTimeLog || endTimeLog) {
    log += ` with`;
  }
  if (startTimeLog) {
    log += ` ${startTimeLog}`;
  }
  if (endTimeLog) {
    log += ` ${endTimeLog}`;
  }
  logger.info(log);
};
