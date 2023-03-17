import SouthConnector from './south-connector';
import PinoLogger from '../tests/__mocks__/logger.mock';
import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';

import { SouthConnectorDTO, SouthConnectorManifest, OibusItemDTO } from '../../../shared/model/south-connector.model';

import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import ProxyService from '../service/proxy.service';
import RepositoryService from '../service/repository.service';

import { delay, generateIntervals } from '../service/utils';

// Mock fs
jest.mock('node:fs/promises');

jest.mock('../service/repository.service');
jest.mock('../service/encryption.service');

const createCacheHistoryTableMock = jest.fn();
const getSouthCacheMock = jest.fn();
const createOrUpdateCacheScanModeMock = jest.fn();
jest.mock('../service/south-cache.service');
jest.mock(
  '../service/south-cache.service',
  () =>
    function () {
      return {
        createCacheHistoryTable: createCacheHistoryTableMock,
        getSouthCache: getSouthCacheMock,
        createOrUpdateCacheScanMode: createOrUpdateCacheScanModeMock
      };
    }
);
jest.mock('../service/proxy.service');
jest.mock('../service/status.service');

jest.mock('../service/utils');

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const proxyService: ProxyService = new ProxyService(repositoryService.proxyRepository, encryptionService);

const nowDateString = '2020-02-02T02:02:02.222Z';
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

const addValues = jest.fn();
const addFile = jest.fn();

let south: SouthConnector;
let configuration: SouthConnectorDTO;
const manifest: SouthConnectorManifest = {
  name: 'south',
  description: 'My South Connector test',
  category: 'test',
  modes: {
    subscription: true,
    lastPoint: true,
    lastFile: true,
    historyPoint: true,
    historyFile: true
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

const items: Array<OibusItemDTO> = [
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
  }
];

describe('SouthConnector enabled', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (repositoryService.scanModeRepository.getScanMode as jest.Mock)
      .mockReturnValueOnce({
        id: 'id1',
        name: 'scanMode1',
        description: 'my scan mode',
        cron: '* * * * * *'
      })
      .mockReturnValue(null);

    getSouthCacheMock.mockReturnValue({
      scanModeId: 'id1',
      maxInstant: nowDateString,
      intervalIndex: 0
    });
    configuration = { id: 'southId', name: 'south', type: 'test', description: 'my test connector', enabled: true, settings: {} };
    south = new SouthConnector(
      configuration,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolder',
      true,
      manifest
    );
    await south.start();
  });

  it('should be properly initialized', async () => {
    expect(logger.trace(`South connector ${configuration.name} enabled. Starting services...`));
    expect(createCacheHistoryTableMock).toHaveBeenCalledTimes(1);
    expect(repositoryService.scanModeRepository.getScanMode).toHaveBeenCalledWith('scanModeId1');
    expect(logger.error).toHaveBeenCalledWith('Scan mode scanModeId2 not found.');
    expect(south.isEnabled()).toBeTruthy();
  });

  it('should properly create cron job and add to queue', async () => {
    const scanMode = {
      id: 'id1',
      name: 'my scan mode',
      description: 'my description',
      cron: '* * * * * *'
    };
    (repositoryService.scanModeRepository.getScanMode as jest.Mock).mockReturnValue(scanMode);

    south.addToQueue = jest.fn();
    await south.connect();
    expect(logger.debug).toHaveBeenCalledWith(`Creating South cron job for scan mode "${scanMode.name}" (${scanMode.cron})`);

    await south.connect();
    expect(logger.debug).toHaveBeenCalledWith(
      `Removing existing South cron job associated to scan mode "${scanMode.name}" (${scanMode.cron})`
    );

    jest.advanceTimersByTime(1000);
    expect(south.addToQueue).toHaveBeenCalledTimes(1);
    expect(south.addToQueue).toHaveBeenCalledWith(scanMode);

    await south.stop();
  });

  it('should properly add to queue a new task and trigger next run', async () => {
    south.run = jest.fn();
    const scanMode = {
      id: 'id1',
      name: 'my scan mode',
      description: 'my description',
      cron: '* * * * * *'
    };
    south.addToQueue(scanMode);
    expect(logger.warn).toHaveBeenCalledWith('subscribe method must be override');

    expect(south.run).toHaveBeenCalledWith(scanMode, true);
    expect(south.run).toHaveBeenCalledTimes(1);
    south.addToQueue(scanMode);

    expect(logger.warn).toHaveBeenCalledWith(`Task job not added in South connector queue for cron "${scanMode.name}" (${scanMode.cron})`);
    expect(south.run).toHaveBeenCalledTimes(1);
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

    await south.run(scanMode, true);

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
    expect(logger.error).toHaveBeenCalledWith(`Error when calling historyQuery ${new Error('history query error')}`);
    expect(logger.error).toHaveBeenCalledWith(`Error when calling fileQuery ${new Error('file query error')}`);
    expect(logger.error).toHaveBeenCalledWith(`Error when calling lastPointQuery ${new Error('last point query error')}`);

    await south.run(scanMode, true);
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

    south.run(scanMode, true);

    await south.run(scanMode, true);
    expect(logger.warn).toHaveBeenCalledWith(`A South task is already running with scan mode ${scanMode.name}`);

    south.stop();
    expect(logger.info).toHaveBeenCalledWith(`Stopping South "${configuration.name}" (${configuration.id})...`);
    expect(logger.debug).toHaveBeenCalledWith('Waiting for South task to finish');
    expect(south.disconnect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await flushPromises();
    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(logger.debug(`South connector ${configuration.id} stopped`));
  });

  it('should call default history query', async () => {
    await south.historyQuery([], nowDateString, nowDateString);
    expect(logger.warn).toHaveBeenCalledWith('historyQuery method must be override');
  });

  it('should call default file query', async () => {
    await south.fileQuery([]);
    expect(logger.warn).toHaveBeenCalledWith('fileQuery method must be override');
  });

  it('should call default last point query', async () => {
    await south.lastPointQuery([]);
    expect(logger.warn).toHaveBeenCalledWith('lastPointQuery method must be override');
  });

  it('should call default subscribe query', async () => {
    await south.subscribe([]);
    expect(logger.warn).toHaveBeenCalledWith('subscribe method must be override');
  });

  it('should add values', async () => {
    jest.resetAllMocks();
    await south.addValues([]);
    expect(logger.trace).not.toHaveBeenCalled();
    expect(addValues).not.toHaveBeenCalled();

    await south.addValues([{}, {}]);
    expect(logger.trace).toHaveBeenCalledWith(`Add 2 values to cache from South "${configuration.name}"`);
    expect(addValues).toHaveBeenCalledWith(configuration.id, [{}, {}]);
  });

  it('should add file', async () => {
    await south.addFile('file.csv');
    expect(logger.trace).toHaveBeenCalledWith(`Add file "file.csv" to cache from South "${configuration.name}"`);
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
      configuration.settings.maxReadInterval
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
      intervalIndex: 0
    });
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2022-02-02T02:02:02.222Z',
      intervalIndex: 1
    });
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2023-02-02T02:02:02.222Z',
      intervalIndex: 0
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
      configuration.settings.maxReadInterval
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
      intervalIndex: 0
    });
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2023-02-02T02:02:02.222Z',
      intervalIndex: 0
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
      configuration.settings.maxReadInterval
    );
    expect(logger.trace).toHaveBeenCalledWith(`Querying interval: ${JSON.stringify(intervals[0], null, 2)}`);
    expect(south.historyQuery).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledTimes(1);
    expect(createOrUpdateCacheScanModeMock).toHaveBeenCalledWith({
      scanModeId: 'id1',
      maxInstant: '2023-02-02T02:02:02.222Z',
      intervalIndex: 0
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
});

describe('SouthConnector disabled', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    manifest.modes.historyPoint = false;
    manifest.modes.historyFile = false;
    manifest.modes.subscription = false;

    configuration = { id: 'southId', name: 'south', type: 'test', description: 'my test connector', enabled: false, settings: {} };
    south = new SouthConnector(
      configuration,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolder',
      true,
      manifest
    );
    south.subscribe = jest.fn();
    await south.start();
  });

  it('should be properly initialized ', async () => {
    expect(logger.trace(`South connector ${configuration.name} not enabled`));
    expect(createCacheHistoryTableMock).not.toHaveBeenCalled();
    expect(createCacheHistoryTableMock).not.toHaveBeenCalled();
    expect(south.subscribe).not.toHaveBeenCalled();
  });
});

describe('SouthConnector enabled without any modes', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    manifest.modes.historyPoint = false;
    manifest.modes.historyFile = false;
    manifest.modes.subscription = false;
    manifest.modes.lastPoint = false;
    manifest.modes.lastFile = false;

    configuration = { id: 'southId', name: 'south', type: 'test', description: 'my test connector', enabled: true, settings: {} };
    south = new SouthConnector(
      configuration,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolder',
      true,
      manifest
    );
    south.subscribe = jest.fn();
    south.lastPointQuery = jest.fn();
    south.fileQuery = jest.fn();
    south.historyQueryHandler = jest.fn();
    await south.start();
  });

  it('should be properly initialized ', async () => {
    expect(logger.trace(`South connector ${configuration.name} not enabled`));
    expect(createCacheHistoryTableMock).not.toHaveBeenCalled();
    expect(createCacheHistoryTableMock).not.toHaveBeenCalled();
    expect(south.subscribe).not.toHaveBeenCalled();
  });

  it('should not run any method', async () => {
    const scanMode = {
      id: 'id1',
      name: 'my scan mode',
      description: 'my description',
      cron: '* * * * * *'
    };
    await south.run(scanMode, true);
    expect(south.lastPointQuery).not.toHaveBeenCalled();
    expect(south.fileQuery).not.toHaveBeenCalled();
    expect(south.historyQueryHandler).not.toHaveBeenCalled();
  });
});

describe('SouthConnector without stream mode', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    configuration = { id: 'southId', name: 'south', type: 'test', description: 'my test connector', enabled: true, settings: {} };
    south = new SouthConnector(
      configuration,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolder',
      false,
      manifest
    );

    await south.start();
  });

  it('should be properly initialized ', () => {
    expect(logger.trace(`Stream mode not enabled. Cron jobs and subscription won't start`));
  });

  it('should properly add item', () => {
    const item: OibusItemDTO = { id: 'id1', scanModeId: 'scanModeId', connectorId: 'southId1', name: 'my item', settings: {} };
    south.createCronJob = jest.fn();

    (repositoryService.scanModeRepository.getScanMode as jest.Mock).mockReturnValueOnce(null).mockReturnValueOnce({
      id: 'id1',
      name: 'scanMode1',
      description: 'my scan mode',
      cron: '* * * * * *'
    });

    south.addItem(item);

    expect(logger.error).toHaveBeenCalledWith(`Error when creating South item in cron jobs: scan mode ${item.scanModeId} not found`);

    south.addItem(item);

    expect(south.createCronJob).toHaveBeenCalledTimes(1);
  });

  it('should properly update item', () => {
    const item: OibusItemDTO = { id: 'id1', scanModeId: 'scanModeId', connectorId: 'southId1', name: 'my item', settings: {} };
    south.addItem = jest.fn();
    south.deleteItem = jest.fn();

    (repositoryService.scanModeRepository.getScanMode as jest.Mock).mockReturnValueOnce(null).mockReturnValueOnce({
      id: 'id1',
      name: 'scanMode1',
      cron: '* * * * * *'
    });

    south.updateItem(item, { scanModeId: 'scanModeId', name: 'my updated item', settings: {} });

    expect(logger.error).toHaveBeenCalledWith(`Error when creating South item in cron jobs: scan mode ${item.scanModeId} not found`);

    south.updateItem(item, { scanModeId: 'scanModeId', name: 'my updated item', settings: {} });

    expect(south.addItem).toHaveBeenCalledTimes(1);
    expect(south.deleteItem).toHaveBeenCalledTimes(1);
  });

  it('should properly delete item', () => {
    const item1: OibusItemDTO = { id: 'id1', scanModeId: 'scanModeId3', connectorId: 'southId1', name: 'my item', settings: {} };
    const item2: OibusItemDTO = { id: 'id2', scanModeId: 'scanModeId3', connectorId: 'southId1', name: 'my item', settings: {} };
    const item3: OibusItemDTO = { id: 'id3', scanModeId: 'scanModeId1', connectorId: 'southId1', name: 'my item', settings: {} };

    (repositoryService.scanModeRepository.getScanMode as jest.Mock).mockReturnValue({
      id: 'scanModeId3',
      name: 'scanMode1',
      description: 'my scan mode',
      cron: '* * * * * *'
    });

    south.deleteItem(item1);
    expect(logger.error).toHaveBeenCalledWith(`Error when removing South item from cron jobs: scan mode ${item1.scanModeId} was not set`);

    south.addItem(item1);
    south.addItem(item2);
    south.addItem(item3);

    south.deleteItem(item1);
    south.deleteItem(item1);
    expect(logger.error).toHaveBeenCalledWith(`Error when removing South item from cron jobs: item ${item1.id} was not set`);

    south.deleteItem(item2);
    south.deleteItem(items[0]);
    south.deleteItem(items[1]);
    south.deleteItem({ ...item1, scanModeId: undefined });
  });

  it('should use another logger', async () => {
    jest.resetAllMocks();

    south.setLogger(anotherLogger);
    await south.stop();
    expect(anotherLogger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).not.toHaveBeenCalled();
  });
});
