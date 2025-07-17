import pino from 'pino';
import NorthConnector from '../north/north-connector';
import SouthConnector from '../south/south-connector';
import path from 'node:path';
import { BaseFolders } from '../model/types';
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
import { SouthConnectorEntity } from '../model/south-connector.model';
import { NorthConnectorEntity } from '../model/north-connector.model';
import SouthConnectorMetricsService from '../service/metrics/south-connector-metrics.service';
import SouthConnectorMetricsRepository from '../repository/metrics/south-connector-metrics.repository';
import NorthConnectorMetricsRepository from '../repository/metrics/north-connector-metrics.repository';
import NorthConnectorMetricsService from '../service/metrics/north-connector-metrics.service';
import { PassThrough } from 'node:stream';
import { ReadStream } from 'node:fs';
import { connectionService } from '../service/connection.service';

const CACHE_FOLDER = './cache';
const ARCHIVE_FOLDER = './archive';
const ERROR_FOLDER = './error';

export default class DataStreamEngine {
  private northConnectors = new Map<string, NorthConnector<NorthSettings>>();
  private northConnectorMetrics: Map<string, NorthConnectorMetricsService> = new Map<string, NorthConnectorMetricsService>();
  private southConnectors = new Map<string, SouthConnector<SouthSettings, SouthItemSettings>>();
  private southConnectorMetrics: Map<string, SouthConnectorMetricsService> = new Map<string, SouthConnectorMetricsService>();

  private readonly cacheFolders: BaseFolders;

  constructor(
    private northConnectorMetricsRepository: NorthConnectorMetricsRepository,
    private southConnectorMetricsRepository: SouthConnectorMetricsRepository,
    private _logger: pino.Logger
  ) {
    this.cacheFolders = {
      cache: path.resolve(CACHE_FOLDER),
      archive: path.resolve(ARCHIVE_FOLDER),
      error: path.resolve(ERROR_FOLDER)
    };
    connectionService.init(this);
  }

  get logger() {
    return this._logger;
  }

  get baseFolders() {
    return this.cacheFolders;
  }

  getSouthDataStream(southConnectorId: string): PassThrough | null {
    return this.southConnectorMetrics.get(southConnectorId)?.stream || null;
  }

  resetSouthConnectorMetrics(southConnectorId: string): PassThrough | null {
    return this.southConnectorMetrics.get(southConnectorId)?.resetMetrics() || null;
  }

  getSouthConnectorMetrics(): Record<string, SouthConnectorMetrics> {
    const metricsList: Record<string, SouthConnectorMetrics> = {};
    for (const [id, value] of this.southConnectorMetrics.entries()) {
      metricsList[id] = value.metrics;
    }
    return metricsList;
  }

  getNorthDataStream(northConnectorId: string): PassThrough | null {
    return this.northConnectorMetrics.get(northConnectorId)?.stream || null;
  }

  resetNorthConnectorMetrics(northConnectorId: string): PassThrough | null {
    return this.northConnectorMetrics.get(northConnectorId)?.resetMetrics() || null;
  }

  getNorthConnectorMetrics(): Record<string, NorthConnectorMetrics> {
    const metricsList: Record<string, NorthConnectorMetrics> = {};
    for (const [id, value] of this.northConnectorMetrics.entries()) {
      metricsList[id] = value.metrics;
    }
    return metricsList;
  }

  /**
   * Method called by South connectors to add content to the appropriate Norths
   */
  async addContent(southId: string, data: OIBusContent) {
    for (const north of this.northConnectors.values()) {
      if (north.isEnabled() && north.isSubscribed(southId)) {
        await north.cacheContent(data, southId);
      }
    }
  }

  /**
   * Add content to a north connector from the OIBus API endpoints
   */
  async addExternalContent(northId: string, data: OIBusContent, source: string): Promise<void> {
    const north = this.northConnectors.get(northId);
    if (north && north.isEnabled()) {
      await north.cacheContent(data, source);
    }
  }

  /**
   * Creates a new instance for every North and South connectors and initialize them.
   * Creates CronJobs based on the ScanModes and starts them.
   */
  async start(
    northConnectorList: Array<NorthConnector<NorthSettings>>,
    southConnectorList: Array<SouthConnector<SouthSettings, SouthItemSettings>>
  ): Promise<void> {
    for (const north of northConnectorList) {
      try {
        await this.createNorth(north);
        if (north.settings.enabled) {
          await this.startNorth(north.settings.id);
        }
      } catch (error) {
        this._logger.error(
          `Error while creating North connector "${north.settings.name}" of type "${north.settings.type}" (${north.settings.id}): ${error}`
        );
      }
    }

    for (const south of southConnectorList) {
      try {
        await this.createSouth(south);
        if (south.settings.enabled) {
          await this.startSouth(south.settings.id);
        }
      } catch (error) {
        this._logger.error(
          `Error while creating South connector "${south.settings.name}" of type "${south.settings.type}" (${south.settings.id}): ${error}`
        );
      }
    }

    this._logger.info('OIBus engine started');
  }

  /**
   * Gracefully stop every timer, South and North connectors
   */
  async stop(): Promise<void> {
    for (const id of this.southConnectors.keys()) {
      await this.stopSouth(id);
    }

    for (const id of this.northConnectors.keys()) {
      await this.stopNorth(id);
    }
  }

  async createSouth<S extends SouthSettings, I extends SouthItemSettings>(south: SouthConnector<S, I>): Promise<void> {
    this.southConnectors.set(south.settings.id, south);
    this.southConnectorMetrics.set(south.settings.id, new SouthConnectorMetricsService(south, this.southConnectorMetricsRepository));
  }

  async startSouth(southId: string): Promise<void> {
    const south = this.southConnectors.get(southId);
    if (!south) {
      this._logger.trace(`South connector ${southId} not set`);
      return;
    }

    south.connectedEvent.removeAllListeners();
    south.connectedEvent.on('connected', async () => {
      // Trigger cron and subscription creations
      await south.onItemChange();
    });
    // Do not await here, so it can start all connectors without blocking the thread
    south.start().catch(error => {
      this._logger.error(
        `Error while starting South connector "${south.settings.name}" of type "${south.settings.type}" (${south.settings.id}): ${error.message}`
      );
    });
  }

  async createNorth<N extends NorthSettings>(north: NorthConnector<N>): Promise<void> {
    this.northConnectors.set(north.settings.id, north);
    this.northConnectorMetrics.set(north.settings.id, new NorthConnectorMetricsService(north, this.northConnectorMetricsRepository));
  }

  async startNorth(northId: string): Promise<void> {
    const north = this.northConnectors.get(northId);
    if (!north) {
      this._logger.trace(`North connector ${northId} not set`);
      return;
    }

    // Do not await here, so it can start all connectors without blocking the thread
    north.start().catch(error => {
      this._logger.error(
        `Error while starting North connector "${north.settings.name}" of type "${north.settings.type}" (${north.settings.id}): ${error.message}`
      );
    });
  }

  async stopSouth(southId: string): Promise<void> {
    await this.southConnectors.get(southId)?.stop();
    this.southConnectors.get(southId)?.connectedEvent.removeAllListeners();
  }

  async stopNorth(northId: string): Promise<void> {
    await this.northConnectors.get(northId)?.stop();
  }

  /**
   * Stops the south connector and deletes all cache inside the base folder
   */
  async deleteSouth(south: SouthConnectorEntity<SouthSettings, SouthItemSettings>): Promise<void> {
    await this.stopSouth(south.id);
    this.southConnectors.delete(south.id);
  }

  /**
   * Stops the north connector and deletes all cache inside the base folder
   */
  async deleteNorth(north: NorthConnectorEntity<NorthSettings>): Promise<void> {
    await this.stopNorth(north.id);
    this.northConnectors.delete(north.id);
  }

  isConnectionUsed(connectorType: 'north' | 'south', connectorId: string, currentConnectorId: string): boolean {
    for (const north of this.northConnectors.values()) {
      if (north.isEnabled() && north.sharableConnection()) {
        if (
          north.getSharedConnectionSettings().connectorType === connectorType &&
          north.getSharedConnectionSettings().connectorId === connectorId &&
          north.settings.id !== currentConnectorId
        ) {
          return true;
        }
      }
    }
    for (const south of this.southConnectors.values()) {
      if (south.isEnabled() && south.sharableConnection()) {
        if (
          south.getSharedConnectionSettings().connectorType === connectorType &&
          south.getSharedConnectionSettings().connectorId === connectorId &&
          south.settings.id !== currentConnectorId
        ) {
          return true;
        }
      }
    }
    return false;
  }

  setLogger(value: pino.Logger) {
    this._logger = value;

    for (const south of this.southConnectors.values()) {
      south.setLogger(this._logger.child({ scopeType: 'south', scopeId: south.settings.id, scopeName: south.settings.name }));
    }

    for (const north of this.northConnectors.values()) {
      north.setLogger(this._logger.child({ scopeType: 'north', scopeId: north.settings.id, scopeName: north.settings.name }));
    }
  }

  async searchCacheContent(
    northId: string,
    searchParams: CacheSearchParam,
    folder: 'cache' | 'archive' | 'error'
  ): Promise<Array<{ metadataFilename: string; metadata: CacheMetadata }>> {
    return (await this.northConnectors.get(northId)?.searchCacheContent(searchParams, folder)) || [];
  }

  async getCacheContentFileStream(northId: string, folder: 'cache' | 'archive' | 'error', filename: string): Promise<ReadStream | null> {
    return (await this.northConnectors.get(northId)?.getCacheContentFileStream(folder, filename)) || null;
  }

  async removeCacheContent(northId: string, folder: 'cache' | 'archive' | 'error', metadataFilenameList: Array<string>): Promise<void> {
    await this.northConnectors
      .get(northId)
      ?.removeCacheContent(
        folder,
        await this.northConnectors.get(northId)!.metadataFileListToCacheContentList(folder, metadataFilenameList)
      );
  }

  async removeAllCacheContent(northId: string, folder: 'cache' | 'archive' | 'error'): Promise<void> {
    await this.northConnectors.get(northId)?.removeAllCacheContent(folder);
  }

  async moveCacheContent(
    northId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error',
    cacheContentList: Array<string>
  ): Promise<void> {
    await this.northConnectors
      .get(northId)
      ?.moveCacheContent(
        originFolder,
        destinationFolder,
        await this.northConnectors.get(northId)!.metadataFileListToCacheContentList(originFolder, cacheContentList)
      );
  }

  async moveAllCacheContent(
    northId: string,
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error'
  ): Promise<void> {
    await this.northConnectors.get(northId)?.moveAllCacheContent(originFolder, destinationFolder);
  }

  updateScanMode(scanMode: ScanMode) {
    for (const south of this.southConnectors.values()) {
      south.updateScanMode(scanMode);
    }

    for (const north of this.northConnectors.values()) {
      north.updateScanMode(scanMode);
    }
  }

  async reloadItems(southId: string): Promise<void> {
    await this.southConnectors.get(southId)?.onItemChange();
  }

  async reloadSouth(southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings>) {
    await this.stopSouth(southConnector.id);
    const south = this.southConnectors.get(southConnector.id);
    if (south) {
      if (south.queriesHistory()) {
        await south.manageSouthCacheOnChange(south.settings, southConnector, south.getMaxInstantPerItem(south.settings.settings));
      }
      south.setLogger(this.logger.child({ scopeType: 'south', scopeId: southConnector.id, scopeName: southConnector.name }));
      if (southConnector.enabled) {
        await this.startSouth(southConnector.id);
      }
    }
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

  updateSubscriptions() {
    for (const north of this.northConnectors.values()) {
      north.updateConnectorSubscription();
    }
  }

  updateSubscription(northId: string) {
    this.northConnectors.get(northId)?.updateConnectorSubscription();
  }

  getNorth(northId: string): NorthConnector<NorthSettings> | undefined {
    return this.northConnectors.get(northId);
  }

  getSouth(southId: string): SouthConnector<SouthSettings, SouthItemSettings> | undefined {
    return this.southConnectors.get(southId);
  }
}
