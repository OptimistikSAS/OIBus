import pino from 'pino';
import NorthConnector from '../north/north-connector';
import SouthConnector from '../south/south-connector';
import { createFolder, filesExists } from '../service/utils';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Instant } from '../../../shared/model/types';
import { PassThrough } from 'node:stream';
import { OIBusContent } from '../../../shared/model/engine.model';
import { ScanMode } from '../model/scan-mode.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { SouthConnectorEntity } from '../model/south-connector.model';
import { NorthConnectorEntity } from '../model/north-connector.model';

const CACHE_FOLDER = './cache/data-stream';

export default class DataStreamEngine {
  private northConnectors = new Map<string, NorthConnector<NorthSettings>>();
  private southConnectors = new Map<string, SouthConnector<SouthSettings, SouthItemSettings>>();
  private readonly cacheFolder: string;

  constructor(private _logger: pino.Logger) {
    this.cacheFolder = path.resolve(CACHE_FOLDER);
  }

  get logger() {
    return this._logger;
  }

  get baseFolder() {
    return this.cacheFolder;
  }

  /**
   * Method called by South connectors to add content to the appropriate Norths
   */
  async addContent(southId: string, data: OIBusContent) {
    for (const north of this.northConnectors.values()) {
      if (north.isEnabled() && north.isSubscribed(southId)) {
        switch (data.type) {
          case 'time-values':
            await north.cacheValues(data.content);
            break;
          case 'raw':
            await north.cacheFile(data.filePath);
            break;
        }
      }
    }
  }

  /**
   * Add content to a north connector from the OIBus API endpoints
   * @param northId - the north id
   * @param data - the content to be added
   */
  async addExternalContent(northId: string, data: OIBusContent): Promise<void> {
    const north = this.northConnectors.get(northId);
    if (north && north.isEnabled()) {
      switch (data.type) {
        case 'time-values':
          await north.cacheValues(data.content);
          return;
        case 'raw':
          await north.cacheFile(data.filePath);
          return;
      }
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
    const baseFolder = path.resolve(this.cacheFolder, `south-${south.settings.id}`);
    await createFolder(baseFolder);

    this.southConnectors.set(south.settings.id, south);
    // this.homeMetricsService.addSouth(south, south.settings.id);
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
    const baseFolder = path.resolve(this.cacheFolder, `north-${north.settings.id}`);
    await createFolder(baseFolder);

    this.northConnectors.set(north.settings.id, north);
    // this.homeMetricsService.addNorth(north, north.settings.id);
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
    // this.homeMetricsService.removeSouth(southId);
    this.southConnectors.delete(south.id);
    const baseFolder = path.resolve(this.cacheFolder, `south-${south.id}`);

    try {
      this._logger.trace(`Deleting base folder "${baseFolder}" of South connector "${south.name}" (${south.id})`);

      if (await filesExists(baseFolder)) {
        await fs.rm(baseFolder, { recursive: true });
      }

      this._logger.info(`Deleted South connector "${south.name}" (${south.id})`);
    } catch (error) {
      this._logger.error(`Unable to delete South connector "${south.name}" (${south.id} base folder: ${error}`);
    }
  }

  /**
   * Stops the north connector and deletes all cache inside the base folder
   */
  async deleteNorth(north: NorthConnectorEntity<NorthSettings>): Promise<void> {
    await this.stopNorth(north.id);
    // this.homeMetricsService.removeNorth(northId);
    this.northConnectors.delete(north.id);

    const baseFolder = path.resolve(this.cacheFolder, `north-${north.id}`);

    try {
      this._logger.trace(`Deleting base folder "${baseFolder}" of North connector "${north.name}" (${north.id})`);

      if (await filesExists(baseFolder)) {
        await fs.rm(baseFolder, { recursive: true });
      }

      this._logger.info(`Deleted North connector "${north.name}" (${north.id})`);
    } catch (error) {
      this._logger.error(`Unable to delete North connector "${north.name}" (${north.id}) base folder: ${error}`);
    }
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

  async getErrorFiles(northId: string, start: Instant, end: Instant, fileNameContains: string) {
    return (await this.northConnectors.get(northId)?.getErrorFiles(start, end, fileNameContains)) || [];
  }

  async getErrorFileContent(northId: string, filename: string) {
    return (await this.northConnectors.get(northId)?.getErrorFileContent(filename)) || null;
  }

  async removeErrorFiles(northId: string, filenames: Array<string>): Promise<void> {
    await this.northConnectors.get(northId)?.removeErrorFiles(filenames);
  }

  async retryErrorFiles(northId: string, filenames: Array<string>): Promise<void> {
    await this.northConnectors.get(northId)?.retryErrorFiles(filenames);
  }

  async removeAllErrorFiles(northId: string): Promise<void> {
    await this.northConnectors.get(northId)?.removeAllErrorFiles();
  }

  async retryAllErrorFiles(northId: string): Promise<void> {
    await this.northConnectors.get(northId)?.retryAllErrorFiles();
  }

  async getCacheFiles(northId: string, start: Instant, end: Instant, fileNameContains: string) {
    return (await this.northConnectors.get(northId)?.getCacheFiles(start, end, fileNameContains)) || [];
  }

  async getCacheFileContent(northId: string, filename: string) {
    return (await this.northConnectors.get(northId)?.getCacheFileContent(filename)) || null;
  }

  async removeCacheFiles(northId: string, filenames: Array<string>): Promise<void> {
    await this.northConnectors.get(northId)?.removeCacheFiles(filenames);
  }

  async archiveCacheFiles(northId: string, filenames: Array<string>): Promise<void> {
    await this.northConnectors.get(northId)?.archiveCacheFiles(filenames);
  }

  async getArchiveFiles(northId: string, start: Instant, end: Instant, fileNameContains: string) {
    return (await this.northConnectors.get(northId)?.getArchiveFiles(start, end, fileNameContains)) || [];
  }

  async getArchiveFileContent(northId: string, filename: string) {
    return (await this.northConnectors.get(northId)?.getArchiveFileContent(filename)) || null;
  }

  async removeArchiveFiles(northId: string, filenames: Array<string>): Promise<void> {
    await this.northConnectors.get(northId)?.removeArchiveFiles(filenames);
  }

  async retryArchiveFiles(northId: string, filenames: Array<string>): Promise<void> {
    await this.northConnectors.get(northId)?.retryArchiveFiles(filenames);
  }

  async removeAllArchiveFiles(northId: string): Promise<void> {
    await this.northConnectors.get(northId)?.removeAllArchiveFiles();
  }

  async retryAllArchiveFiles(northId: string): Promise<void> {
    await this.northConnectors.get(northId)?.retryAllArchiveFiles();
  }

  async getCacheValues(northId: string, fileNameContains: string) {
    return this.northConnectors.get(northId)?.getCacheValues(fileNameContains) || [];
  }

  async removeCacheValues(northId: string, filenames: Array<string>) {
    await this.northConnectors.get(northId)?.removeCacheValues(filenames);
  }

  async removeAllCacheValues(northId: string) {
    await this.northConnectors.get(northId)?.removeAllCacheValues();
  }

  async getValueErrors(northId: string, start: Instant, end: Instant, fileNameContains: string) {
    return (await this.northConnectors.get(northId)?.getValueErrors(start, end, fileNameContains)) || [];
  }

  async removeValueErrors(northId: string, filenames: Array<string>) {
    await this.northConnectors.get(northId)?.removeValueErrors(filenames);
  }

  async removeAllValueErrors(northId: string) {
    await this.northConnectors.get(northId)?.removeAllValueErrors();
  }

  async retryValueErrors(northId: string, filenames: Array<string>) {
    await this.northConnectors.get(northId)?.retryValueErrors(filenames);
  }

  async retryAllValueErrors(northId: string) {
    await this.northConnectors.get(northId)?.retryAllValueErrors();
  }

  getSouthDataStream(southId: string): PassThrough | null {
    return this.southConnectors.get(southId)?.getMetricsDataStream() || null;
  }

  getNorthDataStream(northId: string): PassThrough | null {
    return this.northConnectors.get(northId)?.getMetricsDataStream() || null;
  }

  resetSouthMetrics(southId: string): PassThrough | null {
    return this.southConnectors.get(southId)?.resetMetrics() || null;
  }

  resetNorthMetrics(northId: string): PassThrough | null {
    return this.northConnectors.get(northId)?.resetMetrics() || null;
  }

  async updateScanMode(scanMode: ScanMode): Promise<void> {
    for (const south of this.southConnectors.values()) {
      await south.updateScanMode(scanMode);
    }

    for (const north of this.northConnectors.values()) {
      await north.updateScanMode(scanMode);
    }
  }

  async reloadItems(southId: string): Promise<void> {
    await this.southConnectors.get(southId)?.onItemChange();
  }

  async reloadSouth(south: SouthConnectorEntity<SouthSettings, SouthItemSettings>) {
    await this.stopSouth(south.id);
    this.southConnectors.get(south.id)?.setLogger(this.logger.child({ scopeType: 'south', scopeId: south.id, scopeName: south.name }));
    await this.startSouth(south.id);
  }

  async reloadNorth(north: NorthConnectorEntity<NorthSettings>) {
    await this.stopNorth(north.id);
    this.northConnectors.get(north.id)?.setLogger(this.logger.child({ scopeType: 'north', scopeId: north.id, scopeName: north.name }));
    await this.startNorth(north.id);
  }

  updateSubscriptions() {
    for (const north of this.northConnectors.values()) {
      north.updateConnectorSubscription();
    }
  }

  updateSubscription(northId: string) {
    this.northConnectors.get(northId)?.updateConnectorSubscription();
  }
}
