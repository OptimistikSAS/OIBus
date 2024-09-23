import fs from 'node:fs/promises';

import NorthConsole from './north-console';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import ValueCacheServiceMock from '../../tests/__mocks__/service/cache/value-cache-service.mock';
import FileCacheServiceMock from '../../tests/__mocks__/service/cache/file-cache-service.mock';
import { NorthConsoleSettings } from '../../../../shared/model/north-settings.model';
import ArchiveServiceMock from '../../tests/__mocks__/service/cache/archive-service.mock';
import { OIBusTimeValue } from '../../../../shared/model/engine.model';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import NorthConnectorMetricsRepository from '../../repository/logs/north-connector-metrics.repository';
import NorthMetricsRepositoryMock from '../../tests/__mocks__/repository/log/north-metrics-repository.mock';
import NorthConnectorMetricsServiceMock from '../../tests/__mocks__/service/north-connector-metrics-service.mock';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import testData from '../../tests/utils/test-data';

jest.mock('node:fs/promises');
// Spy on console table and info
jest.spyOn(global.console, 'table').mockImplementation(() => {});
jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const northMetricsRepository: NorthConnectorMetricsRepository = new NorthMetricsRepositoryMock();
const valueCacheService = new ValueCacheServiceMock();
const fileCacheService = new FileCacheServiceMock();
const archiveService = new ArchiveServiceMock();
const northConnectorMetricsService = new NorthConnectorMetricsServiceMock();
jest.mock(
  '../../service/cache/value-cache.service',
  () =>
    function () {
      return valueCacheService;
    }
);
jest.mock(
  '../../service/cache/file-cache.service',
  () =>
    function () {
      return fileCacheService;
    }
);
jest.mock(
  '../../service/cache/archive.service',
  () =>
    function () {
      return archiveService;
    }
);
jest.mock(
  '../../service/north-connector-metrics.service',
  () =>
    function () {
      return northConnectorMetricsService;
    }
);

let configuration: NorthConnectorEntity<NorthConsoleSettings>;
let north: NorthConsole;

describe('NorthConsole with verbose mode', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      verbose: true
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    north = new NorthConsole(
      configuration,
      encryptionService,
      northConnectorRepository,
      scanModeRepository,
      northMetricsRepository,
      logger,
      'baseFolder'
    );
  });

  it('should properly handle values in verbose mode', async () => {
    const values: Array<OIBusTimeValue> = [
      {
        pointId: 'pointId',
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '666', quality: 'good' }
      }
    ];
    await north.handleContent({ type: 'time-values', content: values });

    expect(console.table).toHaveBeenCalledWith(values, ['pointId', 'timestamp', 'data']);
    expect(process.stdout.write).not.toHaveBeenCalled();
  });

  it('should properly handle values in verbose mode', async () => {
    const filePath = '/path/to/file/example.file';
    (fs.stat as jest.Mock).mockImplementationOnce(() => Promise.resolve({ size: 666 }));
    await north.handleContent({ type: 'raw', filePath });
    expect(fs.stat).toHaveBeenCalledWith(filePath);
    expect(console.table).toHaveBeenCalledWith([{ filePath, fileSize: 666 }]);
    expect(process.stdout.write).not.toHaveBeenCalled();
  });
});

describe('NorthConsole without verbose mode', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      verbose: false
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    north = new NorthConsole(
      configuration,
      encryptionService,
      northConnectorRepository,
      scanModeRepository,
      northMetricsRepository,
      logger,
      'baseFolder'
    );
  });

  it('should properly handle values in non verbose mode', async () => {
    const values: Array<OIBusTimeValue> = [
      {
        pointId: 'pointId',
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '666', quality: 'good' }
      }
    ];
    await north.handleValues(values);

    expect(process.stdout.write).toHaveBeenCalledWith('North Console sent 1 values.\r\n');
    expect(console.table).not.toHaveBeenCalled();
  });

  it('should properly handle file in non verbose mode', async () => {
    const filePath = '/path/to/file/example.file';

    await north.handleFile(filePath);

    expect(fs.stat).not.toHaveBeenCalled();
    expect(process.stdout.write).toHaveBeenCalledWith('North Console sent 1 file.\r\n');
    expect(console.table).not.toHaveBeenCalled();
  });

  it('should be able to write test data to output', async () => {
    await expect(north.testConnection()).resolves.not.toThrow();

    expect(process.stdout.write).toHaveBeenCalledWith('North Console output test.\r\n');
    expect(console.table).toHaveBeenCalledWith([{ data: 'foo' }, { data: 'bar' }]);
  });

  it('should not be able to write to output when stdout is not writable', async () => {
    // Override the process.stdout.writable property
    Object.defineProperty(process.stdout, 'writable', { value: false, configurable: true });

    const error = new Error('The process.stdout stream has been destroyed, errored or ended');
    await expect(north.testConnection()).rejects.toThrow(error);

    expect(process.stdout.write).not.toHaveBeenCalled();
    expect(console.table).not.toHaveBeenCalled();

    Object.defineProperty(process.stdout, 'writable', { value: true, configurable: true });
  });

  it('should not be able to write to output when stdout.write throws error', async () => {
    const error = new Error('Cannot write to stdout');
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(new Error(`Node process is unable to write to STDOUT. ${error}`));
    expect(process.stdout.write).toHaveBeenCalled();
    expect(console.table).not.toHaveBeenCalled();
  });
});
