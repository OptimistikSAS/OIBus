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
import { EngineSettingsDTO, LogSettings, RegistrationSettingsDTO } from '../../../shared/model/engine.model';
import {
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthConnectorCommandDTO,
  SouthConnectorDTO,
  SouthCache
} from '../../../shared/model/south-connector.model';
import {
  NorthConnectorCommandDTO,
  NorthConnectorDTO,
  NorthConnectorItemCommandDTO,
  NorthConnectorItemDTO
} from '../../../shared/model/north-connector.model';
import { HistoryQueryCommandDTO, HistoryQueryDTO } from '../../../shared/model/history-query.model';
import HistoryQueryEngine from '../engine/history-query-engine';
import { ScanModeCommandDTO } from '../../../shared/model/scan-mode.model';
import HomeMetricsService from './home-metrics.service';
import HomeMetricsServiceMock from '../tests/__mocks__/home-metrics-service.mock';
import ProxyServer from '../web-server/proxy-server';
import ProxyServerMock from '../tests/__mocks__/proxy-server.mock';
import OIBusService from './oibus.service';
import OibusServiceMock from '../tests/__mocks__/oibus-service.mock';

jest.mock('./encryption.service');
jest.mock('./logger/logger.service');
jest.mock('./engine-metrics.service');

const oibusEngine: OIBusEngine = new OibusEngineMock();
const historyQueryEngine: HistoryQueryEngine = new HistoryQueryEngineMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const proxyServer: ProxyServer = new ProxyServerMock();
const repositoryService: RepositoryService = new RepositoryServiceMock('', '');
const engineMetricsService: EngineMetricsService = new EngineMetricsServiceMock();
const homeMetrics: HomeMetricsService = new HomeMetricsServiceMock();
const northService: NorthService = new NorthServiceMock();
const southService: SouthService = new SouthServiceMock();
const oibusService: OIBusService = new OibusServiceMock();
const loggerService: LoggerService = new LoggerService(encryptionService, 'folder');

let service: ReloadService;
describe('reload service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (repositoryService.registrationRepository.getRegistrationSettings as jest.Mock).mockReturnValue({
      id: 'id1'
    } as RegistrationSettingsDTO);
    service = new ReloadService(
      loggerService,
      repositoryService,
      engineMetricsService,
      homeMetrics,
      northService,
      southService,
      oibusEngine,
      historyQueryEngine,
      oibusService,
      proxyServer
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
    expect(service.oibusService).toBeDefined();
    expect(service.proxyServer).toBeDefined();
  });

  it('should update port', async () => {
    const changePortFn = jest.fn();
    const oldSettings = { port: 2223, proxyEnabled: false, proxyPort: 8888 };
    const newSettings = { port: 2224, proxyEnabled: true, proxyPort: 9000 };
    service.setWebServerChangePort(changePortFn);

    await service.onUpdateOibusSettings(oldSettings as EngineSettingsDTO, newSettings as EngineSettingsDTO);
    expect(changePortFn).toHaveBeenCalledTimes(1);
    expect(proxyServer.stop).toHaveBeenCalledTimes(1);
    expect(proxyServer.start).toHaveBeenCalledTimes(1);

    await service.onUpdateOibusSettings(null, newSettings as EngineSettingsDTO);
    expect(changePortFn).toHaveBeenCalledTimes(2);
    expect(proxyServer.stop).toHaveBeenCalledTimes(2);
    expect(proxyServer.start).toHaveBeenCalledTimes(2);

    await service.onUpdateOibusSettings(newSettings as EngineSettingsDTO, newSettings as EngineSettingsDTO);
    expect(changePortFn).toHaveBeenCalledTimes(2);
    expect(proxyServer.stop).toHaveBeenCalledTimes(2);
    expect(proxyServer.start).toHaveBeenCalledTimes(2);
  });

  it('should update log parameters', async () => {
    const changeLoggerFn = jest.fn();
    const newSettings = { id: 'oibusId', name: 'oibusName', logParameters: {} as LogSettings };
    service.setWebServerChangeLogger(changeLoggerFn);
    await service.onUpdateOibusSettings(null, newSettings as EngineSettingsDTO);
    expect(loggerService.stop).toHaveBeenCalledTimes(1);
    expect(loggerService.start).toHaveBeenCalledWith(newSettings.id, newSettings.name, newSettings.logParameters, { id: 'id1' });
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
    const command = { enabled: true, history: { maxInstantPerItem: false } };
    const previousSettings = { history: { maxInstantPerItem: 0 } };
    const newSettings = { id: 'southId' };
    (repositoryService.southConnectorRepository.getSouthConnector as jest.Mock).mockReturnValueOnce(previousSettings);
    (repositoryService.southConnectorRepository.getSouthConnector as jest.Mock).mockReturnValueOnce(newSettings);
    const onSouthMaxInstantPerItemChangeSpy = jest.spyOn(service as any, 'onSouthMaxInstantPerItemChange').mockImplementation();

    await service.onUpdateSouth('southId', command as SouthConnectorCommandDTO);
    expect(oibusEngine.stopSouth).toHaveBeenCalledWith('southId');
    expect(repositoryService.southConnectorRepository.updateSouthConnector).toHaveBeenCalledWith('southId', command);
    expect(onSouthMaxInstantPerItemChangeSpy).toHaveBeenCalledWith('southId', previousSettings, command);

    expect(repositoryService.southConnectorRepository.startSouthConnector).toHaveBeenCalledWith('southId');
    expect(oibusEngine.startSouth).toHaveBeenCalledWith('southId', newSettings);
  });

  it('should update and not start south', async () => {
    const command = { enabled: false, history: { maxInstantPerItem: false } };
    const previousSettings = { history: { maxInstantPerItem: 0 } };
    (repositoryService.southConnectorRepository.getSouthConnector as jest.Mock).mockReturnValueOnce(previousSettings);
    const onSouthMaxInstantPerItemChangeSpy = jest.spyOn(service as any, 'onSouthMaxInstantPerItemChange').mockImplementation();

    await service.onUpdateSouth('southId', command as SouthConnectorCommandDTO);
    expect(oibusEngine.stopSouth).toHaveBeenCalledWith('southId');
    expect(repositoryService.southConnectorRepository.updateSouthConnector).toHaveBeenCalledWith('southId', command);
    expect(onSouthMaxInstantPerItemChangeSpy).toHaveBeenCalledWith('southId', previousSettings, command);

    expect(repositoryService.southConnectorRepository.stopSouthConnector).toHaveBeenCalledWith('southId');
    expect(oibusEngine.startSouth).not.toHaveBeenCalled();
  });

  it('should update and not start south', async () => {
    const command = { enabled: true, history: { maxInstantPerItem: false } };
    const previousSettings = { history: { maxInstantPerItem: 0 } };
    (repositoryService.southConnectorRepository.getSouthConnector as jest.Mock).mockReturnValueOnce(previousSettings);
    const onSouthMaxInstantPerItemChangeSpy = jest.spyOn(service as any, 'onSouthMaxInstantPerItemChange').mockImplementation();

    await service.onUpdateSouth('southId', command as SouthConnectorCommandDTO, false);
    expect(oibusEngine.stopSouth).toHaveBeenCalledWith('southId');
    expect(repositoryService.southConnectorRepository.updateSouthConnector).toHaveBeenCalledWith('southId', command);
    expect(onSouthMaxInstantPerItemChangeSpy).toHaveBeenCalledWith('southId', previousSettings, command);

    expect(oibusEngine.startSouth).not.toHaveBeenCalled();
  });

  it('should delete south', async () => {
    (repositoryService.subscriptionRepository.getSubscribedNorthConnectors as jest.Mock).mockReturnValueOnce(['northId1', 'northId2']);
    (repositoryService.northConnectorRepository.getNorthConnector as jest.Mock)
      .mockReturnValueOnce({ id: 'northId1', enabled: true })
      .mockReturnValueOnce({ id: 'northId2', enabled: true });
    (repositoryService.southConnectorRepository.getSouthConnector as jest.Mock).mockReturnValueOnce({ name: 'southName', id: 'southId' });

    await service.onDeleteSouth('southId');

    expect(oibusEngine.stopNorth).toHaveBeenNthCalledWith(1, 'northId1');
    expect(oibusEngine.stopNorth).toHaveBeenNthCalledWith(2, 'northId2');
    expect(repositoryService.subscriptionRepository.deleteNorthSubscription).toHaveBeenNthCalledWith(1, 'northId1', 'southId');
    expect(repositoryService.subscriptionRepository.deleteNorthSubscription).toHaveBeenNthCalledWith(2, 'northId2', 'southId');
    expect(oibusEngine.startNorth).toHaveBeenNthCalledWith(1, 'northId1', { id: 'northId1', enabled: true });
    expect(oibusEngine.startNorth).toHaveBeenNthCalledWith(2, 'northId2', { id: 'northId2', enabled: true });

    expect(repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('southId');
    expect(oibusEngine.deleteSouth).toHaveBeenCalledWith('southId', 'southName');

    expect(repositoryService.southItemRepository.deleteAllSouthItems).toHaveBeenCalledWith('southId');
    expect(repositoryService.southConnectorRepository.deleteSouthConnector).toHaveBeenCalledWith('southId');

    expect(repositoryService.logRepository.deleteLogsByScopeId).toHaveBeenCalledWith('south', 'southId');
    expect(repositoryService.southMetricsRepository.removeMetrics).toHaveBeenCalledWith('southId');
    expect(repositoryService.southCacheRepository.deleteAllCacheScanModes).toHaveBeenCalledWith('southId');
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
    const onSouthItemScanModeChangeSpy = jest.spyOn(service as any, 'onSouthItemScanModeChange').mockImplementation();

    const command = {};
    await service.onUpdateSouthItemsSettings('southId', oldSouthItem as SouthConnectorItemDTO, command as SouthConnectorItemCommandDTO);
    expect(repositoryService.southItemRepository.updateSouthItem).toHaveBeenCalledWith('southItemId', command);
    expect(onSouthItemScanModeChangeSpy).toHaveBeenCalledWith('southId', oldSouthItem, newSouthItem);
    expect(oibusEngine.updateItemInSouth).toHaveBeenCalledWith('southId', oldSouthItem, newSouthItem);
  });

  it('should create or update south items', async () => {
    await service.onCreateOrUpdateSouthItems({ id: 'southId' } as SouthConnectorDTO, [], []);
    expect(repositoryService.southItemRepository.createAndUpdateSouthItems).toHaveBeenCalledWith('southId', [], []);
    expect(oibusEngine.stopSouth).toHaveBeenCalledWith('southId');
    expect(oibusEngine.startSouth).toHaveBeenCalledWith('southId', { id: 'southId' });
  });

  it('should create or update south items without restarting', async () => {
    await service.onCreateOrUpdateSouthItems({ id: 'southId' } as SouthConnectorDTO, [], [], false);
    expect(repositoryService.southItemRepository.createAndUpdateSouthItems).toHaveBeenCalledWith('southId', [], []);
    expect(oibusEngine.stopSouth).toHaveBeenCalledWith('southId');
    expect(oibusEngine.startSouth).not.toHaveBeenCalled();
  });

  it('should create or update south items with scan mode changes', async () => {
    const previousSouthItems: Array<SouthConnectorItemDTO> = [
      { id: 'southItemId1', name: 'southItem1', scanModeId: 'scanModeId1', connectorId: 'southId', settings: {} } as SouthConnectorItemDTO,
      { id: 'southItemId2', name: 'southItem2', scanModeId: 'scanModeId1', connectorId: 'southId', settings: {} } as SouthConnectorItemDTO
    ];
    const southItemsToUpdate: Array<SouthConnectorItemDTO> = [
      { id: 'southItemId1', name: 'southItem1', scanModeId: 'scanModeId2', connectorId: 'southId', settings: {} } as SouthConnectorItemDTO,
      { id: 'southItemId2', name: 'southItem2', scanModeId: 'scanModeId2', connectorId: 'southId', settings: {} } as SouthConnectorItemDTO
    ];
    (repositoryService.southItemRepository.getSouthItems as jest.Mock).mockReturnValueOnce(previousSouthItems);
    const onSouthItemScanModeChangeSpy = jest.spyOn(service as any, 'onSouthItemScanModeChange').mockImplementation();

    await service.onCreateOrUpdateSouthItems({ id: 'southId' } as SouthConnectorDTO, [], southItemsToUpdate);

    expect(repositoryService.southItemRepository.getSouthItems).toHaveBeenCalledWith('southId');
    expect(repositoryService.southItemRepository.createAndUpdateSouthItems).toHaveBeenCalledWith('southId', [], southItemsToUpdate);
    expect(oibusEngine.stopSouth).toHaveBeenCalledWith('southId');
    expect(onSouthItemScanModeChangeSpy).toHaveBeenCalledWith('southId', previousSouthItems[0], southItemsToUpdate[0]);
    expect(onSouthItemScanModeChangeSpy).toHaveBeenCalledWith('southId', previousSouthItems[1], southItemsToUpdate[1]);
    expect(oibusEngine.startSouth).toHaveBeenCalledWith('southId', { id: 'southId' });
  });

  it('should delete south item', async () => {
    const southItem = { id: 'southItemId', connectorId: 'southId', settings: {} };
    (repositoryService.southItemRepository.getSouthItem as jest.Mock).mockReturnValueOnce(southItem);
    const safeDeleteSouthCacheEntrySpy = jest.spyOn(service as any, 'safeDeleteSouthCacheEntry').mockImplementation();

    await service.onDeleteSouthItem('southItemId');
    expect(oibusEngine.deleteItemFromSouth).toHaveBeenCalledWith('southId', southItem);
    expect(repositoryService.southItemRepository.deleteSouthItem).toHaveBeenCalledWith('southItemId');
    expect(safeDeleteSouthCacheEntrySpy).toHaveBeenCalledWith(southItem);
  });

  it('delete should throw when south item not found', async () => {
    (repositoryService.southItemRepository.getSouthItem as jest.Mock).mockReturnValue(null);
    const safeDeleteSouthCacheEntrySpy = jest.spyOn(service as any, 'safeDeleteSouthCacheEntry').mockImplementation();

    let error;
    try {
      await service.onDeleteSouthItem('southItemId');
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error('South item not found'));
    expect(oibusEngine.deleteItemFromSouth).not.toHaveBeenCalled();
    expect(repositoryService.southItemRepository.deleteSouthItem).not.toHaveBeenCalled();
    expect(safeDeleteSouthCacheEntrySpy).not.toHaveBeenCalled();
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
    expect(repositoryService.southCacheRepository.deleteAllCacheScanModes).toHaveBeenCalledWith('southId');
  });

  it('should create and start north', async () => {
    const command = { enabled: true };
    (repositoryService.northConnectorRepository.createNorthConnector as jest.Mock).mockReturnValueOnce({ id: 'northId' });
    const result = await service.onCreateNorth(command as NorthConnectorCommandDTO);
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
    (repositoryService.northConnectorRepository.getNorthConnector as jest.Mock).mockReturnValueOnce({ name: 'northName', id: 'northId' });

    await service.onDeleteNorth('northId');

    expect(repositoryService.northConnectorRepository.getNorthConnector).toHaveBeenCalledWith('northId');
    expect(oibusEngine.deleteNorth).toHaveBeenCalledWith('northId', 'northName');
    expect(repositoryService.northConnectorRepository.deleteNorthConnector).toHaveBeenCalledWith('northId');
    expect(repositoryService.logRepository.deleteLogsByScopeId).toHaveBeenCalledWith('north', 'northId');
    expect(repositoryService.northMetricsRepository.removeMetrics).toHaveBeenCalledWith('northId');
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
    const command = {};
    (repositoryService.historyQueryRepository.updateHistoryQuery as jest.Mock).mockReturnValueOnce({ id: 'historyId' });
    await service.onUpdateHistoryQuerySettings('historyId', command as HistoryQueryCommandDTO);
    expect(repositoryService.historyQueryRepository.updateHistoryQuery).toHaveBeenCalledWith('historyId', command);
  });

  it('should delete history query', async () => {
    (repositoryService.historyQueryRepository.getHistoryQuery as jest.Mock).mockReturnValueOnce({ name: 'historyName', id: 'historyId' });

    await service.onDeleteHistoryQuery('historyId');

    expect(repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
    expect(historyQueryEngine.deleteHistoryQuery).toHaveBeenCalledWith('historyId', 'historyName');

    expect(repositoryService.historyQueryItemRepository.deleteAllItems).toHaveBeenCalledWith('historyId');
    expect(repositoryService.historyQueryRepository.deleteHistoryQuery).toHaveBeenCalledWith('historyId');

    expect(repositoryService.logRepository.deleteLogsByScopeId).toHaveBeenCalledWith('history-query', 'historyId');
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
    expect(repositoryService.historyQueryRepository.setHistoryQueryStatus).toHaveBeenCalledWith('historyId', 'RUNNING');
    expect(historyQueryEngine.startHistoryQuery).toHaveBeenCalledWith({ id: 'historyId' });
  });

  it('should restart history query', async () => {
    (repositoryService.historyQueryRepository.getHistoryQuery as jest.Mock).mockReturnValueOnce({ id: 'historyId' });
    await service.onRestartHistoryQuery('historyId');
    expect(historyQueryEngine.stopHistoryQuery).toHaveBeenCalledWith('historyId', true);
    expect(repositoryService.historyQueryRepository.getHistoryQuery).toHaveBeenCalledWith('historyId');
    expect(repositoryService.historyQueryRepository.setHistoryQueryStatus).toHaveBeenCalledWith('historyId', 'RUNNING');
    expect(historyQueryEngine.startHistoryQuery).toHaveBeenCalledWith({ id: 'historyId' });
  });

  it('should stop history query', async () => {
    await service.onPauseHistoryQuery('historyId');
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
    expect(historyQueryEngine.stopHistoryQuery).toHaveBeenCalledWith('historyId', true);
  });

  it('should update scan mode', async () => {
    (repositoryService.scanModeRepository.getScanMode as jest.Mock).mockReturnValue({ id: 'scanModeId', cron: '* * * * *' });

    await service.onUpdateScanMode('scanModeId', { cron: '*/10 * * * *' } as ScanModeCommandDTO);
    expect(repositoryService.scanModeRepository.getScanMode).toHaveBeenCalledWith('scanModeId');
    expect(oibusEngine.updateScanMode).toHaveBeenCalledWith({ id: 'scanModeId', cron: '* * * * *' });
  });

  it('should not update scan mode if not found', async () => {
    (repositoryService.scanModeRepository.getScanMode as jest.Mock).mockReturnValue(null);

    await expect(service.onUpdateScanMode('scanModeId', { cron: '*/10 * * * *' } as ScanModeCommandDTO)).rejects.toThrow(
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

  describe('onSouthItemScanModeChange', () => {
    let previousState: { item: SouthConnectorItemDTO; cache: SouthCache };
    let newState: { item: SouthConnectorItemDTO; cache: SouthCache };
    let safeDeleteSouthCacheEntrySpy: jest.SpyInstance;

    beforeEach(() => {
      jest.clearAllMocks();
      safeDeleteSouthCacheEntrySpy = jest.spyOn(service as any, 'safeDeleteSouthCacheEntry').mockImplementation();
      previousState = {
        item: {
          id: 'item1',
          scanModeId: 'scanModePrev'
        } as SouthConnectorItemDTO,
        cache: {
          southId: 'southId',
          scanModeId: 'scanModePrev',
          itemId: 'item1',
          maxInstant: '2024-02-16T00:00:00.000Z'
        }
      };
      newState = {
        item: {
          id: 'item1',
          scanModeId: 'scanModeNew'
        } as SouthConnectorItemDTO,
        cache: {
          southId: 'southId',
          scanModeId: 'scanModeNew',
          itemId: 'item1',
          maxInstant: '2024-02-16T00:00:00.000Z'
        }
      };
    });

    it('should handle south item scan mode change when there is no change', () => {
      (repositoryService.southConnectorRepository.getSouthConnector as jest.Mock).mockReturnValueOnce({
        history: { maxInstantPerItem: 0 }
      });
      newState.item.scanModeId = previousState.item.scanModeId;

      service['onSouthItemScanModeChange']('southId', previousState.item, newState.item);
      expect(repositoryService.southCacheRepository.getSouthCacheScanMode).not.toHaveBeenCalled();
      expect(safeDeleteSouthCacheEntrySpy).not.toHaveBeenCalled();
      expect(repositoryService.southCacheRepository.createOrUpdateCacheScanMode).not.toHaveBeenCalled();
    });

    it('should handle south item scan mode change when there is no previous cache', () => {
      (repositoryService.southConnectorRepository.getSouthConnector as jest.Mock).mockReturnValueOnce({
        history: { maxInstantPerItem: 0 }
      });
      (repositoryService.southCacheRepository.getSouthCacheScanMode as jest.Mock).mockReturnValue(null);

      service['onSouthItemScanModeChange']('southId', previousState.item, newState.item);

      expect(safeDeleteSouthCacheEntrySpy).not.toHaveBeenCalled();
      expect(repositoryService.southCacheRepository.getSouthCacheScanMode).toHaveBeenCalledTimes(2);
      expect(repositoryService.southCacheRepository.createOrUpdateCacheScanMode).not.toHaveBeenCalled();
    });

    it('should handle south item scan mode change when max instant per item is enabled', () => {
      (repositoryService.southConnectorRepository.getSouthConnector as jest.Mock).mockReturnValueOnce({
        history: { maxInstantPerItem: 1 }
      });
      (repositoryService.southCacheRepository.getSouthCacheScanMode as jest.Mock).mockReturnValueOnce(previousState.cache);
      (repositoryService.southCacheRepository.createOrUpdateCacheScanMode as jest.Mock).mockReturnValueOnce(newState.cache);

      service['onSouthItemScanModeChange']('southId', previousState.item, newState.item);

      expect(safeDeleteSouthCacheEntrySpy).toHaveBeenCalledWith(previousState.item);
      expect(repositoryService.southCacheRepository.getSouthCacheScanMode).toHaveBeenCalledTimes(2);
      expect(repositoryService.southCacheRepository.createOrUpdateCacheScanMode).toHaveBeenCalledWith(newState.cache);
    });

    it('should handle south item scan mode change when max instant per item is disabled', () => {
      (repositoryService.southConnectorRepository.getSouthConnector as jest.Mock).mockReturnValueOnce({
        history: { maxInstantPerItem: 0 }
      });
      (repositoryService.southCacheRepository.getSouthCacheScanMode as jest.Mock).mockReturnValueOnce(previousState.cache);
      (repositoryService.southCacheRepository.createOrUpdateCacheScanMode as jest.Mock).mockReturnValueOnce(newState.cache);
      newState.cache.itemId = 'all';

      service['onSouthItemScanModeChange']('southId', previousState.item, newState.item);

      expect(safeDeleteSouthCacheEntrySpy).toHaveBeenCalledWith(previousState.item);
      expect(repositoryService.southCacheRepository.getSouthCacheScanMode).toHaveBeenCalledTimes(2);
      expect(repositoryService.southCacheRepository.createOrUpdateCacheScanMode).toHaveBeenCalledWith(newState.cache);
    });
  });

  describe('onSouthMaxInstantPerItemChange', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle south max instant per item change when there is no change', () => {
      service['onSouthMaxInstantPerItemChange'](
        'southId',
        { history: { maxInstantPerItem: false } } as any,
        { history: { maxInstantPerItem: false } } as any
      );

      expect(repositoryService.southCacheRepository.getLatestMaxInstants).not.toHaveBeenCalled();
      expect(repositoryService.southCacheRepository.deleteAllCacheScanModes).not.toHaveBeenCalled();
      expect(repositoryService.southCacheRepository.createOrUpdateCacheScanMode).not.toHaveBeenCalled();
    });

    it('should handle south max instant per item change when there is no previous cache', () => {
      (repositoryService.southCacheRepository.getLatestMaxInstants as jest.Mock).mockReturnValueOnce(null);

      service['onSouthMaxInstantPerItemChange'](
        'southId',
        { history: { maxInstantPerItem: false } } as any,
        { history: { maxInstantPerItem: true } } as any
      );

      expect(repositoryService.southCacheRepository.getLatestMaxInstants).toHaveBeenCalled();
      expect(repositoryService.southCacheRepository.deleteAllCacheScanModes).not.toHaveBeenCalled();
      expect(repositoryService.southCacheRepository.createOrUpdateCacheScanMode).not.toHaveBeenCalled();
    });

    it('should handle south max instant per item change when max instant per item is being enabled', () => {
      const items = [
        { id: 'item1', scanModeId: 'scanModePrev' },
        { id: 'item2', scanModeId: 'scanModePrev' },
        { id: 'item3', scanModeId: 'scanModeNew' },
        { id: 'item4', scanModeId: 'scanModeNotStarted' }
      ];
      (repositoryService.southItemRepository.getSouthItems as jest.Mock).mockReturnValueOnce(items);
      const maxInstantsByScanMode = new Map([
        ['scanModeNew', '2024-01-16T00:00:00.000Z'],
        ['scanModePrev', '2024-02-16T00:00:00.000Z']
      ]);
      (repositoryService.southCacheRepository.getLatestMaxInstants as jest.Mock).mockReturnValueOnce(maxInstantsByScanMode);

      service['onSouthMaxInstantPerItemChange'](
        'southId',
        { history: { maxInstantPerItem: false } } as any,
        { history: { maxInstantPerItem: true } } as any
      );

      expect(repositoryService.southCacheRepository.getLatestMaxInstants).toHaveBeenCalled();
      expect(repositoryService.southCacheRepository.deleteAllCacheScanModes).toHaveBeenCalledWith('southId');
      expect(repositoryService.southItemRepository.getSouthItems).toHaveBeenCalledWith('southId');

      // 3 calls, since the last item has not started yet, so it has no cache
      expect(repositoryService.southCacheRepository.createOrUpdateCacheScanMode).toHaveBeenCalledTimes(3);
      expect(repositoryService.southCacheRepository.createOrUpdateCacheScanMode).toHaveBeenNthCalledWith(1, {
        southId: 'southId',
        itemId: 'item1',
        scanModeId: 'scanModePrev',
        maxInstant: '2024-02-16T00:00:00.000Z'
      });
      expect(repositoryService.southCacheRepository.createOrUpdateCacheScanMode).toHaveBeenNthCalledWith(2, {
        southId: 'southId',
        itemId: 'item2',
        scanModeId: 'scanModePrev',
        maxInstant: '2024-02-16T00:00:00.000Z'
      });
      expect(repositoryService.southCacheRepository.createOrUpdateCacheScanMode).toHaveBeenNthCalledWith(3, {
        southId: 'southId',
        itemId: 'item3',
        scanModeId: 'scanModeNew',
        maxInstant: '2024-01-16T00:00:00.000Z'
      });
    });

    it('should handle south max instant per item change when max instant per item is being disabled', () => {
      const maxInstantsByScanMode = new Map([
        ['scanModeNew', '2024-01-16T00:00:00.000Z'],
        ['scanModePrev', '2024-02-20T00:00:00.000Z']
      ]);
      (repositoryService.southCacheRepository.getLatestMaxInstants as jest.Mock).mockReturnValueOnce(maxInstantsByScanMode);

      service['onSouthMaxInstantPerItemChange'](
        'southId',
        { history: { maxInstantPerItem: true } } as any,
        { history: { maxInstantPerItem: false } } as any
      );

      expect(repositoryService.southCacheRepository.getLatestMaxInstants).toHaveBeenCalled();
      expect(repositoryService.southCacheRepository.deleteAllCacheScanModes).toHaveBeenCalledWith('southId');
      expect(repositoryService.southItemRepository.getSouthItems).not.toHaveBeenCalled();

      // 2 calls, since there are only two distinct scan modes
      expect(repositoryService.southCacheRepository.createOrUpdateCacheScanMode).toHaveBeenCalledTimes(2);
      expect(repositoryService.southCacheRepository.createOrUpdateCacheScanMode).toHaveBeenNthCalledWith(1, {
        southId: 'southId',
        itemId: 'all',
        scanModeId: 'scanModeNew',
        maxInstant: '2024-01-16T00:00:00.000Z'
      });
      expect(repositoryService.southCacheRepository.createOrUpdateCacheScanMode).toHaveBeenNthCalledWith(2, {
        southId: 'southId',
        itemId: 'all',
        scanModeId: 'scanModePrev',
        maxInstant: '2024-02-20T00:00:00.000Z'
      });
    });
  });

  describe('safeDeleteSouthCacheEntry', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should do nothing when south connector is not found', () => {
      (repositoryService.southConnectorRepository.getSouthConnector as jest.Mock).mockReturnValueOnce(null);

      service['safeDeleteSouthCacheEntry']({ id: 'itemId', connectorId: 'southId' } as any);

      expect(repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('southId');
      expect(repositoryService.southCacheRepository.deleteCacheScanModesByItem).not.toHaveBeenCalled();
      expect(repositoryService.southCacheRepository.deleteCacheScanMode).not.toHaveBeenCalled();
    });

    it('should delete south cache entry when max instant per item is enabled', () => {
      const item = { id: 'itemId', connectorId: 'southId' };
      (repositoryService.southConnectorRepository.getSouthConnector as jest.Mock).mockReturnValueOnce({
        history: { maxInstantPerItem: true }
      });

      service['safeDeleteSouthCacheEntry'](item as any);

      expect(repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('southId');
      expect(repositoryService.southCacheRepository.deleteCacheScanModesByItem).toHaveBeenCalledWith('itemId');
    });

    it('should delete south cache entry when max instant per item is disabled and the scan mode is unused', () => {
      const item = {
        id: 'itemId',
        connectorId: 'southId',
        scanModeId: 'scanModePrev'
      };
      const allItems = [{ scanModeId: 'scanModeId1' }, { scanModeId: 'scanModeId2' }];
      (repositoryService.southItemRepository.getSouthItems as jest.Mock).mockReturnValueOnce(allItems);
      (repositoryService.southConnectorRepository.getSouthConnector as jest.Mock).mockReturnValueOnce({
        history: { maxInstantPerItem: false }
      });

      service['safeDeleteSouthCacheEntry'](item as any);

      expect(repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('southId');
      expect(repositoryService.southItemRepository.getSouthItems).toHaveBeenCalledWith('southId');
      expect(repositoryService.southCacheRepository.deleteCacheScanMode).toHaveBeenCalledWith('itemId', 'scanModePrev', 'all');
    });

    it('should not delete south cache entry when max instant per item is disabled and the scan mode is used', () => {
      const item = {
        id: 'itemId',
        connectorId: 'southId',
        scanModeId: 'scanModePrev'
      };
      const allItems = [{ scanModeId: 'scanModePrev' }, { scanModeId: 'scanModeId2' }];
      (repositoryService.southItemRepository.getSouthItems as jest.Mock).mockReturnValueOnce(allItems);
      (repositoryService.southConnectorRepository.getSouthConnector as jest.Mock).mockReturnValueOnce({
        history: { maxInstantPerItem: false }
      });

      service['safeDeleteSouthCacheEntry'](item as any);

      expect(repositoryService.southConnectorRepository.getSouthConnector).toHaveBeenCalledWith('southId');
      expect(repositoryService.southItemRepository.getSouthItems).toHaveBeenCalledWith('southId');
      expect(repositoryService.southCacheRepository.deleteCacheScanMode).not.toHaveBeenCalled();
    });
  });

  it('should create north item', async () => {
    const command = {};
    const northItem = { id: 'northItemId', settings: {} };
    (repositoryService.northItemRepository.createNorthItem as jest.Mock).mockReturnValueOnce(northItem);

    const result = await service.onCreateNorthItem('northId', command as NorthConnectorItemCommandDTO);

    expect(oibusEngine.addItemToNorth).toHaveBeenCalledWith('northId', northItem);
    expect(result).toEqual(northItem);
  });

  it('should update north item', async () => {
    const command = {};
    const oldNorthItem = { id: 'northItemId', connectorId: 'northId', settings: { field: 'value' } };
    const newNorthItem = { id: 'northItemId', connectorId: 'northId', settings: { field: 'newValue' } };
    (repositoryService.northItemRepository.getNorthItem as jest.Mock).mockReturnValueOnce(newNorthItem);

    await service.onUpdateNorthItemsSettings('northId', oldNorthItem as NorthConnectorItemDTO, command as NorthConnectorItemCommandDTO);

    expect(repositoryService.northItemRepository.updateNorthItem).toHaveBeenCalledWith('northItemId', command);
    expect(oibusEngine.updateItemInNorth).toHaveBeenCalledWith('northId', oldNorthItem, newNorthItem);
  });

  it('should create or update north items', async () => {
    await service.onCreateOrUpdateNorthItems({ id: 'northId' } as NorthConnectorDTO, [], []);
    expect(oibusEngine.stopNorth).toHaveBeenCalledWith('northId');
    expect(repositoryService.northItemRepository.createAndUpdateNorthItems).toHaveBeenCalledWith('northId', [], []);
    expect(oibusEngine.startNorth).toHaveBeenCalledWith('northId', { id: 'northId' });
  });

  it('should delete north item', async () => {
    const northItem = { id: 'northItemId', connectorId: 'northId', settings: {} };
    (repositoryService.northItemRepository.getNorthItem as jest.Mock).mockReturnValueOnce(northItem);

    await service.onDeleteNorthItem('northItemId');
    expect(oibusEngine.deleteItemFromNorth).toHaveBeenCalledWith('northId', northItem);
    expect(repositoryService.northItemRepository.deleteNorthItem).toHaveBeenCalledWith('northItemId');
  });

  it('delete should throw when north item not found', async () => {
    (repositoryService.northItemRepository.getNorthItem as jest.Mock).mockReturnValue(null);

    let error;
    try {
      await service.onDeleteNorthItem('northItemId');
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error('North item not found'));
    expect(oibusEngine.deleteItemFromNorth).not.toHaveBeenCalled();
    expect(repositoryService.northItemRepository.deleteNorthItem).not.toHaveBeenCalled();
  });

  it('should enable north item', async () => {
    const northItem = { id: 'northItemId', connectorId: 'northId', settings: {} };
    (repositoryService.northItemRepository.getNorthItem as jest.Mock).mockReturnValueOnce(northItem);

    await service.onEnableNorthItem('northItemId');
    expect(repositoryService.northItemRepository.enableNorthItem).toHaveBeenCalledWith('northItemId');
    expect(oibusEngine.updateItemInNorth).toHaveBeenCalledWith('northId', northItem, { ...northItem, enabled: true });
  });

  it('enable should throw when north item not found', async () => {
    (repositoryService.northItemRepository.getNorthItem as jest.Mock).mockReturnValue(null);

    let error;
    try {
      await service.onEnableNorthItem('northItemId');
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error('North item not found'));
    expect(repositoryService.northItemRepository.enableNorthItem).not.toHaveBeenCalled();
    expect(oibusEngine.updateItemInNorth).not.toHaveBeenCalled();
  });

  it('should disable north item', async () => {
    const northItem = { id: 'northItemId', connectorId: 'northId', settings: {} };
    (repositoryService.northItemRepository.getNorthItem as jest.Mock).mockReturnValueOnce(northItem);

    await service.onDisableNorthItem('northItemId');
    expect(repositoryService.northItemRepository.disableNorthItem).toHaveBeenCalledWith('northItemId');
    expect(oibusEngine.updateItemInNorth).toHaveBeenCalledWith('northId', northItem, { ...northItem, enabled: false });
  });

  it('disable should throw when north item not found', async () => {
    (repositoryService.northItemRepository.getNorthItem as jest.Mock).mockReturnValue(null);

    let error;
    try {
      await service.onDisableNorthItem('northItemId');
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error('North item not found'));
    expect(oibusEngine.updateItemInNorth).not.toHaveBeenCalled();
    expect(repositoryService.northItemRepository.disableNorthItem).not.toHaveBeenCalled();
  });

  it('should delete all north items', async () => {
    await service.onDeleteAllNorthItems('northId');
    expect(oibusEngine.deleteAllItemsFromNorth).toHaveBeenCalledWith('northId');
    expect(repositoryService.northItemRepository.deleteAllNorthItems).toHaveBeenCalledWith('northId');
  });
});
