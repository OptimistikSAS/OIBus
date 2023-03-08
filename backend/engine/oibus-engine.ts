import BaseEngine from './base-engine';
import EncryptionService from '../service/encryption.service';
import pino from 'pino';
import ProxyService from '../service/proxy.service';
import RepositoryService from '../service/repository.service';
import NorthConnector from '../north/north-connector';
import SouthConnector from '../south/south-connector';
import NorthService from '../service/north.service';
import SouthService from '../service/south.service';
import { createFolder } from '../service/utils';
import path from 'node:path';

import { SouthConnectorDTO, SouthItemCommandDTO, SouthItemDTO } from '../../shared/model/south-connector.model';
import { NorthConnectorDTO } from '../../shared/model/north-connector.model';

const CACHE_FOLDER = './cache/data-stream';

/**
 * At startup, handles of North and South connectors.
 */
export default class OIBusEngine extends BaseEngine {
  private northConnectors: Map<string, NorthConnector> = new Map<string, NorthConnector>();
  private southConnectors: Map<string, SouthConnector> = new Map<string, SouthConnector>();

  constructor(
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    repositoryService: RepositoryService,
    northService: NorthService,
    southService: SouthService,
    logger: pino.Logger
  ) {
    super(encryptionService, proxyService, repositoryService, northService, southService, logger, CACHE_FOLDER);
  }

  /**
   * Add new values from a South connector to the Engine.
   * The Engine will forward the values to the Cache.
   */
  override async addValues(southId: string, values: Array<any>): Promise<void> {
    this.logger.info(`Add "${values.length}" values from ${southId} to north`);
    for (const north of this.northConnectors.values()) {
      if (north.enabled() && north.isSubscribed(southId)) {
        await north.cacheValues(values);
      }
    }
  }

  /**
   * Add a new file from a South connector to the Engine.
   * The Engine will forward the file to the Cache.
   */
  override async addFile(southId: string, filePath: string): Promise<void> {
    this.logger.info(`Add file "${filePath}" from ${southId} to north connectors`);
    for (const north of this.northConnectors.values()) {
      if (north.enabled() && north.isSubscribed(southId)) {
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

    this.logger.info('OIBus started.');
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
    const south = this.southService.createSouth(settings, items, this.addValues.bind(this), this.addFile.bind(this), baseFolder, true);
    // Do not await here, so it can start all connectors without blocking the thread
    south.start().catch(error => {
      this.logger.error(`Error while starting South connector "${settings.name}" of type "${settings.type}" (${settings.id}): ${error}`);
    });
    this.southConnectors.set(settings.id, south);
  }

  async startNorth(southId: string, settings: NorthConnectorDTO): Promise<void> {
    const baseFolder = path.resolve(this.cacheFolder, `north-${settings.id}`);
    await createFolder(baseFolder);

    const north = this.northService.createNorth(settings, baseFolder);
    // Do not await here, so it can start all connectors without blocking the thread
    north.start().catch(error => {
      this.logger.error(`Error while starting North connector "${settings.name}" of type "${settings.type}" (${settings.id}): ${error}`);
    });
    this.northConnectors.set(settings.id, north);
  }

  addItemToSouth(southId: string, item: SouthItemDTO): void {
    this.southConnectors.get(southId)?.addItem(item);
  }

  deleteItemFromSouth(southId: string, item: SouthItemDTO): void {
    this.southConnectors.get(southId)?.deleteItem(item);
  }

  updateItemInSouth(southId: string, oldItem: SouthItemDTO, newItem: SouthItemCommandDTO): void {
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
      south.setLogger(this.logger.child({ scope: `south:${southSettings.name}` }));
    }

    for (const [id, north] of this.northConnectors.entries()) {
      const northSettings = this.northService.getNorth(id);
      north.setLogger(this.logger.child({ scope: `north:${northSettings.name}` }));
    }
  }
}
