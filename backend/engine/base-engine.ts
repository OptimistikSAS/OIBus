import path from 'node:path';

import ProxyService from '../service/proxy.service';
import EncryptionService from '../service/encryption.service';
import pino from 'pino';
import NorthService from '../service/north.service';
import SouthService from '../service/south.service';
import RepositoryService from '../service/repository.service';

/**
 * Abstract class used to manage North and South connectors
 */
export default class BaseEngine {
  protected readonly encryptionService: EncryptionService;
  protected logger: pino.Logger;
  protected readonly proxyService: ProxyService;
  protected cacheFolder: string;
  protected northService: NorthService;
  protected southService: SouthService;
  /**
   * Constructor for BaseEngine
   */
  constructor(
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    repositoryService: RepositoryService,
    northService: NorthService,
    southService: SouthService,
    logger: pino.Logger,
    cacheFolder: string
  ) {
    this.cacheFolder = path.resolve(cacheFolder);
    this.encryptionService = encryptionService;
    this.northService = northService;
    this.southService = southService;
    this.logger = logger;
    this.proxyService = proxyService;
  }

  /**
   * Add new values from a South connector to the Engine.
   * The Engine will forward the values to the Cache.
   */
  async addValues(southId: string, values: Array<any>): Promise<void> {
    this.logger.warn(`addValues() should be surcharged. Called with South "${southId}" and ${values.length} values.`);
  }

  /**
   * Add a new file from a South connector to the Engine.
   * The Engine will forward the file to the Cache.
   */
  async addFile(southId: string, filePath: string, preserveFiles: boolean): Promise<void> {
    this.logger.warn(`addFile() should be surcharged. Called with South "${southId}", file "${filePath}" and ${preserveFiles}.`);
  }

  /**
   * Creates a new instance for every North and South connectors and initialize them.
   * Creates CronJobs based on the ScanModes and starts them.
   */
  async start(): Promise<void> {
    this.logger.warn(`start() should be surcharged.`);
  }

  /**
   * Gracefully stop every timer, South and North connectors
   */
  async stop(): Promise<void> {
    this.logger.warn('stop() should be surcharged.');
  }

  setLogger(value: pino.Logger) {
    this.logger = value;
  }
}
