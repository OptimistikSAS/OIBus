import PinoLogger from '../tests/__mocks__/logger.mock';
import SouthServiceMock from '../tests/__mocks__/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/north-service.mock';
import HistoryQueryServiceMock from '../tests/__mocks__/history-query-service.mock';

import { SouthConnectorItemDTO } from '../../../shared/model/south-connector.model';
import { HistoryQueryDTO } from '../../../shared/model/history-query.model';

import SouthService from '../service/south.service';
import NorthService from '../service/north.service';

import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import HistoryQueryEngine from './history-query-engine';
import HistoryQueryService from '../service/history-query.service';
import { PassThrough } from 'node:stream';
import fs from 'node:fs/promises';
import path from 'node:path';
import { filesExists } from '../service/utils';

jest.mock('../service/south.service');
jest.mock('../service/north.service');
jest.mock('../service/history-query.service');
jest.mock('../service/repository.service');
jest.mock('../service/encryption.service');
jest.mock('node:fs/promises');

jest.mock('../service/utils');

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const southService: SouthService = new SouthServiceMock();
const northService: NorthService = new NorthServiceMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const historyQueryService: HistoryQueryService = new HistoryQueryServiceMock();

const nowDateString = '2020-02-02T02:02:02.222Z';

let configuration: HistoryQueryDTO;
let engine: HistoryQueryEngine;

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
    enabled: false,
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId2'
  }
];

describe('HistoryQueryEngine', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (logger.child as jest.Mock).mockReturnValue(logger);
    configuration = {
      id: 'historyId',
      name: 'history',
      southType: 'FolderScanner',
      northType: 'Console',
      description: 'my test history query',
      status: 'RUNNING',
      history: {
        maxInstantPerItem: true,
        maxReadInterval: 3600,
        readDelay: 0
      },
      northSettings: {},
      southSettings: {},
      startTime: '2021-02-02T02:02:02.222Z',
      endTime: '2022-02-02T02:02:02.222Z',
      caching: {
        scanModeId: 'scanModeId',
        maxSize: 1,
        retryCount: 3,
        groupCount: 1000,
        maxSendCount: 10000,
        sendFileImmediately: false,
        retryInterval: 5000
      },
      archive: {
        enabled: false,
        retentionDuration: 0
      }
    };
    (historyQueryService.getHistoryQueryList as jest.Mock).mockReturnValue([configuration]);
    (historyQueryService.getHistoryQuery as jest.Mock).mockReturnValue(configuration);

    engine = new HistoryQueryEngine(encryptionService, northService, southService, historyQueryService, logger);
  });

  it('it should start connectors and stop all', async () => {
    await engine.start();
    expect(historyQueryService.getHistoryQueryList as jest.Mock).toHaveBeenCalledTimes(1);
    expect(historyQueryService.getItems as jest.Mock).toHaveBeenCalledTimes(1);
    expect(historyQueryService.getItems as jest.Mock).toHaveBeenCalledWith(configuration.id);
    expect(logger.child).toHaveBeenCalledWith({ scopeType: 'history-query', scopeId: configuration.id, scopeName: configuration.name });

    expect(engine.getHistoryDataStream('bad id')).toEqual(null);
    expect(engine.getHistoryDataStream(configuration.id)).toEqual(expect.any(PassThrough));

    await engine.startHistoryQuery(configuration);
    await engine.stop();
    await engine.stopHistoryQuery('anotherId');
  });

  it('should properly manage items in History Query', async () => {
    await engine.start();

    await engine.addItemToHistoryQuery('anotherId', items[0]);
    await engine.deleteItemFromHistoryQuery('anotherId', items[0]);
    await engine.deleteAllItemsFromHistoryQuery('anotherId');
    await engine.updateItemInHistoryQuery('anotherId', items[0]);

    await engine.addItemToHistoryQuery('historyId', items[0]);
    await engine.deleteItemFromHistoryQuery('historyId', items[0]);
    await engine.deleteAllItemsFromHistoryQuery('historyId');
    await engine.updateItemInHistoryQuery('historyId', items[0]);
  });

  it('should properly set logger', async () => {
    await engine.start();

    (historyQueryService.getHistoryQuery as jest.Mock).mockReturnValueOnce(undefined);
    engine.setLogger(anotherLogger);
    expect(anotherLogger.child).not.toHaveBeenCalled();

    engine.setLogger(anotherLogger);
    expect(historyQueryService.getHistoryQuery).toHaveBeenCalledWith('historyId');
    expect(anotherLogger.child).toHaveBeenCalledWith({
      scopeType: 'history-query',
      scopeId: configuration.id,
      scopeName: configuration.name
    });
  });

  it('should delete History Query', async () => {
    (filesExists as jest.Mock).mockImplementationOnce(() => Promise.resolve(true)).mockImplementationOnce(() => Promise.resolve(false));
    const stopHistoryQuerySpy = jest.spyOn(engine, 'stopHistoryQuery');

    await engine.start();

    const historyId = configuration.id;
    const name = configuration.name;
    const baseFolder = path.resolve('./cache/history-query', `history-${historyId}`);
    await engine.deleteHistoryQuery(historyId, name);

    expect(stopHistoryQuerySpy).toBeCalled();
    expect(filesExists).toBeCalledWith(baseFolder);
    expect(fs.rm).toBeCalledWith(baseFolder, { recursive: true });
    expect(logger.trace).toBeCalledWith(`Deleting base folder "${baseFolder}" of History query "${name}" (${historyId})`);
    expect(logger.info).toBeCalledWith(`Deleted History query "${name}" (${historyId})`);

    // Removing again should not call rm, meaning that it's actually removed
    await engine.deleteHistoryQuery(historyId, name);
    expect(fs.rm).toBeCalledTimes(1);
  });

  it('should handle deletion errors', async () => {
    (filesExists as jest.Mock).mockImplementation(() => Promise.resolve(true));
    const stopHistoryQuerySpy = jest.spyOn(engine, 'stopHistoryQuery');

    await engine.start();

    const error = new Error(`Can't remove folder`);
    (fs.rm as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const historyId = configuration.id;
    const name = configuration.name;
    const baseFolder = path.resolve('./cache/history-query', `history-${historyId}`);
    await engine.deleteHistoryQuery(historyId, name);

    expect(stopHistoryQuerySpy).toBeCalled();
    expect(filesExists).toBeCalled();
    expect(logger.trace).toBeCalledWith(`Deleting base folder "${baseFolder}" of History query "${name}" (${historyId})`);
    expect(logger.error).toBeCalledWith(`Unable to delete History query "${name}" (${historyId}) base folder: ${error}`);
  });
});
