import pino from 'pino';
import NorthConnector from '../north/north-connector';
import SouthConnector from '../south/south-connector';
import path from 'node:path';
import { Instant, NotFoundError } from '../model/types';
import {
  CacheContentUpdateCommand,
  CacheSearchParam,
  CacheSearchResult,
  DataFolderType,
  FileCacheContent,
  HistoryQueryMetrics,
  NorthConnectorMetrics,
  OIBusContent,
  SouthConnectorMetrics
} from '../../shared/model/engine.model';
import { ScanMode } from '../model/scan-mode.model';
import { NorthSettings } from '../../shared/model/north-settings.model';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { SouthConnectorEntity, SouthConnectorEntityLight, SouthConnectorItemEntity } from '../model/south-connector.model';
import { NorthConnectorEntity, NorthConnectorEntityLight } from '../model/north-connector.model';
import SouthConnectorMetricsService from '../service/metrics/south-connector-metrics.service';
import SouthConnectorMetricsRepository from '../repository/metrics/south-connector-metrics.repository';
import NorthConnectorMetricsRepository from '../repository/metrics/north-connector-metrics.repository';
import NorthConnectorMetricsService from '../service/metrics/north-connector-metrics.service';
import { PassThrough } from 'node:stream';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import { buildSouth, deleteSouthCache, initSouthCache } from '../south/south-connector-factory';
import { buildNorth, createNorthOrchestrator, deleteNorthCache, initNorthCache } from '../north/north-connector-factory';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import { HistoryQueryEntity, HistoryQueryEntityLight, HistoryQueryItemEntity } from '../model/histor-query.model';
import HistoryQuery from './history-query';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import HistoryQueryMetricsService from '../service/metrics/history-query-metrics.service';
import HistoryQueryMetricsRepository from '../repository/metrics/history-query-metrics.repository';
import OIAnalyticsMessageService from '../service/oia/oianalytics-message.service';
import { buildHistoryQuery, createHistoryQueryOrchestrator, deleteHistoryQueryCache, initHistoryQueryCache } from './history-query-factory';
import { clearProxyAgentCache } from '../service/http-request.utils';

export default class DataStreamEngine {
  private northConnectors = new Map<string, { north: NorthConnector<NorthSettings>; metrics: NorthConnectorMetricsService }>();
  private southConnectors = new Map<
    string,
    { south: SouthConnector<SouthSettings, SouthItemSettings>; metrics: SouthConnectorMetricsService }
  >();
  private historyQueries = new Map<string, { historyQuery: HistoryQuery; metrics: HistoryQueryMetricsService }>();

  readonly baseFolder: string;

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
    this.baseFolder = path.resolve('./');
  }

  async start(
    northConnectorList: Array<NorthConnectorEntityLight>,
    southConnectorList: Array<SouthConnectorEntityLight>,
    historyQueryList: Array<HistoryQueryEntityLight>
  ): Promise<void> {
    for (const northLight of northConnectorList) {
      try {
        const north = await this.createNorth(northLight.id);
        await this.startNorth(north.connectorConfiguration.id);
      } catch (error: unknown) {
        this._logger.error(
          `Error while creating North connector "${northLight.name}" of type "${northLight.type}" (${northLight.id}): ${(error as Error).message}`
        );
      }
    }

    for (const southLight of southConnectorList) {
      try {
        const south = await this.createSouth(southLight.id);
        await this.startSouth(south.connectorConfiguration.id);
      } catch (error: unknown) {
        this._logger.error(
          `Error while creating South connector "${southLight.name}" of type "${southLight.type}" (${southLight.id}): ${(error as Error).message}`
        );
      }
    }

    for (const historyLight of historyQueryList) {
      try {
        const historyQuery = await this.createHistoryQuery(historyLight.id);
        await this.startHistoryQuery(historyQuery.historyQueryConfiguration.id);
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
      try {
        await this.stopSouth(id);
      } catch (error: unknown) {
        this._logger.error(`Error while stopping South "${id}": ${(error as Error).message}`);
      }
    }

    for (const id of this.northConnectors.keys()) {
      try {
        await this.stopNorth(id);
      } catch (error: unknown) {
        this._logger.error(`Error while stopping North "${id}": ${(error as Error).message}`);
      }
    }

    for (const id of this.historyQueries.keys()) {
      try {
        await this.stopHistoryQuery(id);
      } catch (error: unknown) {
        this._logger.error(`Error while stopping History query "${id}": ${(error as Error).message}`);
      }
    }
    clearProxyAgentCache();
  }

  async createNorth(northId: string): Promise<NorthConnector<NorthSettings>> {
    const configuration = this.northConnectorRepository.findNorthById(northId)!;
    const logger = this.logger.child({ scopeType: 'north', scopeId: configuration.id, scopeName: configuration.name });
    const north = buildNorth(
      configuration,
      logger,
      this.certificateRepository,
      this.oIAnalyticsRegistrationRepository,
      createNorthOrchestrator(this.baseFolder, northId, logger)
    );
    await initNorthCache(configuration.id, configuration.type, this.baseFolder);
    if (this.northConnectors.has(configuration.id)) {
      this.northConnectors.get(configuration.id)!.metrics.destroy();
    }
    this.northConnectors.set(configuration.id, {
      north,
      metrics: new NorthConnectorMetricsService(north, this.northConnectorMetricsRepository)
    });
    return north;
  }

  async startNorth(northId: string): Promise<void> {
    const north = this.getNorth(northId).north;
    north.connectorConfiguration = this.northConnectorRepository.findNorthById(northId)!;
    north // Do not await here, so it can start all connectors without blocking the thread
      .start()
      .catch(error => {
        this._logger.error(
          `Error while starting North connector "${north.connectorConfiguration.name}" of type "${north.connectorConfiguration.type}" (${north.connectorConfiguration.id}): ${error.message}`
        );
      });
  }

  getNorth(northId: string): { north: NorthConnector<NorthSettings>; metrics: NorthConnectorMetricsService } {
    const north = this.northConnectors.get(northId);
    if (!north) {
      throw new NotFoundError(`Could not find North "${northId}" in engine`);
    }
    return north;
  }

  getNorthSSE(northId: string): PassThrough {
    return this.getNorth(northId).metrics.stream;
  }

  getNorthMetrics(northId: string): NorthConnectorMetrics {
    return this.getNorth(northId).metrics.metrics;
  }

  getAllNorthMetrics(): Record<string, NorthConnectorMetrics> {
    const metricsList: Record<string, NorthConnectorMetrics> = {};
    for (const [id, value] of this.northConnectors.entries()) {
      metricsList[id] = value.metrics.metrics;
    }
    return metricsList;
  }

  resetNorthMetrics(northId: string): void {
    return this.getNorth(northId).metrics.resetMetrics();
  }

  async reloadNorth(northEntity: NorthConnectorEntity<NorthSettings>) {
    await this.stopNorth(northEntity.id);
    const north = this.getNorth(northEntity.id).north;
    north.setLogger(this.logger.child({ scopeType: 'north', scopeId: northEntity.id, scopeName: northEntity.name }));
    await this.startNorth(northEntity.id);
  }

  async stopNorth(northId: string): Promise<void> {
    const north = this.getNorth(northId).north;
    north.connectorConfiguration = this.northConnectorRepository.findNorthById(northId)!;
    await north.stop();
  }

  async deleteNorth(northEntity: NorthConnectorEntity<NorthSettings>): Promise<void> {
    const northConnector = this.getNorth(northEntity.id);
    await this.stopNorth(northEntity.id);
    await deleteNorthCache(northEntity.id, this.baseFolder);
    northConnector.metrics.destroy();
    this.northConnectors.delete(northEntity.id);
  }

  async createSouth(southId: string): Promise<SouthConnector<SouthSettings, SouthItemSettings>> {
    const configuration = this.southConnectorRepository.findSouthById(southId)!;
    const south = buildSouth(
      configuration,
      this.addContent.bind(this),
      this.logger.child({ scopeType: 'south', scopeId: configuration.id, scopeName: configuration.name }),
      path.join(this.baseFolder, 'cache', `south-${configuration.id}`),
      this.southCacheRepository,
      this.certificateRepository,
      this.oIAnalyticsRegistrationRepository
    );
    await initSouthCache(configuration.id, configuration.type, this.baseFolder);
    if (this.southConnectors.has(configuration.id)) {
      this.southConnectors.get(configuration.id)!.metrics.destroy();
    }
    this.southConnectors.set(configuration.id, {
      south,
      metrics: new SouthConnectorMetricsService(south, this.southConnectorMetricsRepository)
    });
    return south;
  }

  async startSouth(southId: string): Promise<void> {
    const south = this.getSouth(southId).south;
    south.connectorConfiguration = this.southConnectorRepository.findSouthById(southId)!;
    south.connectedEvent.removeAllListeners();
    south.connectedEvent.on('connected', async () => {
      if (south.hasDirectQuery() || south.hasHistoryQuery()) {
        south.updateCronJobs();
      }
      if (south.hasSubscription()) {
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

  getSouth(southId: string): { south: SouthConnector<SouthSettings, SouthItemSettings>; metrics: SouthConnectorMetricsService } {
    const south = this.southConnectors.get(southId);
    if (!south) {
      throw new Error(`Could not find South "${southId}" in engine`);
    }
    return south;
  }

  getSouthSSE(southId: string): PassThrough {
    return this.getSouth(southId).metrics.stream;
  }

  getAllSouthMetrics(): Record<string, SouthConnectorMetrics> {
    const metricsList: Record<string, SouthConnectorMetrics> = {};
    for (const [id, value] of this.southConnectors.entries()) {
      metricsList[id] = value.metrics.metrics;
    }
    return metricsList;
  }

  resetSouthMetrics(southId: string): void {
    return this.getSouth(southId).metrics.resetMetrics();
  }

  async reloadSouth(southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings>) {
    await this.stopSouth(southConnector.id);
    const south = this.getSouth(southConnector.id).south;
    south.setLogger(this.logger.child({ scopeType: 'south', scopeId: southConnector.id, scopeName: southConnector.name }));
    await this.startSouth(southConnector.id);
  }

  async reloadSouthItems(southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings>): Promise<void> {
    const south = this.getSouth(southConnector.id).south;
    south.connectorConfiguration = this.southConnectorRepository.findSouthById(southConnector.id)!;
    if (south.isEnabled()) {
      if (south.hasDirectQuery() || south.hasHistoryQuery()) {
        south.updateCronJobs();
      }
      if (south.hasSubscription()) {
        await south.updateSubscriptions();
      }
    }
  }

  async stopSouth(southId: string): Promise<void> {
    const south = this.getSouth(southId).south;
    south.connectorConfiguration = this.southConnectorRepository.findSouthById(southId)!;
    await south.stop();
    south.connectedEvent.removeAllListeners();
  }

  async deleteSouth(southEntity: SouthConnectorEntity<SouthSettings, SouthItemSettings>): Promise<void> {
    const southConnector = this.getSouth(southEntity.id);
    await this.stopSouth(southEntity.id);
    this.updateNorthTransformerBySouth(southEntity.id);
    await deleteSouthCache(southEntity.id, this.baseFolder);
    southConnector.metrics.destroy();
    this.southConnectors.delete(southEntity.id);
  }

  async createHistoryQuery(historyId: string): Promise<HistoryQuery> {
    const configuration = this.historyQueryRepository.findHistoryById(historyId)!;
    const logger = this.logger.child({ scopeType: 'history-query', scopeId: configuration.id, scopeName: configuration.name });
    const historyQuery = buildHistoryQuery(
      configuration,
      this.addContent.bind(this),
      logger,
      this.baseFolder,
      this.southCacheRepository,
      this.certificateRepository,
      this.oIAnalyticsRegistrationRepository,
      createHistoryQueryOrchestrator(this.baseFolder, configuration.id, logger)
    );
    await initHistoryQueryCache(configuration.id, configuration.northType, configuration.southType, this.baseFolder);

    if (this.historyQueries.has(configuration.id)) {
      this.historyQueries.get(configuration.id)!.metrics.destroy();
    }
    this.historyQueries.set(configuration.id, {
      historyQuery,
      metrics: new HistoryQueryMetricsService(historyQuery, this.historyQueryMetricsRepository)
    });
    return historyQuery;
  }

  getHistoryQuery(historyId: string): { historyQuery: HistoryQuery; metrics: HistoryQueryMetricsService } {
    const historyQuery = this.historyQueries.get(historyId);
    if (!historyQuery) {
      throw new Error(`Could not find History "${historyId}" in engine`);
    }
    return historyQuery;
  }

  async startHistoryQuery(historyId: string): Promise<void> {
    const historyQuery = this.getHistoryQuery(historyId).historyQuery;
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

  getHistoryQuerySSE(historyId: string): PassThrough {
    return this.getHistoryQuery(historyId).metrics.stream;
  }

  getHistoryMetrics(historyId: string): HistoryQueryMetrics {
    return this.getHistoryQuery(historyId).metrics.metrics;
  }

  async reloadHistoryQuery(historyQueryConfig: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>, resetCache: boolean) {
    const historyQuery = this.getHistoryQuery(historyQueryConfig.id).historyQuery;
    await this.stopHistoryQuery(historyQueryConfig.id);
    historyQuery.setLogger(
      this.logger.child({ scopeType: 'history-query', scopeId: historyQueryConfig.id, scopeName: historyQueryConfig.name })
    );
    if (resetCache) {
      await this.resetHistoryQueryCache(historyQueryConfig.id);
    }
    await this.startHistoryQuery(historyQueryConfig.id);
  }

  async stopHistoryQuery(historyId: string): Promise<void> {
    const historyQuery = this.getHistoryQuery(historyId).historyQuery;
    historyQuery.historyQueryConfiguration = this.historyQueryRepository.findHistoryById(historyId)!;
    await historyQuery.stop();
    historyQuery.finishEvent.removeAllListeners();
  }

  async deleteHistoryQuery(historyEntity: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>): Promise<void> {
    const historyQuery = this.getHistoryQuery(historyEntity.id);
    await this.stopHistoryQuery(historyEntity.id);
    await deleteHistoryQueryCache(historyEntity.id, this.baseFolder);
    historyQuery.metrics.destroy();
    this.historyQueries.delete(historyEntity.id);
  }

  async resetHistoryQueryCache(historyId: string) {
    const history = this.getHistoryQuery(historyId);
    await history.historyQuery.resetCache();
    history.metrics.resetMetrics();
  }

  get logger() {
    return this._logger;
  }

  setLogger(value: pino.Logger) {
    this._logger = value;

    for (const south of this.southConnectors.values()) {
      south.south.setLogger(
        this._logger.child({
          scopeType: 'south',
          scopeId: south.south.connectorConfiguration.id,
          scopeName: south.south.connectorConfiguration.name
        })
      );
    }

    for (const north of this.northConnectors.values()) {
      north.north.setLogger(
        this._logger.child({
          scopeType: 'north',
          scopeId: north.north.connectorConfiguration.id,
          scopeName: north.north.connectorConfiguration.name
        })
      );
    }

    for (const historyQuery of this.historyQueries.values()) {
      historyQuery.historyQuery.setLogger(
        this._logger.child({
          scopeType: 'history-query',
          scopeId: historyQuery.historyQuery.historyQueryConfiguration.id,
          scopeName: historyQuery.historyQuery.historyQueryConfiguration.name
        })
      );
    }
  }

  /**
   * Method called by South connectors to add content to the appropriate Norths
   */
  async addContent(
    southId: string,
    data: OIBusContent,
    queryTime: Instant,
    items: Array<SouthConnectorItemEntity<SouthItemSettings>> | Array<HistoryQueryItemEntity<SouthItemSettings>>
  ) {
    for (const north of this.northConnectors.values()) {
      if (north.north.isEnabled()) {
        await north.north.cacheContent(data, { source: 'south', southId, queryTime, items });
      }
    }
  }

  /**
   * Add content to a north connector from the OIBus API endpoints
   */
  async addExternalContent(northId: string, dataSourceId: string, data: OIBusContent): Promise<void> {
    const north = this.northConnectors.get(northId);
    if (north && north.north.isEnabled()) {
      await north.north.cacheContent(data, { source: 'oibus-api', dataSourceId });
    }
  }

  async searchCacheContent(type: 'north' | 'history', id: string, searchParams: CacheSearchParam): Promise<CacheSearchResult> {
    if (type === 'north') {
      const result = await this.getNorth(id).north.searchCacheContent(searchParams);
      return {
        metrics: this.getNorthMetrics(id)!,
        ...result
      };
    }
    const result = await this.getHistoryQuery(id).historyQuery.searchCacheContent(searchParams);
    return {
      metrics: this.getHistoryMetrics(id)!.north,
      ...result
    };
  }

  async getFileFromCache(type: 'north' | 'history', id: string, folder: DataFolderType, filename: string): Promise<FileCacheContent> {
    if (type === 'north') {
      return await this.getNorth(id).north.getFileFromCache(folder, filename);
    }
    return await this.getHistoryQuery(id).historyQuery.getFileFromCache(folder, filename);
  }

  async updateCacheContent(type: 'north' | 'history', id: string, updateCommand: CacheContentUpdateCommand): Promise<void> {
    if (type === 'north') {
      return await this.getNorth(id).north.updateCacheContent(updateCommand);
    }
    await this.getHistoryQuery(id).historyQuery.updateCacheContent(updateCommand);
  }

  async updateScanMode(scanMode: ScanMode): Promise<void> {
    for (const south of this.southConnectors.values()) {
      south.south.updateScanModeIfUsed(scanMode);
    }

    for (const north of this.northConnectors.values()) {
      await north.north.updateScanMode(scanMode);
    }
  }

  /**
   * When a South connector is removed, it has also been removed from the subscription list.
   * The North configuration must thus be reloaded
   */
  updateNorthTransformerBySouth(southId: string) {
    for (const north of this.northConnectors.values()) {
      if (
        north.north.connectorConfiguration.transformers.find(
          element => element.source.type === 'south' && element.source.south.id === southId
        )
      ) {
        north.north.connectorConfiguration = this.northConnectorRepository.findNorthById(north.north.connectorConfiguration.id)!;
      }
    }
  }

  updateNorthConfiguration(northId: string) {
    const north = this.getNorth(northId);
    north.north.connectorConfiguration = this.northConnectorRepository.findNorthById(northId)!;
  }

  async reloadTransformer(transformerId: string): Promise<void> {
    for (const north of this.northConnectors.values()) {
      if (north.north.connectorConfiguration.transformers.some(t => t.transformer.id === transformerId)) {
        this.logger.debug(
          `Custom transformer "${transformerId}" code changed; reloading north connector "${north.north.connectorConfiguration.name}"`
        );
        north.north.connectorConfiguration = this.northConnectorRepository.findNorthById(north.north.connectorConfiguration.id)!;
      }
    }
    for (const { historyQuery } of this.historyQueries.values()) {
      if (historyQuery.historyQueryConfiguration.northTransformers.some(t => t.transformer.id === transformerId)) {
        this.logger.debug(
          `Custom transformer "${transformerId}" code changed; reloading history query "${historyQuery.historyQueryConfiguration.name}"`
        );
        await this.reloadHistoryQuery(historyQuery.historyQueryConfiguration, false);
      }
    }
  }

  async removeAndReloadTransformer(transformerId: string): Promise<void> {
    const affectedNorthIds: Array<string> = [];
    for (const north of this.northConnectors.values()) {
      if (north.north.connectorConfiguration.transformers.some(t => t.transformer.id === transformerId)) {
        affectedNorthIds.push(north.north.connectorConfiguration.id);
      }
    }
    const affectedHistoryConfigs: Array<HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>> = [];
    for (const { historyQuery } of this.historyQueries.values()) {
      if (historyQuery.historyQueryConfiguration.northTransformers.some(t => t.transformer.id === transformerId)) {
        affectedHistoryConfigs.push(historyQuery.historyQueryConfiguration);
      }
    }

    if (affectedNorthIds.length > 0 || affectedHistoryConfigs.length > 0) {
      this.logger.debug(
        `Custom transformer "${transformerId}" manifest changed; removing transformer from ` +
          `${affectedNorthIds.length} north connector(s) and ${affectedHistoryConfigs.length} history query(ies)`
      );
    }

    this.northConnectorRepository.removeTransformersByTransformerId(transformerId);
    this.historyQueryRepository.removeTransformersByTransformerId(transformerId);

    for (const northId of affectedNorthIds) {
      this.updateNorthConfiguration(northId);
    }
    for (const config of affectedHistoryConfigs) {
      await this.reloadHistoryQuery(config, false);
    }
  }
}
