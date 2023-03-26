import HistoryQuery from './history-query';
import PinoLogger from '../tests/__mocks__/logger.mock';
import SouthServiceMock from '../tests/__mocks__/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/north-service.mock';

import { OibusItemDTO } from '../../../shared/model/south-connector.model';
import { HistoryQueryDTO } from '../../../shared/model/history-query.model';

import SouthService from '../service/south.service';
import NorthService from '../service/north.service';

import { createFolder } from '../service/utils';

import pino from 'pino';
import path from 'node:path';

jest.mock('../service/south.service');
jest.mock('../service/north.service');
jest.mock('../service/utils');

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const southService: SouthService = new SouthServiceMock();
const northService: NorthService = new NorthServiceMock();

const nowDateString = '2020-02-02T02:02:02.222Z';

let historyQuery: HistoryQuery;
let configuration: HistoryQueryDTO;

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

const createdSouth = {
  start: jest.fn(),
  stop: jest.fn(),
  connect: jest.fn(),
  historyQueryHandler: jest.fn(),
  addItem: jest.fn(),
  deleteItem: jest.fn(),
  resetCache: jest.fn()
};
const createdNorth = {
  start: jest.fn(),
  stop: jest.fn(),
  connect: jest.fn(),
  cacheValues: jest.fn(),
  cacheFile: jest.fn(),
  resetCache: jest.fn()
};

describe('HistoryQuery enabled', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (southService.createSouth as jest.Mock).mockReturnValue(createdSouth);
    (northService.createNorth as jest.Mock).mockReturnValue(createdNorth);

    configuration = {
      id: 'historyId',
      name: 'history',
      southType: 'FolderScanner',
      northType: 'Console',
      description: 'my test history query',
      enabled: true,
      northSettings: {},
      southSettings: {},
      startTime: '2021-02-02T02:02:02.222Z',
      endTime: '2022-02-02T02:02:02.222Z',
      caching: {
        scanModeId: 'scanModeId',
        timeout: 1,
        retryCount: 3,
        groupCount: 1000,
        maxSendCount: 10000,
        retryInterval: 5000
      },
      archive: {
        enabled: false,
        retentionDuration: 0
      }
    };
    historyQuery = new HistoryQuery(configuration, southService, northService, items, logger, 'baseFolder');
  });

  it('should be properly initialized', async () => {
    historyQuery.runSouthConnector = jest.fn();
    await historyQuery.start();
    expect(createFolder).toHaveBeenCalledWith(path.resolve('baseFolder', configuration.id));
    expect(createFolder).toHaveBeenCalledWith(path.resolve('baseFolder', configuration.id, 'south'));
    expect(createFolder).toHaveBeenCalledWith(path.resolve('baseFolder', configuration.id, 'north'));
    expect(createdNorth.start).toHaveBeenCalledTimes(1);
    expect(createdNorth.connect).toHaveBeenCalledTimes(1);
    expect(historyQuery.runSouthConnector).toHaveBeenCalledTimes(1);
  });

  it('should manage error when no south found', async () => {
    (southService.createSouth as jest.Mock).mockReturnValueOnce(null);

    historyQuery.runSouthConnector = jest.fn();
    let error;
    try {
      await historyQuery.start();
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(
      new Error(`Could not instantiate South type ${configuration.southType} for History Query ${configuration.name} (${configuration.id})`)
    );
    expect(historyQuery.runSouthConnector).not.toHaveBeenCalled();
  });

  it('should manage error when no south found', async () => {
    (northService.createNorth as jest.Mock).mockReturnValue(null);

    historyQuery.runSouthConnector = jest.fn();
    let error;
    try {
      await historyQuery.start();
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(
      new Error(`Could not instantiate North type ${configuration.northType} for History Query ${configuration.name} (${configuration.id})`)
    );
    expect(historyQuery.runSouthConnector).not.toHaveBeenCalled();
  });

  it('should start south connector', async () => {
    createdSouth.historyQueryHandler.mockImplementation(() => {
      return new Promise(resolve => {
        resolve('');
      });
    });
    await historyQuery.start();
    expect(createdSouth.start).toHaveBeenCalledTimes(1);
    expect(createdSouth.connect).toHaveBeenCalledTimes(1);
    expect(createdSouth.historyQueryHandler).toHaveBeenCalledTimes(1);
    expect(createdSouth.historyQueryHandler).toHaveBeenCalledWith(items, configuration.startTime, configuration.endTime, 'history');
  });

  it('should start south connector with error', async () => {
    createdSouth.historyQueryHandler
      .mockImplementationOnce(() => {
        return new Promise((resolve, reject) => {
          reject('error');
        });
      })
      .mockImplementation(() => {
        return new Promise(resolve => {
          resolve('');
        });
      });
    await historyQuery.start();
    expect(createdSouth.start).toHaveBeenCalledTimes(2);
    expect(createdSouth.connect).toHaveBeenCalledTimes(2);
    expect(createdSouth.historyQueryHandler).toHaveBeenCalledTimes(1);
    expect(createdSouth.historyQueryHandler).toHaveBeenCalledWith(items, configuration.startTime, configuration.endTime, 'history');
    expect(logger.error).toHaveBeenCalledWith(
      `Restarting South for "${configuration.name}" after an error while running South history query handler: error`
    );
  });

  it('should cache values', async () => {
    historyQuery.runSouthConnector = jest.fn();
    await historyQuery.start();

    await historyQuery.addValues('southId', ['', '']);
    expect(logger.info).toHaveBeenCalledWith(`Add 2 values from History Query "${configuration.name}" to north connector`);
    expect(createdNorth.cacheValues).toHaveBeenCalledWith(['', '']);
  });

  it('should cache file', async () => {
    historyQuery.runSouthConnector = jest.fn();
    await historyQuery.start();

    await historyQuery.addFile('southId', 'myFile');
    expect(logger.info).toHaveBeenCalledWith(`Add file "myFile" from History Query "${configuration.name}" to north connector`);
    expect(createdNorth.cacheFile).toHaveBeenCalledWith('myFile');
  });

  it('should properly stop', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    historyQuery.runSouthConnector = jest.fn();
    await historyQuery.start();
    await historyQuery.stop();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(createdSouth.stop).toHaveBeenCalledTimes(1);
    expect(createdNorth.stop).toHaveBeenCalledTimes(1);
    expect(createdNorth.resetCache).not.toHaveBeenCalled();
    expect(createdSouth.resetCache).not.toHaveBeenCalled();
    await historyQuery.stop(true);
    expect(createdNorth.resetCache).toHaveBeenCalledTimes(1);
    expect(createdSouth.resetCache).toHaveBeenCalledTimes(1);
  });

  it('should properly finish', async () => {
    historyQuery.stop = jest.fn();
    await historyQuery.finish();

    expect(historyQuery.stop).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(`Finish "${configuration.name}" (${configuration.id})`);
  });

  it('should properly add item', async () => {
    historyQuery.runSouthConnector = jest.fn();

    await historyQuery.start();
    historyQuery.stop = jest.fn();
    historyQuery.start = jest.fn();
    await historyQuery.addItem(items[0]);
    expect(historyQuery.stop).toHaveBeenCalledTimes(1);
    expect(historyQuery.start).toHaveBeenCalledTimes(1);
    expect(createdSouth.addItem).toHaveBeenCalledTimes(1);
    expect(createdSouth.addItem).toHaveBeenCalledWith(items[0]);
  });

  it('should properly update item', async () => {
    historyQuery.runSouthConnector = jest.fn();

    await historyQuery.start();
    historyQuery.deleteItem = jest.fn();
    historyQuery.addItem = jest.fn();
    await historyQuery.updateItem(items[0]);
    expect(historyQuery.deleteItem).toHaveBeenCalledTimes(1);
    expect(historyQuery.addItem).toHaveBeenCalledTimes(1);
  });

  it('should properly delete item', async () => {
    historyQuery.runSouthConnector = jest.fn();

    await historyQuery.start();
    await historyQuery.deleteItem(items[0]);
    expect(createdSouth.deleteItem).toHaveBeenCalledTimes(1);
    expect(createdSouth.deleteItem).toHaveBeenCalledWith(items[0]);
  });

  it('should do nothing when adding item without any south', async () => {
    historyQuery.stop = jest.fn();
    historyQuery.start = jest.fn();
    await historyQuery.addItem(items[0]);
    expect(historyQuery.stop).not.toHaveBeenCalled();
    expect(historyQuery.start).not.toHaveBeenCalled();
    expect(createdSouth.addItem).not.toHaveBeenCalled();
  });

  it('should do nothing when updating item without any south', async () => {
    historyQuery.deleteItem = jest.fn();
    historyQuery.addItem = jest.fn();
    await historyQuery.updateItem(items[0]);
    expect(historyQuery.deleteItem).not.toHaveBeenCalled();
    expect(historyQuery.addItem).not.toHaveBeenCalled();
  });

  it('should do nothing when deleting item without any south', async () => {
    await historyQuery.deleteItem(items[0]);
    expect(createdSouth.deleteItem).not.toHaveBeenCalled();
  });

  it('should properly set another logger', async () => {
    historyQuery.stop = jest.fn();
    historyQuery.setLogger(anotherLogger);
    await historyQuery.finish();
    expect(anotherLogger.info).toHaveBeenCalledTimes(1);
  });
});

describe('HistoryQuery disabled', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (southService.createSouth as jest.Mock).mockReturnValue(createdSouth);
    (northService.createNorth as jest.Mock).mockReturnValue(createdNorth);

    configuration = {
      id: 'historyId',
      name: 'history',
      southType: 'FolderScanner',
      northType: 'Console',
      description: 'my test history query',
      enabled: false,
      northSettings: {},
      southSettings: {},
      startTime: '2021-02-02T02:02:02.222Z',
      endTime: '2022-02-02T02:02:02.222Z',
      caching: {
        scanModeId: 'scanModeId',
        timeout: 1,
        retryCount: 3,
        groupCount: 1000,
        maxSendCount: 10000,
        retryInterval: 5000
      },
      archive: {
        enabled: false,
        retentionDuration: 0
      }
    };
    historyQuery = new HistoryQuery(configuration, southService, northService, items, logger, 'baseFolder');
  });

  it('should be properly initialized', async () => {
    historyQuery.runSouthConnector = jest.fn();
    await historyQuery.start();
    expect(logger.trace).toHaveBeenCalledWith(`History Query "${configuration.name}" not enabled`);
    expect(createdNorth.start).not.toHaveBeenCalled();
    expect(createdNorth.connect).not.toHaveBeenCalled();
    expect(historyQuery.runSouthConnector).not.toHaveBeenCalled();
  });

  it('should return if no south is set', async () => {
    await historyQuery.runSouthConnector();
    expect(createdSouth.start).not.toHaveBeenCalled();
  });

  it('should not cache values if north is not defined', async () => {
    await historyQuery.addValues('southId', []);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should not cache file if north is not defined', async () => {
    await historyQuery.addFile('southId', 'filePath');
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should properly stop', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    await historyQuery.stop();
    expect(clearIntervalSpy).not.toHaveBeenCalled();
    expect(createdSouth.stop).not.toHaveBeenCalled();
    expect(createdSouth.resetCache).not.toHaveBeenCalled();
    expect(createdNorth.stop).not.toHaveBeenCalled();
    expect(createdNorth.resetCache).not.toHaveBeenCalled();
  });
});
