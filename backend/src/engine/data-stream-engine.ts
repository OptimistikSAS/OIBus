import NorthConnector from '../north/north-connector';
import SouthConnector from '../south/south-connector';
import { CronJob } from 'cron';
import { DateTime } from 'luxon';
import { validateCronExpression } from '../service/utils';
import {
  MAX_INTERVAL_MS,
  MIN_INTERVAL_MS,
  intervalToMs,
  isActivationWindowExpired,
  isWithinActivationWindow
} from '../service/scan-mode.utils';
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
import ScanModeRepository from '../repository/config/scan-mode.repository';
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
import type { IOIAnalyticsMessageService } from '../model/oianalytics-message.model';
import { buildHistoryQuery, createHistoryQueryOrchestrator, deleteHistoryQueryCache, initHistoryQueryCache } from './history-query-factory';
import { clearProxyAgentCache } from '../service/http-request.utils';
import { clearOIAnalyticsCredentialCache } from '../service/utils-oianalytics';
import { loggerService } from '../service/logger/logger.service';

export default class DataStreamEngine {
  private northConnectors = new Map<string, { north: NorthConnector<NorthSettings>; metrics: NorthConnectorMetricsService }>();
  private southConnectors = new Map<
    string,
    { south: SouthConnector<SouthSettings, SouthItemSettings>; metrics: SouthConnectorMetricsService }
  >();
  private historyQueries = new Map<string, { historyQuery: HistoryQuery; metrics: HistoryQueryMetricsService }>();
  // One shared cron per scan mode, regardless of whether any connector currently uses it — see
  // start()/onScanModeTriggered() for why this replaced per-connector cron ownership.
  private cronByScanModeId = new Map<string, CronJob>();
  // Sibling of cronByScanModeId for `type: 'interval'` scan modes. A scan mode lives in exactly one
  // of the two maps, keyed by id, so it can switch mechanism without leaking a timer.
  private intervalByScanModeId = new Map<string, NodeJS.Timeout>();

  private readonly _logger = loggerService.createChildLogger('internal', 'engine');
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
    private oianalyticsMessageService: IOIAnalyticsMessageService,
    private scanModeRepository: ScanModeRepository
  ) {
    this.baseFolder = path.resolve('./');
  }

  async start(
    northConnectorList: Array<NorthConnectorEntityLight>,
    southConnectorList: Array<SouthConnectorEntityLight>,
    historyQueryList: Array<HistoryQueryEntityLight>
  ): Promise<void> {
    /**
     * Create one shared cron per scan mode present in the `scan_modes` table, regardless of whether
     * any south/north connector currently uses it — connectors decide for themselves, on each tick,
     * whether they have anything to do (see `SouthConnector.trigger` / `NorthConnector.trigger`).
     * The `'subscription'` sentinel is excluded: it's a real seeded row with an empty cron string
     * (subscription items are push-driven, never polled), which would otherwise fail cron validation
     * on every startup.
     */
    for (const scanMode of this.scanModeRepository.findAll()) {
      this.scheduleScanMode(scanMode);
    }

    for (const northLight of northConnectorList) {
      try {
        const north = await this.createNorth(northLight.id);
        this.startNorth(north.connectorConfiguration.id);
      } catch (error: unknown) {
        this._logger.error(
          `Error while creating North connector "${northLight.name}" of type "${northLight.type}" (${northLight.id}): ${(error as Error).message}`
        );
      }
    }

    for (const southLight of southConnectorList) {
      try {
        const south = await this.createSouth(southLight.id);
        this.startSouth(south.connectorConfiguration.id);
      } catch (error: unknown) {
        this._logger.error(
          `Error while creating South connector "${southLight.name}" of type "${southLight.type}" (${southLight.id}): ${(error as Error).message}`
        );
      }
    }

    for (const historyLight of historyQueryList) {
      try {
        const historyQuery = await this.createHistoryQuery(historyLight.id);
        this.startHistoryQuery(historyQuery.historyQueryConfiguration.id);
      } catch (error: unknown) {
        this._logger.error(
          `Error while creating History query "${historyLight.name}" of South type "${historyLight.southType}" and North type "${historyLight.northType}" (${historyLight.id}): ${(error as Error).message}`
        );
      }
    }
    this._logger.info('OIBus engine started');
  }

  /**
   * Stop every South, North, and History query. The three groups run concurrently (nothing ties
   * their shutdown order together), and within each group every connector stops concurrently too —
   * same fan-out pattern as `addContent()`. Each individual stop is caught so one connector failing
   * to stop cleanly never blocks or fails the others.
   */
  async stop(): Promise<void> {
    for (const job of this.cronByScanModeId.values()) {
      job.stop();
    }
    this.cronByScanModeId.clear();
    for (const timer of this.intervalByScanModeId.values()) {
      clearInterval(timer);
    }
    this.intervalByScanModeId.clear();

    const stopAllSouths = Promise.all(
      Array.from(this.southConnectors.keys()).map(id =>
        this.stopSouth(id).catch((error: unknown) => {
          this._logger.error(`Error while stopping South "${id}": ${(error as Error).message}`);
        })
      )
    );

    const stopAllNorths = Promise.all(
      Array.from(this.northConnectors.keys()).map(id =>
        this.stopNorth(id).catch((error: unknown) => {
          this._logger.error(`Error while stopping North "${id}": ${(error as Error).message}`);
        })
      )
    );

    const stopAllHistoryQueries = Promise.all(
      Array.from(this.historyQueries.keys()).map(id =>
        this.stopHistoryQuery(id).catch((error: unknown) => {
          this._logger.error(`Error while stopping History query "${id}": ${(error as Error).message}`);
        })
      )
    );

    await Promise.all([stopAllSouths, stopAllNorths, stopAllHistoryQueries]);

    clearProxyAgentCache();
    clearOIAnalyticsCredentialCache();
  }

  /**
   * Replace (or create) the shared scheduler entry for one scan mode. Invalid schedules are logged
   * and skipped rather than thrown, so one bad scan mode cannot stop the engine from starting.
   *
   * The `'subscription'` sentinel is excluded here rather than at each call site: it is a real
   * seeded row with an empty cron (subscription items are push-driven, never polled).
   */
  private scheduleScanMode(scanMode: ScanMode): void {
    this.unscheduleScanMode(scanMode.id);
    if (scanMode.id === 'subscription') {
      return;
    }

    if (isActivationWindowExpired(scanMode.activationWindow, DateTime.utc())) {
      // Non-blocking: the schedule is still installed, but no tick will ever pass the gate.
      this._logger.warn(
        `Scan mode "${scanMode.name}" (${scanMode.id}) has an activation window that can never be active again; it will never trigger`
      );
    }

    try {
      if (scanMode.type === 'interval') {
        const periodMs = scanMode.interval ? intervalToMs(scanMode.interval) : 0;
        // Re-checked here and not only in the request validator: the engine reads scan modes
        // straight from the database at startup, where rows may predate the current schema.
        if (periodMs < MIN_INTERVAL_MS || periodMs > MAX_INTERVAL_MS) {
          throw new Error(`Interval must be between ${MIN_INTERVAL_MS} ms and ${MAX_INTERVAL_MS} ms, got ${periodMs} ms`);
        }
        // The global setInterval on purpose, so node:test's mock.timers can intercept it. Not
        // unref'd: like the CronJob below, a scheduled scan mode keeps the process alive, and
        // stop() clears every timer for a clean shutdown. Unlike cron this drifts under event-loop
        // pressure, which is acceptable for a polling trigger.
        this.intervalByScanModeId.set(
          scanMode.id,
          setInterval(() => this.onScanModeTriggered(scanMode), periodMs)
        );
      } else {
        validateCronExpression(scanMode.cron);
        const newCron = new CronJob(scanMode.cron, () => this.onScanModeTriggered(scanMode), null, true);
        this.cronByScanModeId.set(scanMode.id, newCron);
      }
    } catch (error: unknown) {
      this._logger.error(`Error when scheduling scan mode "${scanMode.name}" (${scanMode.id}): ${(error as Error).message}`);
    }
  }

  /** Stop and forget whichever scheduler entry — cron or interval — a scan mode currently owns. */
  private unscheduleScanMode(scanModeId: string): void {
    const existingCron = this.cronByScanModeId.get(scanModeId);
    if (existingCron) {
      existingCron.stop();
      this.cronByScanModeId.delete(scanModeId);
    }
    const existingInterval = this.intervalByScanModeId.get(scanModeId);
    if (existingInterval) {
      clearInterval(existingInterval);
      this.intervalByScanModeId.delete(scanModeId);
    }
  }

  /**
   * Fan out one scan-mode tick to every south, north and history query; each decides for itself
   * whether it applies.
   *
   * A scan mode with an activation window only fans out while the window is open. The scheduler
   * keeps ticking and the tick is simply dropped, so nothing has to be rescheduled when the window
   * opens or closes, and no run is recorded for a skipped tick.
   */
  private onScanModeTriggered(scanMode: ScanMode): void {
    if (!isWithinActivationWindow(scanMode, DateTime.utc())) {
      this._logger.trace(`Scan mode "${scanMode.name}" tick skipped: outside its activation window`);
      return;
    }
    for (const { south } of this.southConnectors.values()) {
      south.trigger(scanMode);
    }
    for (const { north } of this.northConnectors.values()) {
      north.trigger(scanMode);
    }
    // History query norths were previously never ticked: their caching trigger scan mode was
    // configurable but nothing ever fired it, so cache flushes only happened on threshold or retry.
    for (const { historyQuery } of this.historyQueries.values()) {
      historyQuery.triggerNorth(scanMode);
    }
  }

  async createNorth(northId: string): Promise<NorthConnector<NorthSettings>> {
    const configuration = this.northConnectorRepository.findNorthById(northId)!;
    const north = buildNorth(
      configuration,
      this.certificateRepository,
      this.oIAnalyticsRegistrationRepository,
      createNorthOrchestrator(this.baseFolder, northId, configuration.name)
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

  startNorth(northId: string): void {
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
    north.refreshLogger();
    this.startNorth(northEntity.id);
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

  startSouth(southId: string): void {
    const south = this.getSouth(southId).south;
    south.connectorConfiguration = this.southConnectorRepository.findSouthById(southId)!;
    south.connectedEvent.removeAllListeners();
    south.connectedEvent.on('connected', async () => {
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

  hasSouth(southId: string): boolean {
    return this.southConnectors.has(southId);
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
    south.refreshLogger();
    this.startSouth(southConnector.id);
  }

  async reloadSouthItems(southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings>): Promise<void> {
    const south = this.getSouth(southConnector.id).south;
    // Only reload the items list — the connector's other settings (type, name, etc.) haven't
    // changed. Reassigned through the setter (rather than mutating .items in place) so South's
    // scan-mode-grouped-items cache is rebuilt from the new list.
    south.connectorConfiguration = {
      ...south.connectorConfiguration,
      items: this.southConnectorRepository.findAllItemsForSouth(southConnector.id)
    };
    if (south.isEnabled() && south.hasSubscription()) {
      await south.updateSubscriptions();
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
    const historyQuery = buildHistoryQuery(
      configuration,
      this.addContent.bind(this),
      this.baseFolder,
      this.southCacheRepository,
      this.certificateRepository,
      this.oIAnalyticsRegistrationRepository,
      createHistoryQueryOrchestrator(this.baseFolder, configuration.id, configuration.name)
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

  startHistoryQuery(historyId: string): void {
    const historyQuery = this.getHistoryQuery(historyId).historyQuery;
    historyQuery.historyQueryConfiguration = this.historyQueryRepository.findHistoryById(historyId)!;
    historyQuery.finishEvent.removeAllListeners();
    historyQuery.finishEvent.on('finished', () => {
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
    historyQuery.refreshLogger();
    if (resetCache) {
      await this.resetHistoryQueryCache(historyQueryConfig.id);
    }
    this.startHistoryQuery(historyQueryConfig.id);
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

  /**
   * Method called by South connectors to add content to the appropriate Norths.
   *
   * Fan-out is parallel: each enabled North caches concurrently, so total latency
   * is `max(perNorthTime)` instead of `sum`. A failure in one North no longer
   * blocks the others — errors are logged per-North via the per-promise catch.
   */
  async addContent(
    southId: string,
    data: OIBusContent,
    queryTime: Instant,
    items: Array<SouthConnectorItemEntity<SouthItemSettings>> | Array<HistoryQueryItemEntity<SouthItemSettings>>,
    queryStartTime?: Instant | null,
    queryEndTime?: Instant | null
  ) {
    const pending: Array<Promise<void>> = [];
    for (const north of this.northConnectors.values()) {
      if (!north.north.isEnabled()) continue;
      pending.push(
        north.north
          .cacheContent(data, {
            source: 'south',
            southId,
            queryTime,
            queryStartTime: queryStartTime ?? null,
            queryEndTime: queryEndTime ?? null,
            items
          })
          .catch((error: unknown) => {
            this._logger.error(
              `Error while caching content to North "${north.north.connectorConfiguration.name}" ` +
                `(${north.north.connectorConfiguration.id}): ${(error as Error).message}`
            );
          })
      );
    }
    await Promise.all(pending);
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

  /** Called by ScanModeService.create() — install the new scan mode's shared schedule. */
  createScanMode(scanMode: ScanMode): void {
    this.scheduleScanMode(scanMode);
  }

  /** Called by ScanModeService.update() when the schedule changed — replace the one affected entry. */
  updateScanMode(scanMode: ScanMode): void {
    this.scheduleScanMode(scanMode);
  }

  /** Called by ScanModeService.delete() — stop and remove the scan mode's shared schedule. */
  deleteScanMode(scanModeId: string): void {
    this.unscheduleScanMode(scanModeId);
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
