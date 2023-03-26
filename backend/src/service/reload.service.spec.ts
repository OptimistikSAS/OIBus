import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';
import HealthSignalServiceMock from '../tests/__mocks__/health-signal-service.mock';
import NorthServiceMock from '../tests/__mocks__/north-service.mock';
import SouthServiceMock from '../tests/__mocks__/south-service.mock';
import OibusEngineMock from '../tests/__mocks__/oibus-engine.mock';
import HistoryQueryEngineMock from '../tests/__mocks__/history-query-engine.mock';
import EncryptionService from './encryption.service';
import RepositoryService from './repository.service';
import SouthService from './south.service';
import ReloadService from './reload.service';
import LoggerService from './logger/logger.service';
import HealthSignalService from './health-signal.service';
import NorthService from './north.service';
import OIBusEngine from '../engine/oibus-engine';
import { EngineSettingsDTO, LogSettings } from '../../../shared/model/engine.model';
import { OibusItemCommandDTO, OibusItemDTO, SouthConnectorCommandDTO } from '../../../shared/model/south-connector.model';
import { NorthConnectorCommandDTO } from '../../../shared/model/north-connector.model';
import { HistoryQueryCommandDTO } from '../../../shared/model/history-query.model';
import HistoryQueryEngine from '../engine/history-query-engine';

jest.mock('../repository/proxy.repository');
jest.mock('./encryption.service');
jest.mock('./logger/logger.service');
jest.mock('./health-signal.service');

const oibusEngine: OIBusEngine = new OibusEngineMock();
const historyQueryEngine: HistoryQueryEngine = new HistoryQueryEngineMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryRepository: RepositoryService = new RepositoryServiceMock('', '');
const healthSignalService: HealthSignalService = new HealthSignalServiceMock();
const northService: NorthService = new NorthServiceMock();
const southService: SouthService = new SouthServiceMock();
const loggerService: LoggerService = new LoggerService(encryptionService);

let service: ReloadService;
describe('reload service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReloadService(
      loggerService,
      repositoryRepository,
      healthSignalService,
      northService,
      southService,
      oibusEngine,
      historyQueryEngine
    );
  });

  it('should be properly initialized', () => {
    expect(service.repositoryService).toBeDefined();
    expect(service.loggerService).toBeDefined();
    expect(service.healthSignalService).toBeDefined();
    expect(service.northService).toBeDefined();
    expect(service.southService).toBeDefined();
    expect(service.oibusEngine).toBeDefined();
  });

  it('should update port', async () => {
    const changePortFn = jest.fn();
    const oldSettings = { port: 2223 };
    const newSettings = { port: 2224 };
    service.setWebServerChangePort(changePortFn);

    await service.onUpdateOibusSettings(oldSettings as EngineSettingsDTO, newSettings as EngineSettingsDTO);
    expect(changePortFn).toHaveBeenCalledTimes(1);

    await service.onUpdateOibusSettings(null, newSettings as EngineSettingsDTO);
    expect(changePortFn).toHaveBeenCalledTimes(2);

    await service.onUpdateOibusSettings(newSettings as EngineSettingsDTO, newSettings as EngineSettingsDTO);
    expect(changePortFn).toHaveBeenCalledTimes(2);
  });

  it('should update log parameters', async () => {
    const changeLoggerFn = jest.fn();
    const newSettings = { id: 'oibusId', logParameters: {} as LogSettings, healthSignal: {} };
    service.setWebServerChangeLogger(changeLoggerFn);
    await service.onUpdateOibusSettings(null, newSettings as EngineSettingsDTO);
    expect(loggerService.stop).toHaveBeenCalledTimes(1);
    expect(loggerService.start).toHaveBeenCalledWith(newSettings.id, newSettings.logParameters);
    expect(changeLoggerFn).toHaveBeenCalledTimes(1);
    expect(healthSignalService.setLogger).toHaveBeenCalledTimes(1);
    expect(healthSignalService.setSettings).toHaveBeenCalledWith(newSettings.healthSignal);
  });

  it('should create south', async () => {
    const command = {};
    (repositoryRepository.southConnectorRepository.createSouthConnector as jest.Mock).mockReturnValueOnce({ id: 'southId' });
    const result = await service.onCreateSouth(command as SouthConnectorCommandDTO);
    expect(oibusEngine.startSouth).toHaveBeenCalledWith('southId', { id: 'southId' });
    expect(result).toEqual({ id: 'southId' });
  });

  it('should update south', async () => {
    const command = {};
    (repositoryRepository.southConnectorRepository.getSouthConnector as jest.Mock).mockReturnValueOnce({ id: 'southId' });
    await service.onUpdateSouthSettings('southId', command as SouthConnectorCommandDTO);
    expect(oibusEngine.stopSouth).toHaveBeenCalledWith('southId');
    expect(repositoryRepository.southConnectorRepository.updateSouthConnector).toHaveBeenCalledWith('southId', command);
    expect(oibusEngine.startSouth).toHaveBeenCalledWith('southId', { id: 'southId' });
  });

  it('should delete south', async () => {
    await service.onDeleteSouth('southId');
    expect(oibusEngine.stopSouth).toHaveBeenCalledWith('southId');
    expect(repositoryRepository.southConnectorRepository.deleteSouthConnector).toHaveBeenCalledWith('southId');
    expect(repositoryRepository.southItemRepository.deleteSouthItemByConnectorId).toHaveBeenCalledWith('southId');
  });

  it('should create south item', async () => {
    const command = {};
    const southItem = { id: 'southItemId', settings: {} };
    (repositoryRepository.southItemRepository.createSouthItem as jest.Mock).mockReturnValueOnce(southItem);
    const result = await service.onCreateSouthItem('southId', command as OibusItemCommandDTO);
    expect(oibusEngine.addItemToSouth).toHaveBeenCalledWith('southId', southItem);
    expect(result).toEqual(southItem);
  });

  it('should update south item', async () => {
    const southItem = { id: 'southItemId', settings: {} };
    const command = {};
    await service.onUpdateSouthItemsSettings('southId', southItem as OibusItemDTO, command as OibusItemCommandDTO);
    expect(repositoryRepository.southItemRepository.updateSouthItem).toHaveBeenCalledWith('southItemId', command);
    expect(oibusEngine.updateItemInSouth).toHaveBeenCalledWith('southId', southItem, command);
  });

  it('should delete south item', async () => {
    const southItem = { id: 'southItemId', connectorId: 'southId', settings: {} };
    (repositoryRepository.southItemRepository.getSouthItem as jest.Mock).mockReturnValueOnce(southItem);

    await service.onDeleteSouthItem('southItemId');
    expect(oibusEngine.deleteItemFromSouth).toHaveBeenCalledWith('southId', southItem);
    expect(repositoryRepository.southItemRepository.deleteSouthItem).toHaveBeenCalledWith('southItemId');
  });

  it('should create north', async () => {
    const command = {};
    (repositoryRepository.northConnectorRepository.createNorthConnector as jest.Mock).mockReturnValueOnce({ id: 'northId' });
    const result = await service.onCreateNorth(command as NorthConnectorCommandDTO);
    expect(oibusEngine.startNorth).toHaveBeenCalledWith('northId', { id: 'northId' });
    expect(result).toEqual({ id: 'northId' });
  });

  it('should update north', async () => {
    const command = {};
    (repositoryRepository.northConnectorRepository.getNorthConnector as jest.Mock).mockReturnValueOnce({ id: 'northId' });
    await service.onUpdateNorthSettings('northId', command as NorthConnectorCommandDTO);
    expect(oibusEngine.stopNorth).toHaveBeenCalledWith('northId');
    expect(repositoryRepository.northConnectorRepository.updateNorthConnector).toHaveBeenCalledWith('northId', command);
    expect(oibusEngine.startNorth).toHaveBeenCalledWith('northId', { id: 'northId' });
  });

  it('should delete north', async () => {
    await service.onDeleteNorth('northId');
    expect(oibusEngine.stopNorth).toHaveBeenCalledWith('northId');
    expect(repositoryRepository.northConnectorRepository.deleteNorthConnector).toHaveBeenCalledWith('northId');
  });

  it('should create history query', async () => {
    const command = {};
    const southItems: Array<OibusItemDTO> = [
      { id: 'southItemId1', name: 'southItem1', scanModeId: 'scanModeId1', connectorId: 'southId', settings: {} } as OibusItemDTO,
      { id: 'southItemId2', name: 'southItem2', scanModeId: 'scanModeId1', connectorId: 'southId', settings: {} } as OibusItemDTO
    ];
    (repositoryRepository.historyQueryRepository.createHistoryQuery as jest.Mock).mockReturnValueOnce({ id: 'historyId' });
    const result = await service.onCreateHistoryQuery(command as HistoryQueryCommandDTO, southItems);
    expect(repositoryRepository.historyQueryRepository.createHistoryQuery).toHaveBeenCalledWith(command);
    expect(result).toEqual({ id: 'historyId' });
    expect(repositoryRepository.historyQueryItemRepository.createHistoryItem).toHaveBeenCalledTimes(2);
    expect(repositoryRepository.historyQueryItemRepository.createHistoryItem).toHaveBeenCalledWith('historyId', {
      name: 'southItem1',
      scanModeId: null,
      settings: {}
    });
    expect(repositoryRepository.historyQueryItemRepository.createHistoryItem).toHaveBeenCalledWith('historyId', {
      name: 'southItem2',
      scanModeId: null,
      settings: {}
    });
  });

  it('should update history query', async () => {
    const command = {};
    (repositoryRepository.historyQueryRepository.updateHistoryQuery as jest.Mock).mockReturnValueOnce({ id: 'historyId' });
    await service.onUpdateHistoryQuerySettings('historyId', command as HistoryQueryCommandDTO);
    expect(repositoryRepository.historyQueryRepository.updateHistoryQuery).toHaveBeenCalledWith('historyId', command);
  });

  it('should delete history query', async () => {
    await service.onDeleteHistoryQuery('historyId');
    expect(repositoryRepository.historyQueryRepository.deleteHistoryQuery).toHaveBeenCalledWith('historyId');
    expect(repositoryRepository.historyQueryItemRepository.deleteHistoryItemByHistoryId).toHaveBeenCalledWith('historyId');
  });

  it('should create history item', async () => {
    const command = {};
    const historyItem = { id: 'southItemId', settings: {} };
    (repositoryRepository.historyQueryItemRepository.createHistoryItem as jest.Mock).mockReturnValueOnce(historyItem);
    const result = await service.onCreateHistoryItem('historyId', command as OibusItemCommandDTO);
    expect(result).toEqual(historyItem);
  });

  it('should update history item', async () => {
    const historyItem = { id: 'historyItemId', settings: {} };
    const command = {};
    await service.onUpdateHistoryItemsSettings('historyId', historyItem as OibusItemDTO, command as OibusItemCommandDTO);
    expect(repositoryRepository.historyQueryItemRepository.updateHistoryItem).toHaveBeenCalledWith('historyItemId', command);
  });

  it('should delete history item', async () => {
    const historyItem = { id: 'historyItemId', connectorId: 'southId', settings: {} };
    (repositoryRepository.historyQueryItemRepository.getHistoryItem as jest.Mock).mockReturnValueOnce(historyItem);

    await service.onDeleteHistoryItem('historyItemId');
    expect(repositoryRepository.historyQueryItemRepository.deleteHistoryItem).toHaveBeenCalledWith('historyItemId');
  });
});
