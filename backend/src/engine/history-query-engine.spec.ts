import PinoLogger from '../tests/__mocks__/logger.mock';
import SouthServiceMock from '../tests/__mocks__/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/north-service.mock';
import HistoryQueryServiceMock from '../tests/__mocks__/history-query-service.mock';

import { OibusItemDTO } from '../../../shared/model/south-connector.model';
import { HistoryQueryDTO } from '../../../shared/model/history-query.model';

import SouthService from '../service/south.service';
import NorthService from '../service/north.service';

import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import RepositoryService from '../service/repository.service';
import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';
import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import ProxyService from '../service/proxy.service';
import HistoryQueryEngine from './history-query-engine';
import HistoryQueryService from '../service/history-query.service';

jest.mock('../service/south.service');
jest.mock('../service/north.service');
jest.mock('../service/history-query.service');
jest.mock('../service/repository.service');
jest.mock('../service/encryption.service');
jest.mock('../service/proxy.service');

jest.mock('../service/utils');

const logger: pino.Logger = new PinoLogger();
const anotherLogger: pino.Logger = new PinoLogger();

const southService: SouthService = new SouthServiceMock();
const northService: NorthService = new NorthServiceMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const historyQueryService: HistoryQueryService = new HistoryQueryServiceMock();
const proxyService: ProxyService = new ProxyService(repositoryService.proxyRepository, encryptionService);

const nowDateString = '2020-02-02T02:02:02.222Z';

let configuration: HistoryQueryDTO;
let engine: HistoryQueryEngine;

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
    (historyQueryService.getHistoryQueryList as jest.Mock).mockReturnValue([configuration]);
    (historyQueryService.getHistoryQuery as jest.Mock).mockReturnValue(configuration);

    engine = new HistoryQueryEngine(encryptionService, proxyService, northService, southService, historyQueryService, logger);
  });

  it('it should start connectors and stop all', async () => {
    await engine.start();
    expect(historyQueryService.getHistoryQueryList as jest.Mock).toHaveBeenCalledTimes(1);
    expect(historyQueryService.getItems as jest.Mock).toHaveBeenCalledTimes(1);
    expect(historyQueryService.getItems as jest.Mock).toHaveBeenCalledWith(configuration.id);
    expect(logger.child).toHaveBeenCalledWith({ scope: `history:${configuration.name}` });

    await engine.stop();
    await engine.stopHistoryQuery('anotherId');
  });

  it('should properly manage items in History Query', async () => {
    await engine.start();

    await engine.addItemToHistoryQuery('anotherId', items[0]);
    await engine.deleteItemFromHistoryQuery('anotherId', items[0]);
    await engine.updateItemInHistoryQuery('anotherId', items[0]);

    await engine.addItemToHistoryQuery('historyId', items[0]);
    await engine.deleteItemFromHistoryQuery('historyId', items[0]);
    await engine.updateItemInHistoryQuery('historyId', items[0]);
  });

  it('should properly set logger', async () => {
    await engine.start();

    (historyQueryService.getHistoryQuery as jest.Mock).mockReturnValueOnce(undefined);
    engine.setLogger(anotherLogger);
    expect(anotherLogger.child).not.toHaveBeenCalled();

    engine.setLogger(anotherLogger);
    expect(historyQueryService.getHistoryQuery).toHaveBeenCalledWith('historyId');
    expect(anotherLogger.child).toHaveBeenCalledWith({ scope: `south:${configuration.name}` });
  });
});
