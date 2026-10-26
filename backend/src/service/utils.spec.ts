import assert from 'node:assert/strict';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import zlib from 'node:zlib';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import cronstrue from 'cronstrue';
import { DateTime } from 'luxon';

import type { EngineSettingsDTO, OIBusInfo } from '../../shared/model/api/engine.model';
import type { HistoryQueryItemDTO } from '../../shared/model/api/history-query.model';
import type { SouthConnectorItemDTO } from '../../shared/model/api/south-connector.model';
import type { DateTimeType } from '../../shared/model/common/types';
import type { OIBusObjectAttribute } from '../../shared/model/connector/form.model';
import type { SouthFolderScannerItemSettings } from '../../shared/model/connector/south-settings.model';

import type { CacheMetadataSourceOriginSouth, OIBusError as OIBusErrorType } from '../model/engine.model';
import type { SouthConnectorItemEntity, SouthItemGroupEntity } from '../model/south-connector.model';
import type { OIBusValidationError as OIBusValidationErrorType } from '../model/types';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import testData from '../tests/utils/test-data';
import { mockModule, reloadModule } from '../tests/utils/test-utils';

const nodeRequire = createRequire(import.meta.url);
// the real papaparse, to parse the imported files
const papaparse: typeof import('papaparse') = nodeRequire('papaparse');
// the real yazl, kept before it is mocked, to build the archives to unzip
const realYazl: typeof import('yazl') = nodeRequire('yazl');

// Module-level mock exports for third-party modules: the SUT keeps a reference to these objects,
// so their functions are replaced in beforeEach rather than the objects themselves
const minimistExports = mock.fn((): Record<string, unknown> => ({}));
const csvExports = {
  unparse: mock.fn((_data?: unknown, _config?: unknown): string => 'csv content'),
  parse: papaparse.parse
};
let zipOutputStream: PassThrough;
const zipAddFileMock = mock.fn((_input: string, _entryName: string) => undefined);
const zipEndMock = mock.fn(() => zipOutputStream.end('zip content'));
const yazlExports = {
  ZipFile: class {
    outputStream = zipOutputStream;
    addFile = zipAddFileMock;
    end = zipEndMock;
  }
};

// Type for the utils module exports
type UtilsModule = typeof import('./utils');

// An item schema without any setting
const emptySchema: OIBusObjectAttribute = {
  type: 'object',
  key: 'settings',
  translationKey: '',
  validators: [],
  attributes: [],
  enablingConditions: [],
  displayProperties: { visible: true, wrapInBox: false }
};

const baseGroup: SouthItemGroupEntity = {
  id: 'g1',
  name: 'Group 1',
  southId: 'south1',
  scanMode: testData.scanMode.list[0],
  startTimeOffset: null,
  endTimeOffset: null,
  maxReadInterval: null,
  readDelay: 0,
  recoveryStrategy: null,
  cachingStrategy: null,
  items: [],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
};

describe('Service utils', () => {
  let utils: UtilsModule;
  let OIBusError: typeof OIBusErrorType;
  let OIBusValidationError: typeof OIBusValidationErrorType;
  let logger: PinoLogger;

  before(() => {
    mockModule(nodeRequire, 'minimist', minimistExports);
    mockModule(nodeRequire, 'papaparse', csvExports);
    mockModule(nodeRequire, 'yazl', yazlExports);

    utils = reloadModule<UtilsModule>(nodeRequire, './utils');
    // OIBusError is a class from model/engine.model - import it directly
    OIBusError = nodeRequire('../model/engine.model').OIBusError;
    OIBusValidationError = nodeRequire('../model/types').OIBusValidationError;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    csvExports.unparse = mock.fn((_data?: unknown, _config?: unknown): string => 'csv content');
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('getCommandLineArguments', () => {
    let consoleSpy: Mock<typeof console.info>;

    beforeEach(() => {
      consoleSpy = mock.method(console, 'info', () => undefined);
    });

    it('should parse command line arguments without args', () => {
      minimistExports.mock.mockImplementation(() => ({}));
      const result = utils.getCommandLineArguments();

      assert.strictEqual(consoleSpy.mock.calls.length >= 1, true);
      const infoArg = consoleSpy.mock.calls[0].arguments[0] as string;
      assert.strictEqual(infoArg.includes('OIBus starting with the following arguments:'), true);
      assert.deepStrictEqual(result, {
        version: false,
        configFile: path.resolve('./'),
        ignoreIpFilters: false,
        ignoreRemoteUpdate: false,
        ignoreRemoteConfig: false,
        launcherVersion: '3.4.0'
      });
    });

    it('should parse command line arguments with args', () => {
      minimistExports.mock.mockImplementation(() => ({
        version: true,
        config: 'myConfig.json',
        ignoreIpFilters: true,
        ignoreRemoteUpdate: true,
        ignoreRemoteConfig: true,
        launcherVersion: '3.5.0'
      }));
      const result = utils.getCommandLineArguments();

      assert.strictEqual(consoleSpy.mock.calls.length >= 1, true);
      const infoArg = consoleSpy.mock.calls[0].arguments[0] as string;
      assert.strictEqual(infoArg.includes('OIBus starting with the following arguments:'), true);
      assert.deepStrictEqual(result, {
        version: true,
        configFile: path.resolve('myConfig.json'),
        ignoreIpFilters: true,
        ignoreRemoteUpdate: true,
        ignoreRemoteConfig: true,
        launcherVersion: '3.5.0'
      });
    });
  });

  describe('extractDiscoveryQuery', () => {
    it('should return the query of the discovery scope', () => {
      assert.strictEqual(utils.extractDiscoveryQuery({ query: 'SELECT * FROM points' }), 'SELECT * FROM points');
    });

    for (const scope of [{}, { query: 42 }, { query: '   ' }]) {
      it(`should reject a discovery scope without a non-empty query: ${JSON.stringify(scope)}`, () => {
        assert.throws(() => utils.extractDiscoveryQuery(scope), /discoveryScope.query is required/);
      });
    }
  });

  describe('delay', () => {
    it('should delay', async () => {
      // Just verify delay resolves without hanging (using a tiny timeout)
      await utils.delay(0);
    });
  });

  describe('generateIntervals', () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const chunk1End = '2020-01-01T01:00:00.000Z';
    const chunk2End = '2020-01-01T02:00:00.000Z';

    it('should return only one interval', () => {
      assert.deepStrictEqual(utils.generateIntervals(startTime, chunk1End, 3600), [{ start: startTime, end: chunk1End }]);
    });

    it('should return only one interval when max number of seconds is 0', () => {
      assert.deepStrictEqual(utils.generateIntervals(startTime, chunk1End, 0), [{ start: startTime, end: chunk1End }]);
    });

    it('should return three intervals', () => {
      const endTime = '2020-01-01T02:50:00.000Z';
      assert.deepStrictEqual(utils.generateIntervals(startTime, endTime, 3600), [
        { start: startTime, end: chunk1End },
        { start: chunk1End, end: chunk2End },
        { start: chunk2End, end: endTime }
      ]);
    });

    it('should return single interval when maxNumberOfSecondsInInterval is 0', () => {
      const endTime = '2020-01-02T00:00:00.000Z';
      assert.deepStrictEqual(utils.generateIntervals(startTime, endTime, 0), [{ start: startTime, end: endTime }]);
    });

    it('should reverse intervals for newest strategy', () => {
      const endTime = '2020-01-01T02:50:00.000Z';
      assert.deepStrictEqual(utils.generateIntervals(startTime, endTime, 3600, 'newest'), [
        { start: chunk2End, end: endTime },
        { start: chunk1End, end: chunk2End },
        { start: startTime, end: chunk1End }
      ]);
    });

    it('should return the single interval unchanged for newest strategy', () => {
      assert.deepStrictEqual(utils.generateIntervals(startTime, chunk1End, 3600, 'newest'), [{ start: startTime, end: chunk1End }]);
    });
  });

  describe('filesExists', () => {
    it('should properly check if a file does not exist', async () => {
      mock.method(fs, 'stat', () => {
        throw new Error('File does not exist');
      });

      assert.deepStrictEqual(await utils.filesExists('myConfigFile.json'), false);
    });

    it('should properly check if a file exists', async () => {
      mock.method(fs, 'stat', async () => null);

      assert.deepStrictEqual(await utils.filesExists('myConfigFile.json'), true);
    });
  });

  describe('createFolder', () => {
    it('should properly create folder when it exists', async () => {
      const mkdirMock = mock.method(fs, 'mkdir', async () => null);
      mock.method(fs, 'stat', async () => null);

      await utils.createFolder('myFolder');
      assert.strictEqual(mkdirMock.mock.calls.length, 0);
    });

    it('should properly create folder when it does not exist', async () => {
      const mkdirMock = mock.method(fs, 'mkdir', async () => null);
      mock.method(fs, 'stat', () => {
        throw new Error('File does not exist');
      });

      await utils.createFolder('myFolder');

      assert.strictEqual(mkdirMock.mock.calls.length, 1);
      assert.deepStrictEqual(mkdirMock.mock.calls[0].arguments, [path.resolve('myFolder'), { recursive: true }]);
    });
  });

  describe('compress', () => {
    it('should properly compress file', async () => {
      const source = new PassThrough();
      source.end('some data');
      const dest = new PassThrough();
      dest.resume(); // drain so pipeline finishes
      const createReadStreamMock = mock.method(fsSync, 'createReadStream', () => source);
      const createWriteStreamMock = mock.method(fsSync, 'createWriteStream', () => dest);
      const createGzipMock = mock.method(zlib, 'createGzip', () => new PassThrough());

      await utils.compress('myInputFile', 'myOutputFile');

      assert.strictEqual(createReadStreamMock.mock.calls.length, 1);
      assert.deepStrictEqual(createReadStreamMock.mock.calls[0].arguments, ['myInputFile']);
      assert.strictEqual(createWriteStreamMock.mock.calls.length, 1);
      assert.deepStrictEqual(createWriteStreamMock.mock.calls[0].arguments, ['myOutputFile']);
      assert.strictEqual(createGzipMock.mock.calls.length, 1);
    });

    it('should properly manage error when compressing file', async () => {
      const source = new PassThrough();
      mock.method(fsSync, 'createReadStream', () => source);
      mock.method(fsSync, 'createWriteStream', () => new PassThrough());
      mock.method(zlib, 'createGzip', () => new PassThrough());

      // Emit an error on the source after the pipeline has started
      setImmediate(() => source.destroy(new Error('compression error')));

      await assert.rejects(() => utils.compress('myInputFile', 'myOutputFile'), /compression error/);
    });
  });

  describe('unzip', () => {
    let tmpDir: string;

    const buildZip = async (files: Record<string, string>, directories: Array<string> = []): Promise<Buffer> => {
      const zip = new realYazl.ZipFile();
      for (const directory of directories) {
        zip.addEmptyDirectory(directory);
      }
      for (const [name, content] of Object.entries(files)) {
        zip.addBuffer(Buffer.from(content), name);
      }
      zip.end();
      const chunks: Array<Buffer> = [];
      for await (const chunk of zip.outputStream) {
        chunks.push(chunk as Buffer);
      }
      return Buffer.concat(chunks);
    };

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-unzip-spec-'));
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('should extract files and folders into the output folder', async () => {
      const zipPath = path.join(tmpDir, 'archive.zip');
      const output = path.join(tmpDir, 'update');
      await fs.writeFile(zipPath, await buildZip({ oibus: 'binary', 'sub/folder/file.txt': 'nested' }, ['empty/']));

      await utils.unzip(zipPath, output);

      assert.strictEqual(await fs.readFile(path.join(output, 'oibus'), 'utf8'), 'binary');
      assert.strictEqual(await fs.readFile(path.join(output, 'sub', 'folder', 'file.txt'), 'utf8'), 'nested');
      assert.ok((await fs.stat(path.join(output, 'empty'))).isDirectory());
    });

    it('should reject an entry escaping the output folder', async () => {
      const zipPath = path.join(tmpDir, 'archive.zip');
      // yazl refuses `..` in a name, so the entry name is patched in the archive (same length, outside the checksummed data)
      const archive = await buildZip({ 'xx/evil.txt': 'evil' });
      let index = archive.indexOf('xx/evil.txt');
      while (index !== -1) {
        archive.write('..', index);
        index = archive.indexOf('xx/evil.txt', index);
      }
      await fs.writeFile(zipPath, archive);

      await assert.rejects(() => utils.unzip(zipPath, path.join(tmpDir, 'update')), /invalid relative path: \.\.\/evil\.txt/);
      assert.strictEqual(fsSync.existsSync(path.join(tmpDir, 'evil.txt')), false);
    });

    it('should reject a file that is not a zip archive', async () => {
      const zipPath = path.join(tmpDir, 'archive.zip');
      await fs.writeFile(zipPath, 'not a zip');

      await assert.rejects(() => utils.unzip(zipPath, path.join(tmpDir, 'update')), /End of central directory record signature not found/);
    });
  });

  describe('zipFile', () => {
    it('should zip a single file under the given entry name', async () => {
      zipOutputStream = new PassThrough();
      const dest = new PassThrough();
      const written: Array<Buffer> = [];
      dest.on('data', chunk => written.push(chunk));
      const createWriteStreamMock = mock.method(fsSync, 'createWriteStream', () => dest);

      await utils.zipFile('myInputFile', 'entry.txt', 'myOutputFile.zip');

      assert.deepStrictEqual(zipAddFileMock.mock.calls[0].arguments, ['myInputFile', 'entry.txt']);
      assert.strictEqual(zipEndMock.mock.calls.length, 1);
      assert.deepStrictEqual(createWriteStreamMock.mock.calls[0].arguments, ['myOutputFile.zip']);
      assert.strictEqual(Buffer.concat(written).toString(), 'zip content');
    });
  });

  describe('generateRandomId', () => {
    for (const { label, size, expectedLength } of [
      { label: 'a standard size', size: undefined, expectedLength: 16 },
      { label: 'smaller size', size: 8, expectedLength: 8 },
      { label: 'bigger size', size: 32, expectedLength: 32 }
    ]) {
      it(`should properly generate a random ID with ${label}`, () => {
        assert.strictEqual(utils.generateRandomId(size).length, expectedLength);
      });
    }
  });

  describe('generateReplacementParameters', () => {
    it('should generate replacement parameters', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2021-01-01T00:00:00.000Z';
      const query = 'SELECT * FROM table WHERE timestamp > @StartTime && timestamp < @EndTime && @StartTime > timestamp';

      assert.deepStrictEqual(utils.generateReplacementParameters(query, startTime, endTime), [startTime, endTime, startTime]);
    });
  });

  describe('logQuery', () => {
    const query = 'SELECT * FROM logs WHERE timestamp > @StartTime AND timestamp < @EndTime';

    it('should properly log a query with string variables', () => {
      utils.logQuery(query, '2020-01-01T00:00:00.000Z', '2023-01-01T00:00:00.000Z', logger);

      assert.strictEqual(logger.info.mock.calls.length, 1);
      assert.deepStrictEqual(logger.info.mock.calls[0].arguments, [
        {},
        `Sending "${query}" with @StartTime = 2020-01-01T00:00:00.000Z @EndTime = 2023-01-01T00:00:00.000Z`
      ]);
    });

    it('should properly log a query with number variables', () => {
      utils.logQuery(
        query,
        DateTime.fromISO('2020-01-01T00:00:00.000Z').toMillis(),
        DateTime.fromISO('2023-01-01T00:00:00.000Z').toMillis(),
        logger
      );

      assert.strictEqual(logger.info.mock.calls.length, 1);
      assert.deepStrictEqual(logger.info.mock.calls[0].arguments, [
        {},
        `Sending "${query}" with @StartTime = 1577836800000 @EndTime = 1672531200000`
      ]);
    });

    it('should properly log a query without variable', () => {
      utils.logQuery('SELECT * FROM logs', '2020-01-01T00:00:00.000Z', '2023-01-01T00:00:00.000Z', logger);

      assert.strictEqual(logger.info.mock.calls.length, 1);
      assert.deepStrictEqual(logger.info.mock.calls[0].arguments, [{}, `Sending "SELECT * FROM logs"`]);
    });
  });

  describe('convertDateTimeFromInstant', () => {
    const testInstant = '2020-02-02T02:02:02.222Z';

    it('should return empty string', () => {
      assert.deepStrictEqual(utils.formatInstant(undefined, { type: 'unix-epoch-ms' }), '');
    });

    it('should return Number of ms', () => {
      const result = utils.formatInstant(testInstant, { type: 'unix-epoch-ms' });
      assert.deepStrictEqual(result, DateTime.fromISO(testInstant).toMillis());
      assert.deepStrictEqual(
        DateTime.fromMillis(result as number)
          .toUTC()
          .toISO(),
        '2020-02-02T02:02:02.222Z'
      );
    });

    it('should return Number of seconds', () => {
      const result = utils.formatInstant(testInstant, { type: 'unix-epoch' });
      assert.deepStrictEqual(result, Math.floor(DateTime.fromISO(testInstant).toMillis() / 1000));
      assert.deepStrictEqual(
        DateTime.fromMillis((result as number) * 1000)
          .toUTC()
          .toISO(),
        '2020-02-02T02:02:02.000Z'
      );
    });

    for (const { label, locale, format, expected } of [
      { label: 'with correct timezone', locale: 'en-US', format: 'yyyy-MM-dd HH:mm:ss.SSS', expected: '2020-02-02 11:02:02.222' },
      { label: 'with correct timezone for locale en-US', locale: 'en-US', format: 'dd-MMM-yy HH:mm:ss', expected: '02-Feb-20 11:02:02' },
      { label: 'with correct timezone for locale fr-FR', locale: 'fr-FR', format: 'dd-MMM-yy HH:mm:ss', expected: '02-févr.-20 11:02:02' }
    ]) {
      it(`should return a formatted String ${label}`, () => {
        const result = utils.formatInstant(testInstant, { type: 'string', timezone: 'Asia/Tokyo', format, locale });
        assert.deepStrictEqual(result, DateTime.fromISO(testInstant, { zone: 'Asia/Tokyo' }).toFormat(format, { locale }));
        assert.deepStrictEqual(result, expected);
      });
    }

    for (const { label, type, expected } of [
      { label: 'ISO String from ISO String', type: 'iso-string', expected: testInstant },
      { label: 'Date', type: 'date', expected: '2020-02-02' },
      { label: 'small-date-time', type: 'small-date-time', expected: '2020-02-02 11:02:02' },
      { label: 'DateTime', type: 'date-time', expected: '2020-02-02 11:02:02.222' }
    ] satisfies Array<{ label: string; type: DateTimeType; expected: string }>) {
      it(`should return a formatted ${label}`, () => {
        assert.deepStrictEqual(utils.formatInstant(testInstant, { type, timezone: 'Asia/Tokyo' }), expected);
      });
    }

    it('should return an ISO String from Date with correct timezone', () => {
      const result = utils.formatInstant(testInstant, { type: 'date-time-offset', timezone: 'Asia/Tokyo' });
      assert.deepStrictEqual(result, DateTime.fromISO(testInstant, { zone: 'Asia/Tokyo' }).toUTC().toISO()!);
    });
  });

  describe('convertDelimiter', () => {
    it('should convert to csv delimiter', () => {
      assert.deepStrictEqual(utils.convertDelimiter('NON_BREAKING_SPACE'), '\u00a0');
      assert.deepStrictEqual(utils.convertDelimiter('COLON'), ':');
      assert.deepStrictEqual(utils.convertDelimiter('COMMA'), ',');
      assert.deepStrictEqual(utils.convertDelimiter('DOT'), '.');
      assert.deepStrictEqual(utils.convertDelimiter('SLASH'), '/');
      assert.deepStrictEqual(utils.convertDelimiter('PIPE'), '|');
      assert.deepStrictEqual(utils.convertDelimiter('SEMI_COLON'), ';');
      assert.deepStrictEqual(utils.convertDelimiter('TAB'), '\t');
    });
  });

  describe('parseCsvImport', () => {
    it('should parse the rows with the entered delimiter', () => {
      assert.deepStrictEqual(utils.parseCsvImport('name;value\na;1\n\nb;2', ';'), [
        { name: 'a', value: '1' },
        { name: 'b', value: '2' }
      ]);
    });

    it('should accept a single column file whatever the delimiter', () => {
      assert.deepStrictEqual(utils.parseCsvImport('name\na\nb', ';'), [{ name: 'a' }, { name: 'b' }]);
    });

    it('should accept a file using a delimiter that papaparse cannot detect', () => {
      assert.deepStrictEqual(utils.parseCsvImport('name/value\na/1', '/'), [{ name: 'a', value: '1' }]);
    });

    for (const { fileDelimiter, delimiter } of [
      { fileDelimiter: ';', delimiter: ',' },
      { fileDelimiter: ',', delimiter: ';' },
      { fileDelimiter: '\t', delimiter: '|' }
    ]) {
      it(`should throw when the file uses "${fileDelimiter}" instead of "${delimiter}"`, () => {
        assert.throws(
          () => utils.parseCsvImport(`name${fileDelimiter}value\na${fileDelimiter}1`, delimiter),
          new OIBusValidationError(`The entered delimiter "${delimiter}" does not correspond to the file delimiter "${fileDelimiter}"`)
        );
      });
    }

    it('should throw when the entered delimiter cannot be a delimiter', () => {
      // papaparse guesses the delimiter of the file instead
      assert.throws(
        () => utils.parseCsvImport('name;value\na;1', '"'),
        new OIBusValidationError('The entered delimiter """ does not correspond to the file delimiter ";"')
      );
    });
  });

  describe('convertQuoteChar', () => {
    it('should convert all quote char options', () => {
      assert.deepStrictEqual(utils.convertQuoteChar('DOUBLE_QUOTE'), '"');
      assert.deepStrictEqual(utils.convertQuoteChar('SINGLE_QUOTE'), "'");
      assert.deepStrictEqual(utils.convertQuoteChar('NONE'), '');
    });
  });

  describe('convertEscapeChar', () => {
    it('should convert all escape char options', () => {
      assert.deepStrictEqual(utils.convertEscapeChar('BACKSLASH'), '\\');
      assert.deepStrictEqual(utils.convertEscapeChar('DOUBLE_QUOTE'), '"');
    });
  });

  describe('convertNewline', () => {
    it('should convert all newline options', () => {
      assert.deepStrictEqual(utils.convertNewline('CRLF'), '\r\n');
      assert.deepStrictEqual(utils.convertNewline('LF'), '\n');
      assert.deepStrictEqual(utils.convertNewline('CR'), '\r');
      assert.deepStrictEqual(utils.convertNewline('DEFAULT'), '');
    });
  });

  describe('convertDateTimeToInstant', () => {
    beforeEach(() => {
      mock.method(DateTime, 'fromJSDate', (date: Date) => {
        if (date instanceof Date && !isNaN(date.getTime())) {
          return DateTime.fromISO(testData.constants.dates.FAKE_NOW);
        }
        throw new Error('Invalid date');
      });
    });

    describe('when no type is provided', () => {
      it('should return empty string if value is null', () => {
        const result = utils.convertDateTimeToInstant(null, {});
        assert.deepStrictEqual(result, '');
      });

      it('should return the input if it is a valid ISO string', () => {
        const result = utils.convertDateTimeToInstant('2023-01-01T00:00:00Z', {});
        assert.strictEqual(result, '2023-01-01T00:00:00Z');
      });

      it('should throw an error if input is not a valid ISO string', () => {
        assert.throws(
          () => utils.convertDateTimeToInstant('not-an-iso-string', {}),
          /The value must be a valid ISO string if no type is provided: "not-an-iso-string"/
        );
        assert.throws(() => utils.convertDateTimeToInstant(123, {}), /The value must be a valid ISO string if no type is provided: "123"/);
        assert.throws(
          () => utils.convertDateTimeToInstant(new Date(), {}),
          /The value must be a valid ISO string if no type is provided: "/
        );
      });
    });

    describe('unix-epoch', () => {
      it('should convert a number (seconds since epoch) to ISO string', () => {
        const result = utils.convertDateTimeToInstant(1672531200, { type: 'unix-epoch' });
        assert.strictEqual(result, '2023-01-01T00:00:00.000Z');
      });

      it('should convert a numeric string (seconds since epoch) to ISO string', () => {
        const result = utils.convertDateTimeToInstant('1672531200', { type: 'unix-epoch' });
        assert.strictEqual(result, '2023-01-01T00:00:00.000Z');
      });

      it('should throw an error if input is not a number or numeric string', () => {
        assert.throws(
          () => utils.convertDateTimeToInstant(new Date(), { type: 'unix-epoch' }),
          /The value must be a number or numeric string for type "unix-epoch": "/
        );
        assert.throws(
          () => utils.convertDateTimeToInstant('not-a-number', { type: 'unix-epoch' }),
          /Failed to convert "not-a-number" to Instant for type "unix-epoch"/
        );
      });
    });

    describe('unix-epoch-ms', () => {
      it('should convert a number (milliseconds since epoch) to ISO string', () => {
        const result = utils.convertDateTimeToInstant(1672531200000, { type: 'unix-epoch-ms' });
        assert.strictEqual(result, '2023-01-01T00:00:00.000Z');
      });

      it('should convert a numeric string (milliseconds since epoch) to ISO string', () => {
        const result = utils.convertDateTimeToInstant('1672531200000', { type: 'unix-epoch-ms' });
        assert.strictEqual(result, '2023-01-01T00:00:00.000Z');
      });

      it('should throw an error if input is not a number or numeric string', () => {
        assert.throws(
          () => utils.convertDateTimeToInstant(new Date(), { type: 'unix-epoch-ms' }),
          /The value must be a number or numeric string for type "unix-epoch-ms": "/
        );
        assert.throws(
          () => utils.convertDateTimeToInstant('not-a-number', { type: 'unix-epoch-ms' }),
          /Failed to convert "not-a-number" to Instant for type "unix-epoch-ms"/
        );
      });
    });

    describe('iso-string', () => {
      it('should convert a valid ISO string to ISO string', () => {
        const result = utils.convertDateTimeToInstant('2023-01-01T12:00:00+02:00', { type: 'iso-string' });
        assert.strictEqual(result, '2023-01-01T10:00:00.000Z');
      });

      it('should throw an error if input is not a string', () => {
        assert.throws(
          () => utils.convertDateTimeToInstant(123, { type: 'iso-string' }),
          /The value must be a string for type "iso-string": "123"/
        );
        assert.throws(
          () => utils.convertDateTimeToInstant(new Date(), { type: 'iso-string' }),
          /The value must be a string for type "iso-string": "/
        );
      });
    });

    describe('string', () => {
      it('should convert a string with format to ISO string', () => {
        const result = utils.convertDateTimeToInstant('01/01/2023', {
          type: 'string',
          format: 'MM/dd/yyyy',
          timezone: 'Europe/Paris'
        });
        assert.match(result, /2022-12-31T.*Z/);
      });

      it('should throw an error if input is not a string', () => {
        assert.throws(
          () => utils.convertDateTimeToInstant(123, { type: 'string', format: 'MM/dd/yyyy' }),
          /The value must be a string and format must be provided for type "string": "123"/
        );
      });

      it('should throw an error if format is not provided', () => {
        assert.throws(
          () => utils.convertDateTimeToInstant('01/01/2023', { type: 'string' }),
          /The value must be a string and format must be provided for type "string": "01\/01\/2023"/
        );
      });

      it('should throw an error if string cannot be parsed with the given format', () => {
        assert.throws(
          () =>
            utils.convertDateTimeToInstant('not-a-date', {
              type: 'string',
              format: 'MM/dd/yyyy'
            }),
          /Failed to convert "not-a-date" to Instant for type "string"/
        );
      });
    });

    describe('Date types (date, small-date-time, date-time, date-time-2)', () => {
      const dateTypes: Array<'date' | 'small-date-time' | 'date-time' | 'date-time-2'> = [
        'date',
        'small-date-time',
        'date-time',
        'date-time-2'
      ];

      for (const type of dateTypes) {
        describe(type, () => {
          it('should convert a Date object to ISO string', () => {
            const result = utils.convertDateTimeToInstant(new Date(testData.constants.dates.FAKE_NOW), { type, timezone: 'UTC' });
            assert.strictEqual(result, testData.constants.dates.FAKE_NOW);
          });

          it('should convert a Date object to ISO string with timezone', () => {
            const result = utils.convertDateTimeToInstant(new Date(testData.constants.dates.FAKE_NOW), {
              type,
              timezone: 'America/New_York'
            });
            assert.strictEqual(result, '2021-01-02T05:00:00.000Z');
          });

          it('should throw an error if input is not a Date object', () => {
            assert.throws(
              () => utils.convertDateTimeToInstant('not-a-date', { type }),
              new RegExp(`The value must be a Date object for type "${type}": "not-a-date"`)
            );
            assert.throws(
              () => utils.convertDateTimeToInstant(123, { type }),
              new RegExp(`The value must be a Date object for type "${type}": "123"`)
            );
          });
        });
      }
    });

    describe('date-time-offset, timestamp, timestamptz', () => {
      const dateTypes: Array<'date-time-offset' | 'timestamp' | 'timestamptz'> = ['date-time-offset', 'timestamp', 'timestamptz'];

      for (const type of dateTypes) {
        describe(type, () => {
          it('should convert a Date object to ISO string', () => {
            const result = utils.convertDateTimeToInstant(new Date(testData.constants.dates.FAKE_NOW), { type, timezone: 'UTC' });
            assert.strictEqual(result, testData.constants.dates.FAKE_NOW);
          });

          it('should throw an error if input is not a Date object', () => {
            assert.throws(
              () => utils.convertDateTimeToInstant('not-a-date', { type }),
              new RegExp(`The value must be a Date object for type "${type}": "not-a-date"`)
            );
            assert.throws(
              () => utils.convertDateTimeToInstant(123, { type }),
              new RegExp(`The value must be a Date object for type "${type}": "123"`)
            );
          });
        });
      }

      describe('unsupported type', () => {
        it('should throw an error for unsupported types', () => {
          assert.throws(
            () =>
              utils.convertDateTimeToInstant(new Date(), {
                type: 'unsupported-type' as unknown as DateTimeType
              }),
            /Unsupported DateTimeType: "unsupported-type"/
          );
        });
      });
    });
  });

  describe('convertDateTime', () => {
    it('should convert a valid ISO string to ISO string', () => {
      const result = utils.convertDateTime('2023-01-01T12:00:00+02:00', { type: 'iso-string' }, { type: 'iso-string' });
      assert.strictEqual(result, '2023-01-01T10:00:00.000Z');
    });
  });

  describe('formatQueryParams', () => {
    it('should correctly return void string when there is no query params', () => {
      const result = utils.formatQueryParams('2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z', []);
      assert.deepStrictEqual(result, {});
    });

    it('should correctly format query params with ISO date string', () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2021-01-01T00:00:00.000Z';
      const queryParams = [
        { key: 'start', value: '@StartTime' },
        { key: 'end', value: '@EndTime' },
        { key: 'anotherParam', value: 'anotherQueryParam' }
      ];

      const result = utils.formatQueryParams(startTime, endTime, queryParams);
      assert.deepStrictEqual(result, {
        anotherParam: 'anotherQueryParam',
        end: '2021-01-01T00:00:00.000Z',
        start: '2020-01-01T00:00:00.000Z'
      });
    });

    it('should return empty object for no params', () => {
      const result = utils.formatQueryParams('start', 'end', []);
      assert.deepStrictEqual(result, {});
    });

    it('should substitute @StartTime', () => {
      const result = utils.formatQueryParams('2020-01-01', '2021-01-01', [{ key: 'from', value: '@StartTime' }]);
      assert.deepStrictEqual(result, { from: '2020-01-01' });
    });

    it('should substitute @EndTime', () => {
      const result = utils.formatQueryParams('2020-01-01', '2021-01-01', [{ key: 'to', value: '@EndTime' }]);
      assert.deepStrictEqual(result, { to: '2021-01-01' });
    });

    it('should pass through default param values', () => {
      const result = utils.formatQueryParams('s', 'e', [{ key: 'k', value: 'literal' }]);
      assert.deepStrictEqual(result, { k: 'literal' });
    });

    it('should turn a repeated key into an array on the second occurrence', () => {
      const result = utils.formatQueryParams('s', 'e', [
        { key: 'tag', value: 'a' },
        { key: 'tag', value: 'b' }
      ]);
      assert.deepStrictEqual(result, { tag: ['a', 'b'] });
    });

    it('should keep appending to the array for further occurrences of the same key', () => {
      const result = utils.formatQueryParams('s', 'e', [
        { key: 'tag', value: 'a' },
        { key: 'tag', value: 'b' },
        { key: 'tag', value: 'c' }
      ]);
      assert.deepStrictEqual(result, { tag: ['a', 'b', 'c'] });
    });

    it('should not mix up different keys when one is repeated', () => {
      const result = utils.formatQueryParams('s', 'e', [
        { key: 'tag', value: 'a' },
        { key: 'other', value: 'x' },
        { key: 'tag', value: 'b' }
      ]);
      assert.deepStrictEqual(result, { tag: ['a', 'b'], other: 'x' });
    });
  });

  it('should get OIBus info', () => {
    const expectedResult: OIBusInfo = {
      architecture: process.arch,
      binaryDirectory: process.execPath,
      dataDirectory: process.cwd(),
      hostname: os.hostname(),
      operatingSystem: `${os.type()} ${os.release()}`,
      processId: process.pid.toString(),
      version: '3.3.3',
      launcherVersion: '3.5.0',
      oibusId: 'id',
      oibusName: 'name',
      platform: utils.getPlatformFromOsType(os.type()),
      ignoreIpFilters: false,
      ignoreRemoteUpdate: false
    };
    const result = utils.getOIBusInfo({
      id: 'id',
      general: { name: 'name' },
      version: '3.3.3',
      launcherVersion: '3.5.0'
    } as EngineSettingsDTO);
    assert.deepStrictEqual(result, expectedResult);
  });

  it('should get OIBus info with ignore flags set', () => {
    const info = utils.getOIBusInfo(
      { id: 'id', general: { name: 'name' }, version: '3.3.3', launcherVersion: '3.5.0' } as EngineSettingsDTO,
      true,
      true
    );
    assert.strictEqual(info.ignoreIpFilters, true);
    assert.strictEqual(info.ignoreRemoteUpdate, true);
  });

  it('should return OIBus info including architecture and os', () => {
    const settings = { id: 'id', general: { name: 'test' }, version: '1.0.0', launcherVersion: '1.0.0' } as EngineSettingsDTO;
    const info = utils.getOIBusInfo(settings);
    assert.strictEqual(info.oibusId, 'id');
    assert.strictEqual(info.oibusName, 'test');
    assert.strictEqual(info.architecture, process.arch);
    assert.strictEqual(info.operatingSystem, `${os.type()} ${os.release()}`);
  });

  it('should return proper platform from OS type', () => {
    assert.deepStrictEqual(utils.getPlatformFromOsType('Linux'), 'linux');
    assert.deepStrictEqual(utils.getPlatformFromOsType('Darwin'), 'macos');
    assert.deepStrictEqual(utils.getPlatformFromOsType('Windows_NT'), 'windows');
    assert.deepStrictEqual(utils.getPlatformFromOsType('unknown'), 'unknown');
  });

  it('should return the current platform from os type', () => {
    mock.method(os, 'type', () => 'Windows_NT');
    assert.strictEqual(utils.getCurrentPlatform(), 'windows');
    mock.method(os, 'type', () => 'Linux');
    assert.strictEqual(utils.getCurrentPlatform(), 'linux');
  });

  describe('validateCronExpression', () => {
    it('should properly validate a cron expression (every second)', () => {
      mock.method(Date, 'now', () => new Date(testData.constants.dates.FAKE_NOW).getTime());
      const result = utils.validateCronExpression('* * * * * *');
      const expectedResult = {
        isValid: true,
        errorMessage: '',
        humanReadableForm: 'Every second, every minute, every hour, every day',
        nextExecutions: ['2021-01-02T00:00:01.000Z', '2021-01-02T00:00:02.000Z', '2021-01-02T00:00:03.000Z']
      };
      assert.deepStrictEqual(result, expectedResult);
    });

    it('should properly validate a cron expression', () => {
      mock.method(Date, 'now', () => new Date(testData.constants.dates.FAKE_NOW).getTime());
      const result = utils.validateCronExpression('0 */10 * * * *');
      const expectedResult = {
        isValid: true,
        errorMessage: '',
        humanReadableForm: 'Every 10 minutes, every hour, every day',
        nextExecutions: ['2021-01-02T00:10:00.000Z', '2021-01-02T00:20:00.000Z', '2021-01-02T00:30:00.000Z']
      };
      assert.deepStrictEqual(result, expectedResult);
    });

    it('should throw an error for too many fields', () => {
      assert.deepStrictEqual(utils.validateCronExpression('* * * * * * 2024'), {
        isValid: false,
        errorMessage: 'Cron Expression: Too many fields. Only seconds, minutes, hours, day of month, month and day of week are supported.',
        humanReadableForm: '',
        nextExecutions: []
      });
    });

    it('should throw an error for non standard characters', () => {
      assert.deepStrictEqual(utils.validateCronExpression('* * * * 5L'), {
        isValid: false,
        errorMessage: 'Cron Expression: Non-standard characters: L',
        humanReadableForm: '',
        nextExecutions: []
      });

      assert.deepStrictEqual(utils.validateCronExpression('* * * W * *'), {
        isValid: false,
        errorMessage: 'Cron Expression: Non-standard characters: W',
        humanReadableForm: '',
        nextExecutions: []
      });

      assert.deepStrictEqual(utils.validateCronExpression('* * * * * 5#3'), {
        isValid: false,
        errorMessage: 'Cron Expression: Non-standard characters: #',
        humanReadableForm: '',
        nextExecutions: []
      });

      assert.deepStrictEqual(utils.validateCronExpression('? ? * * * *'), {
        isValid: false,
        errorMessage: 'Cron Expression: Non-standard characters: ?',
        humanReadableForm: '',
        nextExecutions: []
      });

      assert.deepStrictEqual(utils.validateCronExpression('H * * * *'), {
        isValid: false,
        errorMessage: 'Cron Expression: Non-standard characters: H',
        humanReadableForm: '',
        nextExecutions: []
      });
    });

    it('should throw an error for invalid cron expression caught by cronstrue', () => {
      assert.deepStrictEqual(utils.validateCronExpression('0 35 10 19 01'), {
        isValid: false,
        errorMessage: 'Cron Expression: Hours part must be >= 0 and <= 23',
        humanReadableForm: '',
        nextExecutions: []
      });
      assert.deepStrictEqual(utils.validateCronExpression('0 23 10 19 01'), {
        isValid: false,
        errorMessage: 'Cron Expression: Month part must be >= 1 and <= 12',
        humanReadableForm: '',
        nextExecutions: []
      });
      assert.deepStrictEqual(utils.validateCronExpression('0 23 10 12 8'), {
        isValid: false,
        errorMessage: 'Cron Expression: DOW part must be >= 0 and <= 6',
        humanReadableForm: '',
        nextExecutions: []
      });
    });

    it('should throw an error for invalid cron expression caught by cron-parser', () => {
      assert.deepStrictEqual(utils.validateCronExpression('0 23 10 12 6/-'), {
        isValid: false,
        errorMessage: 'Cron Expression: Constraint error, cannot repeat at every NaN time.',
        humanReadableForm: '',
        nextExecutions: []
      });
      assert.deepStrictEqual(utils.validateCronExpression('0 23 10-1 12 6/1'), {
        isValid: false,
        errorMessage: 'Cron Expression: Invalid range: 10-1, min(10) > max(1)',
        humanReadableForm: '',
        nextExecutions: []
      });
    });

    it('should catch unexpected errors', () => {
      mock.method(cronstrue, 'toString', () => {
        throw null;
      });
      assert.deepStrictEqual(utils.validateCronExpression('* * * * * *'), {
        isValid: false,
        errorMessage: 'Cron Expression: Invalid',
        humanReadableForm: '',
        nextExecutions: []
      });
    });
  });

  describe('checkScanMode', () => {
    it('should properly check scan mode', () => {
      assert.deepStrictEqual(utils.checkScanMode(testData.scanMode.list, 'scanModeId1', null), testData.scanMode.list[0]);
      assert.throws(() => utils.checkScanMode(testData.scanMode.list, null, null), /Scan mode not specified/);
      assert.throws(
        () => utils.checkScanMode(testData.scanMode.list, null, 'bad scan mode name'),
        /Scan mode "bad scan mode name" not found/
      );
      assert.deepStrictEqual(utils.checkScanMode(testData.scanMode.list, null, testData.scanMode.list[0].name), testData.scanMode.list[0]);
    });
  });

  describe('checkGroups', () => {
    const groups: Array<SouthItemGroupEntity> = [
      { ...baseGroup, id: 'group1', name: 'Group 1' },
      { ...baseGroup, id: 'group2', name: 'Group 2' }
    ];

    it('should throw an error when neither groupId nor groupName are specified', () => {
      assert.throws(() => utils.checkGroups(groups, null, null), /Group not specified/);
    });

    it('should return a light entity with only the id when groupId starts with "temp_"', () => {
      assert.deepStrictEqual(utils.checkGroups(groups, 'temp_new-group', null), { id: 'temp_new-group' });
    });

    it('should find and return the group by id', () => {
      assert.deepStrictEqual(utils.checkGroups(groups, 'group1', null), groups[0]);
    });

    it('should find and return the group by name', () => {
      assert.deepStrictEqual(utils.checkGroups(groups, null, 'Group 2'), groups[1]);
    });

    it('should throw a not found error when the group id cannot be found', () => {
      assert.throws(() => utils.checkGroups(groups, 'unknown-id', null), /Group "unknown-id" not found/);
    });

    it('should throw a not found error when the group name cannot be found', () => {
      assert.throws(() => utils.checkGroups(groups, null, 'unknown-name'), /Group "unknown-name" not found/);
    });
  });

  describe('itemToFlattenedCSV', () => {
    // Partial DTOs: only the fields read by itemToFlattenedCSV are given
    const scanMode = { id: 'sm1', name: 'Every 10s', cron: '*/10 * * * * *', createdBy: '', updatedBy: '', createdAt: '', updatedAt: '' };
    const historianGroup = (scanModeDTO: object) => ({
      id: 'group1',
      standardSettings: { name: 'My Group', scanMode: scanModeDTO },
      historySettings: { maxReadInterval: 3600, readDelay: 200, startTimeOffset: 5, endTimeOffset: 6, recoveryStrategy: 'oldest' },
      createdBy: { id: '', friendlyName: '' },
      updatedBy: { id: '', friendlyName: '' },
      createdAt: '',
      updatedAt: ''
    });
    const baseItem = {
      id: 'item1',
      connectorId: 'conn1',
      name: 'Item 1',
      enabled: true,
      scanModeId: 'sm1',
      scanMode,
      group: null,
      syncWithGroup: false,
      maxReadInterval: 3600,
      readDelay: 200,
      startTimeOffset: 0,
      endTimeOffset: null,
      settings: { address: '40001' }
    } as unknown as SouthConnectorItemDTO;
    const unparsedData = () => csvExports.unparse.mock.calls[0].arguments[0] as Array<Record<string, unknown>>;

    it('should properly convert items into csv', () => {
      assert.deepStrictEqual(
        utils.itemToFlattenedCSV(
          [
            ...testData.south.list[2].items.map(item => ({ ...item, settings: { ...item.settings, objectSettings: {} } })),
            {
              ...testData.south.list[2].items[0]
            }
          ] as unknown as Array<SouthConnectorItemDTO | HistoryQueryItemDTO>,
          ',',
          emptySchema
        ),
        'csv content'
      );
    });

    it('should use the group scan mode and historian settings when the item is synced with its group', () => {
      const scanModeEntry = testData.scanMode.list[0];
      const group = historianGroup({
        ...scanModeEntry,
        createdBy: { id: scanModeEntry.createdBy, friendlyName: scanModeEntry.createdBy },
        updatedBy: { id: scanModeEntry.updatedBy, friendlyName: scanModeEntry.updatedBy }
      });
      const item = {
        ...testData.south.list[2].items[0],
        group,
        syncWithGroup: true,
        // The item's own scan mode and historian settings differ from the group's on purpose:
        // the group's values must win since the item is synced with it.
        scanMode: testData.scanMode.list[1],
        maxReadInterval: 1,
        readDelay: 1,
        startTimeOffset: 1,
        endTimeOffset: 1,
        recoveryStrategy: 'newest'
      } as unknown as SouthConnectorItemDTO;

      utils.itemToFlattenedCSV([item], ',', emptySchema);

      assert.strictEqual(csvExports.unparse.mock.calls.length, 1);
      const capturedData = unparsedData();
      assert.strictEqual(capturedData[0].scanMode, scanModeEntry.name);
      assert.strictEqual(capturedData[0].group, group.standardSettings.name);
      assert.strictEqual(capturedData[0].maxReadInterval, group.historySettings.maxReadInterval);
      assert.strictEqual(capturedData[0].readDelay, group.historySettings.readDelay);
      assert.strictEqual(capturedData[0].startTimeOffset, group.historySettings.startTimeOffset);
      assert.strictEqual(capturedData[0].endTimeOffset, group.historySettings.endTimeOffset);
      assert.strictEqual(capturedData[0].recoveryStrategy, group.historySettings.recoveryStrategy);
    });

    it('should use the group scan mode but keep the item historian settings when the item is not synced with its group', () => {
      const item = {
        ...testData.south.list[2].items[0],
        group: historianGroup({ ...scanMode, id: 'groupScanModeId', name: 'Group Scan Mode', cron: '' }),
        syncWithGroup: false,
        scanMode: testData.scanMode.list[1],
        maxReadInterval: 42,
        readDelay: 43,
        startTimeOffset: 44,
        endTimeOffset: 45,
        recoveryStrategy: 'newest'
      } as unknown as SouthConnectorItemDTO;

      utils.itemToFlattenedCSV([item], ',', emptySchema);

      const capturedData = unparsedData();
      assert.strictEqual(capturedData[0].scanMode, 'Group Scan Mode');
      assert.strictEqual(capturedData[0].maxReadInterval, 42);
      assert.strictEqual(capturedData[0].readDelay, 43);
      assert.strictEqual(capturedData[0].startTimeOffset, 44);
      assert.strictEqual(capturedData[0].endTimeOffset, 45);
      assert.strictEqual(capturedData[0].recoveryStrategy, 'newest');
    });

    it('should flatten items with scanModes', () => {
      assert.strictEqual(utils.itemToFlattenedCSV([baseItem], ',', emptySchema), 'csv content');
      assert.strictEqual(csvExports.unparse.mock.calls.length, 1);
      assert.strictEqual(unparsedData()[0].scanMode, scanMode.name);
      assert.strictEqual(unparsedData()[0].group, '');
    });

    it('should flatten items without scanModes', () => {
      const itemWithoutScanMode: SouthConnectorItemDTO = { ...baseItem, scanMode: null };

      assert.strictEqual(utils.itemToFlattenedCSV([itemWithoutScanMode], ',', emptySchema), 'csv content');
      assert.strictEqual(csvExports.unparse.mock.calls.length, 1);
      assert.strictEqual(unparsedData()[0].scanMode, '');
      assert.strictEqual(unparsedData()[0].group, '');
    });

    it('should flatten history query items with isHistoryQuery=true', () => {
      const historyItem = {
        id: 'hItem1',
        connectorId: 'conn1',
        name: 'History Item',
        enabled: true,
        settings: { address: '40001' }
      } as unknown as HistoryQueryItemDTO;
      assert.strictEqual(utils.itemToFlattenedCSV([historyItem], ',', emptySchema, true), 'csv content');
      assert.strictEqual(csvExports.unparse.mock.calls.length, 1);
    });

    it('should not use group historian settings when the item is not synced with its group, even if its own fields are null', () => {
      const itemWithNulls = {
        ...baseItem,
        maxReadInterval: null,
        readDelay: null,
        recoveryStrategy: null,
        group: {
          id: 'g1',
          standardSettings: { name: 'Group A', scanMode: { id: 'sm2', name: 'Group Scan Mode', cron: '' } },
          historySettings: {
            maxReadInterval: 9999,
            readDelay: 500,
            startTimeOffset: 10,
            endTimeOffset: null,
            recoveryStrategy: 'oldest'
          }
        }
      } as unknown as SouthConnectorItemDTO;
      utils.itemToFlattenedCSV([itemWithNulls], ',', emptySchema);

      assert.strictEqual(csvExports.unparse.mock.calls.length, 1);
      const capturedData = unparsedData();
      assert.strictEqual(capturedData[0].scanMode, 'Group Scan Mode');
      assert.strictEqual(capturedData[0].maxReadInterval, null);
      assert.strictEqual(capturedData[0].readDelay, null);
      assert.strictEqual(capturedData[0].startTimeOffset, 0);
      assert.strictEqual(capturedData[0].endTimeOffset, null);
      assert.strictEqual(capturedData[0].recoveryStrategy, null);
    });

    it('should default scanMode to an empty string when the item has no group and no scan mode', () => {
      utils.itemToFlattenedCSV([{ ...baseItem, scanMode: null }], ',', emptySchema);

      const capturedData = unparsedData();
      assert.strictEqual(capturedData[0].scanMode, '');
      assert.strictEqual(capturedData[0].group, '');
    });

    it('should flatten settings declared in the schema, stringifying object values', () => {
      const historyItem = {
        id: 'item1',
        connectorId: 'conn1',
        name: 'Item 1',
        enabled: true,
        settings: {
          address: '40001',
          objectSetting: { nested: 'value' }
        }
      } as unknown as HistoryQueryItemDTO;
      // partial attributes: only the keys and types are read
      const schema = {
        attributes: [
          {
            key: 'settings',
            type: 'object',
            attributes: [
              { key: 'address', type: 'string' },
              { key: 'objectSetting', type: 'object' }
            ]
          }
        ]
      } as unknown as OIBusObjectAttribute;

      utils.itemToFlattenedCSV([historyItem], ',', schema, true);

      assert.strictEqual(csvExports.unparse.mock.calls.length, 1);
      const capturedData = unparsedData();
      assert.strictEqual(capturedData[0].settings_address, '40001');
      assert.strictEqual(capturedData[0].settings_objectSetting, JSON.stringify({ nested: 'value' }));
      const capturedColumns = (csvExports.unparse.mock.calls[0].arguments[1] as { columns: Array<string> }).columns;
      assert.ok(capturedColumns.includes('settings_address'));
      assert.ok(capturedColumns.includes('settings_objectSetting'));
    });
  });

  describe('stringToBoolean', () => {
    it('should properly convert string to boolean', () => {
      assert.deepStrictEqual(utils.stringToBoolean('true'), true);
      assert.deepStrictEqual(utils.stringToBoolean('True'), true);
      assert.deepStrictEqual(utils.stringToBoolean('TRUE'), true);
      assert.deepStrictEqual(utils.stringToBoolean('1'), true);
      assert.deepStrictEqual(utils.stringToBoolean('false'), false);
      assert.deepStrictEqual(utils.stringToBoolean('False'), false);
      assert.deepStrictEqual(utils.stringToBoolean('FALSE'), false);
      assert.deepStrictEqual(utils.stringToBoolean('0'), false);
      assert.deepStrictEqual(utils.stringToBoolean('99'), false);
    });
  });

  describe('testIPOnFilter', () => {
    it('should return false for an empty filter list', () => {
      assert.deepStrictEqual(utils.testIPOnFilter([], '192.168.1.1'), false);
    });

    it('should cache compiled regexes across repeated calls (perf contract)', () => {
      // Sanity: repeated calls against the same filter set must keep working —
      // protects against any future regression that drops the regex cache.
      const ipFilters = ['10.0.*.*', '192.168.1.*'];
      for (let i = 0; i < 50; i++) {
        assert.strictEqual(utils.testIPOnFilter(ipFilters, '10.0.0.1'), true);
        assert.strictEqual(utils.testIPOnFilter(ipFilters, '192.168.1.42'), true);
        assert.strictEqual(utils.testIPOnFilter(ipFilters, '172.16.0.1'), false);
      }
    });

    it('should return true for a matching IPv4 address', () => {
      assert.deepStrictEqual(utils.testIPOnFilter(['192.168.1.*'], '192.168.1.1'), true);
      assert.deepStrictEqual(utils.testIPOnFilter(['192.168.*.*'], '192.168.1.1'), true);
    });

    it('should return true for a matching IPv6-mapped IPv4 address', () => {
      const ipFilters = ['192.168.1.*'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '::ffff:192.168.1.1'), true);
    });

    it('should return false for a non-matching IPv4 address', () => {
      const ipFilters = ['192.168.2.*'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '192.168.1.1'), false);
    });

    it('should return false for a non-matching IPv6-mapped IPv4 address', () => {
      const ipFilters = ['192.168.2.*'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '::ffff:192.168.1.1'), false);
    });

    it('should return true for a direct matching IPv4 address', () => {
      const ipFilters = ['192.168.1.1'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '192.168.1.1'), true);
    });

    it('should return true for a direct matching IPv6-mapped IPv4 address', () => {
      const ipFilters = ['192.168.1.1'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '::ffff:192.168.1.1'), true);
    });

    it('should return true for a matching IPv6 address', () => {
      const ipFilters = ['2001:0db8:85a3:0000:0000:8a2e:0370:*'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '2001:0db8:85a3:0000:0000:8a2e:0370:7334'), true);
    });

    it('should return false for a non-matching IPv6 address', () => {
      const ipFilters = ['2001:0db8:85a3:0000:0000:8a2e:0370:*'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '2001:0db8:85a3:0000:0000:8a2e:0371:7334'), false);
    });

    it('should return true for localhost IPv4', () => {
      const ipFilters = ['127.0.0.1'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '127.0.0.1'), true);
    });

    it('should return true for localhost IPv6', () => {
      const ipFilters = ['::1'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '::1'), true);
    });

    it('should return true for any IP with wildcard *', () => {
      const ipFilters = ['*'];
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '192.168.1.1'), true);
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '::ffff:192.168.1.1'), true);
      assert.deepStrictEqual(utils.testIPOnFilter(ipFilters, '2001:0db8:85a3:0000:0000:8a2e:0370:7334'), true);
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove surrounding quotes', () => {
      assert.deepStrictEqual(utils.sanitizeFilename('"file.csv"'), 'file.csv');
      assert.deepStrictEqual(utils.sanitizeFilename("'file.csv'"), 'file.csv');
      assert.deepStrictEqual(utils.sanitizeFilename('"file.name.csv"'), 'file.name.csv');
    });

    it('should replace special characters and spaces with hyphens in the name', () => {
      assert.deepStrictEqual(utils.sanitizeFilename('my file.csv'), 'my-file.csv');
      assert.deepStrictEqual(utils.sanitizeFilename('file@name#1.json'), 'file-name-1.json');
      assert.deepStrictEqual(utils.sanitizeFilename('my/bad/path.txt'), 'my-bad-path.txt');
    });

    it('should allow valid characters (alphanumeric, -, _) to remain', () => {
      assert.deepStrictEqual(utils.sanitizeFilename('valid-file_name123.csv'), 'valid-file_name123.csv');
      assert.deepStrictEqual(utils.sanitizeFilename('UPPER_case.TXT'), 'UPPER_case.TXT');
    });

    it('should handle files without extensions', () => {
      assert.deepStrictEqual(utils.sanitizeFilename('makefile'), 'makefile');
      assert.deepStrictEqual(utils.sanitizeFilename('read me'), 'read-me');
      assert.deepStrictEqual(utils.sanitizeFilename('weird@file'), 'weird-file');
    });

    it('should handle complex extensions correctly', () => {
      assert.deepStrictEqual(utils.sanitizeFilename('archive.tar.gz'), 'archive.tar.gz');
      assert.deepStrictEqual(utils.sanitizeFilename('complex.name.structure.json'), 'complex.name.structure.json');
    });

    it('should handle edge cases', () => {
      assert.deepStrictEqual(utils.sanitizeFilename('.env'), '.env');
      assert.deepStrictEqual(utils.sanitizeFilename('folder.'), 'folder.');
      assert.deepStrictEqual(utils.sanitizeFilename(''), '');
    });
  });

  describe('injectIndices', () => {
    it('should replace single wildcard with corresponding index', () => {
      assert.strictEqual(utils.injectIndices('$.users[*].name', [0]), '$.users[0].name');
      assert.strictEqual(utils.injectIndices('$[*]', [99]), '$[99]');
    });

    it('should replace multiple wildcards sequentially', () => {
      assert.strictEqual(utils.injectIndices('$.users[*].items[*].id', [0, 5]), '$.users[0].items[5].id');
      assert.strictEqual(utils.injectIndices('$[*].nested[*].deep[*]', [1, 2, 3]), '$[1].nested[2].deep[3]');
    });

    it('should keep the wildcard if there are not enough indices provided', () => {
      assert.strictEqual(utils.injectIndices('$.users[*].items[*].id', [0]), '$.users[0].items[*].id');
      assert.strictEqual(utils.injectIndices('$.users[*].items[*]', []), '$.users[*].items[*]');
    });

    it('should ignore extra indices if there are fewer wildcards', () => {
      assert.strictEqual(utils.injectIndices('$.users[*].name', [0, 5]), '$.users[0].name');
    });

    it('should return the path unchanged if there are no wildcards', () => {
      assert.strictEqual(utils.injectIndices('$.users.fixed.path', [0, 1]), '$.users.fixed.path');
    });

    it('should correctly handle other bracket notation that is not [*]', () => {
      assert.strictEqual(utils.injectIndices('$.users[0].items[*]', [2]), '$.users[0].items[2]');
      assert.strictEqual(utils.injectIndices('$.users["key"].items[*]', [3]), '$.users["key"].items[3]');
    });
  });

  describe('processCacheFileContent', () => {
    it('should read full content if smaller than limit', async () => {
      const content = 'Hello World';
      const stream = Readable.from(Buffer.from(content));

      const result = await utils.processCacheFileContent(stream);

      assert.deepStrictEqual(result.content, content);
      assert.strictEqual(result.truncated, false);
    });

    it('should truncate content if larger than limit', async () => {
      const content = 'Hello World';
      const limit = 5;

      function* charGenerator() {
        for (const char of content) {
          yield Buffer.from(char);
        }
      }
      const stream = Readable.from(charGenerator());

      const result = await utils.processCacheFileContent(stream, limit);

      assert.deepStrictEqual(result.content, 'Hello');
      assert.strictEqual(result.truncated, true);
    });

    it('should handle multi-chunk streams correctly', async () => {
      function* generateChunks() {
        yield Buffer.from('Chunk1');
        yield Buffer.from('Chunk2');
        yield Buffer.from('Chunk3');
      }
      const stream = Readable.from(generateChunks());

      const result = await utils.processCacheFileContent(stream, 9);

      assert.deepStrictEqual(result.content, 'Chunk1Chu');
      assert.strictEqual(result.truncated, true);
    });
  });

  describe('determineContentTypeFromFilename', () => {
    it('should identify json', () => {
      assert.strictEqual(utils.determineContentTypeFromFilename('data.json'), 'json');
      assert.strictEqual(utils.determineContentTypeFromFilename('/path/to/file.json'), 'json');
    });

    it('should identify csv', () => {
      assert.strictEqual(utils.determineContentTypeFromFilename('data.csv'), 'csv');
    });

    it('should identify xml', () => {
      assert.strictEqual(utils.determineContentTypeFromFilename('data.xml'), 'xml');
    });

    it('should default to raw for others', () => {
      assert.strictEqual(utils.determineContentTypeFromFilename('data.txt'), 'raw');
      assert.strictEqual(utils.determineContentTypeFromFilename('data'), 'raw');
      assert.strictEqual(utils.determineContentTypeFromFilename('data.bin'), 'raw');
    });
  });

  describe('streamToString', () => {
    it('should convert stream to string', async () => {
      const expected = 'stream content';
      const stream = Readable.from(Buffer.from(expected));

      const result = await utils.streamToString(stream);
      assert.deepStrictEqual(result, expected);
    });

    it('should reject on stream error', async () => {
      const stream = new Readable({
        read() {
          this.emit('error', new Error('Stream Error'));
        }
      });

      await assert.rejects(async () => utils.streamToString(stream), /Stream Error/);
    });
  });

  describe('createOIBusError', () => {
    it('should return OIBusError as is', () => {
      const originalError = new OIBusError('test', true);
      const result = utils.createOIBusError(originalError);
      assert.strictEqual(result, originalError);
      assert.strictEqual(result.forceRetry, true);
    });

    it('should wrap Error object', () => {
      const error = new Error('Standard error');
      const result = utils.createOIBusError(error);
      assert.strictEqual(result instanceof OIBusError, true);
      assert.strictEqual(result.message, 'Standard error');
      assert.strictEqual(result.forceRetry, false);
    });

    it('should wrap string error', () => {
      const result = utils.createOIBusError('String error');
      assert.strictEqual(result instanceof OIBusError, true);
      assert.strictEqual(result.message, 'String error');
    });

    it('should stringify unknown object', () => {
      const obj = { custom: 'value' };
      const result = utils.createOIBusError(obj);
      assert.strictEqual(result instanceof OIBusError, true);
      assert.strictEqual(result.message, '{"custom":"value"}');
    });
  });

  describe('applyFilenameVariables', () => {
    const southSource = (overrides: Partial<CacheMetadataSourceOriginSouth> = {}): CacheMetadataSourceOriginSouth => ({
      source: 'south',
      southId: 'south1',
      southName: 'South 1',
      queryTime: testData.constants.dates.DATE_1,
      queryStartTime: null,
      queryEndTime: null,
      items: [],
      ...overrides
    });
    const namedItem = (name: string) => ({ ...testData.south.list[0].items[0], name });

    beforeEach(() => {
      mock.method(Date, 'now', () => new Date(testData.constants.dates.FAKE_NOW).getTime());
    });

    it('should replace @QueryStartTime and @QueryEndTime with the south query window', () => {
      const result = utils.applyFilenameVariables(
        'export_@QueryStartTime_@QueryEndTime.csv',
        southSource({ queryStartTime: '2023-01-01T00:00:00.000Z', queryEndTime: '2023-01-01T01:00:00.000Z' })
      );

      assert.strictEqual(result, 'export_2023_01_01_00_00_00_000_2023_01_01_01_00_00_000.csv');
    });

    it('should replace @CurrentDate alongside the query window variables', () => {
      const result = utils.applyFilenameVariables(
        '@CurrentDate_@QueryStartTime.csv',
        southSource({ queryStartTime: '2023-01-01T00:00:00.000Z' })
      );

      assert.strictEqual(result, '2021_01_02_00_00_00_000_2023_01_01_00_00_00_000.csv');
    });

    it('should replace @SourceFilename and @SourceExtension with the name and extension of the transformed file', () => {
      assert.strictEqual(utils.applyFilenameVariables('@SourceFilename_copy@SourceExtension', southSource(), 'data.csv'), 'data_copy.csv');
      assert.strictEqual(utils.applyFilenameVariables('@SourceFilename_copy@SourceExtension', southSource()), '_copy');
    });

    it('should replace @QueryStartTime/@QueryEndTime with an empty string when the south content is not bound to a query window', () => {
      assert.strictEqual(utils.applyFilenameVariables('export_@QueryStartTime_@QueryEndTime.csv', southSource()), 'export__.csv');
    });

    it('should replace @ConnectorName with the south connector name', () => {
      const result = utils.applyFilenameVariables('export_@ConnectorName.csv', southSource({ southName: 'My SQL South' }));

      assert.strictEqual(result, 'export_My SQL South.csv');
    });

    it('should replace @ItemName with the single item name when the batch has exactly one item', () => {
      const result = utils.applyFilenameVariables('export_@ItemName.csv', southSource({ items: [namedItem('MyItem')] }));

      assert.strictEqual(result, 'export_MyItem.csv');
    });

    it('should replace @ItemName with an empty string when the batch has zero or several items', () => {
      assert.strictEqual(utils.applyFilenameVariables('export_@ItemName.csv', southSource()), 'export_.csv');
      assert.strictEqual(
        utils.applyFilenameVariables('export_@ItemName.csv', southSource({ items: [namedItem('Item1'), namedItem('Item2')] })),
        'export_.csv'
      );
    });

    it('should replace @QueryStartTime/@QueryEndTime with an empty string for a non-south source', () => {
      const result = utils.applyFilenameVariables('export_@QueryStartTime_@QueryEndTime.csv', { source: 'test' });

      assert.strictEqual(result, 'export__.csv');
    });
  });

  describe('resolveBypassingExports', () => {
    it('should resolve a standard allowed export normally', () => {
      const result = utils.resolveBypassingExports('typescript', 'package.json');
      assert.strictEqual(result.includes(path.normalize('node_modules/typescript/package.json')), true);
    });

    it('should bypass exports restrictions for blocked subpaths (e.g., luxon)', () => {
      const pkgName = 'luxon';
      const subPath = 'build/global/luxon.min.js';

      const result = utils.resolveBypassingExports(pkgName, subPath);

      assert.strictEqual(result.includes(path.normalize(`node_modules/${pkgName}/${subPath}`)), true);
    });

    it('should throw standard MODULE_NOT_FOUND for non-existent packages', () => {
      assert.throws(() => {
        utils.resolveBypassingExports('some-fake-package-that-does-not-exist', 'file.js');
      }, /Cannot find module 'some-fake-package-that-does-not-exist\/file\.js'/);
    });

    it('should re-throw generic errors that are not related to module resolution', () => {
      assert.throws(() => {
        utils.resolveBypassingExports(Symbol('bad-input') as unknown as string, 'file.js');
      }, TypeError);

      assert.throws(() => {
        utils.resolveBypassingExports(Symbol('bad-input') as unknown as string, 'file.js');
      }, /Cannot convert a Symbol value to a string/);
    });

    it('should throw the original error if the package resolves but is not in a node_modules folder (rootIdx === -1)', () => {
      assert.throws(() => {
        utils.resolveBypassingExports('fs', 'fake-subpath.js');
      }, /Cannot find module 'fs\/fake-subpath\.js'/);
    });
  });

  describe('groupItemsByGroup', () => {
    const baseItem = testData.south.list[2].items[0];

    it('should put each item in its own group when syncWithGroup is false', () => {
      const item1 = { ...baseItem, id: 'item1', group: null, syncWithGroup: false };
      const item2 = { ...baseItem, id: 'item2', group: null, syncWithGroup: false };
      const result = utils.groupItemsByGroup('mssql', [item1, item2]);
      assert.deepStrictEqual(result, [[item1], [item2]]);
    });

    it('should group items with the same group.id when syncWithGroup is true and southType supports grouping', () => {
      const group = { ...baseGroup, id: 'g1' };
      const item1 = { ...baseItem, id: 'item1', group, syncWithGroup: true };
      const item2 = { ...baseItem, id: 'item2', group, syncWithGroup: true };
      // opcua is NOT in SOUTH_SINGLE_ITEMS, so grouping is enabled
      const result = utils.groupItemsByGroup('opcua', [item1, item2]);
      assert.deepStrictEqual(result, [[item1, item2]]);
    });

    it('should treat every item as a singleton when southType is in SOUTH_SINGLE_ITEMS, even if syncWithGroup is true', () => {
      const group = { ...baseGroup, id: 'g1' };
      const item1 = { ...baseItem, id: 'item1', group, syncWithGroup: true };
      const item2 = { ...baseItem, id: 'item2', group, syncWithGroup: true };
      // mssql IS in SOUTH_SINGLE_ITEMS — grouping must be ignored
      const result = utils.groupItemsByGroup('mssql', [item1, item2]);
      assert.deepStrictEqual(result, [[item1], [item2]]);
    });

    it('should create separate sub-arrays for items with different group.ids', () => {
      const group1 = { ...baseGroup, id: 'g1' };
      const group2 = { ...baseGroup, id: 'g2' };
      const item1 = { ...baseItem, id: 'item1', group: group1, syncWithGroup: true };
      const item2 = { ...baseItem, id: 'item2', group: group2, syncWithGroup: true };
      // opcua is NOT in SOUTH_SINGLE_ITEMS, so items with different group.ids stay separate
      const result = utils.groupItemsByGroup('opcua', [item1, item2]);
      assert.deepStrictEqual(result, [[item1], [item2]]);
    });

    it('should handle mixed items — grouped and ungrouped in the same list', () => {
      const group = { ...baseGroup, id: 'g1' };
      const grouped1 = { ...baseItem, id: 'item1', group, syncWithGroup: true };
      const grouped2 = { ...baseItem, id: 'item2', group, syncWithGroup: true };
      const ungrouped = { ...baseItem, id: 'item3', group: null, syncWithGroup: false };
      const result = utils.groupItemsByGroup('opcua', [grouped1, ungrouped, grouped2]);
      // grouped1 and grouped2 share group g1; ungrouped is always a singleton
      assert.deepStrictEqual(result, [[grouped1, grouped2], [ungrouped]]);
    });
  });

  describe('workUnitLogCtx', () => {
    const baseItem = testData.south.list[2].items[0];

    it('should return an empty object for an empty work-unit', () => {
      assert.deepStrictEqual(utils.workUnitLogCtx([]), {});
    });

    it('should return { itemId, itemName } for a single item, grouped or not', () => {
      const item = { ...baseItem, id: 'item1', name: 'Item 1', group: null };
      assert.deepStrictEqual(utils.workUnitLogCtx([item]), { itemId: 'item1', itemName: 'Item 1' });
    });

    it('should return { groupId, groupName } for several items sharing a synced group', () => {
      const group = { ...baseGroup, id: 'g1', name: 'Group 1' };
      const item1 = { ...baseItem, id: 'item1', group, syncWithGroup: true };
      const item2 = { ...baseItem, id: 'item2', group, syncWithGroup: true };
      assert.deepStrictEqual(utils.workUnitLogCtx([item1, item2]), { groupId: 'g1', groupName: 'Group 1' });
    });

    it('should return an empty object for several items that do not share a group', () => {
      const item1 = { ...baseItem, id: 'item1', group: null, syncWithGroup: false };
      const item2 = { ...baseItem, id: 'item2', group: null, syncWithGroup: false };
      assert.deepStrictEqual(utils.workUnitLogCtx([item1, item2]), {});
    });
  });

  describe('readInitConfig', () => {
    const envVarsToClean = [
      'ENGINE_NAME',
      'ADMIN_USERNAME',
      'ADMIN_PASSWORD',
      'DEFAULT_PORT',
      'ADMIN_USERNAME_FILE',
      'ADMIN_PASSWORD_FILE'
    ];

    afterEach(() => {
      mock.restoreAll();
      for (const key of envVarsToClean) {
        delete process.env[key];
      }
    });

    it('should read credentials and port from a valid init file', () => {
      mock.method(fsSync, 'existsSync', () => true);
      mock.method(fsSync, 'readFileSync', () => '{"engineName":"MyOIBus","adminUsername":"alice","adminPassword":"s3cr3t","port":3000}');

      const result = utils.readInitConfig();
      assert.deepStrictEqual(result, { engineName: 'MyOIBus', adminUsername: 'alice', adminPassword: 's3cr3t', port: 3000 });
    });

    it('should fall back to env vars when init file does not exist', () => {
      mock.method(fsSync, 'existsSync', () => false);
      process.env.ENGINE_NAME = 'MyOIBus';
      process.env.ADMIN_USERNAME = 'bob';
      process.env.ADMIN_PASSWORD = 'secret';
      process.env.DEFAULT_PORT = '4000';

      const result = utils.readInitConfig();
      assert.deepStrictEqual(result, { engineName: 'MyOIBus', adminUsername: 'bob', adminPassword: 'secret', port: 4000 });
    });

    it('should fall back to env vars when init file is malformed JSON', () => {
      const consoleWarn = mock.method(console, 'warn', () => undefined);
      mock.method(fsSync, 'existsSync', () => true);
      mock.method(fsSync, 'readFileSync', () => '{invalid json}');
      process.env.ADMIN_USERNAME = 'charlie';

      const result = utils.readInitConfig();
      assert.strictEqual(result.adminUsername, 'charlie');
      assert.strictEqual(consoleWarn.mock.calls.length, 1);
      assert.strictEqual((consoleWarn.mock.calls[0].arguments[0] as string).includes('Failed to parse'), true);
    });

    it('should return undefined port when DEFAULT_PORT is not a valid number', () => {
      mock.method(fsSync, 'existsSync', () => false);
      process.env.DEFAULT_PORT = 'abc';

      const result = utils.readInitConfig();
      assert.strictEqual(result.port, undefined);
    });

    it('should read credentials from Docker secret files when _FILE env vars are set', () => {
      mock.method(fsSync, 'existsSync', () => false);
      mock.method(fsSync, 'readFileSync', (filePath: string) => {
        if (filePath === '/run/secrets/admin_pass') return 'dockersecret\n';
        throw new Error(`unexpected path: ${filePath}`);
      });
      process.env.ADMIN_PASSWORD_FILE = '/run/secrets/admin_pass';

      const result = utils.readInitConfig();
      assert.strictEqual(result.adminPassword, 'dockersecret');
    });

    it('should fall back to the direct env var and warn when the secret file cannot be read', () => {
      const consoleWarn = mock.method(console, 'warn', () => undefined);
      mock.method(fsSync, 'existsSync', () => false);
      mock.method(fsSync, 'readFileSync', (filePath: string) => {
        throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      });
      process.env.ADMIN_USERNAME_FILE = '/run/secrets/missing_username';
      process.env.ADMIN_USERNAME = 'fallback-user';

      const result = utils.readInitConfig();
      assert.strictEqual(result.adminUsername, 'fallback-user');
      assert.ok(
        consoleWarn.mock.calls.some(c => (c.arguments[0] as string).includes('Failed to read secret from /run/secrets/missing_username'))
      );
    });

    it('should ignore fields with wrong types in the init file', () => {
      mock.method(fsSync, 'existsSync', () => true);
      mock.method(fsSync, 'readFileSync', () => '{"engineName":99,"adminUsername":123,"adminPassword":null,"port":"not-a-number"}');

      const result = utils.readInitConfig();
      assert.deepStrictEqual(result, { engineName: undefined, adminUsername: undefined, adminPassword: undefined, port: undefined });
    });
  });

  describe('sanitizeCommandError', () => {
    it('should redact the secret from error.message', () => {
      const error = new Error('Command failed: cmdkey /add:\\\\server /user:bob /pass:Compteur123');

      const result = utils.sanitizeCommandError(error, 'Compteur123');

      assert.strictEqual(result.message.includes('Compteur123'), false);
      assert.strictEqual(result.message, 'Command failed: cmdkey /add:\\\\server /user:bob /pass:********');
    });

    it('should redact the secret from stdout and stderr and append them to the message', () => {
      const error = Object.assign(new Error('Command failed: cmdkey ...'), {
        stdout: 'ERROR: Unable to add Compteur123 to the list.',
        stderr: 'access denied for Compteur123'
      });

      const result = utils.sanitizeCommandError(error, 'Compteur123');

      assert.strictEqual(result.message.includes('Compteur123'), false);
      assert.strictEqual(
        result.message,
        'Command failed: cmdkey ... (ERROR: Unable to add ******** to the list. | access denied for ********)'
      );
    });

    it('should not alter the message when there is no secret to redact', () => {
      const error = new Error('Command failed: cmdkey /delete:\\\\server');

      const result = utils.sanitizeCommandError(error, '');

      assert.strictEqual(result.message, 'Command failed: cmdkey /delete:\\\\server');
    });

    it('should fall back to a generic message when the error has none', () => {
      const result = utils.sanitizeCommandError({}, 'Compteur123');

      assert.strictEqual(result.message, 'Unknown error');
    });
  });

  describe('checkAge', () => {
    const makeItem = (settings: Partial<SouthFolderScannerItemSettings>): SouthConnectorItemEntity<SouthFolderScannerItemSettings> => ({
      ...testData.south.list[0].items[0],
      settings: {
        regex: '.*',
        minAge: 0,
        preserveFiles: false,
        ignoreModifiedDate: false,
        maxFiles: 0,
        maxSize: 0,
        recursive: false,
        ...settings
      }
    });

    it('should return false when the file is not old enough', () => {
      const item = makeItem({ minAge: 100_000 });
      const result = utils.checkAge(item, 'file.txt', Date.now(), [], logger);
      assert.strictEqual(result, false);
    });

    it('should return true when preserveFiles is false and the file is old enough', () => {
      const item = makeItem({ minAge: 0, preserveFiles: false });
      const result = utils.checkAge(item, 'file.txt', Date.now() - 1_000, [], logger);
      assert.strictEqual(result, true);
    });

    it('should return true when preserveFiles is true and ignoreModifiedDate is true', () => {
      const item = makeItem({ minAge: 0, preserveFiles: true, ignoreModifiedDate: true });
      const result = utils.checkAge(
        item,
        'file.txt',
        Date.now() - 1_000,
        [{ filename: 'file.txt', modifiedTime: 999_999_999_999 }],
        logger
      );
      assert.strictEqual(result, true);
    });

    it('should return true when preserveFiles is true and the file was not seen before', () => {
      const item = makeItem({ minAge: 0, preserveFiles: true, ignoreModifiedDate: false });
      const mtimeMs = Date.now() - 1_000;
      const result = utils.checkAge(item, 'file.txt', mtimeMs, [], logger);
      assert.strictEqual(result, true);
    });

    it('should return false when preserveFiles is true and the file was already sent with a newer or equal mtime', () => {
      const item = makeItem({ minAge: 0, preserveFiles: true, ignoreModifiedDate: false });
      const mtimeMs = Date.now() - 1_000;
      const result = utils.checkAge(item, 'file.txt', mtimeMs, [{ filename: 'file.txt', modifiedTime: mtimeMs }], logger);
      assert.strictEqual(result, false);
    });
  });

  describe('getErrorMessage', () => {
    it('should join AggregateError sub-messages with a semicolon', () => {
      const error = new AggregateError([new Error('first'), new Error('second')], '');
      assert.strictEqual(utils.getErrorMessage(error), 'first; second');
    });

    it('should fall back to the AggregateError message when no sub-message is present', () => {
      const error = new AggregateError([], 'top-level message');
      assert.strictEqual(utils.getErrorMessage(error), 'top-level message');
    });

    it('should fall back to toString() when an AggregateError has neither message nor sub-messages', () => {
      const error = new AggregateError([], '');
      assert.strictEqual(utils.getErrorMessage(error), error.toString());
    });

    it('should append a non-empty cause message separated by a colon', () => {
      const error = Object.assign(new Error('outer'), { cause: new Error('inner') });
      assert.strictEqual(utils.getErrorMessage(error), 'outer: inner');
    });

    it('should ignore a null cause', () => {
      const error = Object.assign(new Error('outer'), { cause: null });
      assert.strictEqual(utils.getErrorMessage(error), 'outer');
    });

    it('should fall back to toString() when the error has an empty message and no cause', () => {
      const error = new Error('');
      assert.strictEqual(utils.getErrorMessage(error), error.toString());
    });

    it('should return a plain string error as-is', () => {
      assert.strictEqual(utils.getErrorMessage('plain string error'), 'plain string error');
    });

    it('should JSON.stringify a non-Error, non-string value', () => {
      assert.strictEqual(utils.getErrorMessage({ code: 42 }), JSON.stringify({ code: 42 }));
    });

    it('should fall back to String() when JSON.stringify throws (e.g. circular structure)', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      assert.strictEqual(utils.getErrorMessage(circular), String(circular));
    });
  });
});
