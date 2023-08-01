import BaseEngine from './base-engine';
import EncryptionService from '../service/encryption.service';
import pino from 'pino';
import NorthConnector from '../north/north-connector';
import SouthConnector from '../south/south-connector';
import NorthService from '../service/north.service';
import SouthService from '../service/south.service';
import { createFolder } from '../service/utils';
import path from 'node:path';

import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../shared/model/south-connector.model';
import { NorthConnectorDTO } from '../../../shared/model/north-connector.model';
import { Instant } from '../../../shared/model/types';
import { PassThrough } from 'node:stream';
import { ScanModeDTO } from '../../../shared/model/scan-mode.model';

const CACHE_FOLDER = './cache/data-stream';

/**
 * At startup, handles of North and South connectors.
 */
export default class OIBusEngine extends BaseEngine {
  private northConnectors: Map<string, NorthConnector> = new Map<string, NorthConnector>();
  private southConnectors: Map<string, SouthConnector> = new Map<string, SouthConnector>();

  constructor(encryptionService: EncryptionService, northService: NorthService, southService: SouthService, logger: pino.Logger) {
    super(encryptionService, northService, southService, logger, CACHE_FOLDER);
  }

  /**
   * Add new values from a South connector to the Engine.
   * The Engine will forward the values to the Cache.
   */
  async addValues(southId: string, values: Array<any>): Promise<void> {
    for (const north of this.northConnectors.values()) {
      if (north.isEnabled() && north.isSubscribed(southId)) {
        await north.cacheValues(values);
      }
    }
  }

  /**
   * Add new values from an external source to the Engine.
   * The Engine will forward the values to the Cache.
   */
  async addExternalValues(externalSourceId: string | null, values: Array<any>): Promise<void> {
    for (const north of this.northConnectors.values()) {
      if (north.isEnabled() && (!externalSourceId || north.isSubscribedToExternalSource(externalSourceId))) {
        await north.cacheValues(values);
      }
    }
  }

  /**
   * Add a new file from a South connector to the Engine.
   * The Engine will forward the file to the Cache.
   */
  async addFile(southId: string, filePath: string): Promise<void> {
    for (const north of this.northConnectors.values()) {
      if (north.isEnabled() && north.isSubscribed(southId)) {
        await north.cacheFile(filePath);
      }
    }
  }

  /**
   * Add a new file from an external source to the Engine.
   * The Engine will forward the file to the Cache.
   */
  async addExternalFile(externalSourceId: string | null, filePath: string): Promise<void> {
    for (const north of this.northConnectors.values()) {
      if (north.isEnabled() && (!externalSourceId || north.isSubscribedToExternalSource(externalSourceId))) {
        await north.cacheFile(filePath);
      }
    }
  }

  /**
   * Creates a new instance for every North and South connectors and initialize them.
   * Creates CronJobs based on the ScanModes and starts them.
   */
  override async start(): Promise<void> {
    // North connectors
    const northListSettings = this.northService.getNorthList();
    for (const settings of northListSettings) {
      try {
        await this.startNorth(settings.id, settings);
      } catch (error) {
        this.logger.error(`Error while creating North connector "${settings.name}" of type "${settings.type}" (${settings.id}): ${error}`);
      }
    }

    // South connectors
    const southListSettings = this.southService.getSouthList();
    for (const settings of southListSettings) {
      try {
        await this.startSouth(settings.id, settings);
      } catch (error) {
        this.logger.error(`Error while creating South connector "${settings.name}" of type "${settings.type}" (${settings.id}): ${error}`);
      }
    }

    this.logger.info('OIBus engine started');
  }

  /**
   * Gracefully stop every timer, South and North connectors
   */
  override async stop(): Promise<void> {
    for (const id of this.southConnectors.keys()) {
      await this.stopSouth(id);
    }

    for (const id of this.northConnectors.keys()) {
      await this.stopNorth(id);
    }
  }

  async startSouth(southId: string, settings: SouthConnectorDTO): Promise<void> {
    const baseFolder = path.resolve(this.cacheFolder, `south-${settings.id}`);
    await createFolder(baseFolder);

    const items = this.southService.getSouthItems(settings.id);
    const south = this.southService.createSouth(
      settings,
      items,
      this.addValues.bind(this),
      this.addFile.bind(this),
      baseFolder,
      this.logger.child({ scopeType: 'south', scopeId: settings.id, scopeName: settings.name })
    );
    if (south.isEnabled()) {
      south.connectedEvent.on('connected', async () => {
        await south.createSubscriptions(items.filter(item => item.scanModeId === 'subscription' && item.enabled));
        await south.createCronJobs(items.filter(item => item.scanModeId !== 'subscription' && item.enabled));
      });
      // Do not await here, so it can start all connectors without blocking the thread
      south.start().catch(error => {
        this.logger.error(`Error while starting South connector "${settings.name}" of type "${settings.type}" (${settings.id}): ${error}`);
      });
    } else {
      this.logger.trace(`South connector ${settings.name} not enabled`);
    }
    this.southConnectors.set(settings.id, south);
  }

  async startNorth(northId: string, settings: NorthConnectorDTO): Promise<void> {
    const baseFolder = path.resolve(this.cacheFolder, `north-${settings.id}`);
    await createFolder(baseFolder);

    const north = this.northService.createNorth(
      settings,
      baseFolder,
      this.logger.child({ scopeType: 'north', scopeId: settings.id, scopeName: settings.name })
    );
    if (north.isEnabled()) {
      // Do not await here, so it can start all connectors without blocking the thread
      north.start().catch(error => {
        this.logger.error(`Error while starting North connector "${settings.name}" of type "${settings.type}" (${settings.id}): ${error}`);
      });
    } else {
      this.logger.trace(`North connector "${settings.name}" not enabled`);
    }
    this.northConnectors.set(settings.id, north);
  }

  addItemToSouth(southId: string, item: SouthConnectorItemDTO): void {
    this.southConnectors.get(southId)?.addItem(item);
  }

  deleteItemFromSouth(southId: string, item: SouthConnectorItemDTO): void {
    this.southConnectors.get(southId)?.deleteItem(item);
  }

  deleteAllItemsFromSouth(southId: string): void {
    this.southConnectors.get(southId)?.deleteAllItems();
  }

  updateItemInSouth(southId: string, oldItem: SouthConnectorItemDTO, newItem: SouthConnectorItemDTO): void {
    this.southConnectors.get(southId)?.updateItem(oldItem, newItem);
  }

  async stopSouth(southId: string): Promise<void> {
    await this.southConnectors.get(southId)?.stop();
    this.southConnectors.delete(southId);
  }

  async stopNorth(northId: string): Promise<void> {
    await this.northConnectors.get(northId)?.stop();
    this.northConnectors.delete(northId);
  }

  setLogger(value: pino.Logger) {
    super.setLogger(value);

    for (const [id, south] of this.southConnectors.entries()) {
      const southSettings = this.southService.getSouth(id);
      if (southSettings) {
        south.setLogger(this.logger.child({ scopeType: 'south', scopeId: southSettings.id, scopeName: southSettings.name }));
      }
    }

    for (const [id, north] of this.northConnectors.entries()) {
      const northSettings = this.northService.getNorth(id);
      if (northSettings) {
        north.setLogger(this.logger.child({ scopeType: 'north', scopeId: northSettings.id, scopeName: northSettings.name }));
      }
    }
  }

  async getErrorFiles(northId: string, start: Instant, end: Instant, fileNameContains: string) {
    return (await this.northConnectors.get(northId)?.getErrorFiles(start, end, fileNameContains)) || [];
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

  async getArchiveFiles(northId: string, start: Instant, end: Instant, fileNameContains: string) {
    return (await this.northConnectors.get(northId)?.getArchiveFiles(start, end, fileNameContains)) || [];
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

  async updateScanMode(scanMode: ScanModeDTO): Promise<void> {
    for (const [id, south] of this.southConnectors.entries()) {
      const southSettings = this.southService.getSouth(id);
      if (southSettings) {
        await south.updateScanMode(scanMode);
      }
    }

    for (const [id, north] of this.northConnectors.entries()) {
      const northSettings = this.northService.getNorth(id);
      if (northSettings) {
        await north.updateScanMode(scanMode);
      }
    }
  }
}
