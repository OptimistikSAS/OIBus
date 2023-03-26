import PinoLogger from '../tests/__mocks__/logger.mock';
import SouthServiceMock from '../tests/__mocks__/south-service.mock';
import NorthServiceMock from '../tests/__mocks__/north-service.mock';

import { OibusItemDTO, SouthConnectorDTO } from '../../../shared/model/south-connector.model';
import { NorthConnectorDTO } from '../../../shared/model/north-connector.model';

import SouthService from '../service/south.service';
import NorthService from '../service/north.service';

import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../service/repository.service';
import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';
import ProxyService from '../service/proxy.service';
import OIBusEngine from './oibus-engine';

jest.mock('../service/south.service');
jest.mock('../service/north.service');
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
const proxyService: ProxyService = new ProxyService(repositoryService.proxyRepository, encryptionService);

const nowDateString = '2020-02-02T02:02:02.222Z';

let engine: OIBusEngine;

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

describe('OIBusEngine', () => {
  const northConnectors: Array<NorthConnectorDTO> = [
    {
      id: 'id1',
      name: 'myNorthConnector1',
      description: 'a test north connector',
      enabled: true,
      type: 'Test'
    } as NorthConnectorDTO,
    {
      id: 'id2',
      name: 'myNorthConnector2',
      description: 'a test north connector',
      enabled: false,
      type: 'Test'
    } as NorthConnectorDTO
  ];
  const southConnectors: Array<SouthConnectorDTO> = [
    {
      id: 'id1',
      type: 'SQL',
      name: 'South Connector1 ',
      description: 'My first South connector description',
      enabled: true,
      settings: {}
    },
    {
      id: 'id2',
      type: 'OPCUA_HA',
      name: 'South Connector 2',
      description: 'My second South connector description',
      enabled: false,
      settings: {}
    }
  ];
  const createdSouth = {
    start: jest.fn(),
    stop: jest.fn(),
    connect: jest.fn(),
    historyQueryHandler: jest.fn(),
    isEnabled: jest.fn(),
    addItem: jest.fn(),
    deleteItem: jest.fn(),
    updateItem: jest.fn(),
    setLogger: jest.fn()
  };
  const createdNorth = {
    start: jest.fn(),
    stop: jest.fn(),
    connect: jest.fn(),
    isEnabled: jest.fn(),
    cacheValues: jest.fn(),
    cacheFile: jest.fn(),
    isSubscribed: jest.fn(),
    setLogger: jest.fn()
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    (southService.createSouth as jest.Mock).mockReturnValue(createdSouth);
    (northService.createNorth as jest.Mock).mockReturnValue(createdNorth);

    engine = new OIBusEngine(encryptionService, proxyService, northService, southService, logger);
  });

  it('it should start', async () => {
    (northService.getNorthList as jest.Mock).mockReturnValue(northConnectors);
    (southService.getSouthList as jest.Mock).mockReturnValue(southConnectors);

    engine.startNorth = jest
      .fn()
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => {
        throw new Error('error');
      });
    engine.startSouth = jest
      .fn()
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => {
        throw new Error('error');
      });
    await engine.start();
    expect(logger.info).toHaveBeenCalledWith(`OIBus engine started`);
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while creating North connector "${northConnectors[1].name}" of type "${northConnectors[1].type}" (${
        northConnectors[1].id
      }): ${new Error('error')}`
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Error while creating South connector "${southConnectors[1].name}" of type "${southConnectors[1].type}" (${
        southConnectors[1].id
      }): ${new Error('error')}`
    );
  });

  it('it should start connectors and stop all', async () => {
    createdSouth.start.mockImplementation(() => {
      return new Promise((resolve, reject) => {
        reject('error');
      });
    });

    createdNorth.start.mockImplementation(() => {
      return new Promise((resolve, reject) => {
        reject('error');
      });
    });

    createdNorth.isEnabled.mockReturnValueOnce(true).mockReturnValueOnce(false);
    createdNorth.isSubscribed.mockReturnValue(true);
    createdSouth.isEnabled.mockReturnValueOnce(true).mockReturnValueOnce(false);
    (southService.getSouthItems as jest.Mock).mockReturnValue(items);

    await engine.startSouth(southConnectors[0].id, southConnectors[0]);
    expect(southService.getSouthItems).toHaveBeenCalledWith(southConnectors[0].id);
    expect(southService.createSouth).toHaveBeenCalledTimes(1);
    expect(createdSouth.isEnabled).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while starting South connector "${southConnectors[0].name}" of type "${southConnectors[0].type}" (${southConnectors[0].id}): error`
    );

    await engine.startNorth(northConnectors[0].id, northConnectors[0]);
    expect(northService.createNorth).toHaveBeenCalledTimes(1);
    expect(createdNorth.isEnabled).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      `Error while starting North connector "${northConnectors[0].name}" of type "${northConnectors[0].type}" (${northConnectors[0].id}): error`
    );

    await engine.startSouth(southConnectors[1].id, southConnectors[1]);
    expect(logger.trace).toHaveBeenCalledWith(`South connector ${southConnectors[1].name} not enabled`);
    await engine.startNorth(northConnectors[1].id, northConnectors[1]);
    expect(logger.trace).toHaveBeenCalledWith(`North connector "${northConnectors[1].name}" not enabled`);

    createdNorth.isEnabled.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await engine.addValues('southId', ['', '']);
    expect(logger.info).toHaveBeenCalledWith(`Add 2 values from southId to north`);
    expect(createdNorth.cacheValues).toHaveBeenCalledTimes(1);
    expect(createdNorth.cacheValues).toHaveBeenCalledWith(['', '']);

    createdNorth.isEnabled.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await engine.addFile('southId', 'filePath');
    expect(logger.info).toHaveBeenCalledWith(`Add file "filePath" from southId to north connectors`);
    expect(createdNorth.cacheFile).toHaveBeenCalledTimes(1);
    expect(createdNorth.cacheFile).toHaveBeenCalledWith('filePath');

    engine.addItemToSouth('southId', items[0]);
    expect(createdSouth.addItem).not.toHaveBeenCalled();
    engine.deleteItemFromSouth('southId', items[0]);
    expect(createdSouth.deleteItem).not.toHaveBeenCalled();
    engine.updateItemInSouth('southId', items[0], { name: 'new name', settings: {}, scanModeId: null });
    expect(createdSouth.updateItem).not.toHaveBeenCalled();

    engine.addItemToSouth(southConnectors[1].id, items[0]);
    expect(createdSouth.addItem).toHaveBeenCalledWith(items[0]);
    engine.deleteItemFromSouth(southConnectors[1].id, items[0]);
    expect(createdSouth.deleteItem).toHaveBeenCalledWith(items[0]);
    engine.updateItemInSouth(southConnectors[1].id, items[0], { name: 'new name', settings: {}, scanModeId: null });
    expect(createdSouth.updateItem).toHaveBeenCalledWith(items[0], { name: 'new name', settings: {}, scanModeId: null });

    (southService.getSouth as jest.Mock).mockReturnValueOnce(southConnectors[0]).mockReturnValueOnce(southConnectors[1]);
    (northService.getNorth as jest.Mock).mockReturnValueOnce(northConnectors[0]).mockReturnValueOnce(northConnectors[1]);

    engine.setLogger(anotherLogger);
    expect(createdNorth.setLogger).toHaveBeenCalledTimes(2);
    expect(createdSouth.setLogger).toHaveBeenCalledTimes(2);
    expect(anotherLogger.child).toHaveBeenCalledWith({ scope: `south:${southConnectors[0].name}` });
    expect(anotherLogger.child).toHaveBeenCalledWith({ scope: `south:${southConnectors[1].name}` });
    expect(anotherLogger.child).toHaveBeenCalledWith({ scope: `north:${northConnectors[0].name}` });
    expect(anotherLogger.child).toHaveBeenCalledWith({ scope: `north:${northConnectors[1].name}` });

    await engine.stopSouth('southId');
    expect(createdSouth.stop).not.toHaveBeenCalled();
    await engine.stopNorth('northId');
    expect(createdNorth.stop).not.toHaveBeenCalled();

    await engine.stop();
    expect(createdSouth.stop).toHaveBeenCalledTimes(2);
    expect(createdNorth.stop).toHaveBeenCalledTimes(2);
  });
});
