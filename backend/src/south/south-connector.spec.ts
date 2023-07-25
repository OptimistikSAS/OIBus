import SouthConnector from './south-connector';
import PinoLogger from '../tests/__mocks__/logger.mock';
import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';

import { SouthConnectorDTO, SouthConnectorItemDTO, SouthConnectorManifest } from '../../../shared/model/south-connector.model';

import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import RepositoryService from '../service/repository.service';

import { delay, generateIntervals } from '../service/utils';
import { QueriesFile, QueriesHistory, QueriesLastPoint, QueriesSubscription } from './south-interface';
import { Instant } from '../../../shared/model/types';

// Mock fs
jest.mock('node:fs/promises');

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
          numberOfFilesRetrieved: 1
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

const addValues = jest.fn();
const addFile = jest.fn();

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
    history: true
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
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'item2',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId2'
  },
  {
    id: 'id3',
    name: 'item3',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
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
    jest.resetAllMocks();
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
        readDelay: 0
      },
      settings: {}
    };
    south = new TestSouth(configuration, [...items], addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
    await south.init();
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
    south.addToQueue(scanMode);

    expect(south.run).toHaveBeenCalledWith(scanMode.id, [items[0], items[2]]);
    expect(south.run).toHaveBeenCalledTimes(1);
    south.addToQueue(scanMode);

    expect(logger.warn).toHaveBeenCalledWith(`Task job not added in South connector queue for cron "${scanMode.name}" (${scanMode.cron})`);
    expect(south.run).toHaveBeenCalledTimes(1);
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
    expect(logger.info).toHaveBeenCalledWith('Stopping South "south" (southId)...');
    expect(logger.info).toHaveBeenCalledWith('South connector "south" (southId) disconnected');
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
    expect(logger.info).toHaveBeenCalledWith(`Stopping South "${configuration.name}" (${configuration.id})...`);
    expect(logger.debug).toHaveBeenCalledWith('Waiting for South task to finish');
    expect(south.disconnect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await flushPromises();
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(logger.debug(`South connector ${configuration.id} stopped`));
  });

  it('should add values', async () => {
    jest.resetAllMocks();
    await south.addValues([]);
    expect(logger.debug).not.toHaveBeenCalled();
    expect(addValues).not.toHaveBeenCalled();

    await south.addValues([{}, {}]);
    expect(logger.debug).toHaveBeenCalledWith(`Add 2 values to cache from South "${configuration.name}"`);
    expect(addValues).toHaveBeenCalledWith(configuration.id, [{}, {}]);
  });

  it('should add file', async () => {
    await south.addFile('file.csv');
    expect(logger.debug).toHaveBeenCalledWith(`Add file "file.csv" to cache from South "${configuration.name}"`);
    expect(addFile).toHaveBeenCalledWith(configuration.id, 'file.csv');
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
      '2020-02-02T02:02:02.222Z',
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
      '2020-02-02T02:02:02.222Z',
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
      '2020-02-02T02:02:02.222Z',
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

  it('should properly add item', async () => {
    const item: SouthConnectorItemDTO = {
      id: 'id1',
      scanModeId: 'scanModeId',
      connectorId: 'southId1',
      name: 'my item',
      settings: {}
    };
    south.createCronJob = jest.fn();

    (repositoryService.scanModeRepository.getScanMode as jest.Mock).mockReturnValueOnce(null).mockReturnValueOnce({
      id: 'id1',
      name: 'scanMode1',
      description: 'my scan mode',
      cron: '* * * * * *'
    });

    await south.addItem(item);

    expect(logger.error).toHaveBeenCalledWith(`Error when creating South item in cron jobs: scan mode ${item.scanModeId} not found`);

    await south.addItem(item);

    expect(south.createCronJob).toHaveBeenCalledTimes(1);
  });

  it('should properly update item', async () => {
    const item: SouthConnectorItemDTO = {
      id: 'id1',
      scanModeId: 'scanModeId',
      connectorId: 'southId1',
      name: 'my item',
      settings: {}
    };
    south.addItem = jest.fn();
    south.deleteItem = jest.fn();

    (repositoryService.scanModeRepository.getScanMode as jest.Mock).mockReturnValueOnce(null).mockReturnValueOnce({
      id: 'id1',
      name: 'scanMode1',
      cron: '* * * * * *'
    });

    await south.updateItem(item, {
      id: 'itemId',
      scanModeId: 'scanModeId',
      connectorId: 'id',
      name: 'my updated item',
      settings: {}
    });

    expect(logger.error).toHaveBeenCalledWith(`Error when creating South item in cron jobs: scan mode ${item.scanModeId} not found`);

    await south.updateItem(item, {
      id: 'itemId',
      scanModeId: 'scanModeId',
      connectorId: 'id',
      name: 'my updated item',
      settings: {}
    });

    expect(south.addItem).toHaveBeenCalledTimes(1);
    expect(south.deleteItem).toHaveBeenCalledTimes(1);
  });

  it('should properly delete item', () => {
    const item1: SouthConnectorItemDTO = {
      id: 'id1',
      scanModeId: 'scanModeId3',
      connectorId: 'southId1',
      name: 'my item',
      settings: {}
    };
    const item2: SouthConnectorItemDTO = {
      id: 'id2',
      scanModeId: 'scanModeId3',
      connectorId: 'southId1',
      name: 'my item',
      settings: {}
    };
    const item3: SouthConnectorItemDTO = {
      id: 'id3',
      scanModeId: 'scanModeId1',
      connectorId: 'southId1',
      name: 'my item',
      settings: {}
    };
    const item4: SouthConnectorItemDTO = {
      id: 'id4',
      scanModeId: 'subscription',
      connectorId: 'southId1',
      name: 'my item',
      settings: {}
    };

    (repositoryService.scanModeRepository.getScanMode as jest.Mock).mockReturnValue({
      id: 'scanModeId3',
      name: 'scanMode1',
      description: 'my scan mode',
      cron: '* * * * * *'
    });
    south.unsubscribe = jest.fn();
    south.createSubscriptions = jest.fn();

    south.deleteItem(item1);

    south.addItem(item1);
    south.addItem(item2);
    south.addItem(item3);

    south.deleteItem(item1);
    south.deleteItem(item1);

    south.deleteItem(item2);
    south.deleteItem(items[0]);
    south.deleteItem(items[1]);

    south.addItem(item4);
    south.deleteItem(item4);
    south.addItem(item3);
    south.deleteAllItems();
    expect(south.createSubscriptions).toHaveBeenCalledTimes(1);
    expect(south.createSubscriptions).toHaveBeenCalledWith([item4]);
    expect(south.unsubscribe).toHaveBeenCalledTimes(2);
    expect(south.unsubscribe).toHaveBeenCalledWith([item4]);
  });

  it('should use another logger', async () => {
    jest.resetAllMocks();

    south.setLogger(anotherLogger);
    await south.stop();
    expect(anotherLogger.info).toHaveBeenCalledTimes(2);
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

  it('should create subscriptions', async () => {
    south.subscribe = jest.fn();
    await south.createSubscriptions([items[1]]);
    expect(south.subscribe).toHaveBeenCalledWith([items[1]]);
    expect(logger.debug).toHaveBeenCalledWith(`Subscribing to 1 items`);

    (south.subscribe as jest.Mock).mockClear();
    south.queriesSubscription = jest.fn().mockReturnValueOnce(false);
    await south.createSubscriptions([items[1]]);
    expect(south.subscribe).not.toHaveBeenCalled();
  });

  it('should create cron jobs', async () => {
    (repositoryService.scanModeRepository.getScanMode as jest.Mock)
      .mockReturnValueOnce({
        id: 'id1',
        name: 'scanMode1',
        description: 'my scan mode',
        cron: '* * * * * *'
      })
      .mockReturnValueOnce({
        id: 'id2',
        name: 'scanMode2',
        description: 'my scan mode',
        cron: '* * * * * *'
      })
      .mockReturnValueOnce({
        id: 'id1',
        name: 'scanMode1',
        description: 'my scan mode',
        cron: '* * * * * *'
      });

    south.createCronJob = jest.fn();
    south.createCronJobs(items);
    expect(south.createCronJob).toHaveBeenCalledTimes(2);
  });

  it('should create a cron job', async () => {
    south.addToQueue = jest.fn();
    const scanMode = {
      id: 'id1',
      name: 'scanMode1',
      description: 'my scan mode',
      cron: '* * * * * *'
    };
    south.createCronJob(scanMode);

    south.createCronJob(scanMode);
    expect(`Removing existing South cron job associated to scan mode "${scanMode.name}" (${scanMode.cron})`);
    jest.advanceTimersByTime(1000);
    expect(south.addToQueue).toHaveBeenCalledTimes(1);

    await south.disconnect();
    south.createCronJob(scanMode);

    await south.stop();
  });
});

describe('SouthConnector with max instant per item', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
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
        readDelay: 0
      },
      settings: {}
    };
    south = new TestSouth(configuration, [...items], addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
    await south.init();
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
      '2020-02-02T02:02:02.222Z',
      '2023-02-02T02:02:02.222Z',
      configuration.history.maxReadInterval
    );
    expect(generateIntervals).toHaveBeenCalledTimes(3);
    expect(south.historyQuery).toHaveBeenCalledTimes(9);
    expect(delay).toHaveBeenCalledTimes(8);
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledTimes(9);
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
      '2020-02-02T02:02:02.222Z',
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
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledTimes(6);
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
      '2020-02-02T02:02:02.222Z',
      '2023-02-02T02:02:02.222Z',
      configuration.history.maxReadInterval
    );
    expect(logger.trace).toHaveBeenCalledWith(`Querying interval: ${JSON.stringify(intervals[0], null, 2)}`);
    expect(south.historyQuery).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(2);
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledTimes(3);
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
      '2020-02-02T02:02:02.222Z',
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
    jest.resetAllMocks();
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
        readDelay: 0
      },
      settings: {}
    };
    basicSouth = new SouthConnector(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
    await basicSouth.init();
    await basicSouth.start();
  });

  it('should be properly initialized ', async () => {
    expect(logger.trace(`South connector ${configuration.name} not enabled`));
    expect(basicSouth.isEnabled()).toEqual(false);
    expect(createCacheHistoryTableMock).not.toHaveBeenCalled();

    basicSouth.historyQueryHandler = jest.fn();

    await basicSouth.run('scanModeId', []);

    expect(basicSouth.historyQueryHandler).not.toHaveBeenCalled();

    await basicSouth.deleteAllItems();
  });
});
