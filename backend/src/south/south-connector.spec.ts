import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';

import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import { CronJob } from 'cron';
import { delay, generateIntervals, validateCronExpression } from '../service/utils';
import { OIBusTimeValue } from '../../shared/model/engine.model';
import testData from '../tests/utils/test-data';
import SouthFolderScanner from './south-folder-scanner/south-folder-scanner';
import {
  SouthFolderScannerItemSettings,
  SouthFolderScannerSettings,
  SouthMSSQLItemSettings,
  SouthMSSQLSettings,
  SouthOPCUAItemSettings,
  SouthOPCUASettings
} from '../../shared/model/south-settings.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../model/south-connector.model';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../tests/__mocks__/service/south-cache-service.mock';
import { flushPromises } from '../tests/utils/test-utils';
import SouthOPCUA from './south-opcua/south-opcua';
import ConnectionService from '../service/connection.service';
import ConnectionServiceMock from '../tests/__mocks__/service/connection-service.mock';
import SouthMSSQL from './south-mssql/south-mssql';
import { DateTime } from 'luxon';
import { Instant } from '../model/types';

// Mock fs
jest.mock('node:fs/promises');
jest.mock('cron');

// Mock node-opcua-client
jest.mock('node-opcua-client', () => ({
  OPCUAClient: { createSession: jest.fn(() => ({})) },
  ClientSubscription: { create: jest.fn() },
  ClientMonitoredItem: { create: jest.fn() },
  MessageSecurityMode: { None: 1 },
  DataType: jest.requireActual('node-opcua-client').DataType,
  StatusCodes: jest.requireActual('node-opcua-client').StatusCodes,
  SecurityPolicy: jest.requireActual('node-opcua-client').SecurityPolicy,
  AttributeIds: jest.requireActual('node-opcua-client').AttributeIds,
  UserTokenType: jest.requireActual('node-opcua-client').UserTokenType,
  TimestampsToReturn: jest.requireActual('node-opcua-client').TimestampsToReturn,
  AggregateFunction: jest.requireActual('node-opcua-client').AggregateFunction,
  ReadRawModifiedDetails: jest.fn(() => ({})),
  HistoryReadRequest: jest.requireActual('node-opcua-client').HistoryReadRequest,
  ReadProcessedDetails: jest.fn(() => ({}))
}));
jest.mock('node-opcua-certificate-manager', () => ({ OPCUACertificateManager: jest.fn(() => ({})) }));

// Mock services
jest.mock('../service/utils');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const connectionService: ConnectionService = new ConnectionServiceMock();
const southCacheService = new SouthCacheServiceMock();

jest.mock(
  '../service/south-cache.service',
  () =>
    function () {
      return southCacheService;
    }
);

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const addContentCallback = jest.fn();

describe('SouthConnector with file query', () => {
  let south: SouthFolderScanner;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    southCacheService.getSouthCache.mockReturnValue({
      southId: testData.south.list[0].id,
      scanModeId: testData.scanMode.list[0].id,
      maxInstant: testData.constants.dates.FAKE_NOW
    });
    (southConnectorRepository.findSouthById as jest.Mock).mockImplementation(id => testData.south.list.find(element => element.id === id));
    (southConnectorRepository.findAllItemsForSouth as jest.Mock).mockImplementation(
      id => testData.south.list.find(element => element.id === id)!.items
    );
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    south = new SouthFolderScanner(
      testData.south.list[0] as SouthConnectorEntity<SouthFolderScannerSettings, SouthFolderScannerItemSettings>,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder'
    );
    await south.start();
  });

  it('should properly add to queue a new task and trigger next run', async () => {
    south.run = jest.fn();

    await south.onItemChange();
    south.addToQueue(testData.scanMode.list[0]);
    expect(south.run).toHaveBeenCalledWith(
      testData.scanMode.list[0].id,
      testData.south.list[0].items.filter(element => element.scanModeId === testData.scanMode.list[0].id)
    );
    expect(south.run).toHaveBeenCalledTimes(1);

    south.addToQueue(testData.scanMode.list[0]);
    expect(logger.warn).toHaveBeenCalledWith(
      `Task job not added in South connector queue for cron "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron}). The previous cron was still running`
    );
    expect(south.run).toHaveBeenCalledTimes(1);
    expect(south.settings).toEqual(testData.south.list[0]);
  });

  it('should properly add to queue a new task and not trigger next run if no item', async () => {
    south.run = jest.fn();
    (southConnectorRepository.findAllItemsForSouth as jest.Mock).mockReturnValueOnce([]);

    await south.onItemChange();
    south.addToQueue(testData.scanMode.list[0]);
    expect(south.run).not.toHaveBeenCalled();
  });

  it('should not add to queue if connector is stopping', async () => {
    const promise = new Promise<void>(resolve => {
      setTimeout(resolve, 1000);
    });
    south.disconnect = jest.fn().mockImplementationOnce(() => {
      return promise;
    });
    south.run = jest.fn();

    south.stop();
    south.addToQueue(testData.scanMode.list[0]);
    expect(south.run).not.toHaveBeenCalled();
    await flushPromises();
  });

  it('should add to queue a new task and not trigger next run if run in progress', async () => {
    south.run = jest.fn();
    south.createDeferredPromise();
    south.addToQueue(testData.scanMode.list[0]);

    expect(south.run).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('A South task is already running');
  });

  it('should use another logger', async () => {
    jest.clearAllMocks();

    south.setLogger(anotherLogger);
    await south.stop();
    expect(anotherLogger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
    south.queriesSubscription();
  });

  it('should reset cache', async () => {
    await south.resetCache();
    expect(southCacheService.resetSouthCache).toHaveBeenCalledTimes(1);
  });

  it('should create a cron job', async () => {
    (CronJob as unknown as jest.Mock).mockImplementation((_cron, callback) => {
      setTimeout(() => callback(), 1000);
    });
    south.addToQueue = jest.fn();
    south.createCronJob(testData.scanMode.list[0]);
    jest.advanceTimersByTime(1000);
    expect(south.addToQueue).toHaveBeenCalledTimes(1);

    south.createCronJob(testData.scanMode.list[0]);
    expect(
      `Removing existing South cron job associated to scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
    );
  });

  it('should properly update cron', async () => {
    south.createCronJob(testData.scanMode.list[0]);
    await south.updateScanMode(testData.scanMode.list[0]);
    expect(logger.debug).toHaveBeenCalledWith(
      `Creating South cron job for scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `Removing existing South cron job associated to scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
    );

    await south.connect();
    await south.disconnect();
    south.createCronJob(testData.scanMode.list[0]);

    await south.stop();
  });

  it('should not create a cron job when the cron expression is invalid', () => {
    const error = new Error('Invalid cron expression');
    (validateCronExpression as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    south.createCronJob({ ...testData.scanMode.list[0], cron: '* * * * * *L' });

    expect(logger.error).toHaveBeenCalledWith(
      `Error when creating South cron job for scan mode "${testData.scanMode.list[0].name}" (* * * * * *L): ${error.message}`
    );
  });

  it('should query files', async () => {
    south.fileQuery = jest
      .fn()
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error('file query error');
      });
    await south.run(
      testData.scanMode.list[0].id,
      testData.south.list[0].items as Array<SouthConnectorItemEntity<SouthFolderScannerItemSettings>>
    );
    expect(south.fileQuery).toHaveBeenCalledWith(testData.south.list[0].items);
    expect(logger.trace).toHaveBeenCalledWith(`Querying file for ${testData.south.list[0].items.length} items`);

    await south.run(
      testData.scanMode.list[0].id,
      testData.south.list[0].items as Array<SouthConnectorItemEntity<SouthFolderScannerItemSettings>>
    );

    expect(logger.error).toHaveBeenCalledWith(`Error when calling fileQuery. ${new Error('file query error')}`);
  });
});

describe('SouthConnector disabled', () => {
  let south: SouthMSSQL;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (southConnectorRepository.findSouthById as jest.Mock).mockImplementation(id => testData.south.list.find(element => element.id === id));
    (southConnectorRepository.findAllItemsForSouth as jest.Mock).mockImplementation(
      id => testData.south.list.find(element => element.id === id)!.items
    );
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    southCacheService.getSouthCache.mockReturnValue({
      southId: testData.south.list[1].id,
      scanModeId: testData.scanMode.list[0].id,
      maxInstant: testData.constants.dates.FAKE_NOW
    });

    south = new SouthMSSQL(
      testData.south.list[1] as SouthConnectorEntity<SouthMSSQLSettings, SouthMSSQLItemSettings>,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder'
    );
    await south.start();
  });

  it('should be properly initialized ', async () => {
    expect(logger.trace(`South connector ${testData.south.list[1].name} not enabled`));
    expect(south.isEnabled()).toEqual(false);
    expect(southCacheRepository.createCustomTable).not.toHaveBeenCalled();

    south.historyQueryHandler = jest.fn();
  });

  it('should ignore history query when not history items', async () => {
    await south.historyQueryHandler(
      [],
      '2020-02-02T02:02:02.222Z',
      '2020-02-02T02:02:02.222Z',
      testData.scanMode.list[0].id,
      {
        maxReadInterval: 3600,
        readDelay: 200
      },
      false,
      0
    );
    expect(logger.trace).toHaveBeenCalledWith('No history items to read. Ignoring historyQuery');
  });

  it('should not subscribe if queriesSubscription not supported history query when not history items', async () => {
    south.queriesSubscription = jest.fn().mockReturnValueOnce(false);

    await south.onItemChange();

    expect(south.queriesSubscription).toHaveBeenCalledTimes(1);
  });
});

describe('SouthConnector with history and max instant per item', () => {
  let south: SouthOPCUA;
  let configuration: SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings>;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    southCacheService.getSouthCache.mockImplementation((southId: string, scanModeId: string, itemId: string) => ({
      scanModeId: scanModeId,
      maxInstant: testData.constants.dates.FAKE_NOW,
      southId: southId,
      itemId: itemId
    }));

    configuration = JSON.parse(JSON.stringify(testData.south.list[2]));
    configuration.settings.throttling.maxInstantPerItem = true;
    configuration.settings.sharedConnection = true;
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);
    (southConnectorRepository.findAllItemsForSouth as jest.Mock).mockReturnValue(configuration.items);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    south = new SouthOPCUA(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder',
      connectionService
    );

    await south.start();
  });

  it('should delegate connection', async () => {
    expect(connectionService.create).toHaveBeenCalled();
  });

  it('should manage history query with several intervals with max instant per item', async () => {
    const intervals = [
      { start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' },
      { start: '2021-02-02T02:02:02.222Z', end: '2022-02-02T02:02:02.222Z' },
      { start: '2022-02-02T02:02:02.222Z', end: '2023-02-02T02:02:02.222Z' }
    ];
    (generateIntervals as jest.Mock).mockReturnValue(intervals);
    south.historyQuery = jest
      .fn()
      .mockReturnValueOnce('2021-02-02T02:02:02.222Z')
      .mockReturnValueOnce('2022-02-02T02:02:02.222Z')
      .mockReturnValueOnce('2023-02-02T02:02:02.222Z');

    await south.historyQueryHandler(
      configuration.items as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>,
      '2020-02-02T02:02:02.222Z',
      '2023-02-02T02:02:02.222Z',
      testData.scanMode.list[0].id,
      {
        readDelay: south.settings.settings.throttling.readDelay,
        maxReadInterval: south.settings.settings.throttling.maxReadInterval
      },
      south.settings.settings.throttling.maxInstantPerItem,
      south.settings.settings.throttling.overlap
    );
    expect(generateIntervals).toHaveBeenCalledWith(
      DateTime.fromISO(testData.constants.dates.FAKE_NOW)
        .minus({ milliseconds: configuration.settings.throttling.overlap })
        .toUTC()
        .toISO(),
      '2023-02-02T02:02:02.222Z',
      south.settings.settings.throttling.maxReadInterval
    );
    expect(generateIntervals).toHaveBeenCalledTimes(2);
    expect(south.historyQuery).toHaveBeenCalledTimes(6);
    expect(delay).toHaveBeenCalledTimes(5);
    expect(southCacheService.saveSouthCache).toHaveBeenCalledTimes(3);
    expect(southCacheService.saveSouthCache).toHaveBeenCalledWith({
      scanModeId: testData.scanMode.list[0].id,
      maxInstant: '2021-02-02T02:02:02.222Z',
      southId: configuration.id,
      itemId: configuration.items[0].id
    });
    expect(southCacheService.saveSouthCache).toHaveBeenCalledWith({
      scanModeId: testData.scanMode.list[0].id,
      maxInstant: '2022-02-02T02:02:02.222Z',
      southId: configuration.id,
      itemId: configuration.items[0].id
    });
    expect(southCacheService.saveSouthCache).toHaveBeenCalledWith({
      scanModeId: testData.scanMode.list[0].id,
      maxInstant: '2023-02-02T02:02:02.222Z',
      southId: configuration.id,
      itemId: configuration.items[0].id
    });
  });

  it('should manage history query with 2 intervals with max instant per item', async () => {
    const intervals = [
      { start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' },
      { start: '2022-02-02T02:02:02.222Z', end: '2023-02-02T02:02:02.222Z' }
    ];
    (generateIntervals as jest.Mock).mockReturnValue(intervals);
    south.historyQuery = jest.fn().mockReturnValueOnce('2021-02-02T02:02:02.222Z').mockReturnValueOnce('2023-02-02T02:02:02.222Z');

    await south.historyQueryHandler(
      configuration.items,
      '2020-02-02T02:02:02.222Z',
      '2023-02-02T02:02:02.222Z',
      testData.scanMode.list[0].id,
      {
        readDelay: south.settings.settings.throttling.readDelay,
        maxReadInterval: south.settings.settings.throttling.maxReadInterval
      },
      south.settings.settings.throttling.maxInstantPerItem,
      south.settings.settings.throttling.overlap
    );
    expect(generateIntervals).toHaveBeenCalledWith(
      DateTime.fromISO(testData.constants.dates.FAKE_NOW)
        .minus({ milliseconds: south.settings.settings.throttling.overlap })
        .toUTC()
        .toISO(),
      '2023-02-02T02:02:02.222Z',
      south.settings.settings.throttling.maxReadInterval
    );
    expect(logger.trace).toHaveBeenCalledWith(
      `Interval split in ${intervals.length} sub-intervals: \r\n` +
        `[${JSON.stringify(intervals[0], null, 2)}\r\n` +
        `${JSON.stringify(intervals[1], null, 2)}]`
    );
    expect(generateIntervals).toHaveBeenCalledTimes(2);
    expect(south.historyQuery).toHaveBeenCalledTimes(4);
    expect(delay).toHaveBeenCalledTimes(3);
    expect(southCacheService.saveSouthCache).toHaveBeenCalledTimes(2);
    expect(southCacheService.saveSouthCache).toHaveBeenCalledWith({
      scanModeId: testData.scanMode.list[0].id,
      maxInstant: '2021-02-02T02:02:02.222Z',
      southId: configuration.id,
      itemId: configuration.items[0].id
    });
    expect(southCacheService.saveSouthCache).toHaveBeenCalledWith({
      scanModeId: testData.scanMode.list[0].id,
      maxInstant: '2023-02-02T02:02:02.222Z',
      southId: configuration.id,
      itemId: configuration.items[0].id
    });
  });

  it('should manage history query with 1 interval with max instant per item', async () => {
    const intervals = [{ start: '2020-02-02T02:02:02.222Z', end: '2023-02-02T02:02:02.222Z' }];
    (generateIntervals as jest.Mock).mockReturnValue(intervals);
    south.historyQuery = jest.fn().mockReturnValueOnce('2023-02-02T02:02:02.222Z');

    await south.historyQueryHandler(
      configuration.items,
      '2020-02-02T02:02:02.222Z',
      '2023-02-02T02:02:02.222Z',
      testData.scanMode.list[0].id,
      {
        readDelay: south.settings.settings.throttling.readDelay,
        maxReadInterval: south.settings.settings.throttling.maxReadInterval
      },
      south.settings.settings.throttling.maxInstantPerItem,
      south.settings.settings.throttling.overlap
    );
    expect(generateIntervals).toHaveBeenCalledWith(
      DateTime.fromISO(testData.constants.dates.FAKE_NOW)
        .minus({ milliseconds: south.settings.settings.throttling.overlap })
        .toUTC()
        .toISO(),
      '2023-02-02T02:02:02.222Z',
      south.settings.settings.throttling.maxReadInterval
    );
    expect(logger.trace).toHaveBeenCalledWith(`Querying interval: ${JSON.stringify(intervals[0], null, 2)}`);
    expect(south.historyQuery).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledTimes(1);
    expect(southCacheService.saveSouthCache).toHaveBeenCalledTimes(1);
    expect(southCacheService.saveSouthCache).toHaveBeenCalledWith({
      scanModeId: testData.scanMode.list[0].id,
      maxInstant: '2023-02-02T02:02:02.222Z',
      southId: configuration.id,
      itemId: configuration.items[0].id
    });
  });

  it('should manage history query with 1 interval with 1 item and max instant per item', async () => {
    const intervals = [{ start: '2020-02-02T02:02:02.222Z', end: '2023-02-02T02:02:02.222Z' }];
    (generateIntervals as jest.Mock).mockReturnValue(intervals);
    south.historyQuery = jest.fn().mockReturnValueOnce('2023-02-02T02:02:02.222Z');

    await south.historyQueryHandler(
      [configuration.items[0]],
      '2020-02-02T02:02:02.222Z',
      '2023-02-02T02:02:02.222Z',
      testData.scanMode.list[0].id,
      {
        readDelay: south.settings.settings.throttling.readDelay,
        maxReadInterval: south.settings.settings.throttling.maxReadInterval
      },
      south.settings.settings.throttling.maxInstantPerItem,
      south.settings.settings.throttling.overlap
    );
    expect(generateIntervals).toHaveBeenCalledWith(
      DateTime.fromISO(testData.constants.dates.FAKE_NOW)
        .minus({ milliseconds: south.settings.settings.throttling.overlap })
        .toUTC()
        .toISO(),
      '2023-02-02T02:02:02.222Z',
      south.settings.settings.throttling.maxReadInterval
    );
    expect(logger.trace).toHaveBeenCalledWith(`Querying interval: ${JSON.stringify(intervals[0], null, 2)}`);
    expect(south.historyQuery).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
    expect(southCacheService.saveSouthCache).toHaveBeenCalledTimes(1);
    expect(southCacheService.saveSouthCache).toHaveBeenCalledWith({
      scanModeId: testData.scanMode.list[0].id,
      maxInstant: '2023-02-02T02:02:02.222Z',
      southId: configuration.id,
      itemId: configuration.items[0].id
    });
  });

  it('should manage history query with several intervals when stopping with max instant per item', async () => {
    const intervals = [
      { start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' },
      { start: '2021-02-02T02:02:02.222Z', end: '2022-02-02T02:02:02.222Z' },
      { start: '2022-02-02T02:02:02.222Z', end: '2023-02-02T02:02:02.222Z' }
    ];
    (generateIntervals as jest.Mock).mockReturnValueOnce(intervals);

    south.historyQuery = jest.fn(
      () =>
        new Promise<string>(resolve => {
          setTimeout(() => {
            resolve('2021-02-02T02:02:02.222Z');
          }, 1000);
        })
    );

    south.createDeferredPromise();
    south
      .historyQueryHandler(
        configuration.items,
        '2020-02-02T02:02:02.222Z',
        '2023-02-02T02:02:02.222Z',
        testData.scanMode.list[0].id,
        {
          readDelay: south.settings.settings.throttling.readDelay,
          maxReadInterval: south.settings.settings.throttling.maxReadInterval
        },
        south.settings.settings.throttling.maxInstantPerItem,
        south.settings.settings.throttling.overlap
      )
      .then(() => {
        south.resolveDeferredPromise();
      });
    south.stop();

    jest.advanceTimersByTime(10000);

    await flushPromises();

    expect(logger.debug).toHaveBeenCalledWith(
      `Connector is stopping. Exiting history query at interval 0: [2020-02-02T02:02:02.222Z, 2021-02-02T02:02:02.222Z]`
    );
    expect(south.historyQuery).toHaveBeenCalledTimes(1);
  });
});

describe('SouthConnector with history and subscription', () => {
  let south: SouthOPCUA;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    southCacheService.getSouthCache.mockReturnValue({
      scanModeId: testData.scanMode.list[0].id,
      maxInstant: testData.constants.dates.FAKE_NOW,
      southId: testData.south.list[2].id
    });
    (southConnectorRepository.findSouthById as jest.Mock).mockImplementation(id => testData.south.list.find(element => element.id === id));
    (southConnectorRepository.findAllItemsForSouth as jest.Mock).mockImplementation(
      id => testData.south.list.find(element => element.id === id)!.items
    );
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));

    south = new SouthOPCUA(
      testData.south.list[2] as SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings>,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder',
      connectionService
    );

    south.connect = jest.fn();
    south.disconnect = jest.fn();
    await south.start();
  });

  it('should properly run task a task', async () => {
    south.historyQueryHandler = jest.fn().mockImplementationOnce(() => {
      throw new Error('history query error');
    });
    south.lastPointQuery = jest.fn().mockImplementationOnce(() => {
      throw new Error('last point query error');
    });

    await south.run(testData.scanMode.list[0].id, testData.south.list[2].items as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>);

    expect(south.historyQueryHandler).toHaveBeenCalledTimes(1);
    expect(south.historyQueryHandler).toHaveBeenCalledWith(
      testData.south.list[2].items,
      DateTime.fromISO(testData.constants.dates.FAKE_NOW)
        .minus(3600 * 1000)
        .toUTC()
        .toISO()!,
      testData.constants.dates.FAKE_NOW,
      testData.scanMode.list[0].id,
      { maxReadInterval: south.settings.settings.throttling.maxReadInterval, readDelay: south.settings.settings.throttling.readDelay },
      false,
      south.settings.settings.throttling.overlap
    );
    expect(south.lastPointQuery).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(`Error when calling historyQuery. ${new Error('history query error')}`);
    expect(logger.error).toHaveBeenCalledWith(`Error when calling lastPointQuery. ${new Error('last point query error')}`);

    await south.run(testData.scanMode.list[0].id, testData.south.list[2].items as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>);
    expect(south.historyQueryHandler).toHaveBeenCalledTimes(2);
    expect(south.lastPointQuery).toHaveBeenCalledTimes(2);

    expect(logger.trace).toHaveBeenCalledWith('No more task to run');
  });

  it('should properly stop', async () => {
    await south.stop();
    expect(logger.debug).toHaveBeenCalledWith(`Stopping South "${testData.south.list[2].name}" (${testData.south.list[2].id})...`);
    expect(logger.info).toHaveBeenCalledWith(`South connector "${testData.south.list[2].name}" stopped`);
  });

  it('should properly stop with running task ', async () => {
    const promise = new Promise<void>(resolve => {
      setTimeout(resolve, 1000);
    });
    south.historyQueryHandler = jest.fn(async () => promise);
    south.lastPointQuery = jest.fn();

    south.disconnect = jest.fn();

    south.run(testData.scanMode.list[0].id, testData.south.list[2].items as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>);

    south.stop();
    expect(logger.debug).toHaveBeenCalledWith(`Stopping South "${testData.south.list[2].name}" (${testData.south.list[2].id})...`);
    expect(logger.debug).toHaveBeenCalledWith('Waiting for South task to finish');
    expect(south.disconnect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await flushPromises();
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(logger.info(`South connector "${testData.south.list[2].name}" stopped`));
  });

  it('should add values', async () => {
    await south.addContent({ type: 'time-values', content: [] });
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(addContentCallback).not.toHaveBeenCalled();

    await south.addContent({ type: 'time-values', content: [{}, {}] as Array<OIBusTimeValue> });
    expect(logger.debug).toHaveBeenCalledWith(`Add 2 values to cache from South "${testData.south.list[2].name}"`);
    expect(addContentCallback).toHaveBeenCalledWith(testData.south.list[2].id, { type: 'time-values', content: [{}, {}] });
  });

  it('should add file', async () => {
    await south.addContent({ type: 'raw', filePath: 'file.csv' });
    expect(logger.debug).toHaveBeenCalledWith(`Add file "file.csv" to cache from South "${testData.south.list[2].name}"`);
    expect(addContentCallback).toHaveBeenCalledWith(testData.south.list[2].id, { type: 'raw', filePath: 'file.csv' });
  });

  it('should manage history query with several intervals', async () => {
    const intervals = [
      { start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' },
      { start: '2021-02-02T02:02:02.222Z', end: '2022-02-02T02:02:02.222Z' },
      { start: '2022-02-02T02:02:02.222Z', end: '2023-02-02T02:02:02.222Z' }
    ];
    (generateIntervals as jest.Mock).mockReturnValueOnce(intervals);
    south.historyQuery = jest
      .fn()
      .mockReturnValueOnce('2021-02-02T02:02:02.222Z')
      .mockReturnValueOnce('2022-02-02T02:02:02.222Z')
      .mockReturnValueOnce('2023-02-02T02:02:02.222Z');

    southCacheService.getSouthCache.mockReturnValueOnce({
      scanModeId: 'id1',
      maxInstant: testData.constants.dates.FAKE_NOW,
      southId: testData.south.list[2].id
    });

    await south.historyQueryHandler(
      testData.south.list[2].items as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>,
      '2020-02-02T02:02:02.222Z',
      '2023-02-02T02:02:02.222Z',
      testData.scanMode.list[0].id,
      {
        readDelay: south.settings.settings.throttling.readDelay,
        maxReadInterval: south.settings.settings.throttling.maxReadInterval
      },
      south.settings.settings.throttling.maxInstantPerItem,
      south.settings.settings.throttling.overlap
    );
    expect(generateIntervals).toHaveBeenCalledWith(
      DateTime.fromISO(testData.constants.dates.FAKE_NOW)
        .minus({ milliseconds: south.settings.settings.throttling.overlap })
        .toUTC()
        .toISO(),
      '2023-02-02T02:02:02.222Z',
      south.settings.settings.throttling.maxReadInterval
    );
    expect(logger.trace).toHaveBeenCalledWith(
      `Interval split in ${intervals.length} sub-intervals: \r\n` +
        `[${JSON.stringify(intervals[0], null, 2)}\r\n` +
        `${JSON.stringify(intervals[1], null, 2)}\r\n` +
        '...\r\n' +
        `${JSON.stringify(intervals[intervals.length - 1], null, 2)}]`
    );
    expect(south.historyQuery).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(2);
    expect(southCacheService.saveSouthCache).toHaveBeenCalledTimes(3);
    expect(southCacheService.saveSouthCache).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2021-02-02T02:02:02.222Z',
      southId: testData.south.list[2].id
    });
    expect(southCacheService.saveSouthCache).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2022-02-02T02:02:02.222Z',
      southId: testData.south.list[2].id
    });
    expect(southCacheService.saveSouthCache).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2023-02-02T02:02:02.222Z',
      southId: testData.south.list[2].id
    });
  });

  it('should manage history query with 2 intervals', async () => {
    const intervals = [
      { start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' },
      { start: '2022-02-02T02:02:02.222Z', end: '2023-02-02T02:02:02.222Z' }
    ];
    (generateIntervals as jest.Mock).mockReturnValueOnce(intervals);
    south.historyQuery = jest.fn().mockReturnValueOnce('2021-02-02T02:02:02.222Z').mockReturnValueOnce('2023-02-02T02:02:02.222Z');
    southCacheService.getSouthCache.mockReturnValueOnce({
      scanModeId: 'id1',
      maxInstant: testData.constants.dates.FAKE_NOW,
      southId: testData.south.list[2].id
    });

    await south.historyQueryHandler(
      testData.south.list[2].items as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>,
      '2020-02-02T02:02:02.222Z',
      '2023-02-02T02:02:02.222Z',
      'scanModeId1',
      {
        readDelay: south.settings.settings.throttling.readDelay,
        maxReadInterval: south.settings.settings.throttling.maxReadInterval
      },
      south.settings.settings.throttling.maxInstantPerItem,
      south.settings.settings.throttling.overlap
    );
    expect(generateIntervals).toHaveBeenCalledWith(
      DateTime.fromISO(testData.constants.dates.FAKE_NOW)
        .minus({ milliseconds: south.settings.settings.throttling.overlap })
        .toUTC()
        .toISO(),
      '2023-02-02T02:02:02.222Z',
      south.settings.settings.throttling.maxReadInterval
    );
    expect(logger.trace).toHaveBeenCalledWith(
      `Interval split in ${intervals.length} sub-intervals: \r\n` +
        `[${JSON.stringify(intervals[0], null, 2)}\r\n` +
        `${JSON.stringify(intervals[1], null, 2)}]`
    );
    expect(south.historyQuery).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledTimes(1);
    expect(southCacheService.saveSouthCache).toHaveBeenCalledTimes(2);
    expect(southCacheService.saveSouthCache).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2021-02-02T02:02:02.222Z',
      southId: testData.south.list[2].id
    });
    expect(southCacheService.saveSouthCache).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2023-02-02T02:02:02.222Z',
      southId: testData.south.list[2].id
    });
  });

  it('should manage history query with 1 interval', async () => {
    const intervals = [{ start: '2020-02-02T02:02:02.222Z', end: '2023-02-02T02:02:02.222Z' }];
    (generateIntervals as jest.Mock).mockReturnValueOnce(intervals);
    south.historyQuery = jest.fn().mockReturnValueOnce('2023-02-02T02:02:02.222Z');
    southCacheService.getSouthCache.mockReturnValueOnce({
      scanModeId: 'id1',
      maxInstant: testData.constants.dates.FAKE_NOW,
      southId: testData.south.list[2].id
    });

    await south.historyQueryHandler(
      testData.south.list[2].items as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>,
      '2020-02-02T02:02:02.222Z',
      '2023-02-02T02:02:02.222Z',
      testData.scanMode.list[0].id,
      {
        readDelay: south.settings.settings.throttling.readDelay,
        maxReadInterval: south.settings.settings.throttling.maxReadInterval
      },
      south.settings.settings.throttling.maxInstantPerItem,
      south.settings.settings.throttling.overlap
    );
    expect(generateIntervals).toHaveBeenCalledWith(
      DateTime.fromISO(testData.constants.dates.FAKE_NOW)
        .minus({ milliseconds: south.settings.settings.throttling.overlap })
        .toUTC()
        .toISO(),
      '2023-02-02T02:02:02.222Z',
      south.settings.settings.throttling.maxReadInterval
    );
    expect(logger.trace).toHaveBeenCalledWith(`Querying interval: ${JSON.stringify(intervals[0], null, 2)}`);
    expect(south.historyQuery).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
    expect(southCacheService.saveSouthCache).toHaveBeenCalledTimes(1);
    expect(southCacheService.saveSouthCache).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2023-02-02T02:02:02.222Z',
      southId: testData.south.list[2].id
    });
  });

  it('should manage history query with several intervals when stopping', async () => {
    const intervals = [
      { start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' },
      { start: '2021-02-02T02:02:02.222Z', end: '2022-02-02T02:02:02.222Z' },
      { start: '2022-02-02T02:02:02.222Z', end: '2023-02-02T02:02:02.222Z' }
    ];
    (generateIntervals as jest.Mock).mockReturnValueOnce(intervals);

    south.historyQuery = jest.fn(
      () =>
        new Promise<string>(resolve => {
          setTimeout(() => {
            resolve('2021-02-02T02:02:02.222Z');
          }, 1000);
        })
    );

    south.createDeferredPromise();
    south
      .historyQueryHandler(
        testData.south.list[2].items as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>,
        '2020-02-02T02:02:02.222Z',
        '2023-02-02T02:02:02.222Z',
        testData.scanMode.list[0].id,
        {
          readDelay: south.settings.settings.throttling.readDelay,
          maxReadInterval: south.settings.settings.throttling.maxReadInterval
        },
        south.settings.settings.throttling.maxInstantPerItem,
        south.settings.settings.throttling.overlap
      )
      .then(() => {
        south.resolveDeferredPromise();
      });
    south.stop();

    jest.advanceTimersByTime(10000);

    await flushPromises();

    expect(logger.debug).toHaveBeenCalledWith(
      `Connector is stopping. Exiting history query at interval 0: [2020-02-02T02:02:02.222Z, 2021-02-02T02:02:02.222Z]`
    );
    expect(south.historyQuery).toHaveBeenCalledTimes(1);
  });

  it('should manage south cache on max item change from true to false', async () => {
    const config = JSON.parse(JSON.stringify(testData.south.list[2]));
    const maxInstants = new Map<string, Instant>();
    maxInstants.set(config.items[0].scanModeId, testData.constants.dates.DATE_2);
    (southCacheRepository.getLatestMaxInstants as jest.Mock).mockReturnValueOnce(maxInstants);
    south.getMaxInstantPerItem = jest.fn().mockReturnValue(true);
    await south.manageSouthCacheOnChange(testData.south.list[2], config, false);

    expect(southCacheRepository.getLatestMaxInstants).toHaveBeenCalledTimes(1);
    expect(southCacheRepository.deleteAllBySouthConnector).toHaveBeenCalledWith(config.id);

    expect(southCacheRepository.save).toHaveBeenCalledTimes(2);
    expect(southCacheRepository.save).toHaveBeenCalledWith({
      southId: config.id,
      itemId: config.items[0].id,
      scanModeId: config.items[0].scanModeId,
      maxInstant: testData.constants.dates.DATE_2
    });
  });

  it('should manage south cache on max item change from false to true', async () => {
    const config = JSON.parse(JSON.stringify(testData.south.list[2]));
    const maxInstants = new Map<string, Instant>();
    maxInstants.set(config.items[0].scanModeId, testData.constants.dates.DATE_2);
    (southCacheRepository.getLatestMaxInstants as jest.Mock).mockReturnValueOnce(maxInstants);
    south.getMaxInstantPerItem = jest.fn().mockReturnValue(false);
    await south.manageSouthCacheOnChange(testData.south.list[2], config, true);

    expect(southCacheRepository.getLatestMaxInstants).toHaveBeenCalledTimes(1);
    expect(southCacheRepository.deleteAllBySouthConnector).toHaveBeenCalledWith(config.id);

    expect(southCacheRepository.save).toHaveBeenCalledTimes(1);
    expect(southCacheRepository.save).toHaveBeenCalledWith({
      southId: config.id,
      itemId: 'all',
      scanModeId: config.items[0].scanModeId,
      maxInstant: testData.constants.dates.DATE_2
    });
  });

  it('should manage south cache on max item change and do nothing if no max instants', async () => {
    const config = JSON.parse(JSON.stringify(testData.south.list[2]));
    (southCacheRepository.getLatestMaxInstants as jest.Mock).mockReturnValueOnce(null);
    south.getMaxInstantPerItem = jest.fn().mockReturnValue(false);
    await south.manageSouthCacheOnChange(testData.south.list[2], config, true);

    expect(southCacheRepository.getLatestMaxInstants).toHaveBeenCalledTimes(1);
    expect(southCacheRepository.save).not.toHaveBeenCalled();
  });

  it('should manage south cache on item deletion with max instant per item', async () => {
    const config = JSON.parse(JSON.stringify(testData.south.list[2]));
    config.items.pop();
    south.getMaxInstantPerItem = jest.fn().mockReturnValue(true);
    await south.manageSouthCacheOnChange(testData.south.list[2], config, true);
    expect(southCacheRepository.deleteAllBySouthItem).toHaveBeenCalledTimes(1);
    expect(southCacheRepository.delete).not.toHaveBeenCalled();
  });

  it('should manage south cache on item deletion without max instant per item', async () => {
    const config = JSON.parse(JSON.stringify(testData.south.list[2]));
    config.items = [];
    south.getMaxInstantPerItem = jest.fn().mockReturnValue(false);
    await south.manageSouthCacheOnChange(testData.south.list[2], config, false);
    expect(southCacheRepository.delete).toHaveBeenCalledTimes(4); // We removed the four items of the south connector
    expect(southCacheRepository.deleteAllBySouthItem).not.toHaveBeenCalled();
  });

  it('should manage south cache on item scan mode change without cache entry', async () => {
    const config = JSON.parse(JSON.stringify(testData.south.list[2]));
    config.items[0].scanModeId = testData.scanMode.list[1].id;
    (southCacheRepository.getSouthCache as jest.Mock).mockReturnValue(null);
    south.getMaxInstantPerItem = jest.fn().mockReturnValue(false);
    await south.manageSouthCacheOnChange(testData.south.list[2], config, false);
    expect(southCacheRepository.save).not.toHaveBeenCalled();
  });

  it('should manage south cache on item scan mode change without max instant per item and create new entry', async () => {
    const config = JSON.parse(JSON.stringify(testData.south.list[2]));
    config.items[0].scanModeId = testData.scanMode.list[1].id;
    (southCacheRepository.getSouthCache as jest.Mock)
      .mockReturnValueOnce({
        scanModeId: testData.scanMode.list[0].id,
        maxInstant: testData.constants.dates.DATE_1,
        southId: testData.south.list[2].id
      })
      .mockReturnValueOnce(null);
    south.getMaxInstantPerItem = jest.fn().mockReturnValue(false);
    await south.manageSouthCacheOnChange(testData.south.list[2], config, false);
    expect(southCacheRepository.save).toHaveBeenCalledWith({
      southId: testData.south.list[2].id,
      itemId: 'all',
      scanModeId: testData.scanMode.list[1].id,
      maxInstant: testData.constants.dates.DATE_1
    });
  });

  it('should manage south cache on item scan mode change without max instant per item and not create new entry', async () => {
    const config = JSON.parse(JSON.stringify(testData.south.list[2]));
    config.items[0].scanModeId = testData.scanMode.list[1].id;
    (southCacheRepository.getSouthCache as jest.Mock)
      .mockReturnValueOnce({
        scanModeId: testData.scanMode.list[0].id,
        maxInstant: testData.constants.dates.DATE_1,
        southId: testData.south.list[2].id
      })
      .mockReturnValueOnce({
        scanModeId: testData.scanMode.list[1].id,
        maxInstant: testData.constants.dates.DATE_2,
        southId: testData.south.list[2].id
      });
    south.getMaxInstantPerItem = jest.fn().mockReturnValue(false);
    await south.manageSouthCacheOnChange(testData.south.list[2], config, false);
    expect(southCacheRepository.save).not.toHaveBeenCalled();
  });

  it('should manage south cache on item scan mode change without max instant per item and create new entry', async () => {
    const config = JSON.parse(JSON.stringify(testData.south.list[2]));
    config.items[0].scanModeId = testData.scanMode.list[1].id;
    (southCacheRepository.getSouthCache as jest.Mock).mockReturnValueOnce({
      scanModeId: testData.scanMode.list[0].id,
      maxInstant: testData.constants.dates.DATE_1,
      southId: testData.south.list[2].id
    });
    south.getMaxInstantPerItem = jest.fn().mockReturnValue(true);
    await south.manageSouthCacheOnChange(testData.south.list[2], config, true);
    expect(southCacheRepository.save).toHaveBeenCalledWith({
      southId: testData.south.list[2].id,
      itemId: config.items[0].id,
      scanModeId: testData.scanMode.list[1].id,
      maxInstant: testData.constants.dates.DATE_1
    });
  });

  // it('should manage south cache on item scan mode change with max instant per item', async () => {
  //   const config = JSON.parse(JSON.stringify(testData.south.list[2]));
  //   config.items[0].scanModeId = testData.scanMode.list[1].id;
  //   southCacheService.getSouthCache
  //     .mockReturnValueOnce({
  //       scanModeId: testData.scanMode.list[0].id,
  //       maxInstant: testData.constants.dates.DATE_1,
  //       southId: testData.south.list[2].id
  //     })
  //     .mockReturnValueOnce({
  //       scanModeId: testData.scanMode.list[1].id,
  //       maxInstant: testData.constants.dates.DATE_2,
  //       southId: testData.south.list[2].id
  //     });
  //   south.getMaxInstantPerItem = jest.fn().mockReturnValue(true);
  //   await south.manageSouthCacheOnChange(testData.south.list[2], config, true);
  //   expect(southCacheRepository.save).toHaveBeenCalledWith({
  //     southId: testData.south.list[2].id,
  //     itemId: config.items[0].id,
  //     scanModeId: testData.scanMode.list[1].id,
  //     maxInstant: testData.constants.dates.DATE_1
  //   });
  // });

  it('should create subscriptions and cron jobs', async () => {
    const subscriptionItem = JSON.parse(JSON.stringify(testData.south.list[2].items[1]));
    south.subscribe = jest.fn();
    south.unsubscribe = jest.fn();
    (scanModeRepository.findById as jest.Mock)
      .mockReturnValueOnce(testData.scanMode.list[0])
      .mockReturnValueOnce(testData.scanMode.list[1]);
    await south.onItemChange();
    expect(south.subscribe).toHaveBeenCalledWith([subscriptionItem]);
    expect(logger.trace).toHaveBeenCalledWith(`Subscribing to 1 new items`);

    (southConnectorRepository.findAllItemsForSouth as jest.Mock).mockReturnValueOnce([]);
    await south.onItemChange();
    expect(south.unsubscribe).toHaveBeenCalledTimes(1);

    south.subscribe = jest.fn().mockImplementationOnce(() => {
      throw new Error('subscription error');
    });
    (southConnectorRepository.findAllItemsForSouth as jest.Mock).mockReturnValueOnce([subscriptionItem]);
    await south.onItemChange();
    expect(logger.error).toHaveBeenCalledWith(`Error when subscribing to new items. ${new Error('subscription error')}`);

    south.subscribe = jest.fn();
    south.unsubscribe = jest.fn().mockImplementationOnce(() => {
      throw new Error('unsubscription error');
    });
    (southConnectorRepository.findAllItemsForSouth as jest.Mock).mockReturnValueOnce([subscriptionItem]).mockReturnValueOnce([]);
    await south.onItemChange();
    await south.onItemChange();
    expect(logger.error).toHaveBeenCalledWith(`Error when unsubscribing to items. ${new Error('unsubscription error')}`);
  });
});
