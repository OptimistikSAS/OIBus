import SouthConnector from './south-connector';
import PinoLogger from '../tests/__mocks__/logger.mock';
import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';

import { SouthConnectorDTO, SouthConnectorItemDTO, SouthConnectorManifest } from '../../../shared/model/south-connector.model';

import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import RepositoryService from '../service/repository.service';
import { CronJob } from 'cron';
import { delay, generateIntervals, validateCronExpression } from '../service/utils';
import { QueriesFile, QueriesHistory, QueriesLastPoint, QueriesSubscription } from './south-interface';
import { Instant } from '../../../shared/model/types';
import { ScanModeDTO } from '../../../shared/model/scan-mode.model';
import { OIBusTimeValue } from '../../../shared/model/engine.model';

// Mock fs
jest.mock('node:fs/promises');
jest.mock('cron');

jest.mock('../service/repository.service');
jest.mock('../service/encryption.service');

const createCacheHistoryTableMock = jest.fn();
const getSouthCacheMock = jest.fn();
const createOrUpdateCacheScanModeMock = jest.fn();
const resetCacheMock = jest.fn();
jest.mock(
  '../service/south-cache.service',
  () =>
    function () {
      return {
        createSouthCacheScanModeTable: createCacheHistoryTableMock,
        getSouthCacheScanMode: getSouthCacheMock,
        createOrUpdateCacheScanMode: createOrUpdateCacheScanModeMock,
        resetCacheScanMode: resetCacheMock
      };
    }
);

const updateMetricsMock = jest.fn();
const resetMetrics = jest.fn();
jest.mock(
  '../service/south-connector-metrics.service',
  () =>
    function () {
      return {
        initMetrics: jest.fn(),
        updateMetrics: updateMetricsMock,
        resetMetrics,
        get stream() {
          return { stream: 'myStream' };
        },
        metrics: {
          numberOfValuesRetrieved: 1,
          numberOfFilesRetrieved: 1,
          historyMetrics: {}
        }
      };
    }
);

jest.mock('../service/utils');

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();

const nowDateString = '2020-02-02T02:02:02.222Z';
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

const addContentCallback = jest.fn();

let configuration: SouthConnectorDTO;
const manifest: SouthConnectorManifest = {
  id: 'south',
  name: 'south',
  description: 'My South Connector test',
  category: 'test',
  modes: {
    subscription: true,
    lastPoint: true,
    lastFile: true,
    history: true,
    forceMaxInstantPerItem: false
  },
  settings: [],
  schema: {} as unknown,
  items: {
    scanMode: {
      acceptSubscription: true,
      subscriptionOnly: true
    },
    settings: [],
    schema: {} as unknown
  }
} as SouthConnectorManifest;

const items: Array<SouthConnectorItemDTO> = [
  {
    id: 'id1',
    name: 'item1',
    enabled: true,
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'item2',
    enabled: true,
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId2'
  },
  {
    id: 'id3',
    name: 'item3',
    enabled: true,
    connectorId: 'southId',
    settings: {},
    scanModeId: 'subscription'
  }
];

class TestSouth extends SouthConnector implements QueriesLastPoint, QueriesFile, QueriesSubscription, QueriesHistory {
  async lastPointQuery(): Promise<void> {}

  async fileQuery(): Promise<void> {}

  async historyQuery(): Promise<Instant> {
    return '';
  }

  async subscribe(): Promise<void> {}
  async unsubscribe(): Promise<void> {}
}

let south: TestSouth;
let basicSouth: SouthConnector;

describe('SouthConnector enabled', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    getSouthCacheMock.mockReturnValue({
      scanModeId: 'id1',
      maxInstant: nowDateString,
      intervalIndex: 0
    });
    configuration = {
      id: 'southId',
      name: 'south',
      type: 'test',
      description: 'my test connector',
      enabled: true,
      history: {
        maxInstantPerItem: false,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 30
      },
      settings: {}
    };
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);

    south = new TestSouth(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
    await south.start();
  });

  it('should properly add to queue a new task and trigger next run', async () => {
    south.run = jest.fn();
    const scanMode = {
      id: 'scanModeId1',
      name: 'my scan mode',
      description: 'my description',
      cron: '* * * * * *'
    };
    (repositoryService.southItemRepository.listSouthItems as jest.Mock).mockReturnValueOnce([items[0]]);
    (repositoryService.scanModeRepository.getScanMode as jest.Mock).mockReturnValue(scanMode);

    await south.onItemChange();
    south.addToQueue(scanMode);
    expect(south.run).toHaveBeenCalledWith(scanMode.id, [items[0]]);
    expect(south.run).toHaveBeenCalledTimes(1);

    south.addToQueue(scanMode);
    expect(logger.warn).toHaveBeenCalledWith(
      `Task job not added in South connector queue for cron "${scanMode.name}" (${scanMode.cron}). The previous cron was still running`
    );
    expect(south.run).toHaveBeenCalledTimes(1);
    expect(south.settings).toEqual(configuration);
  });

  it('should properly add to queue a new task and not trigger next run if no item', async () => {
    south.run = jest.fn();
    const scanMode = {
      id: 'scanModeId1',
      name: 'my scan mode',
      description: 'my description',
      cron: '* * * * * *'
    };
    (repositoryService.southItemRepository.listSouthItems as jest.Mock).mockReturnValueOnce([]).mockReturnValueOnce(items);

    await south.onItemChange();
    south.addToQueue(scanMode);
    expect(south.run).not.toHaveBeenCalled();

    (repositoryService.scanModeRepository.getScanMode as jest.Mock).mockReturnValue(scanMode);
    await south.onItemChange();
    south.addToQueue(scanMode);
    expect(south.run).not.toHaveBeenCalled();
  });

  it('should not add to queue if connector is stopping', async () => {
    const scanMode = {
      id: 'scanModeId1',
      name: 'my scan mode',
      description: 'my description',
      cron: '* * * * * *'
    };

    const promise = new Promise<void>(resolve => {
      setTimeout(resolve, 1000);
    });
    south.disconnect = jest.fn().mockImplementationOnce(() => {
      return promise;
    });
    south.run = jest.fn();

    south.stop();
    south.addToQueue(scanMode);
    expect(south.run).not.toHaveBeenCalled();
    await flushPromises();
  });

  it('should add to queue a new task and not trigger next run if run in progress', async () => {
    south.run = jest.fn();
    const scanMode = {
      id: 'scanModeId1',
      name: 'my scan mode',
      description: 'my description',
      cron: '* * * * * *'
    };
    south.createDeferredPromise();
    south.addToQueue(scanMode);

    expect(south.run).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('A South task is already running');
  });

  it('should properly run task a task', async () => {
    const scanMode = {
      id: 'scanModeId1',
      name: 'my scan mode',
      description: 'my description',
      cron: '* * * * * *'
    };
    south.historyQueryHandler = jest.fn().mockImplementationOnce(() => {
      throw new Error('history query error');
    });
    south.fileQuery = jest.fn().mockImplementationOnce(() => {
      throw new Error('file query error');
    });
    south.lastPointQuery = jest.fn().mockImplementationOnce(() => {
      throw new Error('last point query error');
    });

    await south.run(scanMode.id, [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        connectorId: 'southId',
        settings: {},
        scanModeId: 'scanModeId1'
      }
    ]);

    expect(south.historyQueryHandler).toHaveBeenCalledTimes(1);
    expect(south.historyQueryHandler).toHaveBeenCalledWith(
      [
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          connectorId: 'southId',
          settings: {},
          scanModeId: 'scanModeId1'
        }
      ],
      '2020-02-02T01:02:02.222Z',
      nowDateString,
      'scanModeId1'
    );
    expect(south.fileQuery).toHaveBeenCalledTimes(1);
    expect(south.lastPointQuery).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(`Error when calling historyQuery. ${new Error('history query error')}`);
    expect(logger.error).toHaveBeenCalledWith(`Error when calling fileQuery. ${new Error('file query error')}`);
    expect(logger.error).toHaveBeenCalledWith(`Error when calling lastPointQuery. ${new Error('last point query error')}`);

    await south.run(scanMode.id, items);
    expect(south.historyQueryHandler).toHaveBeenCalledTimes(2);
    expect(south.fileQuery).toHaveBeenCalledTimes(2);
    expect(south.lastPointQuery).toHaveBeenCalledTimes(2);

    expect(logger.trace).toHaveBeenCalledWith('No more task to run');
  });

  it('should properly stop', async () => {
    await south.stop();
    expect(logger.debug).toHaveBeenCalledWith('Stopping South "south" (southId)...');
    expect(logger.info).toHaveBeenCalledWith('South connector "south" stopped');
  });

  it('should properly stop with running task ', async () => {
    const scanMode = {
      id: 'id1',
      name: 'my scan mode',
      description: 'my description',
      cron: '* * * * * *'
    };
    const promise = new Promise<void>(resolve => {
      setTimeout(resolve, 1000);
    });
    south.historyQueryHandler = jest.fn(async () => promise);
    south.fileQuery = jest.fn();
    south.lastPointQuery = jest.fn();

    south.disconnect = jest.fn();

    south.run(scanMode.id, items);

    south.stop();
    expect(logger.debug).toHaveBeenCalledWith(`Stopping South "${configuration.name}" (${configuration.id})...`);
    expect(logger.debug).toHaveBeenCalledWith('Waiting for South task to finish');
    expect(south.disconnect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await flushPromises();
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(logger.info(`South connector "${configuration.name}" stopped`));
  });

  it('should add values', async () => {
    jest.clearAllMocks();
    await south.addContent({ type: 'time-values', content: [] });
    expect(logger.debug).not.toHaveBeenCalled();
    expect(addContentCallback).not.toHaveBeenCalled();

    await south.addContent({ type: 'time-values', content: [{}, {}] as Array<OIBusTimeValue> });
    expect(logger.debug).toHaveBeenCalledWith(`Add 2 values to cache from South "${configuration.name}"`);
    expect(addContentCallback).toHaveBeenCalledWith(configuration.id, { type: 'time-values', content: [{}, {}] });
  });

  it('should add file', async () => {
    await south.addContent({ type: 'raw', filePath: 'file.csv' });
    expect(logger.debug).toHaveBeenCalledWith(`Add file "file.csv" to cache from South "${configuration.name}"`);
    expect(addContentCallback).toHaveBeenCalledWith(configuration.id, { type: 'raw', filePath: 'file.csv' });
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

    await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2023-02-02T02:02:02.222Z', 'scanModeId1');
    expect(generateIntervals).toHaveBeenCalledWith(
      '2020-02-02T02:02:02.192Z',
      '2023-02-02T02:02:02.222Z',
      configuration.history.maxReadInterval
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
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledTimes(3);
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2021-02-02T02:02:02.222Z',
      southId: configuration.id
    });
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2022-02-02T02:02:02.222Z',
      southId: configuration.id
    });
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2023-02-02T02:02:02.222Z',
      southId: configuration.id
    });
  });

  it('should manage history query with 2 intervals', async () => {
    const intervals = [
      { start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' },
      { start: '2022-02-02T02:02:02.222Z', end: '2023-02-02T02:02:02.222Z' }
    ];
    (generateIntervals as jest.Mock).mockReturnValueOnce(intervals);
    south.historyQuery = jest.fn().mockReturnValueOnce('2021-02-02T02:02:02.222Z').mockReturnValueOnce('2023-02-02T02:02:02.222Z');

    await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2023-02-02T02:02:02.222Z', 'scanModeId1');
    expect(generateIntervals).toHaveBeenCalledWith(
      '2020-02-02T02:02:02.192Z',
      '2023-02-02T02:02:02.222Z',
      configuration.history.maxReadInterval
    );
    expect(logger.trace).toHaveBeenCalledWith(
      `Interval split in ${intervals.length} sub-intervals: \r\n` +
        `[${JSON.stringify(intervals[0], null, 2)}\r\n` +
        `${JSON.stringify(intervals[1], null, 2)}]`
    );
    expect(south.historyQuery).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledTimes(1);
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledTimes(2);
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2021-02-02T02:02:02.222Z',
      southId: configuration.id
    });
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2023-02-02T02:02:02.222Z',
      southId: configuration.id
    });
  });

  it('should manage history query with 1 interval', async () => {
    const intervals = [{ start: '2020-02-02T02:02:02.222Z', end: '2023-02-02T02:02:02.222Z' }];
    (generateIntervals as jest.Mock).mockReturnValueOnce(intervals);
    south.historyQuery = jest.fn().mockReturnValueOnce('2023-02-02T02:02:02.222Z');

    await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2023-02-02T02:02:02.222Z', 'scanModeId1');
    expect(generateIntervals).toHaveBeenCalledWith(
      '2020-02-02T02:02:02.192Z',
      '2023-02-02T02:02:02.222Z',
      configuration.history.maxReadInterval
    );
    expect(logger.trace).toHaveBeenCalledWith(`Querying interval: ${JSON.stringify(intervals[0], null, 2)}`);
    expect(south.historyQuery).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledTimes(1);
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2023-02-02T02:02:02.222Z',
      southId: configuration.id
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
    south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2023-02-02T02:02:02.222Z', 'scanModeId1').then(() => {
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
    expect(resetCacheMock).toHaveBeenCalledTimes(1);
  });

  it('should get metrics stream', () => {
    const stream = south.getMetricsDataStream();
    expect(stream).toEqual({ stream: 'myStream' });
  });

  it('should reset metrics', () => {
    south.resetMetrics();
    expect(resetMetrics).toHaveBeenCalledTimes(1);
  });

  it('should create subscriptions and cron jobs', async () => {
    jest.clearAllMocks();
    south.subscribe = jest.fn();
    south.unsubscribe = jest.fn();
    const scanMode1: ScanModeDTO = { id: 'scanModeId1' } as ScanModeDTO;
    const scanMode2: ScanModeDTO = { id: 'scanModeId2' } as ScanModeDTO;
    (repositoryService.scanModeRepository.getScanMode as jest.Mock).mockReturnValueOnce(scanMode1).mockReturnValueOnce(scanMode2);
    (repositoryService.southItemRepository.listSouthItems as jest.Mock).mockReturnValueOnce(items);
    await south.onItemChange();
    expect(south.subscribe).toHaveBeenCalledWith([items[2]]);
    expect(logger.trace).toHaveBeenCalledWith(`Subscribing to 1 new items`);

    (repositoryService.southItemRepository.listSouthItems as jest.Mock).mockReturnValueOnce([]);
    await south.onItemChange();
    expect(south.unsubscribe).toHaveBeenCalledTimes(1);

    south.subscribe = jest.fn().mockImplementationOnce(() => {
      throw new Error('subscription error');
    });
    (repositoryService.southItemRepository.listSouthItems as jest.Mock).mockReturnValueOnce([items[2]]);
    await south.onItemChange();
    expect(logger.error).toHaveBeenCalledWith(`Error when subscribing to new items. ${new Error('subscription error')}`);

    south.subscribe = jest.fn();
    south.unsubscribe = jest.fn().mockImplementationOnce(() => {
      throw new Error('unsubscription error');
    });
    (repositoryService.southItemRepository.listSouthItems as jest.Mock).mockReturnValueOnce([items[2]]).mockReturnValueOnce([]);
    await south.onItemChange();
    await south.onItemChange();
    expect(logger.error).toHaveBeenCalledWith(`Error when unsubscribing to items. ${new Error('unsubscription error')}`);
  });

  it('should create a cron job', async () => {
    (CronJob as unknown as jest.Mock).mockImplementation((_cron, callback) => {
      setTimeout(() => callback(), 1000);
    });
    south.addToQueue = jest.fn();
    const scanMode = {
      id: 'id1',
      name: 'scanMode1',
      description: 'my scan mode',
      cron: '* * * * * *'
    };
    south.createCronJob(scanMode);
    jest.advanceTimersByTime(1000);
    expect(south.addToQueue).toHaveBeenCalledTimes(1);

    south.createCronJob(scanMode);
    expect(`Removing existing South cron job associated to scan mode "${scanMode.name}" (${scanMode.cron})`);
  });

  it('should properly update cron', async () => {
    const scanMode = {
      id: 'id1',
      name: 'scanMode1',
      description: 'my scan mode',
      cron: '* * * * * *'
    };

    south.createCronJob(scanMode);
    await south.updateScanMode({ id: 'id1', name: 'scanMode1', cron: '* * * * *' } as ScanModeDTO);
    expect(logger.debug).toHaveBeenCalledWith(`Creating South cron job for scan mode "scanMode1" (* * * * *)`);
    expect(logger.debug).toHaveBeenCalledWith(`Removing existing South cron job associated to scan mode "scanMode1" (* * * * *)`);

    await south.connect();
    await south.disconnect();
    south.createCronJob(scanMode);

    await south.stop();
  });

  it('should not create a cron job when the cron expression is invalid', () => {
    const scanMode = {
      id: 'id1',
      name: 'scanMode1',
      description: 'my scan mode',
      cron: '* * * * * *L'
    };
    const error = new Error('Invalid cron expression');
    (validateCronExpression as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    south.createCronJob(scanMode);

    expect(logger.error).toHaveBeenCalledWith(
      `Error when creating South cron job for scan mode "${scanMode.name}" (${scanMode.cron}): ${error.message}`
    );
  });
});

describe('SouthConnector with max instant per item', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    manifest.modes.history = true;
    manifest.modes.subscription = false;

    getSouthCacheMock.mockReturnValue({
      scanModeId: 'id1',
      maxInstant: nowDateString,
      southId: configuration.id
    });

    configuration = {
      id: 'southId',
      name: 'south',
      type: 'test',
      description: 'my test connector',
      enabled: true,
      history: {
        maxInstantPerItem: true,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 30
      },
      settings: {}
    };
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);
    (repositoryService.southItemRepository.listSouthItems as jest.Mock).mockReturnValue(items);

    south = new TestSouth(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
    await south.start();
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

    await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2023-02-02T02:02:02.222Z', 'scanModeId1');
    expect(generateIntervals).toHaveBeenCalledWith(
      '2020-02-02T02:02:02.192Z',
      '2023-02-02T02:02:02.222Z',
      configuration.history.maxReadInterval
    );
    expect(generateIntervals).toHaveBeenCalledTimes(3);
    expect(south.historyQuery).toHaveBeenCalledTimes(9);
    expect(delay).toHaveBeenCalledTimes(8);
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledTimes(3);
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2021-02-02T02:02:02.222Z',
      southId: configuration.id
    });
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2022-02-02T02:02:02.222Z',
      southId: configuration.id
    });
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2023-02-02T02:02:02.222Z',
      southId: configuration.id
    });
  });

  it('should manage history query with 2 intervals with max instant per item', async () => {
    const intervals = [
      { start: '2020-02-02T02:02:02.222Z', end: '2021-02-02T02:02:02.222Z' },
      { start: '2022-02-02T02:02:02.222Z', end: '2023-02-02T02:02:02.222Z' }
    ];
    (generateIntervals as jest.Mock).mockReturnValue(intervals);
    south.historyQuery = jest.fn().mockReturnValueOnce('2021-02-02T02:02:02.222Z').mockReturnValueOnce('2023-02-02T02:02:02.222Z');

    await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2023-02-02T02:02:02.222Z', 'scanModeId1');
    expect(generateIntervals).toHaveBeenCalledWith(
      '2020-02-02T02:02:02.192Z',
      '2023-02-02T02:02:02.222Z',
      configuration.history.maxReadInterval
    );
    expect(logger.trace).toHaveBeenCalledWith(
      `Interval split in ${intervals.length} sub-intervals: \r\n` +
        `[${JSON.stringify(intervals[0], null, 2)}\r\n` +
        `${JSON.stringify(intervals[1], null, 2)}]`
    );
    expect(generateIntervals).toHaveBeenCalledTimes(3);
    expect(south.historyQuery).toHaveBeenCalledTimes(6);
    expect(delay).toHaveBeenCalledTimes(5);
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledTimes(2);
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2021-02-02T02:02:02.222Z',
      southId: configuration.id
    });
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2023-02-02T02:02:02.222Z',
      southId: configuration.id
    });
  });

  it('should manage history query with 1 interval with max instant per item', async () => {
    const intervals = [{ start: '2020-02-02T02:02:02.222Z', end: '2023-02-02T02:02:02.222Z' }];
    (generateIntervals as jest.Mock).mockReturnValue(intervals);
    south.historyQuery = jest.fn().mockReturnValueOnce('2023-02-02T02:02:02.222Z');

    await south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2023-02-02T02:02:02.222Z', 'scanModeId1');
    expect(generateIntervals).toHaveBeenCalledWith(
      '2020-02-02T02:02:02.192Z',
      '2023-02-02T02:02:02.222Z',
      configuration.history.maxReadInterval
    );
    expect(logger.trace).toHaveBeenCalledWith(`Querying interval: ${JSON.stringify(intervals[0], null, 2)}`);
    expect(south.historyQuery).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(2);
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledTimes(1);
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2023-02-02T02:02:02.222Z',
      southId: configuration.id
    });
  });

  it('should manage history query with 1 interval with 1 item and max instant per item', async () => {
    const intervals = [{ start: '2020-02-02T02:02:02.222Z', end: '2023-02-02T02:02:02.222Z' }];
    (generateIntervals as jest.Mock).mockReturnValue(intervals);
    south.historyQuery = jest.fn().mockReturnValueOnce('2023-02-02T02:02:02.222Z');

    await south.historyQueryHandler([items[0]], '2020-02-02T02:02:02.222Z', '2023-02-02T02:02:02.222Z', 'scanModeId1');
    expect(generateIntervals).toHaveBeenCalledWith(
      '2020-02-02T02:02:02.192Z',
      '2023-02-02T02:02:02.222Z',
      configuration.history.maxReadInterval
    );
    expect(logger.trace).toHaveBeenCalledWith(`Querying interval: ${JSON.stringify(intervals[0], null, 2)}`);
    expect(south.historyQuery).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledTimes(1);
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2023-02-02T02:02:02.222Z',
      southId: configuration.id
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
    south.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2023-02-02T02:02:02.222Z', 'scanModeId1').then(() => {
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

describe('SouthConnector disabled', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    manifest.modes.history = false;
    manifest.modes.subscription = false;

    getSouthCacheMock.mockReturnValue({
      scanModeId: 'id1',
      maxInstant: nowDateString,
      intervalIndex: 0
    });

    configuration = {
      id: 'southId',
      name: 'south',
      type: 'test',
      description: 'my test connector',
      enabled: false,
      history: {
        maxInstantPerItem: true,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 30
      },
      settings: {}
    };
    repositoryService.southConnectorRepository.getSouthConnector = jest.fn().mockReturnValue(configuration);

    basicSouth = new SouthConnector(configuration, addContentCallback, encryptionService, repositoryService, logger, 'baseFolder');
    await basicSouth.start();
  });

  it('should be properly initialized ', async () => {
    expect(logger.trace(`South connector ${configuration.name} not enabled`));
    expect(basicSouth.isEnabled()).toEqual(false);
    expect(createCacheHistoryTableMock).not.toHaveBeenCalled();

    basicSouth.historyQueryHandler = jest.fn();

    await basicSouth.run('scanModeId', []);
    expect(basicSouth.historyQueryHandler).not.toHaveBeenCalled();
  });

  it('should test connection', async () => {
    await basicSouth.testConnection();
    expect(logger.warn).toHaveBeenCalledWith('testConnection must be override');
  });

  it('should ignore history query when not history items', async () => {
    basicSouth.filterHistoryItems = jest.fn().mockReturnValueOnce([]);
    await basicSouth.historyQueryHandler(items, '2020-02-02T02:02:02.222Z', '2020-02-02T02:02:02.222Z', 'scanModeId');
    expect(logger.trace).toHaveBeenCalledWith('No history items to read. Ignoring historyQuery');
  });

  it('should not subscribe if queriesSubscription not supported history query when not history items', async () => {
    (repositoryService.southItemRepository.listSouthItems as jest.Mock).mockReturnValueOnce([]);

    basicSouth.queriesSubscription = jest.fn().mockReturnValueOnce(false);

    await basicSouth.onItemChange();

    expect(basicSouth.queriesSubscription).toHaveBeenCalledTimes(1);
  });

  it('should test item', async () => {
    let callback = jest.fn();
    await basicSouth.testItem(items[0], callback);
    expect(logger.warn).toHaveBeenCalledWith('testItem must be override to test item item1');
  });
});
