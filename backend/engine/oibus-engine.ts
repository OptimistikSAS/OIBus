import BaseEngine from './base-engine';
import EncryptionService from '../service/encryption.service';
import pino from 'pino';
import ProxyService from '../service/proxy.service';
import RepositoryService from '../service/repository.service';
import NorthConnector from '../north/north-connector';
import SouthConnector from '../south/south-connector';
import NorthService from '../service/north.service';
import SouthService from '../service/south.service';

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
        const north = this.northService.createNorth(settings, this.cacheFolder);
        await north.start();
        this.northConnectors.set(settings.id, north);
      } catch (error) {
        this.logger.error(`Error while creating North connector "${settings.name}" of type "${settings.type}" (${settings.id}): ${error}`);
      }
    }

    // South connectors
    const southListSettings = this.southService.getSouthList();
    for (const settings of southListSettings) {
      try {
        const items = this.southService.getSouthItems(settings.id);
        const south = this.southService.createSouth(
          settings,
          items,
          this.addValues.bind(this),
          this.addFile.bind(this),
          this.cacheFolder,
          true
        );
        await south.start();
        this.southConnectors.set(settings.id, south);
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
    for (const south of this.southConnectors.values()) {
      await south.stop();
    }

    for (const north of this.northConnectors.values()) {
      await north.stop();
    }
  }
}
