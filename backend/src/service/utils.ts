import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

import minimist from 'minimist';
import { DateTime } from 'luxon';

import { CsvCharacter, DateTimeType, Instant, Interval, SerializationSettings, Timezone } from '../../../shared/model/types';
import pino from 'pino';
import csv from 'papaparse';
import https from 'node:https';
import http from 'node:http';
import { OIBusInfo } from '../../../shared/model/engine.model';
import os from 'node:os';
import { version } from '../../package.json';

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
export const generateReplacementParameters = (
  query: string,
  startTime: string | number | DateTime,
  endTime: string | number | DateTime
) => {
  const startTimeOccurrences = getOccurrences(query, '@StartTime', startTime);
  const endTimeOccurrences = getOccurrences(query, '@EndTime', endTime);
  const occurrences = startTimeOccurrences.concat(endTimeOccurrences);
  occurrences.sort((a, b) => a.index - b.index);
  return occurrences.map(occurrence => occurrence.value);
};

export const convertDelimiter = (delimiter: CsvCharacter): string => {
  switch (delimiter) {
    case 'NON_BREAKING_SPACE':
      return ' ';
    case 'COLON':
      return ':';
    case 'COMMA':
      return ',';
    case 'DOT':
      return '.';
    case 'SLASH':
      return '/';
    case 'PIPE':
      return '|';
    case 'SEMI_COLON':
      return ';';
    case 'TAB':
      return ' ';
  }
};

export const persistResults = async (
  data: Array<any>,
  serializationSettings: SerializationSettings,
  connectorName: string,
  baseFolder: string,
  addFileFn: (filePath: string) => Promise<void>,
  addValueFn: (values: Array<any>) => Promise<void>,
  logger: pino.Logger
): Promise<void> => {
  switch (serializationSettings.type) {
    case 'json':
      await addValueFn(data);
      break;
    case 'file':
      const filePath = path.join(
        baseFolder,
        serializationSettings.filename
          .replace('@CurrentDate', DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS'))
          .replace('@ConnectorName', connectorName)
      );
      logger.debug(`Writing ${data.length} bytes into file at "${filePath}"`);
      await fs.writeFile(filePath, data);

      if (serializationSettings.compression) {
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
      break;
    case 'csv':
      const options = {
        header: true,
        delimiter: convertDelimiter(serializationSettings.delimiter)
      };
      const csvPath = path.join(
        baseFolder,
        serializationSettings.filename
          .replace('@CurrentDate', DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS'))
          .replace('@ConnectorName', connectorName)
      );
      const csvContent = csv.unparse(data, options);

      logger.debug(`Writing ${csvContent.length} bytes into CSV file at "${csvPath}"`);
      await fs.writeFile(csvPath, csvContent);

      if (serializationSettings.compression) {
        // Compress and send the compressed file
        const gzipPath = `${csvPath}.gz`;
        await compress(csvPath, gzipPath);

        try {
          await fs.unlink(csvPath);
          logger.info(`CSV file "${csvPath}" compressed and deleted`);
        } catch (unlinkError) {
          logger.error(`Error when deleting CSV file "${csvPath}" after compression. ${unlinkError}`);
        }

        logger.debug(`Sending compressed CSV file "${gzipPath}" to Engine`);
        await addFileFn(gzipPath);
        try {
          await fs.unlink(gzipPath);
          logger.trace(`CSV file "${gzipPath}" deleted`);
        } catch (unlinkError) {
          logger.error(`Error when deleting compressed CSV file "${gzipPath}" after caching it. ${unlinkError}`);
        }
      } else {
        logger.debug(`Sending CSV file "${csvPath}" to Engine`);
        await addFileFn(csvPath);
        try {
          await fs.unlink(csvPath);
          logger.trace(`CSV file ${csvPath} deleted`);
        } catch (unlinkError) {
          logger.error(`Error when deleting CSV file "${csvPath}" after caching it. ${unlinkError}`);
        }
      }
      break;
  }
};

/**
 * Log the executed query with replacements values for query variables
 */
export const logQuery = (query: string, startTime: string | number, endTime: string | number, logger: pino.Logger): void => {
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

export const formatInstant = (
  instant: Instant,
  options: { type: DateTimeType; timezone?: Timezone; format?: string; locale?: string }
): string | number => {
  switch (options.type) {
    case 'unix-epoch':
      return Math.floor(DateTime.fromISO(instant).toMillis() / 1000);
    case 'unix-epoch-ms':
      return DateTime.fromISO(instant).toMillis();
    case 'string':
      return DateTime.fromISO(instant, { zone: options.timezone }).toFormat(options.format!, {
        locale: options.locale
      });
    case 'iso-string':
      return instant;
    case 'Date':
      return DateTime.fromISO(instant, { zone: options.timezone }).toFormat('yyyy-MM-dd');
    case 'SmallDateTime':
      return DateTime.fromISO(instant, { zone: options.timezone }).toFormat('yyyy-MM-dd HH:mm:ss');
    case 'DateTime':
    case 'DateTime2':
    case 'timestamp':
      return DateTime.fromISO(instant, { zone: options.timezone }).toFormat('yyyy-MM-dd HH:mm:ss.SSS');
    case 'DateTimeOffset':
    case 'timestamptz':
    default:
      return instant;
  }
};

export const convertDateTimeToInstant = (
  dateTime: any,
  options: { type: DateTimeType; timezone?: Timezone; format?: string; locale?: string }
): Instant => {
  if (!options.type) {
    return dateTime;
  }
  switch (options.type) {
    case 'unix-epoch':
      return DateTime.fromMillis(parseInt(dateTime, 10) * 1000)
        .toUTC()
        .toISO()!;
    case 'unix-epoch-ms':
      return DateTime.fromMillis(parseInt(dateTime, 10)).toUTC().toISO()!;
    case 'iso-string':
      return DateTime.fromISO(dateTime).toUTC().toISO()!;
    case 'string':
      return DateTime.fromFormat(dateTime, options.format!, {
        zone: options.timezone,
        locale: options.locale
      })
        .toUTC()
        .toISO()!;
    case 'timestamp':
    case 'Date':
    case 'DateTime':
    case 'DateTime2':
    case 'SmallDateTime':
      return DateTime.fromJSDate(dateTime).toUTC().setZone(options.timezone, { keepLocalTime: true }).toUTC().toISO()!;
    case 'DateTimeOffset':
    case 'timestamptz':
      return DateTime.fromJSDate(dateTime).toUTC().toISO()!;
  }
};

export const formatQueryParams = (startTime: any, endTime: any, queryParams: Array<{ key: string; value: string }>): string => {
  if (queryParams.length === 0) {
    return '';
  }
  let queryParamsString = '?';
  queryParams.forEach((queryParam, index) => {
    let value;
    switch (queryParam.value) {
      case '@StartTime':
        value = startTime;
        break;
      case '@EndTime':
        value = endTime;
        break;
      default:
        value = queryParam.value;
    }
    queryParamsString += `${encodeURIComponent(queryParam.key)}=${encodeURIComponent(value)}`;
    if (index < queryParams.length - 1) {
      queryParamsString += '&';
    }
  });
  return queryParamsString;
};

/**
 * Some API such as SLIMS uses a body with GET. It's not standard and requires a specific implementation
 */
export const httpGetWithBody = (body: string, options: any): Promise<any> =>
  new Promise((resolve, reject) => {
    const callback = (response: any) => {
      let str = '';
      response.on('data', (chunk: string) => {
        str += chunk;
      });
      response.on('end', () => {
        try {
          const parsedResult = JSON.parse(str);
          resolve(parsedResult);
        } catch (error) {
          reject(error);
        }
      });
    };

    const req = (options.protocol === 'https:' ? https : http).request(options, callback);
    req.on('error', e => {
      reject(e);
    });
    req.write(body);
    req.end();
  });

export const getOIBusInfo = (): OIBusInfo => {
  return {
    dataDirectory: process.cwd(),
    binaryDirectory: process.execPath,
    processId: process.pid.toString(),
    hostname: os.hostname(),
    operatingSystem: `${os.type()} ${os.release()}`,
    architecture: process.arch,
    version
  };
};
