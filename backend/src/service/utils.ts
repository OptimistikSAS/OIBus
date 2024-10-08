import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

import minimist from 'minimist';
import { DateTime } from 'luxon';
import fetch, { HeadersInit } from 'node-fetch';
import AdmZip from 'adm-zip';

import { CsvCharacter, DateTimeType, Instant, Interval, SerializationSettings, Timezone } from '../../../shared/model/types';
import pino from 'pino';
import csv from 'papaparse';
import https from 'node:https';
import http from 'node:http';
import { EngineSettingsDTO, OIBusContent, OIBusInfo, RegistrationSettingsDTO } from '../../../shared/model/engine.model';
import os from 'node:os';
import { NorthCacheFiles } from '../../../shared/model/north-connector.model';
import EncryptionService from './encryption.service';
import { createProxyAgent } from './proxy-agent';
import cronstrue from 'cronstrue';
import cronparser from 'cron-parser';
import { ValidatedCronExpression } from '../../../shared/model/scan-mode.model';

const COMPRESSION_LEVEL = 9;

/**
 * Get config file from console arguments
 * @returns {Object} - the config file and check argument
 */
export const getCommandLineArguments = () => {
  const args = minimist(process.argv.slice(2));
  console.info(`OIBus starting with the following arguments: ${JSON.stringify(args)}`);
  const { config = './', check = false, ignoreIpFilters = false, ignoreRemoteUpdate = false, ignoreRemoteConfig = false } = args;
  return {
    configFile: path.resolve(config),
    check,
    ignoreIpFilters: Boolean(ignoreIpFilters),
    ignoreRemoteUpdate: Boolean(ignoreRemoteUpdate),
    ignoreRemoteConfig: Boolean(ignoreRemoteConfig)
  };
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
  } catch {
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

export const unzip = (input: string, output: string) => {
  const zip = new AdmZip(input);
  zip.extractAllTo(output, true, true);
};

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
  itemName: string,
  baseFolder: string,
  addContentFn: (data: OIBusContent) => Promise<void>,
  logger: pino.Logger
): Promise<void> => {
  switch (serializationSettings.type) {
    case 'json':
      return addContentFn({ type: 'time-values', content: data });
    case 'file':
      const filePath = generateFilenameForSerialization(baseFolder, serializationSettings.filename, connectorName, itemName);
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
        await addContentFn({ type: 'raw', filePath: gzipPath });
        try {
          await fs.unlink(gzipPath);
          logger.trace(`File "${gzipPath}" deleted`);
        } catch (unlinkError) {
          logger.error(`Error when deleting compressed file "${gzipPath}" after caching it. ${unlinkError}`);
        }
      } else {
        logger.debug(`Sending file "${filePath}" to Engine`);
        await addContentFn({ type: 'raw', filePath });
        try {
          await fs.unlink(filePath);
          logger.trace(`File ${filePath} deleted`);
        } catch (unlinkError) {
          logger.error(`Error when deleting file "${filePath}" after caching it. ${unlinkError}`);
        }
      }
      break;
    case 'csv':
      const csvPath = generateFilenameForSerialization(baseFolder, serializationSettings.filename, connectorName, itemName);
      const csvContent = generateCsvContent(data, serializationSettings.delimiter);

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
        await addContentFn({ type: 'raw', filePath: gzipPath });

        try {
          await fs.unlink(gzipPath);
          logger.trace(`CSV file "${gzipPath}" deleted`);
        } catch (unlinkError) {
          logger.error(`Error when deleting compressed CSV file "${gzipPath}" after caching it. ${unlinkError}`);
        }
      } else {
        logger.debug(`Sending CSV file "${csvPath}" to Engine`);
        await addContentFn({ type: 'raw', filePath: csvPath });

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

export const generateFilenameForSerialization = (baseFolder: string, filename: string, connectorName: string, itemName: string): string => {
  return path.join(
    baseFolder,
    filename
      .replace('@CurrentDate', DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS'))
      .replace('@ConnectorName', connectorName)
      .replace('@ItemName', itemName)
  );
};

export const generateCsvContent = (data: Array<any>, delimiter: CsvCharacter): string => {
  const options = {
    header: true,
    delimiter: convertDelimiter(delimiter)
  };
  return csv.unparse(data, options);
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

export const formatQueryParams = (
  startTime: any,
  endTime: any,
  queryParams: Array<{
    key: string;
    value: string;
  }>
): string => {
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

export const downloadFile = async (
  connectionSettings: { host: string; headers: HeadersInit; agent: any },
  endpoint: string,
  filePath: string,
  timeout: number
): Promise<void> => {
  let response;

  try {
    response = await fetch(`${connectionSettings.host}${endpoint}`, {
      method: 'GET',
      timeout,
      agent: connectionSettings.agent,
      headers: connectionSettings.headers
    });
  } catch (fetchError) {
    throw new Error(`Download failed: ${fetchError}`);
  }

  if (!response.ok) {
    throw new Error(`Download failed with status code ${response.status} and message: ${response.statusText}`);
  }

  const buffer = await response.buffer();
  await fs.writeFile(filePath, buffer);
};

export const getOIBusInfo = (oibusSettings: EngineSettingsDTO): OIBusInfo => {
  return {
    dataDirectory: process.cwd(),
    binaryDirectory: process.execPath,
    processId: process.pid.toString(),
    hostname: os.hostname(),
    operatingSystem: `${os.type()} ${os.release()}`,
    architecture: process.arch,
    version: oibusSettings.version,
    oibusId: oibusSettings.id,
    oibusName: oibusSettings.name,
    platform: getPlatformFromOsType(os.type())
  };
};

export const getPlatformFromOsType = (osType: string): string => {
  switch (osType) {
    case 'Linux':
      return 'linux';
    case 'Darwin':
      return 'macos';
    case 'Windows_NT':
      return 'windows';
    default:
      return 'unknown';
  }
};

/**
 * Returns file metadata from the folder based on filters.
 */
export const getFilesFiltered = async (
  folder: string,
  fromDate: Instant,
  toDate: Instant,
  nameFilter: string,
  logger: pino.Logger
): Promise<Array<NorthCacheFiles>> => {
  const filenames = await fs.readdir(folder);
  const filteredFilenames: Array<NorthCacheFiles> = [];
  for (const filename of filenames) {
    try {
      const stats = await fs.stat(path.join(folder, filename));

      const dateIsSuperiorToStart = fromDate ? stats.mtimeMs >= DateTime.fromISO(fromDate).toMillis() : true;
      const dateIsInferiorToEnd = toDate ? stats.mtimeMs <= DateTime.fromISO(toDate).toMillis() : true;
      const dateIsBetween = dateIsSuperiorToStart && dateIsInferiorToEnd;
      const filenameContains = nameFilter ? filename.toUpperCase().includes(nameFilter.toUpperCase()) : true;
      if (dateIsBetween && filenameContains) {
        filteredFilenames.push({
          filename,
          modificationDate: DateTime.fromMillis(stats.mtimeMs).toUTC().toISO() as Instant,
          size: stats.size
        });
      }
    } catch (error) {
      logger.error(`Error while reading in ${path.basename(folder)} folder file stats "${path.join(folder, filename)}": ${error}`);
    }
  }
  return filteredFilenames;
};

export const getNetworkSettingsFromRegistration = async (
  registrationSettings: RegistrationSettingsDTO | null,
  endpoint: string,
  encryptionService: EncryptionService
): Promise<{ host: string; headers: HeadersInit; agent: any }> => {
  if (!registrationSettings || registrationSettings.status !== 'REGISTERED') {
    throw new Error('OIBus not registered in OIAnalytics');
  }

  if (registrationSettings.host.endsWith('/')) {
    registrationSettings.host = registrationSettings.host.slice(0, registrationSettings.host.length - 1);
  }

  const headers: HeadersInit = {};

  const token = await encryptionService.decryptText(registrationSettings.token!);
  headers.authorization = `Bearer ${token}`;

  const agent = createProxyAgent(
    registrationSettings.useProxy,
    `${registrationSettings.host}${endpoint}`,
    registrationSettings.useProxy
      ? {
          url: registrationSettings.proxyUrl!,
          username: registrationSettings.proxyUsername!,
          password: registrationSettings.proxyPassword ? await encryptionService.decryptText(registrationSettings.proxyPassword) : null
        }
      : null,
    registrationSettings.acceptUnauthorized
  );

  return {
    host: registrationSettings.host,
    headers,
    agent
  };
};

/**
 * Validates a cron expression and returns the next 3 executions and a human-readable form.
 * Next executions are in UTC.
 *
 * @throws {Error} if the cron expression is invalid, with a message
 */
export const validateCronExpression = (cron: string): ValidatedCronExpression => {
  const response: ValidatedCronExpression = {
    nextExecutions: [],
    humanReadableForm: ''
  };

  // source for non-standard characters: https://en.wikipedia.org/wiki/Cron#Non-standard_characters
  const nonStandardCharacters = ['L', 'W', '#', '?', 'H'];

  try {
    // we limit the number of fields to 6 because the
    // backend does not support quartz cron (7th part would be years), so we show an error
    if (cron.split(' ').filter(Boolean).length >= 7) {
      throw new Error('Too many fields. Only seconds, minutes, hours, day of month, month and day of week are supported.');
    }
    // backend does not support these characters
    const badCharecters = nonStandardCharacters.filter(c => cron.includes(c));
    if (badCharecters.length > 0) {
      throw new Error(`Expression contains non-standard characters: ${badCharecters.join(', ')}`);
    }

    // cronstrue throws an error if the cron is invalid
    // this error is more user-friendly
    response.humanReadableForm = cronstrue.toString(cron, {
      verbose: true,
      use24HourTimeFormat: true
    });

    // but cronstrue is not enough to validate the cron
    // so we need to parse it with cronparser
    response.nextExecutions = cronparser
      .parseExpression(cron, { utc: true })
      .iterate(3)
      .map(exp => exp.toISOString() as Instant);
  } catch (error: any) {
    // cronparser throws an error
    if (error instanceof Error) {
      throw error;
    }

    // cronstrue throws a string
    if (typeof error === 'string') {
      // remove the "Error: " prefix
      const string = error.replace(/^Error: /, '');
      const errorMessage = string.charAt(0).toUpperCase() + string.slice(1);
      throw new Error(errorMessage);
    }

    throw new Error('Invalid cron expression');
  }

  return response;
};
