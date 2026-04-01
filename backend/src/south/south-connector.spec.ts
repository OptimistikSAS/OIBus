import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';

import pino from 'pino';
import { CronJob } from 'cron';
import { generateIntervals, groupItemsByGroup, validateCronExpression } from '../service/utils';
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
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../tests/__mocks__/service/south-cache-service.mock';
import { flushPromises } from '../tests/utils/test-utils';
import SouthOPCUA from './south-opcua/south-opcua';
import SouthMSSQL from './south-mssql/south-mssql';
import { DateTime } from 'luxon';

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

jest.mock('../service/encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
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
    (groupItemsByGroup as jest.Mock).mockImplementation((_type, items) => [items]);

    const config = JSON.parse(JSON.stringify(testData.south.list[0])) as SouthConnectorEntity<
      SouthFolderScannerSettings,
      SouthFolderScannerItemSettings
    >;
    south = new SouthFolderScanner(config, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    await south.start();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should properly add to queue a new task and trigger next run', async () => {
    south.run = jest.fn();

    south.addToQueue(testData.scanMode.list[0]);
    expect(south.run).toHaveBeenCalledWith(
      testData.scanMode.list[0].id,
      testData.south.list[0].items.filter(element => element.scanMode.id === testData.scanMode.list[0].id)
    );
    expect(south.run).toHaveBeenCalledTimes(1);

    south.addToQueue(testData.scanMode.list[0]);
    expect(logger.warn).toHaveBeenCalledWith(
      `Task job not added in South connector queue for cron "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron}). The previous cron was still running`
    );
    south.addToQueue(testData.scanMode.list[1]);
    expect(south.run).toHaveBeenCalledTimes(1);
    expect(south.connectorConfiguration).toEqual(testData.south.list[0]);
  });

  it('should properly add to queue a new task and not trigger next run if no item', async () => {
    south.run = jest.fn();
    south['connector'].items = [];
    south.addToQueue(testData.scanMode.list[0]);
    expect(south.run).not.toHaveBeenCalled();
  });

  it('should not update subscriptions if not compatible', async () => {
    await south.updateSubscriptions();
    expect(logger.trace).toHaveBeenCalledWith('This connector does not support subscriptions');

    south.connectorConfiguration = testData.south.list[0] as SouthConnectorEntity<
      SouthFolderScannerSettings,
      SouthFolderScannerItemSettings
    >;
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

  it('should update cron jobs', async () => {
    south.updateCronJobs();
    south.updateCronJobs();
    expect(south['cronByScanModeIds'].size).toBe(2);

    south.createOrUpdateCronJob = jest.fn();
    south.updateScanModeIfUsed({
      id: 'bad id',
      cron: '',
      description: '',
      name: '',
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    });

    south['connector'].items = [];
    south.updateCronJobs();
    expect(south['cronByScanModeIds'].size).toBe(0);
  });

  it('should use another logger', async () => {
    jest.clearAllMocks();

    south.setLogger(anotherLogger);
    await south.stop();
    expect(anotherLogger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
    south.hasSubscription();
  });

  it('should reset cache', async () => {
    await south.resetCache();
    expect(southCacheService.dropItemValueTable).toHaveBeenCalledTimes(1);
  });

  it('should create a cron job', async () => {
    (CronJob as unknown as jest.Mock).mockImplementation((_cron, callback) => {
      setTimeout(() => callback(), 1000);
    });
    south.addToQueue = jest.fn();
    south.createOrUpdateCronJob(testData.scanMode.list[0]);
    jest.advanceTimersByTime(1000);
    expect(south.addToQueue).toHaveBeenCalledTimes(1);

    south.createOrUpdateCronJob(testData.scanMode.list[0]);
    expect(
      `Removing existing South cron job associated to scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
    );
  });

  it('should properly update cron', async () => {
    south.createOrUpdateCronJob(testData.scanMode.list[0]);
    await south.updateScanModeIfUsed(testData.scanMode.list[0]);
    await south.connect();
    await south.disconnect();
    south.createOrUpdateCronJob(testData.scanMode.list[0]);

    await south.stop();

    expect(logger.debug).toHaveBeenCalledWith(
      `Creating South cron job for scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `Removing existing South cron job associated to scan mode "${testData.scanMode.list[0].name}" (${testData.scanMode.list[0].cron})`
    );
  });

  it('should not create a cron job when the cron expression is invalid', () => {
    const error = new Error('Invalid cron expression');
    (validateCronExpression as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    south.createOrUpdateCronJob({ ...testData.scanMode.list[0], cron: '* * * * * *L' });

    expect(logger.error).toHaveBeenCalledWith(
      `Error when creating South cron job for scan mode "${testData.scanMode.list[0].name}" (* * * * * *L): ${error.message}`
    );
  });

  it('should query files', async () => {
    south.directQuery = jest
      .fn()
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => {
        throw new Error('file query error');
      });
    await south.run(
      testData.scanMode.list[0].id,
      testData.south.list[0].items as Array<SouthConnectorItemEntity<SouthFolderScannerItemSettings>>
    );
    expect(south.directQuery).toHaveBeenCalledTimes(1);
    expect(south.directQuery).toHaveBeenCalledWith(testData.south.list[0].items);
    expect(logger.trace).toHaveBeenCalledWith(`Direct querying 2 items`);

    await south.run(
      testData.scanMode.list[0].id,
      testData.south.list[0].items as Array<SouthConnectorItemEntity<SouthFolderScannerItemSettings>>
    );

    expect(logger.error).toHaveBeenCalledWith(`Error when calling directQuery: file query error`);
  });
});

describe('SouthConnector disabled', () => {
  let south: SouthMSSQL;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    southCacheService.getSouthCache.mockReturnValue({
      southId: testData.south.list[1].id,
      scanModeId: testData.scanMode.list[0].id,
      maxInstant: testData.constants.dates.FAKE_NOW
    });
    (groupItemsByGroup as jest.Mock).mockImplementation((_type, items) => [items]);

    south = new SouthMSSQL(
      testData.south.list[1] as SouthConnectorEntity<SouthMSSQLSettings, SouthMSSQLItemSettings>,
      addContentCallback,
      southCacheRepository,
      logger,
      'cacheFolder'
    );
    await south.start();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be properly initialized ', async () => {
    expect(logger.trace(`South connector ${testData.south.list[1].name} not enabled`));
    expect(south.isEnabled()).toEqual(false);
    expect(southCacheService.createItemValueTable).not.toHaveBeenCalled();

    south.historyQueryHandler = jest.fn();
  });

  it('should ignore history query when not history items', async () => {
    await south.historyQueryHandler([], '2020-02-02T02:02:02.222Z', '2020-02-02T02:02:02.222Z');
    south.resolveDeferredPromise();
    expect(logger.trace).toHaveBeenCalledWith('No history items to read. Ignoring historyQuery');
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
    (groupItemsByGroup as jest.Mock).mockImplementation((_type, items) => [items]);

    south = new SouthOPCUA(
      testData.south.list[2] as SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings>,
      addContentCallback,
      southCacheRepository,
      logger,
      'cacheFolder'
    );

    south.connect = jest.fn();
    south.disconnect = jest.fn();
    await south.start();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should properly run task a task', async () => {
    south.historyQueryHandler = jest.fn().mockImplementationOnce(() => {
      throw new Error('history query error');
    });
    south.directQuery = jest.fn().mockImplementationOnce(() => {
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
      testData.constants.dates.FAKE_NOW
    );
    expect(south.directQuery).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(`Error when calling historyQuery: history query error`);
    expect(logger.error).toHaveBeenCalledWith(`Error when calling directQuery: last point query error`);

    await south.run(testData.scanMode.list[0].id, testData.south.list[2].items as Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>);

    expect(south.historyQueryHandler).toHaveBeenCalledWith(
      testData.south.list[2].items,
      DateTime.fromISO(testData.constants.dates.FAKE_NOW)
        .minus(3600 * 1000) // minus 3600*1000 because maxReadInterval is set to 1 s
        .toUTC()
        .toISO()!,
      testData.constants.dates.FAKE_NOW
    );
    expect(south.historyQueryHandler).toHaveBeenCalledTimes(2);
    expect(south.directQuery).toHaveBeenCalledTimes(2);

    expect(logger.trace).toHaveBeenCalledWith('No more task to run');

    south['stopping'] = true;
    const emitSpy = jest.spyOn(south['taskRunner'], 'emit');

    await south.run('scanModeId', []);
    expect(emitSpy).not.toHaveBeenCalled();
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
    south.directQuery = jest.fn();

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
    await south.addContent({ type: 'time-values', content: [] }, testData.constants.dates.DATE_1, []);
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(addContentCallback).not.toHaveBeenCalled();
    expect(southCacheService.saveItemLastValue).not.toHaveBeenCalled();

    const values = [{}, {}] as Array<OIBusTimeValue>;
    await south.addContent({ type: 'time-values', content: values }, testData.constants.dates.DATE_1, testData.south.list[2].items);
    expect(logger.debug).toHaveBeenCalledWith(`Add 2 values to cache from South "${testData.south.list[2].name}"`);
    expect(addContentCallback).toHaveBeenCalledWith(
      testData.south.list[2].id,
      { type: 'time-values', content: values },
      testData.constants.dates.DATE_1,
      testData.south.list[2].items
    );
  });

  it('should add file', async () => {
    await south.addContent({ type: 'any', filePath: 'file.csv' }, testData.constants.dates.DATE_1, testData.south.list[2].items);
    expect(logger.debug).toHaveBeenCalledWith(`Add file "file.csv" to cache from South "${testData.south.list[2].name}"`);
    expect(addContentCallback).toHaveBeenCalledWith(
      testData.south.list[2].id,
      { type: 'any', filePath: 'file.csv' },
      testData.constants.dates.DATE_1,
      testData.south.list[2].items
    );
  });

  it('should add any content', async () => {
    await south.addContent({ type: 'any-content', content: 'file.csv' }, testData.constants.dates.DATE_1, []);
    expect(logger.debug).toHaveBeenCalledWith(`Add 8 bytes of content to cache from South "${testData.south.list[2].name}"`);
    expect(addContentCallback).toHaveBeenCalledWith(
      testData.south.list[2].id,
      { type: 'any-content', content: 'file.csv' },
      testData.constants.dates.DATE_1,
      []
    );
  });

  it('should manage history query with several intervals when stopping', async () => {
    const intervals = [
      { start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' },
      { start: '2021-02-02T02:02:02.222Z', end: '2022-02-02T02:02:02.222Z' },
      { start: '2022-02-02T02:02:02.222Z', end: '2023-02-02T02:02:02.222Z' }
    ];
    (generateIntervals as jest.Mock).mockReturnValueOnce({ intervals, numberOfIntervalsDone: 0 });

    south.historyQuery = jest.fn().mockImplementation(
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
        '2023-02-02T02:02:02.222Z'
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

  it('should use group historian settings when syncWithGroup is true', async () => {
    const group = {
      id: 'group1',
      name: 'Group 1',
      scanMode: testData.scanMode.list[0],
      maxReadInterval: 1800,
      readDelay: 100,
      overlap: 50,
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    const itemsWithGroup = [
      {
        ...(testData.south.list[2].items[0] as SouthConnectorItemEntity<SouthOPCUAItemSettings>),
        group,
        syncWithGroup: true
      }
    ];

    (generateIntervals as jest.Mock).mockReturnValueOnce({ intervals: [], numberOfIntervalsDone: 0 });

    await south.historyQueryHandler(itemsWithGroup, '2020-02-02T02:02:02.222Z', '2023-02-02T02:02:02.222Z');

    expect(generateIntervals).toHaveBeenCalledWith('2020-02-02T02:02:02.222Z', expect.any(String), '2023-02-02T02:02:02.222Z', 1800);
  });

  it('should update subscriptions', async () => {
    south['connector'].items = south['connector'].items.map(item => ({ ...item, scanMode: { ...item.scanMode, id: 'subscription' } }));
    south['subscribedItems'] = [south['connector'].items[0]];
    south.unsubscribe = jest.fn();
    south.subscribe = jest.fn();
    await south.updateSubscriptions();
    expect(logger.trace).toHaveBeenCalledWith('Subscribing to 3 new items');

    south['connector'].items = [];

    await south.updateSubscriptions();

    expect(logger.trace).toHaveBeenCalledWith('Unsubscribing from 4 items');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should update subscriptions and log error', async () => {
    south['connector'].items = [
      {
        id: 'southItemId5',
        name: 'opcua sub',
        enabled: true,
        settings: {
          mode: 'da'
        } as SouthOPCUAItemSettings,
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        scanMode: {
          id: 'subscription',
          name: 'subscription',
          description: '',
          cron: '',
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        },
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'southItemId5',
        name: 'opcua sub',
        enabled: true,
        settings: {
          mode: 'da'
        } as SouthOPCUAItemSettings,
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        scanMode: {
          id: 'subscription',
          name: 'subscription',
          description: '',
          cron: '',
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        },
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ];
    south.unsubscribe = jest.fn().mockImplementationOnce(() => {
      throw new Error('unsubscribe error');
    });
    south.subscribe = jest.fn().mockImplementationOnce(() => {
      throw new Error('subscribe error');
    });
    await south.updateSubscriptions();
    expect(logger.error).toHaveBeenCalledWith('Error when subscribing to new items: subscribe error');
    await south.updateSubscriptions(); // call it again to subscribe before unsubscribing
    south['connector'].items = [];

    await south.updateSubscriptions();
    expect(logger.error).toHaveBeenCalledWith('Error when unsubscribing from items: unsubscribe error');
  });
});
