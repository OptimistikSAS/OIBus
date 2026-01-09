import pino from 'pino';
import NorthConnector from '../north/north-connector';
import SouthConnector from '../south/south-connector';
import path from 'node:path';
import { BaseFolders, Instant } from '../model/types';
import {
  CacheMetadata,
  CacheSearchParam,
  NorthConnectorMetrics,
  OIBusContent,
  SouthConnectorMetrics
} from '../../shared/model/engine.model';
import { ScanMode } from '../model/scan-mode.model';
import { NorthSettings } from '../../shared/model/north-settings.model';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { SouthConnectorEntity, SouthConnectorEntityLight } from '../model/south-connector.model';
import { NorthConnectorEntity, NorthConnectorEntityLight } from '../model/north-connector.model';
import SouthConnectorMetricsService from '../service/metrics/south-connector-metrics.service';
import SouthConnectorMetricsRepository from '../repository/metrics/south-connector-metrics.repository';
import NorthConnectorMetricsRepository from '../repository/metrics/north-connector-metrics.repository';
import NorthConnectorMetricsService from '../service/metrics/north-connector-metrics.service';
import { PassThrough } from 'node:stream';
import { ReadStream } from 'node:fs';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import { createBaseFolders, createFolder, filesExists } from '../service/utils';
import fs from 'node:fs/promises';
import { buildSouth } from '../south/south-connector-factory';
import { buildNorth } from '../north/north-connector-factory';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import { HistoryQueryEntity, HistoryQueryEntityLight } from '../model/histor-query.model';
import HistoryQuery from './history-query';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import HistoryQueryMetricsService from '../service/metrics/history-query-metrics.service';
import HistoryQueryMetricsRepository from '../repository/metrics/history-query-metrics.repository';
import OIAnalyticsMessageService from '../service/oia/oianalytics-message.service';

const CACHE_FOLDER = './cache';
const ARCHIVE_FOLDER = './archive';
const ERROR_FOLDER = './error';

export default class DataStreamEngine {
  private northConnectors = new Map<string, NorthConnector<NorthSettings>>();
  private northConnectorMetrics = new Map<string, NorthConnectorMetricsService>();
  private southConnectors = new Map<string, SouthConnector<SouthSettings, SouthItemSettings>>();
  private southConnectorMetrics = new Map<string, SouthConnectorMetricsService>();
  private historyQueries = new Map<string, HistoryQuery>();
  private historyQueryMetrics = new Map<string, HistoryQueryMetricsService>();

  private readonly cacheFolders: BaseFolders;

  constructor(
    private northConnectorRepository: NorthConnectorRepository,
    private northConnectorMetricsRepository: NorthConnectorMetricsRepository,
    private southConnectorRepository: SouthConnectorRepository,
    private southConnectorMetricsRepository: SouthConnectorMetricsRepository,
    private historyQueryRepository: HistoryQueryRepository,
    private historyQueryMetricsRepository: HistoryQueryMetricsRepository,
    private southCacheRepository: SouthCacheRepository,
    private certificateRepository: CertificateRepository,
    private oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository,
    private oianalyticsMessageService: OIAnalyticsMessageService,
    private _logger: pino.Logger
  ) {
    this.cacheFolders = {
      cache: path.resolve(CACHE_FOLDER),
      archive: path.resolve(ARCHIVE_FOLDER),
      error: path.resolve(ERROR_FOLDER)
    };
  }

  async start(
    northConnectorList: Array<NorthConnectorEntityLight>,
    southConnectorList: Array<SouthConnectorEntityLight>,
    historyQueryList: Array<HistoryQueryEntityLight>
  ): Promise<void> {
    for (const northLight of northConnectorList) {
      try {
        const north = await this.createNorth(northLight.id);
        if (north.connectorConfiguration.enabled) {
          await this.startNorth(north.connectorConfiguration.id);
        }
      } catch (error: unknown) {
        this._logger.error(
          `Error while creating North connector "${northLight.name}" of type "${northLight.type}" (${northLight.id}): ${(error as Error).message}`
        );
      }
    }

    for (const southLight of southConnectorList) {
      try {
        const south = await this.createSouth(southLight.id);
        if (south.connectorConfiguration.enabled) {
          await this.startSouth(south.connectorConfiguration.id);
        }
      } catch (error: unknown) {
        this._logger.error(
          `Error while creating South connector "${southLight.name}" of type "${southLight.type}" (${southLight.id}): ${(error as Error).message}`
        );
      }
    }

    for (const historyLight of historyQueryList) {
      try {
        const historyQuery = await this.createHistoryQuery(historyLight.id);
        if (historyQuery.historyQueryConfiguration.status === 'RUNNING') {
          await this.startHistoryQuery(historyQuery.historyQueryConfiguration.id);
        }
      } catch (error: unknown) {
        this._logger.error(
          `Error while creating History query "${historyLight.name}" of South type "${historyLight.southType}" and North type "${historyLight.northType}" (${historyLight.id}): ${(error as Error).message}`
        );
      }
    }
    this._logger.info('OIBus engine started');
  }

  async stop(): Promise<void> {
    for (const id of this.southConnectors.keys()) {
      await this.stopSouth(id);
    }

    for (const id of this.northConnectors.keys()) {
      await this.stopNorth(id);
    }

    for (const id of this.historyQueries.keys()) {
      await this.stopHistoryQuery(id);
    }
  }

  async createNorth(northId: string): Promise<NorthConnector<NorthSettings>> {
    const configuration = this.northConnectorRepository.findNorthById(northId)!;
    await createBaseFolders(this.getBaseFolderStructure('north', configuration.id), 'north');
    await createFolder(path.resolve(this.cacheFolders.cache, `north-${configuration.id}`, 'tmp'));
    if (configuration.type === 'opcua') {
      await createFolder(path.resolve(this.cacheFolders.cache, `north-${configuration.id}`, 'opcua'));
    }

    const north = buildNorth(
      configuration,
      this.logger.child({ scopeType: 'north', scopeId: configuration.id, scopeName: configuration.name }),
      path.resolve(this.cacheFolders.cache, `north-${configuration.id}`),
      path.resolve(this.cacheFolders.error, `north-${configuration.id}`),
      path.resolve(this.cacheFolders.archive, `north-${configuration.id}`),
      this.certificateRepository,
      this.oIAnalyticsRegistrationRepository
    );

    this.northConnectors.set(configuration.id, north);
    if (this.northConnectorMetrics.has(configuration.id)) {
      this.northConnectorMetrics.get(configuration.id)?.destroy();
    }
    this.northConnectorMetrics.set(configuration.id, new NorthConnectorMetricsService(north, this.northConnectorMetricsRepository));
    return north;
  }

  async startNorth(northId: string): Promise<void> {
    const north = this.northConnectors.get(northId);
    if (!north) {
      this._logger.trace(`North connector "${northId}" not set`);
      return;
    }

    north.connectorConfiguration = this.northConnectorRepository.findNorthById(northId)!;
    north // Do not await here, so it can start all connectors without blocking the thread
      .start()
      .catch(error => {
        this._logger.error(
          `Error while starting North connector "${north.connectorConfiguration.name}" of type "${north.connectorConfiguration.type}" (${north.connectorConfiguration.id}): ${error.message}`
        );
      });
  }

  getNorth(northId: string): NorthConnector<NorthSettings> | undefined {
    return this.northConnectors.get(northId);
  }

  getNorthDataStream(northConnectorId: string): PassThrough | null {
    return this.northConnectorMetrics.get(northConnectorId)?.stream || null;
  }

  getNorthMetrics(): Record<string, NorthConnectorMetrics> {
    const metricsList: Record<string, NorthConnectorMetrics> = {};
    for (const [id, value] of this.northConnectorMetrics.entries()) {
      metricsList[id] = value.metrics;
    }
    return metricsList;
  }

  resetNorthMetrics(northConnectorId: string): PassThrough | null {
    return this.northConnectorMetrics.get(northConnectorId)?.resetMetrics() || null;
  }

  async reloadNorth(northConnector: NorthConnectorEntity<NorthSettings>) {
    await this.stopNorth(northConnector.id);
    const north = this.northConnectors.get(northConnector.id);
    if (north) {
      north.setLogger(this.logger.child({ scopeType: 'north', scopeId: northConnector.id, scopeName: northConnector.name }));
      if (northConnector.enabled) {
        await this.startNorth(northConnector.id);
      }
    }
  }

  async stopNorth(northId: string): Promise<void> {
    const north = this.northConnectors.get(northId);
    if (north) {
      north.connectorConfiguration = this.northConnectorRepository.findNorthById(northId)!;
      await north.stop();
    }
  }

  async deleteNorth(north: NorthConnectorEntity<NorthSettings>): Promise<void> {
    await this.stopNorth(north.id);
    await this.deleteCacheFolder('north', north.id, north.name);
    this.northConnectors.delete(north.id);
    this.northConnectorMetrics.get(north.id)?.destroy();
    this.northConnectorMetrics.delete(north.id);
  }

  async createSouth(southId: string): Promise<SouthConnector<SouthSettings, SouthItemSettings>> {
    const configuration = this.southConnectorRepository.findSouthById(southId)!;
    await createBaseFolders(this.getBaseFolderStructure('south', configuration.id), 'south');
    await createFolder(path.resolve(this.cacheFolders.cache, `south-${configuration.id}`, 'tmp'));
    if (configuration.type === 'opcua') {
      await createFolder(path.resolve(this.cacheFolders.cache, `south-${configuration.id}`, 'opcua'));
    }
    const south = buildSouth(
      configuration,
      this.addContent.bind(this),
      this.logger.child({ scopeType: 'south', scopeId: configuration.id, scopeName: configuration.name }),
      path.resolve(this.cacheFolders.cache, `south-${configuration.id}`),
      this.southCacheRepository,
      this.certificateRepository,
      this.oIAnalyticsRegistrationRepository
    );
    this.southConnectors.set(configuration.id, south);
    if (this.southConnectorMetrics.has(configuration.id)) {
      this.southConnectorMetrics.get(configuration.id)?.destroy();
    }
    this.southConnectorMetrics.set(configuration.id, new SouthConnectorMetricsService(south, this.southConnectorMetricsRepository));
    return south;
  }

  async startSouth(southId: string): Promise<void> {
    const south = this.southConnectors.get(southId);
    if (!south) {
      this._logger.trace(`South connector "${southId}" not set`);
      return;
    }

    south.connectorConfiguration = this.southConnectorRepository.findSouthById(southId)!;
    south.connectedEvent.removeAllListeners();
    south.connectedEvent.on('connected', async () => {
      if (south.queriesLastPoint() || south.queriesFile() || south.queriesHistory()) {
        south.updateCronJobs();
      }
      if (south.queriesSubscription()) {
        await south.updateSubscriptions();
      }
    });
    // Do not await here, so it can start all connectors without blocking the thread
    south.start().catch(error => {
      this._logger.error(
        `Error while starting South connector "${south.connectorConfiguration.name}" of type "${south.connectorConfiguration.type}" (${south.connectorConfiguration.id}): ${error.message}`
      );
    });
  }

  getSouthDataStream(southConnectorId: string): PassThrough | null {
    return this.southConnectorMetrics.get(southConnectorId)?.stream || null;
  }

  getSouthMetrics(): Record<string, SouthConnectorMetrics> {
    const metricsList: Record<string, SouthConnectorMetrics> = {};
    for (const [id, value] of this.southConnectorMetrics.entries()) {
      metricsList[id] = value.metrics;
    }
    return metricsList;
  }

  resetSouthMetrics(southConnectorId: string): PassThrough | null {
    return this.southConnectorMetrics.get(southConnectorId)?.resetMetrics() || null;
  }

  async reloadSouth(southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings>) {
    await this.stopSouth(southConnector.id);
    const south = this.southConnectors.get(southConnector.id);
    if (south) {
      if (south.queriesHistory()) {
        await south.updateSouthCacheOnScanModeAndMaxInstantChanges(
          south.connectorConfiguration,
          southConnector,
          south.getMaxInstantPerItem(south.connectorConfiguration.settings)
        );
      }
      south.setLogger(this.logger.child({ scopeType: 'south', scopeId: southConnector.id, scopeName: southConnector.name }));
      if (southConnector.enabled) {
        await this.startSouth(southConnector.id);
      }
    }
  }

  async reloadSouthItems(southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings>): Promise<void> {
    const south = this.southConnectors.get(southConnector.id);
    if (!south) {
      return;
    }
    south.connectorConfiguration = this.southConnectorRepository.findSouthById(southConnector.id)!;
    if (south.isEnabled()) {
      if (south.queriesHistory()) {
        south.updateSouthCacheOnScanModeAndMaxInstantChanges(
          south.connectorConfiguration,
          southConnector,
          south.getMaxInstantPerItem(south.connectorConfiguration.settings)
        );
      }
      if (south.queriesLastPoint() || south.queriesHistory() || south.queriesFile()) {
        south.updateCronJobs();
      }

      if (south.queriesSubscription()) {
        await south.updateSubscriptions();
      }
    }
  }

  async stopSouth(southId: string): Promise<void> {
    const south = this.southConnectors.get(southId);
    if (south) {
      south.connectorConfiguration = this.southConnectorRepository.findSouthById(southId)!;
      await south.stop();
      south.connectedEvent.removeAllListeners();
    }
  }

  async deleteSouth(south: SouthConnectorEntity<SouthSettings, SouthItemSettings>): Promise<void> {
    await this.stopSouth(south.id);
    await this.deleteCacheFolder('south', south.id, south.name);
    this.updateNorthTransformerBySouth(south.id);
    this.southConnectors.delete(south.id);
    this.southConnectorMetrics.get(south.id)?.destroy();
    this.southConnectorMetrics.delete(south.id);
  }

  async createHistoryQuery(historyId: string): Promise<HistoryQuery> {
    const configuration = this.historyQueryRepository.findHistoryById(historyId)!;
    await createBaseFolders(this.getBaseFolderStructure('history', configuration.id), 'history');
    await createFolder(path.resolve(this.cacheFolders.cache, `history-${configuration.id}`, 'south', 'tmp'));
    if (configuration.northType === 'opcua') {
      await createFolder(path.resolve(this.cacheFolders.cache, `history-${configuration.id}`, 'north', 'opcua'));
    }
    if (configuration.southType === 'opcua') {
      await createFolder(path.resolve(this.cacheFolders.cache, `history-${configuration.id}`, 'south', 'opcua'));
    }

    const logger = this.logger.child({ scopeType: 'history-query', scopeId: configuration.id, scopeName: configuration.name });
    const north = buildNorth(
      {
        id: configuration.id,
        name: configuration.name,
        description: configuration.description,
        enabled: true,
        type: configuration.northType,
        settings: configuration.northSettings,
        caching: configuration.caching,
        transformers: configuration.northTransformers.map(element => ({
          id: element.id,
          transformer: element.transformer,
          options: element.options,
          inputType: element.inputType,
          south: undefined,
          items: element.items
        }))
      },
      logger,
      path.resolve(this.cacheFolders.cache, `history-${configuration.id}`, 'north'),
      path.resolve(this.cacheFolders.error, `history-${configuration.id}`, 'north'),
      path.resolve(this.cacheFolders.archive, `history-${configuration.id}`, 'north'),
      this.certificateRepository,
      this.oIAnalyticsRegistrationRepository
    );
    const south = buildSouth(
      {
        id: configuration.id,
        name: configuration.name,
        description: configuration.description,
        enabled: true,
        type: configuration.southType,
        settings: configuration.southSettings,
        items: []
      },
      async (historyId: string, data: OIBusContent, queryTime: Instant, itemIds: Array<string>) =>
        await north.cacheContent(data, { source: 'south', southId: configuration.id, queryTime, itemIds }),
      logger,
      path.resolve(this.cacheFolders.cache, `history-${configuration.id}`, 'south'),
      this.southCacheRepository,
      this.certificateRepository,
      this.oIAnalyticsRegistrationRepository
    );

    const historyQuery = new HistoryQuery(configuration, north, south, logger);
    this.historyQueries.set(configuration.id, historyQuery);
    if (this.historyQueryMetrics.has(configuration.id)) {
      this.historyQueryMetrics.get(configuration.id)?.destroy();
    }
    const metricsService = new HistoryQueryMetricsService(historyQuery, this.historyQueryMetricsRepository);
    this.historyQueryMetrics.set(configuration.id, metricsService);
    return historyQuery;
  }

  async startHistoryQuery(historyId: string): Promise<void> {
    const historyQuery = this.historyQueries.get(historyId);
    if (!historyQuery) {
      this._logger.trace(`History query "${historyId}" not set`);
      return;
    }

    historyQuery.historyQueryConfiguration = this.historyQueryRepository.findHistoryById(historyId)!;
    historyQuery.finishEvent.removeAllListeners();
    historyQuery.finishEvent.on('finished', async () => {
      this.historyQueryRepository.updateHistoryStatus(historyId, 'FINISHED');
      historyQuery.historyQueryConfiguration = this.historyQueryRepository.findHistoryById(historyId)!;
      this.oianalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    });
    // Do not await here, so it can start all connectors without blocking the thread
    historyQuery.start().catch(error => {
      this._logger.error(
        `Error while starting History query "${historyQuery.historyQueryConfiguration.name}" of South type "${historyQuery.historyQueryConfiguration.southType}" and North type ${historyQuery.historyQueryConfiguration.northType} (${historyQuery.historyQueryConfiguration.id}): ${error.message}`
      );
    });
  }

  getHistoryQueryDataStream(historyQueryId: string): PassThrough | null {
    return this.historyQueryMetrics.get(historyQueryId)?.stream || null;
  }

  async reloadHistoryQuery(historyQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>, resetCache: boolean) {
    await this.stopHistoryQuery(historyQuery.id);
    this.historyQueries
      .get(historyQuery.id)
      ?.setLogger(this.logger.child({ scopeType: 'history-query', scopeId: historyQuery.id, scopeName: historyQuery.name }));
    if (resetCache) {
      await this.resetHistoryQueryCache(historyQuery.id);
    }
    await this.startHistoryQuery(historyQuery.id);
  }
  async stopHistoryQuery(historyId: string): Promise<void> {
    const historyQuery = this.historyQueries.get(historyId);
    if (historyQuery) {
      historyQuery.historyQueryConfiguration = this.historyQueryRepository.findHistoryById(historyId)!;
      await historyQuery.stop();
      historyQuery.finishEvent.removeAllListeners();
    }
  }

  async deleteHistoryQuery(history: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>): Promise<void> {
    await this.stopHistoryQuery(history.id);
    await this.deleteCacheFolder('history', history.id, history.name);
    this.historyQueries.delete(history.id);
    this.historyQueryMetrics.get(history.id)?.destroy();
    this.historyQueryMetrics.delete(history.id);
  }

  async resetHistoryQueryCache(historyId: string) {
    await this.historyQueries.get(historyId)?.resetCache();
    this.historyQueryMetrics.get(historyId)?.resetMetrics();
  }

  get logger() {
    return this._logger;
  }

  setLogger(value: pino.Logger) {
    this._logger = value;

    for (const south of this.southConnectors.values()) {
      south.setLogger(
        this._logger.child({ scopeType: 'south', scopeId: south.connectorConfiguration.id, scopeName: south.connectorConfiguration.name })
      );
    }

    for (const north of this.northConnectors.values()) {
      north.setLogger(
        this._logger.child({ scopeType: 'north', scopeId: north.connectorConfiguration.id, scopeName: north.connectorConfiguration.name })
      );
    }

    for (const historyQuery of this.historyQueries.values()) {
      historyQuery.setLogger(
        this._logger.child({
          scopeType: 'history-query',
          scopeId: historyQuery.historyQueryConfiguration.id,
          scopeName: historyQuery.historyQueryConfiguration.name
        })
      );
    }
  }

  /**
   * Method called by South connectors to add content to the appropriate Norths
   */
  async addContent(southId: string, data: OIBusContent, queryTime: Instant, itemIds: Array<string>) {
    for (const north of this.northConnectors.values()) {
      if (north.isEnabled()) {
        await north.cacheContent(data, { source: 'south', southId, queryTime, itemIds });
      }
    }
  }

  /**
   * Add content to a north connector from the OIBus API endpoints
   */
  async addExternalContent(northId: string, data: OIBusContent): Promise<void> {
    const north = this.northConnectors.get(northId);
    if (north && north.isEnabled()) {
      await north.cacheContent(data, { source: 'api' });
    }
  }

  async searchCacheContent(
    type: 'north' | 'history',
    id: string,
    searchParams: CacheSearchParam,
    folder: 'cache' | 'archive' | 'error'
  ): Promise<Array<{ metadataFilename: string; metadata: CacheMetadata }>> {
    if (type === 'north') {
      return (await this.northConnectors.get(id)?.searchCacheContent(searchParams, folder)) || [];
    }
    return (await this.historyQueries.get(id)?.searchCacheContent(searchParams, folder)) || [];
  }

  async getCacheContentFileStream(
    type: 'north' | 'history',
    id: string,
    folder: 'cache' | 'archive' | 'error',
    filename: string
  ): Promise<ReadStream | null> {
    if (type === 'north') {
      return (await this.northConnectors.get(id)?.getCacheContentFileStream(folder, filename)) || null;
    }
    return (await this.historyQueries.get(id)?.getCacheContentFileStream(folder, filename)) || null;
  }

  async removeCacheContent(
    type: 'north' | 'history',
    id: string,
    folder: 'cache' | 'archive' | 'error',
    metadataFilenameList: Array<string>
  ): Promise<void> {
    if (type === 'north') {
      await this.northConnectors
        .get(id)
        ?.removeCacheContent(folder, await this.northConnectors.get(id)!.metadataFileListToCacheContentList(folder, metadataFilenameList));
      return;
    }
    await this.historyQueries.get(id)?.removeCacheContent(folder, metadataFilenameList);
  }

  async removeAllCacheContent(type: 'north' | 'history', id: string, folder: 'cache' | 'archive' | 'error'): Promise<void> {
    if (type === 'north') {
      await this.northConnectors.get(id)?.removeAllCacheContent(folder);
      return;
    }
    await this.historyQueries.get(id)?.removeAllCacheContent(folder);
  }

  async moveCacheContent(
    type: 'north' | 'history',
    id: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error',
    cacheContentList: Array<string>
  ): Promise<void> {
    if (type === 'north') {
      await this.northConnectors
        .get(id)
        ?.moveCacheContent(
          originFolder,
          destinationFolder,
          await this.northConnectors.get(id)!.metadataFileListToCacheContentList(originFolder, cacheContentList)
        );
      return;
    }
    await this.historyQueries.get(id)?.moveCacheContent(originFolder, destinationFolder, cacheContentList);
  }

  async moveAllCacheContent(
    type: 'north' | 'history',
    id: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error'
  ): Promise<void> {
    if (type === 'north') {
      await this.northConnectors.get(id)?.moveAllCacheContent(originFolder, destinationFolder);
      return;
    }
    await this.historyQueries.get(id)?.moveAllCacheContent(originFolder, destinationFolder);
  }

  async updateScanMode(scanMode: ScanMode): Promise<void> {
    for (const south of this.southConnectors.values()) {
      await south.updateScanModeIfUsed(scanMode);
    }

    for (const north of this.northConnectors.values()) {
      await north.updateScanMode(scanMode);
    }
  }

  /**
   * When a South connector is removed, it has also been removed from the subscription list.
   * The North configuration must thus be reloaded
   */
  updateNorthTransformerBySouth(southId: string) {
    for (const north of this.northConnectors.values()) {
      if (north.connectorConfiguration.transformers.find(element => element.south?.id === southId)) {
        north.connectorConfiguration = this.northConnectorRepository.findNorthById(north.connectorConfiguration.id)!;
      }
    }
  }

  updateNorthConfiguration(northId: string) {
    const north = this.northConnectors.get(northId);
    if (north) {
      north.connectorConfiguration = this.northConnectorRepository.findNorthById(northId)!;
    }
  }

  private async deleteCacheFolder(connectorType: 'south' | 'north' | 'history', connectorId: string, connectorName: string) {
    const folders = structuredClone(this.cacheFolders);

    // Resolve all folder paths and attempt to delete them
    for (const [type, folder] of Object.entries(folders) as Array<[keyof BaseFolders, string]>) {
      folders[type as keyof BaseFolders] = path.resolve(folder, `${connectorType}-${connectorId}`);
      try {
        this.logger.trace(
          `Deleting folder "${folders[type as keyof BaseFolders]}" for connector "${connectorName}" (${connectorType} - ${connectorId})`
        );
        if (await filesExists(folders[type])) {
          await fs.rm(folders[type], { recursive: true });
        }
      } catch (error: unknown) {
        this.logger.error(
          `Unable to delete cache folder "${folders[type as keyof BaseFolders]}" for connector "${connectorName}" (${connectorType} - ${connectorId}): ${(error as Error).message}`
        );
      }
    }
  }

  private getBaseFolderStructure(connectorType: 'south' | 'north' | 'history', connectorId: string) {
    const folders = structuredClone(this.cacheFolders);

    for (const type of Object.keys(this.cacheFolders) as Array<keyof BaseFolders>) {
      folders[type] = path.resolve(folders[type], `${connectorType}-${connectorId}`);
    }

    return folders;
  }
}
