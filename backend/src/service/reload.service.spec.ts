import EncryptionServiceMock from '../tests/__mocks__/encryption-service.mock';
import RepositoryServiceMock from '../tests/__mocks__/repository-service.mock';
import EngineMetricsServiceMock from '../tests/__mocks__/engine-metrics-service.mock';
import NorthServiceMock from '../tests/__mocks__/north-service.mock';
import SouthServiceMock from '../tests/__mocks__/south-service.mock';
import OibusEngineMock from '../tests/__mocks__/oibus-engine.mock';
import HistoryQueryEngineMock from '../tests/__mocks__/history-query-engine.mock';
import EncryptionService from './encryption.service';
import RepositoryService from './repository.service';
import SouthService from './south.service';
import ReloadService from './reload.service';
import LoggerService from './logger/logger.service';
import EngineMetricsService from './engine-metrics.service';
import NorthService from './north.service';
import OIBusEngine from '../engine/oibus-engine';
import { EngineSettingsDTO, LogSettings } from '../../../shared/model/engine.model';
import {
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorCommandDTO,
  SouthConnectorDTO
} from '../../../shared/model/south-connector.model';
import { NorthConnectorCommandDTO } from '../../../shared/model/north-connector.model';
import { HistoryQueryCommandDTO, HistoryQueryDTO } from '../../../shared/model/history-query.model';
import HistoryQueryEngine from '../engine/history-query-engine';
import { ScanModeCommandDTO } from '../../../shared/model/scan-mode.model';
import HomeMetricsService from './home-metrics.service';
import HomeMetricsServiceMock from '../tests/__mocks__/home-metrics-service.mock';

jest.mock('./encryption.service');
jest.mock('./logger/logger.service');
jest.mock('./engine-metrics.service');

const oibusEngine: OIBusEngine = new OibusEngineMock();
const historyQueryEngine: HistoryQueryEngine = new HistoryQueryEngineMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock('', '');
const engineMetricsService: EngineMetricsService = new EngineMetricsServiceMock();
const homeMetrics: HomeMetricsService = new HomeMetricsServiceMock();
const northService: NorthService = new NorthServiceMock();
const southService: SouthService = new SouthServiceMock();
const loggerService: LoggerService = new LoggerService(encryptionService, 'folder');

let service: ReloadService;
describe('reload service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReloadService(
      loggerService,
      repositoryService,
      engineMetricsService,
      homeMetrics,
      northService,
      southService,
      oibusEngine,
      historyQueryEngine
    );
  });

  it('should be properly initialized', () => {
    expect(service.repositoryService).toBeDefined();
    expect(service.loggerService).toBeDefined();
    expect(service.engineMetricsService).toBeDefined();
    expect(service.homeMetricsService).toBeDefined();
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
    const newSettings = { id: 'oibusId', name: 'oibusName', logParameters: {} as LogSettings };
    service.setWebServerChangeLogger(changeLoggerFn);
    await service.onUpdateOibusSettings(null, newSettings as EngineSettingsDTO);
    expect(loggerService.stop).toHaveBeenCalledTimes(1);
    expect(loggerService.start).toHaveBeenCalledWith(newSettings.id, newSettings.name, newSettings.logParameters);
    expect(changeLoggerFn).toHaveBeenCalledTimes(1);
    expect(engineMetricsService.setLogger).toHaveBeenCalledTimes(1);
  });

  it('should create and start south', async () => {
    const command = { enabled: true };
    (repositoryService.southConnectorRepository.createSouthConnector as jest.Mock).mockReturnValueOnce({ id: 'southId' });
    const result = await service.onCreateSouth(command as SouthConnectorCommandDTO);
    expect(oibusEngine.startSouth).toHaveBeenCalledWith('southId', { id: 'southId' });
    expect(result).toEqual({ id: 'southId' });
  });

  it('should create and not start south', async () => {
    const command = {};
    (repositoryService.southConnectorRepository.createSouthConnector as jest.Mock).mockReturnValueOnce({ id: 'southId' });
    const result = await service.onCreateSouth(command as SouthConnectorCommandDTO);
    expect(oibusEngine.startSouth).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'southId' });
  });

  it('should update and start south', async () => {
    const command = { enabled: true };
    (repositoryService.southConnectorRepository.getSouthConnector as jest.Mock).mockReturnValueOnce({ id: 'southId' });

    await service.onUpdateSouth('southId', command as SouthConnectorCommandDTO);
    expect(oibusEngine.stopSouth).toHaveBeenCalledWith('southId');
    expect(repositoryService.southConnectorRepository.updateSouthConnector).toHaveBeenCalledWith('southId', command);
    expect(oibusEngine.startSouth).toHaveBeenCalledWith('southId', { id: 'southId' });
  });

  it('should update and not start south', async () => {
    const command = {};

    await service.onUpdateSouth('southId', command as SouthConnectorCommandDTO);
    expect(oibusEngine.stopSouth).toHaveBeenCalledWith('southId');
    expect(repositoryService.southConnectorRepository.updateSouthConnector).toHaveBeenCalledWith('southId', command);
    expect(oibusEngine.startSouth).not.toHaveBeenCalled();
  });

  it('should delete south', async () => {
    (repositoryService.subscriptionRepository.getSubscribedNorthConnectors as jest.Mock).mockReturnValueOnce(['northId1', 'northId2']);
    (repositoryService.northConnectorRepository.getNorthConnector as jest.Mock)
      .mockReturnValueOnce({ id: 'northId1', enabled: true })
      .mockReturnValueOnce({ id: 'northId2', enabled: true });
    (repositoryService.southConnectorRepository.getSouthConnector as jest.Mock).mockReturnValueOnce({ name: 'southName' });

    await service.onDeleteSouth('southId');

    expect(oibusEngine.stopNorth).toHaveBeenNthCalledWith(1, 'northId1');
    expect(oibusEngine.stopNorth).toHaveBeenNthCalledWith(2, 'northId2');
    expect(repositoryService.subscriptionRepository.deleteNorthSubscription).toHaveBeenNthCalledWith(1, 'northId1', 'southId');
    expect(repositoryService.subscriptionRepository.deleteNorthSubscription).toHaveBeenNthCalledWith(2, 'northId2', 'southId');
    expect(oibusEngine.startNorth).toHaveBeenNthCalledWith(1, 'northId1', { id: 'northId1', enabled: true });
    expect(oibusEngine.startNorth).toHaveBeenNthCalledWith(2, 'northId2', { id: 'northId2', enabled: true });

    expect(repositoryService.southConnectorRepository.getSouthConnector).toBeCalledWith('southId');
    expect(oibusEngine.deleteSouth).toHaveBeenCalledWith('southId', 'southName');

    expect(repositoryService.southItemRepository.deleteAllSouthItems).toHaveBeenCalledWith('southId');
    expect(repositoryService.southConnectorRepository.deleteSouthConnector).toHaveBeenCalledWith('southId');

    expect(loggerService.deleteLogs).toBeCalledWith('south', 'southId');
    expect(repositoryService.southMetricsRepository.removeMetrics).toBeCalledWith('southId');
  });

  it('should start south', async () => {
    (repositoryService.southConnectorRepository.getSouthConnector as jest.Mock).mockReturnValueOnce({ id: 'southId' });
    await service.onStartSouth('southId');
    expect(repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('southId');
    expect(repositoryService.southConnectorRepository.startSouthConnector).toHaveBeenCalledWith('southId');
    expect(oibusEngine.startSouth).toHaveBeenCalledWith('southId', { id: 'southId' });
  });

  it('should stop south', async () => {
    await service.onStopSouth('southId');
    expect(oibusEngine.stopSouth).toHaveBeenCalledWith('southId');
  });

  it('should create south item', async () => {
    const command = {};
    const southItem = { id: 'southItemId', settings: {} };
    (repositoryService.southItemRepository.createSouthItem as jest.Mock).mockReturnValueOnce(southItem);
    const result = await service.onCreateSouthItem('southId', command as SouthConnectorItemCommandDTO);
    expect(oibusEngine.addItemToSouth).toHaveBeenCalledWith('southId', southItem);
    expect(result).toEqual(southItem);
  });

  it('should update south item', async () => {
    const oldSouthItem = { id: 'southItemId', connectorId: 'southId', settings: { field: 'value' } };
    const newSouthItem = { id: 'southItemId', connectorId: 'southId', settings: { field: 'newValue' } };
    (repositoryService.southItemRepository.getSouthItem as jest.Mock).mockReturnValueOnce(newSouthItem);

    const command = {};
    await service.onUpdateSouthItemsSettings('southId', oldSouthItem as SouthConnectorItemDTO, command as SouthConnectorItemCommandDTO);
    expect(repositoryService.southItemRepository.updateSouthItem).toHaveBeenCalledWith('southItemId', command);
    expect(oibusEngine.updateItemInSouth).toHaveBeenCalledWith('southId', oldSouthItem, newSouthItem);
  });

  it('should create or update south items', async () => {
    await service.onCreateOrUpdateSouthItems({ id: 'southId' } as SouthConnectorDTO, [], []);
    expect(repositoryService.southItemRepository.createAndUpdateSouthItems).toHaveBeenCalledWith('southId', [], []);
    expect(oibusEngine.stopSouth).toHaveBeenCalledWith('southId');
    expect(oibusEngine.startSouth).toHaveBeenCalledWith('southId', { id: 'southId' });
  });

  it('should delete south item', async () => {
    const southItem = { id: 'southItemId', connectorId: 'southId', settings: {} };
    (repositoryService.southItemRepository.getSouthItem as jest.Mock).mockReturnValueOnce(southItem);

    await service.onDeleteSouthItem('southItemId');
    expect(oibusEngine.deleteItemFromSouth).toHaveBeenCalledWith('southId', southItem);
    expect(repositoryService.southItemRepository.deleteSouthItem).toHaveBeenCalledWith('southItemId');
  });

  it('delete should throw when south item not found', async () => {
    (repositoryService.southItemRepository.getSouthItem as jest.Mock).mockReturnValue(null);

    let error;
    try {
      await service.onDeleteSouthItem('southItemId');
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error('South item not found'));
    expect(oibusEngine.deleteItemFromSouth).not.toHaveBeenCalled();
    expect(repositoryService.southItemRepository.deleteSouthItem).not.toHaveBeenCalled();
  });

  it('should enable south item', async () => {
    const southItem = { id: 'southItemId', connectorId: 'southId', settings: {} };
    (repositoryService.southItemRepository.getSouthItem as jest.Mock).mockReturnValueOnce(southItem);

    await service.onEnableSouthItem('southItemId');
    expect(oibusEngine.updateItemInSouth).toHaveBeenCalledWith('southId', southItem, { ...southItem, enabled: true });
    expect(repositoryService.southItemRepository.enableSouthItem).toHaveBeenCalledWith('southItemId');
  });

  it('enable should throw when south item not found', async () => {
    (repositoryService.southItemRepository.getSouthItem as jest.Mock).mockReturnValue(null);

    let error;
    try {
      await service.onEnableSouthItem('southItemId');
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error('South item not found'));
    expect(oibusEngine.updateItemInSouth).not.toHaveBeenCalled();
    expect(repositoryService.southItemRepository.enableSouthItem).not.toHaveBeenCalled();
  });

  it('should disable south item', async () => {
    const southItem = { id: 'southItemId', connectorId: 'southId', settings: {} };
    (repositoryService.southItemRepository.getSouthItem as jest.Mock).mockReturnValueOnce(southItem);

    await service.onDisableSouthItem('southItemId');
    expect(oibusEngine.updateItemInSouth).toHaveBeenCalledWith('southId', southItem, { ...southItem, enabled: false });
    expect(repositoryService.southItemRepository.disableSouthItem).toHaveBeenCalledWith('southItemId');
  });

  it('disable should throw when south item not found', async () => {
    (repositoryService.southItemRepository.getSouthItem as jest.Mock).mockReturnValue(null);

    let error;
    try {
      await service.onDisableSouthItem('southItemId');
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error('South item not found'));
    expect(oibusEngine.updateItemInSouth).not.toHaveBeenCalled();
    expect(repositoryService.southItemRepository.disableSouthItem).not.toHaveBeenCalled();
  });

  it('should delete all south items', async () => {
    await service.onDeleteAllSouthItems('southId');
    expect(oibusEngine.deleteAllItemsFromSouth).toHaveBeenCalledWith('southId');
    expect(repositoryService.southItemRepository.deleteAllSouthItems).toHaveBeenCalledWith('southId');
  });

  it('should create and start north', async () => {
    const command = { enabled: true };
    (repositoryService.northConnectorRepository.createNorthConnector as jest.Mock).mockReturnValueOnce({ id: 'northId' });
    const result = await service.onCreateNorth(command as NorthConnectorCommandDTO);
    expect(oibusEngine.startNorth).toHaveBeenCalledWith('northId', { id: 'northId' });
    expect(result).toEqual({ id: 'northId' });
  });

  it('should create and not start north', async () => {
    const command = {};
    (repositoryService.northConnectorRepository.createNorthConnector as jest.Mock).mockReturnValueOnce({ id: 'northId' });
    const result = await service.onCreateNorth(command as NorthConnectorCommandDTO);
    expect(oibusEngine.startNorth).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'northId' });
  });

  it('should update and start north', async () => {
    const command = { enabled: true };
    (repositoryService.northConnectorRepository.getNorthConnector as jest.Mock).mockReturnValueOnce({ id: 'northId' });

    await service.onUpdateNorthSettings('northId', command as NorthConnectorCommandDTO);
    expect(oibusEngine.stopNorth).toHaveBeenCalledWith('northId');
    expect(repositoryService.northConnectorRepository.updateNorthConnector).toHaveBeenCalledWith('northId', command);
    expect(oibusEngine.startNorth).toHaveBeenCalledWith('northId', { id: 'northId' });
  });

  it('should update and not start north', async () => {
    const command = {};

    await service.onUpdateNorthSettings('northId', command as NorthConnectorCommandDTO);
    expect(oibusEngine.stopNorth).toHaveBeenCalledWith('northId');
    expect(repositoryService.northConnectorRepository.updateNorthConnector).toHaveBeenCalledWith('northId', command);
    expect(oibusEngine.startNorth).not.toHaveBeenCalled();
  });

  it('should delete north', async () => {
    (repositoryService.northConnectorRepository.getNorthConnector as jest.Mock).mockReturnValueOnce({ name: 'northName' });

    await service.onDeleteNorth('northId');

    expect(repositoryService.northConnectorRepository.getNorthConnector).toBeCalledWith('northId');
    expect(oibusEngine.deleteNorth).toHaveBeenCalledWith('northId', 'northName');
    expect(repositoryService.northConnectorRepository.deleteNorthConnector).toHaveBeenCalledWith('northId');
    expect(loggerService.deleteLogs).toBeCalledWith('north', 'northId');
    expect(repositoryService.northMetricsRepository.removeMetrics).toBeCalledWith('northId');
  });

  it('should start north', async () => {
    (repositoryService.northConnectorRepository.getNorthConnector as jest.Mock).mockReturnValueOnce({ id: 'northId' });
    await service.onStartNorth('northId');
    expect(repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('northId');
    expect(repositoryService.northConnectorRepository.startNorthConnector).toHaveBeenCalledWith('northId');
    expect(oibusEngine.startNorth).toHaveBeenCalledWith('northId', { id: 'northId' });
  });

  it('should stop north', async () => {
    await service.onStopNorth('northId');
    expect(oibusEngine.stopNorth).toHaveBeenCalledWith('northId');
  });

  it('should create history query', async () => {
    const command = {};
    const southItems: Array<SouthConnectorItemDTO> = [
      { id: 'southItemId1', name: 'southItem1', scanModeId: 'scanModeId1', connectorId: 'southId', settings: {} } as SouthConnectorItemDTO,
      { id: 'southItemId2', name: 'southItem2', scanModeId: 'scanModeId1', connectorId: 'southId', settings: {} } as SouthConnectorItemDTO
    ];
    (repositoryService.historyQueryRepository.createHistoryQuery as jest.Mock).mockReturnValueOnce({ id: 'historyId' });
    const result = await service.onCreateHistoryQuery(command as HistoryQueryCommandDTO, southItems);
    expect(repositoryService.historyQueryRepository.createHistoryQuery).toHaveBeenCalledWith(command);
    expect(result).toEqual({ id: 'historyId' });
    expect(repositoryService.historyQueryItemRepository.createHistoryItem).toHaveBeenCalledTimes(2);
    expect(repositoryService.historyQueryItemRepository.createHistoryItem).toHaveBeenCalledWith('historyId', {
      name: 'southItem1',
      scanModeId: 'history',
      settings: {}
    });
    expect(repositoryService.historyQueryItemRepository.createHistoryItem).toHaveBeenCalledWith('historyId', {
      name: 'southItem2',
      scanModeId: 'history',
      settings: {}
    });
  });

  it('should update history query', async () => {
    const command = {};
    (repositoryService.historyQueryRepository.updateHistoryQuery as jest.Mock).mockReturnValueOnce({ id: 'historyId' });
    await service.onUpdateHistoryQuerySettings('historyId', command as HistoryQueryCommandDTO);
    expect(repositoryService.historyQueryRepository.updateHistoryQuery).toHaveBeenCalledWith('historyId', command);
  });

  it('should update history query and start', async () => {
    (repositoryService.historyQueryRepository.getHistoryQuery as jest.Mock).mockReturnValueOnce({ id: 'historyId' });

    const command = { enabled: true };
    (repositoryService.historyQueryRepository.updateHistoryQuery as jest.Mock).mockReturnValueOnce({ id: 'historyId' });
    await service.onUpdateHistoryQuerySettings('historyId', command as HistoryQueryCommandDTO);
    expect(repositoryService.historyQueryRepository.updateHistoryQuery).toHaveBeenCalledWith('historyId', command);
    expect(repositoryService.historyQueryRepository.startHistoryQuery).toHaveBeenCalledWith('historyId');
    expect(historyQueryEngine.startHistoryQuery).toHaveBeenCalledWith({ id: 'historyId' });
  });

  it('should delete history query', async () => {
    (repositoryService.historyQueryRepository.getHistoryQuery as jest.Mock).mockReturnValueOnce({ name: 'historyName' });

    await service.onDeleteHistoryQuery('historyId');

    expect(repositoryService.historyQueryRepository.getHistoryQuery).toBeCalledWith('historyId');
    expect(historyQueryEngine.deleteHistoryQuery).toHaveBeenCalledWith('historyId', 'historyName');

    expect(repositoryService.historyQueryItemRepository.deleteAllItems).toHaveBeenCalledWith('historyId');
    expect(repositoryService.historyQueryRepository.deleteHistoryQuery).toHaveBeenCalledWith('historyId');

    expect(loggerService.deleteLogs).toBeCalledWith('history-query', 'historyId');
  });

  it('should create history item', async () => {
    const command = {};
    const historyItem = { id: 'southItemId', settings: {} };
    (repositoryService.historyQueryRepository.getHistoryQuery as jest.Mock).mockReturnValueOnce({ id: 'historyId' });
    (repositoryService.historyQueryItemRepository.createHistoryItem as jest.Mock).mockReturnValueOnce(historyItem);
    const result = await service.onCreateHistoryItem('historyId', command as SouthConnectorItemCommandDTO);
    expect(repositoryService.historyQueryItemRepository.createHistoryItem).toHaveBeenCalledWith('historyId', command);
    expect(historyQueryEngine.stopHistoryQuery).toHaveBeenCalledWith('historyId', true);
    expect(historyQueryEngine.addItemToHistoryQuery).toHaveBeenCalledWith('historyId', historyItem);
    expect(result).toEqual(historyItem);
  });

  it('should update history item', async () => {
    const historyItem = { id: 'historyItemId', settings: {} };
    const command = {};
    (repositoryService.historyQueryRepository.getHistoryQuery as jest.Mock).mockReturnValueOnce({ id: 'historyId' });
    (repositoryService.historyQueryItemRepository.getHistoryItem as jest.Mock).mockReturnValueOnce(historyItem);
    await service.onUpdateHistoryItemsSettings('historyId', historyItem as SouthConnectorItemDTO, command as SouthConnectorItemCommandDTO);
    expect(historyQueryEngine.stopHistoryQuery).toHaveBeenCalledWith('historyId', true);
    expect(repositoryService.historyQueryItemRepository.updateHistoryItem).toHaveBeenCalledWith('historyItemId', command);
    expect(repositoryService.historyQueryItemRepository.getHistoryItem).toHaveBeenCalledWith('historyItemId');
    expect(historyQueryEngine.updateItemInHistoryQuery).toHaveBeenCalledWith('historyId', historyItem);
  });

  it('should start history query', async () => {
    (repositoryService.historyQueryRepository.getHistoryQuery as jest.Mock).mockReturnValueOnce({ id: 'historyId' });
    await service.onStartHistoryQuery('historyId');
    expect(repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
    expect(repositoryService.historyQueryRepository.startHistoryQuery).toHaveBeenCalledWith('historyId');
    expect(historyQueryEngine.startHistoryQuery).toHaveBeenCalledWith({ id: 'historyId' });
  });

  it('should stop history query', async () => {
    await service.onStopHistoryQuery('historyId');
    expect(historyQueryEngine.stopHistoryQuery).toHaveBeenCalledWith('historyId');
  });

  it('should delete history item', async () => {
    const historyItem = { id: 'historyItemId', connectorId: 'southId', settings: {} };
    (repositoryService.historyQueryItemRepository.getHistoryItem as jest.Mock).mockReturnValueOnce(historyItem);

    await service.onDeleteHistoryItem('historyItemId', 'itemId');
    expect(repositoryService.historyQueryItemRepository.getHistoryItem).toHaveBeenCalledWith('itemId');
    expect(repositoryService.historyQueryItemRepository.deleteHistoryItem).toHaveBeenCalledWith('itemId');
    expect(historyQueryEngine.deleteItemFromHistoryQuery).toHaveBeenCalledWith('historyItemId', historyItem);
  });

  it('should enable history item', async () => {
    const historyItem = { id: 'historyItemId', connectorId: 'historyId', settings: {} };
    (repositoryService.historyQueryItemRepository.getHistoryItem as jest.Mock).mockReturnValueOnce(historyItem);

    await service.onEnableHistoryItem('historyId', 'historyItemId');
    expect(historyQueryEngine.updateItemInHistoryQuery).toHaveBeenCalledWith('historyId', { ...historyItem, enabled: true });
    expect(repositoryService.historyQueryItemRepository.enableHistoryItem).toHaveBeenCalledWith('historyItemId');
  });

  it('enable should throw when history item not found', async () => {
    (repositoryService.historyQueryItemRepository.getHistoryItem as jest.Mock).mockReturnValue(null);

    let error;
    try {
      await service.onEnableHistoryItem('historyId', 'historyItemId');
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error('History item not found'));
    expect(historyQueryEngine.updateItemInHistoryQuery).not.toHaveBeenCalled();
    expect(repositoryService.historyQueryItemRepository.enableHistoryItem).not.toHaveBeenCalled();
  });

  it('should disable history item', async () => {
    const historyItem = { id: 'historyItemId', connectorId: 'historyId', settings: {} };
    (repositoryService.historyQueryItemRepository.getHistoryItem as jest.Mock).mockReturnValueOnce(historyItem);

    await service.onDisableHistoryItem('historyId', 'historyItemId');
    expect(historyQueryEngine.updateItemInHistoryQuery).toHaveBeenCalledWith('historyId', { ...historyItem, enabled: false });
    expect(repositoryService.historyQueryItemRepository.disableHistoryItem).toHaveBeenCalledWith('historyItemId');
  });

  it('disable should throw when south item not found', async () => {
    (repositoryService.historyQueryItemRepository.getHistoryItem as jest.Mock).mockReturnValue(null);

    let error;
    try {
      await service.onDisableHistoryItem('historyId', 'historyItemId');
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error('History item not found'));
    expect(historyQueryEngine.updateItemInHistoryQuery).not.toHaveBeenCalled();
    expect(repositoryService.historyQueryItemRepository.disableHistoryItem).not.toHaveBeenCalled();
  });

  it('should create North subscription', async () => {
    (repositoryService.northConnectorRepository.getNorthConnector as jest.Mock).mockReturnValue(null);

    await service.onCreateNorthSubscription('northId', 'southId');
    expect(oibusEngine.stopNorth).toHaveBeenCalledWith('northId');
    expect(repositoryService.subscriptionRepository.createNorthSubscription).toHaveBeenCalledWith('northId', 'southId');
    expect(oibusEngine.startNorth).not.toHaveBeenCalled();
  });

  it('should create North subscription and restart', async () => {
    (repositoryService.northConnectorRepository.getNorthConnector as jest.Mock).mockReturnValue({ id: 'northId', enabled: true });

    await service.onCreateNorthSubscription('northId', 'southId');
    expect(oibusEngine.stopNorth).toHaveBeenCalledWith('northId');
    expect(repositoryService.subscriptionRepository.createNorthSubscription).toHaveBeenCalledWith('northId', 'southId');
    expect(oibusEngine.startNorth).toHaveBeenCalledWith('northId', { id: 'northId', enabled: true });
  });

  it('should create external North subscription', async () => {
    (repositoryService.northConnectorRepository.getNorthConnector as jest.Mock).mockReturnValue(null);

    await service.onCreateExternalNorthSubscription('northId', 'externalId');
    expect(oibusEngine.stopNorth).toHaveBeenCalledWith('northId');
    expect(repositoryService.subscriptionRepository.createExternalNorthSubscription).toHaveBeenCalledWith('northId', 'externalId');
    expect(oibusEngine.startNorth).not.toHaveBeenCalled();
  });

  it('should create external North subscription and restart', async () => {
    (repositoryService.northConnectorRepository.getNorthConnector as jest.Mock).mockReturnValue({ id: 'northId', enabled: true });

    await service.onCreateExternalNorthSubscription('northId', 'externalId');
    expect(oibusEngine.stopNorth).toHaveBeenCalledWith('northId');
    expect(repositoryService.subscriptionRepository.createExternalNorthSubscription).toHaveBeenCalledWith('northId', 'externalId');
    expect(oibusEngine.startNorth).toHaveBeenCalledWith('northId', { id: 'northId', enabled: true });
  });

  it('should delete North subscription', async () => {
    (repositoryService.northConnectorRepository.getNorthConnector as jest.Mock).mockReturnValue(null);

    await service.onDeleteNorthSubscription('northId', 'southId');
    expect(oibusEngine.stopNorth).toHaveBeenCalledWith('northId');
    expect(repositoryService.subscriptionRepository.deleteNorthSubscription).toHaveBeenCalledWith('northId', 'southId');
    expect(oibusEngine.startNorth).not.toHaveBeenCalled();
  });

  it('should delete North subscription and restart', async () => {
    (repositoryService.northConnectorRepository.getNorthConnector as jest.Mock).mockReturnValue({ id: 'northId', enabled: true });

    await service.onDeleteNorthSubscription('northId', 'southId');
    expect(oibusEngine.stopNorth).toHaveBeenCalledWith('northId');
    expect(repositoryService.subscriptionRepository.deleteNorthSubscription).toHaveBeenCalledWith('northId', 'southId');
    expect(oibusEngine.startNorth).toHaveBeenCalledWith('northId', { id: 'northId', enabled: true });
  });

  it('should delete external North subscription', async () => {
    (repositoryService.northConnectorRepository.getNorthConnector as jest.Mock).mockReturnValue(null);

    await service.onDeleteExternalNorthSubscription('northId', 'externalId');
    expect(oibusEngine.stopNorth).toHaveBeenCalledWith('northId');
    expect(repositoryService.subscriptionRepository.deleteExternalNorthSubscription).toHaveBeenCalledWith('northId', 'externalId');
    expect(oibusEngine.startNorth).not.toHaveBeenCalled();
  });

  it('should delete external North subscription and restart', async () => {
    (repositoryService.northConnectorRepository.getNorthConnector as jest.Mock).mockReturnValue({ id: 'northId', enabled: true });

    await service.onDeleteExternalNorthSubscription('northId', 'externalId');
    expect(oibusEngine.stopNorth).toHaveBeenCalledWith('northId');
    expect(repositoryService.subscriptionRepository.deleteExternalNorthSubscription).toHaveBeenCalledWith('northId', 'externalId');
    expect(oibusEngine.startNorth).toHaveBeenCalledWith('northId', { id: 'northId', enabled: true });
  });

  it('should retrieve error file from north', async () => {
    await service.getErrorFiles('northId', '2020-02-02T02:02:02.222Z', '2022-02-02T02:02:02.222Z', 'file');
    expect(oibusEngine.getErrorFiles).toHaveBeenCalledWith('northId', '2020-02-02T02:02:02.222Z', '2022-02-02T02:02:02.222Z', 'file');
  });

  it('should delete all history query items', async () => {
    await service.onDeleteAllHistoryItems('historyId');
    expect(historyQueryEngine.deleteAllItemsFromHistoryQuery).toHaveBeenCalledWith('historyId');
    expect(repositoryService.historyQueryItemRepository.deleteAllItems).toHaveBeenCalledWith('historyId');
  });

  it('should create or update south items', async () => {
    await service.onCreateOrUpdateHistoryQueryItems({ id: 'historyId' } as HistoryQueryDTO, [], []);
    expect(repositoryService.historyQueryItemRepository.createAndUpdateItems).toHaveBeenCalledWith('historyId', [], []);
    expect(historyQueryEngine.stopHistoryQuery).toHaveBeenCalledWith('historyId');
  });

  it('should update scan mode', async () => {
    (repositoryService.scanModeRepository.getScanMode as jest.Mock).mockReturnValue({ id: 'scanModeId', cron: '* * * * *' });

    await service.onUpdateScanMode('scanModeId', { cron: '*/10 * * * *' } as ScanModeCommandDTO);
    expect(repositoryService.scanModeRepository.getScanMode).toHaveBeenCalledWith('scanModeId');
    expect(oibusEngine.updateScanMode).toHaveBeenCalledWith({ id: 'scanModeId', cron: '* * * * *' });
  });

  it('should not update scan mode if not found', async () => {
    (repositoryService.scanModeRepository.getScanMode as jest.Mock).mockReturnValue(null);

    await expect(service.onUpdateScanMode('scanModeId', { cron: '*/10 * * * *' } as ScanModeCommandDTO)).rejects.toThrowError(
      new Error(`Scan mode scanModeId not found`)
    );
    expect(repositoryService.scanModeRepository.getScanMode).toHaveBeenCalledWith('scanModeId');
    expect(oibusEngine.updateScanMode).not.toHaveBeenCalled();
  });

  it('should not update scan mode if same cron', async () => {
    (repositoryService.scanModeRepository.getScanMode as jest.Mock).mockReturnValue({ id: 'scanModeId', cron: '* * * * *' });

    await service.onUpdateScanMode('scanModeId', { cron: '* * * * *' } as ScanModeCommandDTO);
    expect(repositoryService.scanModeRepository.getScanMode).toHaveBeenCalledWith('scanModeId');
    expect(oibusEngine.updateScanMode).not.toHaveBeenCalled();
  });
});
