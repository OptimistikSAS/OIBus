import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import SouthServiceMock from '../tests/__mocks__/service/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/service/north-service.mock';
import HistoryQueryServiceMock from '../tests/__mocks__/service/history-query-service.mock';

import SouthService from '../service/south.service';
import NorthService from '../service/north.service';

import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import HistoryQueryEngine from './history-query-engine';
import HistoryQueryService from '../service/history-query.service';
import { PassThrough } from 'node:stream';
import fs from 'node:fs/promises';
import path from 'node:path';
import { filesExists } from '../service/utils';
import RepositoryService from '../service/repository.service';
import RepositoryServiceMock from '../tests/__mocks__/service/repository-service.mock';
import testData from '../tests/utils/test-data';

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
const repositoryService: RepositoryService = new RepositoryServiceMock();
const historyQueryService: HistoryQueryService = new HistoryQueryServiceMock();

let engine: HistoryQueryEngine;

describe('HistoryQueryEngine', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (logger.child as jest.Mock).mockReturnValue(logger);
    (historyQueryService.findAll as jest.Mock).mockReturnValue(testData.historyQueries.list);
    (historyQueryService.findById as jest.Mock).mockImplementation((id: string) =>
      testData.historyQueries.list.find(element => element.id === id)
    );

    engine = new HistoryQueryEngine(encryptionService, northService, southService, repositoryService, historyQueryService, logger);
  });

  it('it should start connectors and stop all', async () => {
    await engine.start();
    expect(historyQueryService.findAll as jest.Mock).toHaveBeenCalledTimes(1);
    expect(logger.child).toHaveBeenCalledWith({
      scopeType: 'history-query',
      scopeId: testData.historyQueries.list[0].id,
      scopeName: testData.historyQueries.list[0].name
    });

    expect(engine.getHistoryDataStream('bad id')).toEqual(null);
    expect(engine.getHistoryDataStream(testData.historyQueries.list[0].id)).toEqual(expect.any(PassThrough));

    await engine.startHistoryQuery(testData.historyQueries.list[0].id);
    await engine.createHistoryQuery(testData.historyQueries.list[0]);
    await engine.stop();
    await engine.stopHistoryQuery('anotherId');
    await engine.resetCache('anotherId');
  });

  it('should properly set logger', async () => {
    await engine.start();

    (historyQueryService.findById as jest.Mock).mockReturnValueOnce(undefined);

    engine.setLogger(anotherLogger);
    expect(historyQueryService.findById).toHaveBeenCalledWith(testData.historyQueries.list[1].id);
    expect(anotherLogger.child).toHaveBeenCalledWith({
      scopeType: 'history-query',
      scopeId: testData.historyQueries.list[1].id,
      scopeName: testData.historyQueries.list[1].name
    });
  });

  it('should delete History Query', async () => {
    (filesExists as jest.Mock).mockImplementationOnce(() => Promise.resolve(true)).mockImplementationOnce(() => Promise.resolve(false));
    const stopHistoryQuerySpy = jest.spyOn(engine, 'stopHistoryQuery');

    await engine.start();

    const historyId = testData.historyQueries.list[0].id;
    const name = testData.historyQueries.list[0].name;
    const baseFolder = path.resolve('./cache/history-query', `history-${historyId}`);
    await engine.deleteHistoryQuery(historyId, name);

    expect(stopHistoryQuerySpy).toHaveBeenCalled();
    expect(filesExists).toHaveBeenCalledWith(baseFolder);
    expect(fs.rm).toHaveBeenCalledWith(baseFolder, { recursive: true });
    expect(logger.trace).toHaveBeenCalledWith(`Deleting base folder "${baseFolder}" of History query "${name}" (${historyId})`);
    expect(logger.info).toHaveBeenCalledWith(`Deleted History query "${name}" (${historyId})`);

    // Removing again should not call rm, meaning that it's actually removed
    await engine.deleteHistoryQuery(historyId, name);
    expect(fs.rm).toHaveBeenCalledTimes(1);
  });

  it('should handle deletion errors', async () => {
    (filesExists as jest.Mock).mockImplementation(() => Promise.resolve(true));
    const stopHistoryQuerySpy = jest.spyOn(engine, 'stopHistoryQuery');

    await engine.start();

    const error = new Error(`Can't remove folder`);
    (fs.rm as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const historyId = testData.historyQueries.list[0].id;
    const name = testData.historyQueries.list[0].name;
    const baseFolder = path.resolve('./cache/history-query', `history-${historyId}`);
    await engine.deleteHistoryQuery(historyId, name);

    expect(stopHistoryQuerySpy).toHaveBeenCalled();
    expect(filesExists).toHaveBeenCalled();
    expect(logger.trace).toHaveBeenCalledWith(`Deleting base folder "${baseFolder}" of History query "${name}" (${historyId})`);
    expect(logger.error).toHaveBeenCalledWith(`Unable to delete History query "${name}" (${historyId}) base folder: ${error}`);
  });
});
