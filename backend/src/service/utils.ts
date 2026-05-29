import fs from 'node:fs/promises';
import { createReadStream, createWriteStream, readFileSync, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';
import path from 'node:path';

import minimist from 'minimist';
import { DateTime } from 'luxon';
import unzipper from 'unzipper';

import { CsvCharacter, DateTimeType, Instant, Interval, SerializationSettings, Timezone } from '../../shared/model/types';
import { OIBusInitConfig } from '../model/oibus-init-config.model';
import csv from 'papaparse';
import { EngineSettingsDTO, OIBusContent, OIBusInfo } from '../../shared/model/engine.model';
import os from 'node:os';
import cronstrue from 'cronstrue';
import cronparser from 'cron-parser';
import { ValidatedCronExpression } from '../../shared/model/scan-mode.model';
import { OIBusSouthType, SOUTH_SINGLE_ITEMS, SouthConnectorItemDTO } from '../../shared/model/south-connector.model';
import { OIBusObjectAttribute } from '../../shared/model/form.model';
import { ScanMode } from '../model/scan-mode.model';
import { HistoryQueryItemDTO } from '../../shared/model/history-query.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import { OIBusError } from '../model/engine.model';
import Stream from 'node:stream';
import { SouthConnectorItemEntity, SouthItemGroupEntity, SouthItemGroupEntityLight } from '../model/south-connector.model';
import { SouthFolderScannerItemSettings, SouthItemSettings } from '../../shared/model/south-settings.model';
import type { ILogger } from '../model/logger.model';

const COMPRESSION_LEVEL = 9;

/**
 * Get config file from console arguments
 * @returns {Object} - the config file and version argument
 */
export const getCommandLineArguments = () => {
  const args = minimist(process.argv.slice(2));
  console.info(`OIBus starting with the following arguments: ${JSON.stringify(args)}`);
  const {
    config = './',
    version = false,
    ignoreIpFilters = false,
    ignoreRemoteUpdate = false,
    ignoreRemoteConfig = false,
    launcherVersion = '3.4.0'
  } = args;
  return {
    configFile: path.resolve(config),
    version,
    ignoreIpFilters: Boolean(ignoreIpFilters),
    ignoreRemoteUpdate: Boolean(ignoreRemoteUpdate),
    ignoreRemoteConfig: Boolean(ignoreRemoteConfig),
    launcherVersion
  };
};

export const INIT_CONFIG_FILENAME = 'oibus.init.json';

const readSecretOrEnv = (fileEnvVar: string, directEnvVar: string): string | undefined => {
  const filePath = process.env[fileEnvVar];
  if (filePath) {
    try {
      return readFileSync(filePath, 'utf8').trim();
    } catch (err) {
      console.warn(`Failed to read secret from ${filePath}: ${(err as Error).message}`);
    }
  }
  return process.env[directEnvVar] || undefined;
};

/**
 * Read the one-time init config from file (installer path) or env vars (Docker path).
 * Priority: oibus.init.json > ADMIN_USERNAME_FILE/ADMIN_PASSWORD_FILE > ADMIN_USERNAME/ADMIN_PASSWORD/DEFAULT_PORT > undefined.
 */
export const readInitConfig = (): OIBusInitConfig => {
  if (existsSync(INIT_CONFIG_FILENAME)) {
    try {
      const raw = readFileSync(INIT_CONFIG_FILENAME, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        adminUsername: typeof parsed.adminUsername === 'string' ? parsed.adminUsername : undefined,
        adminPassword: typeof parsed.adminPassword === 'string' ? parsed.adminPassword : undefined,
        port: typeof parsed.port === 'number' ? parsed.port : undefined
      };
    } catch (err) {
      console.warn(`Failed to parse ${INIT_CONFIG_FILENAME}: ${(err as Error).message}; falling back to env vars / defaults`);
    }
  }

  const portEnv = process.env.DEFAULT_PORT;
  const parsedPort = portEnv ? parseInt(portEnv, 10) : NaN;
  return {
    adminUsername: readSecretOrEnv('ADMIN_USERNAME_FILE', 'ADMIN_USERNAME'),
    adminPassword: readSecretOrEnv('ADMIN_PASSWORD_FILE', 'ADMIN_PASSWORD'),
    port: Number.isNaN(parsedPort) ? undefined : parsedPort
  };
};

/**
 * Method to return a delayed promise.
 */
export const delay = (timeout: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, timeout);
  });

/**
 * Compute a list of intervals from a start, end, and maxInterval.
 */
export const generateIntervals = (
  startInstant: Instant,
  startInstantFromCache: Instant,
  endInstant: Instant,
  maxNumberOfSecondsInInterval: number
): { intervals: Array<Interval>; numberOfIntervalsDone: number } => {
  const startTime = DateTime.fromISO(startInstant);
  const startTimeFromCache = DateTime.fromISO(startInstantFromCache);
  const endTime = DateTime.fromISO(endInstant);
  const originalInterval = endTime.toMillis() - startTime.toMillis();
  let numberOfIntervalsDone = 0;

  if (maxNumberOfSecondsInInterval <= 0) {
    return {
      intervals: [{ start: startInstantFromCache, end: endInstant }],
      numberOfIntervalsDone: 0
    };
  }

  const intervalLists: Array<Interval> = [];
  const intervalDuration = maxNumberOfSecondsInInterval * 1000;
  const numberOfIntervals = Math.ceil(originalInterval / intervalDuration);

  let currentStart = startTime.toMillis();
  for (let i = 0; i < numberOfIntervals; i += 1) {
    const newStartTime = DateTime.fromMillis(currentStart);
    const newEndTime = DateTime.fromMillis(currentStart + intervalDuration);

    if (newEndTime > endTime) {
      // Last interval: adjust end to endTime
      intervalLists.push({
        start: newStartTime.toUTC().toISO() as Instant,
        end: endTime.toUTC().toISO() as Instant
      });
    } else {
      // Handle the first unqueried interval It is needed to not query again the part of the interval that has already been queried
      let adjustedStart = newStartTime;
      if (newStartTime < startTimeFromCache && startTimeFromCache < newEndTime) {
        adjustedStart = startTimeFromCache;
      }
      intervalLists.push({
        start: adjustedStart.toUTC().toISO() as Instant,
        end: newEndTime.toUTC().toISO() as Instant
      });
      if (newEndTime <= startTimeFromCache) {
        numberOfIntervalsDone += 1;
      }
    }
    currentStart += intervalDuration;
  }
  return { intervals: intervalLists, numberOfIntervalsDone };
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
 * Get filename without random ID from file path.
 * Example: file1-123456.json => file1.json
 */
export const getFilenameWithoutRandomId = (filename: string): string => {
  const { name, ext } = path.parse(filename);
  if (name.lastIndexOf('-') === -1) {
    return `${name}${ext}`;
  }
  const resultingFilename = name.slice(0, name.lastIndexOf('-'));
  return `${resultingFilename}${ext}`;
};

/**
 * Compress the specified file
 */
export const compress = (input: string, output: string): Promise<void> =>
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

export const unzip = (input: string, output: string): Promise<void> => {
  return pipeline(createReadStream(input), unzipper.Extract({ path: output }));
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
const getOccurrences = (
  str: string,
  keyword: string,
  value: string | number | DateTime
): Array<{ index: number; value: string | number | DateTime }> => {
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

/**
 * Extract the last data row of a CSV string as an object keyed by the header line.
 *
 * Used to keep a lightweight "last value" in the South cache for connectors whose remote agent
 * returns the whole result set as CSV content — storing the full content on every scan bloats the
 * cache and forces a parse of the entire blob on each read. Returns null when there is no data row.
 */
export const extractLastCsvRow = (content: string, delimiter: string): Record<string, string> | null => {
  if (typeof content !== 'string' || content.length === 0) {
    return null;
  }
  const trimmed = content.replace(/[\r\n]+$/, '');
  const firstBreak = trimmed.search(/\r?\n/);
  if (firstBreak === -1) {
    // Header only (or a single line) — no data row to keep
    return null;
  }
  const headers = trimmed.slice(0, firstBreak).split(delimiter);
  const values = trimmed.slice(trimmed.lastIndexOf('\n') + 1).split(delimiter);
  return headers.reduce(
    (row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    },
    {} as Record<string, string>
  );
};

export const convertQuoteChar = (quoteChar: 'DOUBLE_QUOTE' | 'SINGLE_QUOTE' | 'NONE'): string => {
  switch (quoteChar) {
    case 'DOUBLE_QUOTE':
      return '"';
    case 'SINGLE_QUOTE':
      return "'";
    case 'NONE':
      return '';
  }
};

export const convertEscapeChar = (escapeChar: 'BACKSLASH' | 'DOUBLE_QUOTE'): string => {
  switch (escapeChar) {
    case 'BACKSLASH':
      return '\\';
    case 'DOUBLE_QUOTE':
      return '"';
  }
};

export const convertNewline = (newline: 'DEFAULT' | 'CRLF' | 'LF' | 'CR'): string => {
  switch (newline) {
    case 'CRLF':
      return '\r\n';
    case 'LF':
      return '\n';
    case 'CR':
      return '\r';
    case 'DEFAULT':
      return '';
  }
};

export const persistResults = async (
  data: Array<unknown> | string,
  serializationSettings: SerializationSettings,
  connectorName: string,
  item: SouthConnectorItemEntity<SouthItemSettings>,
  queryTime: Instant,
  baseFolder: string,
  addContentFn: (data: OIBusContent, queryTime: Instant, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>,
  logger: ILogger
): Promise<void> => {
  switch (serializationSettings.type) {
    case 'file':
      const filePath = generateFilenameForSerialization(baseFolder, serializationSettings.filename, connectorName, item.name);
      logger.debug(`Writing ${data.length} bytes into file at "${filePath}"`);
      await fs.writeFile(filePath, data as string);

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
        await addContentFn({ type: 'any', filePath: gzipPath }, queryTime, [item]);
        try {
          await fs.unlink(gzipPath);
          logger.trace(`File "${gzipPath}" deleted`);
        } catch (unlinkError) {
          logger.error(`Error when deleting compressed file "${gzipPath}" after caching it. ${unlinkError}`);
        }
      } else {
        logger.debug(`Sending file "${filePath}" to Engine`);
        await addContentFn({ type: 'any', filePath }, queryTime, [item]);
        try {
          await fs.unlink(filePath);
          logger.trace(`File ${filePath} deleted`);
        } catch (unlinkError) {
          logger.error(`Error when deleting file "${filePath}" after caching it. ${unlinkError}`);
        }
      }
      break;
    case 'csv':
      const csvPath = generateFilenameForSerialization(baseFolder, serializationSettings.filename, connectorName, item.name);
      const csvContent = generateCsvContent(data as Array<Record<string, string>>, serializationSettings.delimiter);

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
        await addContentFn({ type: 'any', filePath: gzipPath }, queryTime, [item]);

        try {
          await fs.unlink(gzipPath);
          logger.trace(`CSV file "${gzipPath}" deleted`);
        } catch (unlinkError) {
          logger.error(`Error when deleting compressed CSV file "${gzipPath}" after caching it. ${unlinkError}`);
        }
      } else {
        logger.debug(`Sending CSV file "${csvPath}" to Engine`);
        await addContentFn({ type: 'any', filePath: csvPath }, queryTime, [item]);

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

export const generateCsvContent = (data: Array<Record<string, string | number>>, delimiter: CsvCharacter): string => {
  const options = {
    header: true,
    delimiter: convertDelimiter(delimiter)
  };
  return csv.unparse(data, options);
};
/**
 * Log the executed query with replacements values for query variables
 */
export const logQuery = (query: string, startTime: string | number, endTime: string | number, logger: ILogger): void => {
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
  instant: Instant | undefined,
  options: { type: DateTimeType; timezone?: Timezone; format?: string; locale?: string }
): string | number => {
  if (!instant) return '';
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
    case 'date':
      return DateTime.fromISO(instant, { zone: options.timezone }).toFormat('yyyy-MM-dd');
    case 'small-date-time':
      return DateTime.fromISO(instant, { zone: options.timezone }).toFormat('yyyy-MM-dd HH:mm:ss');
    case 'date-time':
    case 'date-time-2':
    case 'timestamp':
      return DateTime.fromISO(instant, { zone: options.timezone }).toFormat('yyyy-MM-dd HH:mm:ss.SSS');
    case 'date-time-offset':
    case 'timestamptz':
    default:
      return instant;
  }
};

export const convertDateTimeToInstant = (
  dateTime: string | number | Date | null,
  options: { type?: DateTimeType; timezone?: Timezone; format?: string; locale?: string }
): Instant => {
  if (!dateTime) return '';
  // Early return if no conversion is needed (assume input is already an ISO string)
  if (!options.type) {
    if (typeof dateTime === 'string' && DateTime.fromISO(dateTime).isValid) {
      return dateTime;
    }
    throw new Error(`The value must be a valid ISO string if no type is provided: "${dateTime}"`);
  }

  const { type, timezone, format, locale } = options;

  try {
    switch (type) {
      case 'unix-epoch': {
        const epochSeconds = typeof dateTime === 'string' ? parseInt(dateTime, 10) : dateTime;
        if (typeof epochSeconds !== 'number' || isNaN(epochSeconds)) {
          throw new Error(`The value must be a number or numeric string for type "unix-epoch": "${dateTime}"`);
        }
        return DateTime.fromMillis(epochSeconds * 1000)
          .toUTC()
          .toISO()!;
      }
      case 'unix-epoch-ms': {
        const epochMillis = typeof dateTime === 'string' ? parseInt(dateTime, 10) : dateTime;
        if (typeof epochMillis !== 'number' || isNaN(epochMillis)) {
          throw new Error(`The value must be a number or numeric string for type "unix-epoch-ms": "${dateTime}"`);
        }
        return DateTime.fromMillis(epochMillis).toUTC().toISO()!;
      }
      case 'iso-string': {
        if (typeof dateTime !== 'string') {
          throw new Error(`The value must be a string for type "iso-string": "${dateTime}"`);
        }
        return DateTime.fromISO(dateTime).toUTC().toISO()!;
      }
      case 'string': {
        if (typeof dateTime !== 'string' || !format || !timezone) {
          throw new Error(`The value must be a string and format must be provided for type "string": "${dateTime}"`);
        }
        return DateTime.fromFormat(dateTime, format, { zone: timezone, locale }).toUTC().toISO()!;
      }
      case 'date':
      case 'small-date-time':
      case 'date-time':
      case 'date-time-2': {
        if (!(dateTime instanceof Date) || !timezone) {
          throw new Error(`The value must be a Date object for type "${type}": "${dateTime}"`);
        }
        return DateTime.fromJSDate(dateTime).toUTC().setZone(timezone, { keepLocalTime: true }).toUTC().toISO()!;
      }
      case 'date-time-offset':
      case 'timestamp':
      case 'timestamptz': {
        if (!(dateTime instanceof Date)) {
          throw new Error(`The value must be a Date object for type "${type}": "${dateTime}"`);
        }
        return DateTime.fromJSDate(dateTime).toUTC().toISO()!;
      }
      default:
        throw new Error(`Unsupported DateTimeType: "${type}"`);
    }
  } catch (error) {
    throw new Error(`Failed to convert "${dateTime}" to Instant for type "${type}": ${(error as Error).message}`);
  }
};

export const convertDateTime = (
  dateTime: string | number | Date,
  input: { type: DateTimeType; timezone?: string; format?: string; locale?: string },
  output: { type: DateTimeType; timezone?: string; format?: string; locale?: string }
) => {
  const instant: Instant = convertDateTimeToInstant(dateTime, input);
  return formatInstant(instant, output);
};

export const formatQueryParams = (
  startTime: string | number,
  endTime: string | number,
  queryParams: Array<{
    key: string;
    value: string;
  }>
): Record<string, string | number> => {
  const params: Record<string, string | number> = {};

  for (const queryParam of queryParams) {
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
    params[queryParam.key] = value;
  }

  return params;
};

export const getOIBusInfo = (oibusSettings: Omit<EngineSettingsDTO, 'createdBy' | 'updatedBy'>): OIBusInfo => {
  return {
    dataDirectory: process.cwd(),
    binaryDirectory: process.execPath,
    processId: process.pid.toString(),
    hostname: os.hostname(),
    operatingSystem: `${os.type()} ${os.release()}`,
    architecture: process.arch,
    version: oibusSettings.version,
    launcherVersion: oibusSettings.launcherVersion,
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
 * Validates a cron expression and returns the next 3 executions and a human-readable form.
 * Next executions are in UTC.
 */
export const validateCronExpression = (cron: string): ValidatedCronExpression => {
  const response: ValidatedCronExpression = {
    isValid: true,
    nextExecutions: [],
    humanReadableForm: '',
    errorMessage: ''
  };

  // source for non-standard characters: https://en.wikipedia.org/wiki/Cron#Non-standard_characters
  const nonStandardCharacters = ['L', 'W', '#', '?', 'H'];

  // we limit the number of fields to 6 because the
  // backend does not support quartz cron (7th part would be years), so we show an error
  if (cron.split(' ').filter(Boolean).length >= 7) {
    return {
      isValid: false,
      errorMessage: 'Cron Expression: Too many fields. Only seconds, minutes, hours, day of month, month and day of week are supported.',
      nextExecutions: [],
      humanReadableForm: ''
    };
  }
  // backend does not support these characters
  const badCharacters = nonStandardCharacters.filter(c => cron.includes(c));
  if (badCharacters.length > 0) {
    return {
      isValid: false,
      errorMessage: `Cron Expression: Non-standard characters: ${badCharacters.join(', ')}`,
      nextExecutions: [],
      humanReadableForm: ''
    };
  }

  try {
    // cronstrue throws an error if the cron is invalid
    // this error is more user-friendly
    response.humanReadableForm = cronstrue.toString(cron, {
      verbose: true,
      use24HourTimeFormat: true
    });

    // but cronstrue is not enough to validate the cron,
    // so we need to parse it with cronparser
    response.nextExecutions = cronparser
      .parse(cron)
      .take(3)
      .map(exp => exp.toISOString() as Instant);
  } catch (error: unknown) {
    // cronparser throws an error
    if (error && typeof error === 'object' && (error as Error).message) {
      return {
        isValid: false,
        errorMessage: `Cron Expression: ${(error as Error).message}`,
        nextExecutions: [],
        humanReadableForm: ''
      };
    }

    // cronstrue throws a string
    if (typeof error === 'string') {
      // remove the "Error: " prefix
      const string = error.replace(/^Error: /, '');
      const errorMessage = `Cron Expression: ${string.charAt(0).toUpperCase() + string.slice(1)}`;
      return {
        isValid: false,
        errorMessage,
        nextExecutions: [],
        humanReadableForm: ''
      };
    }

    return {
      isValid: false,
      errorMessage: 'Cron Expression: Invalid',
      nextExecutions: [],
      humanReadableForm: ''
    };
  }

  return response;
};

export const checkScanMode = (scanModes: Array<ScanMode>, scanModeId: string | null, scanModeName: string | null): ScanMode => {
  if (!scanModeId && !scanModeName) {
    throw new OIBusValidationError(`Scan mode not specified`);
  }

  const scanMode = scanModeId
    ? scanModes.find(element => element.id === scanModeId)
    : scanModes.find(element => element.name === scanModeName);
  if (!scanMode) {
    throw new NotFoundError(`Scan mode "${scanModeName}" not found`);
  }
  return scanMode;
};

export const checkGroups = (
  groups: Array<SouthItemGroupEntity>,
  groupId: string | null,
  groupName: string | null
): SouthItemGroupEntityLight => {
  if (!groupId && !groupName) {
    throw new OIBusValidationError(`Group not specified`);
  }

  if (groupId?.startsWith('temp_')) {
    return {
      id: groupId
    } as SouthItemGroupEntityLight;
  }

  const group = groupId ? groups.find(element => element.id === groupId) : groups.find(element => element.name === groupName);
  if (!group) {
    throw new NotFoundError(`Group "${groupName}" not found`);
  }
  return group;
};

export const itemToFlattenedCSV = (
  items: Array<SouthConnectorItemDTO | HistoryQueryItemDTO>,
  delimiter: string,
  itemSettingsSchema: OIBusObjectAttribute,
  isHistoryQuery = false
): string => {
  const columns: Set<string> = new Set<string>(['name', 'enabled']);
  if (!isHistoryQuery) {
    columns.add('scanMode');
    columns.add('group');
    columns.add('maxReadInterval');
    columns.add('readDelay');
    columns.add('overlap');
    columns.add('syncWithGroup');
  }

  // Pre-populate settings columns from the schema so that optional fields
  // absent from every item (e.g. haMode when all items are in DA mode)
  // still appear as headers in the exported CSV.
  const settingsAttributes =
    (itemSettingsSchema.attributes.find(element => element.key === 'settings') as OIBusObjectAttribute)?.attributes ?? [];
  for (const attr of settingsAttributes) {
    columns.add(`settings_${attr.key}`);
  }

  return csv.unparse(
    items.map(item => {
      let flattenedItem: Record<string, string | number | object | boolean | null>;
      if (isHistoryQuery) {
        flattenedItem = { ...(item as HistoryQueryItemDTO) };
      } else {
        const { group, ...itemWithoutGroup } = item as SouthConnectorItemDTO;
        flattenedItem = { ...itemWithoutGroup };
        flattenedItem.scanMode = (item as SouthConnectorItemDTO).scanMode?.name || '';
        flattenedItem.group = group?.standardSettings.name || '';
      }
      for (const [itemSettingsKey, itemSettingsValue] of Object.entries(item.settings)) {
        if (columns.has(`settings_${itemSettingsKey}`)) {
          if (typeof itemSettingsValue === 'object') {
            flattenedItem[`settings_${itemSettingsKey}`] = JSON.stringify(itemSettingsValue);
          } else {
            flattenedItem[`settings_${itemSettingsKey}`] = itemSettingsValue as string;
          }
        }
      }
      delete flattenedItem.id;
      delete flattenedItem.scanModeId;
      delete flattenedItem.settings;
      delete flattenedItem.connectorId;
      return flattenedItem;
    }),
    { columns: Array.from(columns), delimiter }
  );
};

export const stringToBoolean = (value: string): boolean => {
  if (['true', 'True', 'TRUE', '1'].includes(value)) return true;
  if (['false', 'False', 'FALSE', '0'].includes(value)) return false;
  return false;
};

const formatRegex = (ip: string) => {
  // Escape backslashes, then replace . and *
  return `^${ip.replace(/\\/g, '\\\\').replace(/\./g, '\\.').replace(/\*/g, '.*')}$`;
};

const LOCALHOST_ADDRESSES = ['127.0.0.1', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '0:0:0:0:0:0:0:1'];

/**
 * Per-filter compiled regex cache. `testIPOnFilter` runs on every HTTP request
 * via the IP-filter middleware; The set of filters
 * is bounded by the operator's configuration, so an unbounded cache is fine.
 */
const ipFilterRegexCache = new Map<string, RegExp>();
const getFilterRegex = (filter: string): RegExp => {
  let regex = ipFilterRegexCache.get(filter);
  if (!regex) {
    regex = new RegExp(formatRegex(filter));
    ipFilterRegexCache.set(filter, regex);
  }
  return regex;
};

// Hoisted (was `new RegExp(...)` per call before): the request's IP shape only
// needs to be classified once, not once per filter.
const IPV4_PATTERN = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
const IPV4_MAPPED_PATTERN = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/;

export const testIPOnFilter = (ipFilters: Array<string>, ipToCheck: string): boolean => {
  // Classify the inbound IP once.
  const isIPv4 = IPV4_PATTERN.test(ipToCheck);
  const ipv4MappedMatch = !isIPv4 ? ipToCheck.match(IPV4_MAPPED_PATTERN) : null;
  // For an IPv4 request, the mapped form (`::ffff:1.2.3.4`) lets a v4-shaped
  // filter still match — keep that behaviour but compute the string once.
  const mappedIpv4Form = isIPv4 ? `::ffff:${ipToCheck}` : null;

  for (const filter of LOCALHOST_ADDRESSES) {
    if (matchesFilter(filter, ipToCheck, isIPv4, mappedIpv4Form, ipv4MappedMatch)) return true;
  }
  for (const filter of ipFilters) {
    if (matchesFilter(filter, ipToCheck, isIPv4, mappedIpv4Form, ipv4MappedMatch)) return true;
  }
  return false;
};

const matchesFilter = (
  filter: string,
  ipToCheck: string,
  isIPv4: boolean,
  mappedIpv4Form: string | null,
  ipv4MappedMatch: RegExpMatchArray | null
): boolean => {
  if (filter === '*') return true;
  const regex = getFilterRegex(filter);

  if (isIPv4) {
    // Plain IPv4: test the v4 form first; also try the mapped form so a
    // `192.168.*.*`-style filter matches an `::ffff:192.168.x.x` peer.
    return regex.test(ipToCheck) || regex.test(mappedIpv4Form!);
  }
  if (ipv4MappedMatch) {
    // Inbound is `::ffff:1.2.3.4` — try both the raw form and the v4 part.
    return regex.test(ipv4MappedMatch[1]) || regex.test(ipToCheck);
  }
  // Pure IPv6 (or other) — single test.
  return regex.test(ipToCheck);
};

export const sanitizeFilename = (originalName: string): string => {
  return originalName.replace(/['"]/g, '').replace(/[^a-zA-Z0-9-_.]/g, '-');
};

/**
 * Helper: Replaces '*' in a JSONPath with actual indices sequentially.
 * Example: path="$.vals[*].sub[*]", indices=[0, 5] -> "$.vals[0].sub[5]"
 * It is used to retrieve line by line each field and populate csv rows
 */
export const injectIndices = (pathDefinition: string, indices: Array<number>): string => {
  let indexPointer = 0;
  // Regex matches '[*]' literals
  return pathDefinition.replace(/\[\*\]/g, () => {
    // If we run out of indices (parent accessing global), we assume 0 or keep wildcard
    // But usually, we just take the next available index.
    const val = indices[indexPointer] !== undefined ? indices[indexPointer] : '*';
    indexPointer++;
    return `[${val}]`;
  });
};

export const processCacheFileContent = async (
  stream: NodeJS.ReadableStream,
  sizeLimit = 1024 * 500 // 500KB limit
): Promise<{ content: string; truncated: boolean }> => {
  const chunks: Array<Buffer> = [];
  let totalSize = 0;
  let truncated = false;

  for await (const chunk of stream) {
    const bufferChunk = Buffer.from(chunk);
    if (totalSize + bufferChunk.length > sizeLimit) {
      const remaining = sizeLimit - totalSize;
      if (remaining > 0) {
        chunks.push(bufferChunk.subarray(0, remaining));
        totalSize += remaining;
      }
      truncated = true;
      break;
    }
    chunks.push(bufferChunk);
    totalSize += bufferChunk.length;
  }
  return { content: Buffer.concat(chunks).toString('utf-8'), truncated };
};

export const determineContentTypeFromFilename = (filename: string): 'csv' | 'xml' | 'json' | 'raw' => {
  const { ext } = path.parse(filename);
  switch (ext) {
    case '.csv':
      return 'csv';
    case '.json':
      return 'json';
    case '.xml':
      return 'xml';
    default:
      return 'raw';
  }
};

export const streamToString = (stream: Stream): Promise<string> => {
  const chunks: Array<Buffer> = [];
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
    stream.on('error', err => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
};
/**
 * Create an OIBusError from an unknown error thrown by the handleFile or handleValues connector method
 * The error thrown can be overridden with an OIBusError to force a retry on specific cases
 */
export const createOIBusError = (error: unknown): OIBusError => {
  if (typeof error === 'object' && error !== null && '_isOIBusError' in error) {
    return error as OIBusError;
  } else if (error instanceof Error) {
    return new OIBusError(error.message, false);
  } else if (typeof error === 'string') {
    return new OIBusError(error, false);
  } else {
    return new OIBusError(JSON.stringify(error), false);
  }
};

// Helper to bypass Node's strict "exports" rule in package.json
export const resolveBypassingExports = (pkgName: string, subPath: string) => {
  try {
    // Try standard resolution first
    return require.resolve(`${pkgName}/${subPath}`);
  } catch (error: unknown) {
    const err = error as Error & { code?: string };

    // Native Node throws ERR_PACKAGE_PATH_NOT_EXPORTED.
    // Jest throws MODULE_NOT_FOUND when "exports" blocks a path.
    if (err.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' || err.code === 'MODULE_NOT_FOUND') {
      try {
        const mainPath = require.resolve(pkgName); // e.g., .../node_modules/luxon/build/node/luxon.js
        const searchStr = `node_modules${path.sep}${pkgName}`;
        const rootIdx = mainPath.lastIndexOf(searchStr);

        if (rootIdx !== -1) {
          const rootPath = mainPath.substring(0, rootIdx + searchStr.length);
          return path.join(rootPath, subPath);
        }
      } catch {
        // If we can't even resolve the main package (pkgName), it truly doesn't exist.
        // We throw the original error to preserve the exact message.
        throw error;
      }
    }
    throw error;
  }
};

export const checkAge = (
  item: SouthConnectorItemEntity<SouthFolderScannerItemSettings>,
  filename: string,
  mtimeMs: number,
  filesPreserved: Array<{ filename: string; modifiedTime: number }>,
  logger: ILogger
): boolean => {
  const timestamp = new Date().getTime();
  logger.trace(
    `Check age condition: mT:${mtimeMs} + mA ${item.settings.minAge} < ts:${timestamp} ` + `= ${mtimeMs + item.settings.minAge < timestamp}`
  );

  if (mtimeMs + item.settings.minAge > timestamp) return false;
  logger.trace(`File "${filename}" matches age`);

  // Check if the file was already sent (if preserveFiles is true)
  if (item.settings.preserveFiles) {
    if (item.settings.ignoreModifiedDate) return true;
    const fileEntry = filesPreserved.find(f => f.filename === filename);
    const lastModifiedTime = fileEntry ? fileEntry.modifiedTime : 0;
    if (mtimeMs <= lastModifiedTime) return false;
    logger.trace(`File "${filename}" last modified time ${lastModifiedTime} is older than mtimeMs ${mtimeMs}. The file will be sent`);
  }
  return true;
};

export const groupItemsByGroup = <I extends SouthItemSettings>(
  southType: OIBusSouthType,
  items: Array<SouthConnectorItemEntity<I>>
): Array<Array<SouthConnectorItemEntity<I>>> => {
  const groupedItemsList: Array<Array<SouthConnectorItemEntity<I>>> = [];
  // Sidecar map for O(1) group lookup. The arrays stored here are the SAME
  // references as in groupedItemsList, so pushing to one updates both.
  // groupedItemsList is the source of truth for output order; the map is just
  // an index. Connectors in SOUTH_SINGLE_ITEMS skip the map entirely (every
  // item is forced to be its own singleton, so there's no reason to index).
  const supportsGrouping = !SOUTH_SINGLE_ITEMS.includes(southType);
  const groupArraysById = new Map<string, Array<SouthConnectorItemEntity<I>>>();

  for (const item of items) {
    if (!item.group || !item.syncWithGroup || !supportsGrouping) {
      groupedItemsList.push([item]);
      continue;
    }
    const existing = groupArraysById.get(item.group.id);
    if (existing) {
      existing.push(item);
    } else {
      const newGroup = [item];
      groupedItemsList.push(newGroup);
      groupArraysById.set(item.group.id, newGroup);
    }
  }
  return groupedItemsList;
};

/**
 * Extracts a human-readable message from any thrown value.
 *
 * Node.js / undici network errors can arrive as an {@link AggregateError}
 * (e.g. ECONNREFUSED) whose top-level `.message` is empty while the actual
 * reasons live inside `.errors[]`. This helper recurses into sub-errors and
 * `Error.cause` so that callers always receive a non-empty, descriptive string.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AggregateError) {
    const subMessages = error.errors.map(getErrorMessage).filter(Boolean);
    return subMessages.length > 0 ? subMessages.join('; ') : error.message || error.toString();
  }
  if (error instanceof Error) {
    const parts: Array<string> = [];
    if (error.message) parts.push(error.message);
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause != null) {
      const causeMsg = getErrorMessage(cause);
      if (causeMsg) parts.push(causeMsg);
    }
    return parts.join(': ') || error.toString();
  }
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
