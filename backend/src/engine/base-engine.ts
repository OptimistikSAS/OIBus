import path from 'node:path';
import EncryptionService from '../service/encryption.service';
import pino from 'pino';
import NorthService from '../service/north.service';
import SouthService from '../service/south.service';

/**
 * Abstract class used to manage North and South connectors
 */
export default class BaseEngine {
  /**
   * Constructor for BaseEngine
   */
  constructor(
    protected readonly encryptionService: EncryptionService,
    protected readonly northService: NorthService,
    protected readonly southService: SouthService,
    protected _logger: pino.Logger,
    protected readonly cacheFolder: string
  ) {
    this.cacheFolder = path.resolve(cacheFolder);
  }

  /**
   * Creates a new instance for every North and South connectors and initialize them.
   * Creates CronJobs based on the ScanModes and starts them.
   */
  async start(): Promise<void> {
    this._logger.warn(`start() should be surcharged`);
  }

  /**
   * Gracefully stop every timer, South and North connectors
   */
  async stop(): Promise<void> {
    this._logger.warn('stop() should be surcharged');
  }

  setLogger(value: pino.Logger) {
    this._logger = value;
  }

  get logger() {
    return this._logger;
  }
}
