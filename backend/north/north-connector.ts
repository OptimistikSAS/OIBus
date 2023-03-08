import ArchiveService from '../service/cache/archive.service';

import { NorthConnectorDTO, NorthConnectorManifest } from '../../shared/model/north-connector.model';
import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import ProxyService from '../service/proxy.service';
import ValueCacheService from '../service/cache/value-cache.service';
import FileCacheService from '../service/cache/file-cache.service';
import RepositoryService from '../service/repository.service';
import { CronJob } from 'cron';
import { EventEmitter } from 'node:events';
import { ScanModeDTO } from '../../shared/model/scan-mode.model';
import DeferredPromise from '../service/deferred-promise';

import { Instant } from '../../shared/model/types';
import { OIBusError } from '../../shared/model/engine.model';

/**
 * Class NorthConnector : provides general attributes and methods for north connectors.
 * Building a new North connector means to extend this class, and to surcharge
 * the following methods:
 * - **handleValues**: receive an array of values that need to be sent to an external application
 * - **handleFile**: receive a file that need to be sent to an external application.
 * - **connect** (optional): to allow establishing proper connection to the external application
 * - **disconnect** (optional): to allow proper disconnection
 *
 * The constructor of the API need to initialize:
 * - **this.canHandleValues** to true in order to receive values with handleValues()
 * - **this.canHandleFiles** to true in order to receive a file with handleFile()
 *
 * In addition, it is possible to use a number of helper functions:
 * - **getProxy**: get the proxy handler
 * - **logger**: to log an event with different levels (error,warning,info,debug,trace)
 */
export default class NorthConnector {
  protected configuration: NorthConnectorDTO;
  private archiveService: ArchiveService;
  private valueCacheService: ValueCacheService;
  private fileCacheService: FileCacheService;
  protected encryptionService: EncryptionService;
  protected proxyService: ProxyService;
  protected repositoryService: RepositoryService;
  protected logger: pino.Logger;
  private readonly baseFolder: string;
  private manifest: NorthConnectorManifest;

  private fileBeingSent: string | null = null;
  private fileErrorCount = 0;
  private valuesBeingSent: Map<string, Array<any>> = new Map();
  private valueErrorCount = 0;

  private taskJobQueue: Array<ScanModeDTO> = [];
  private cronByScanModeIds: Map<string, CronJob> = new Map<string, CronJob>();
  private taskRunner: EventEmitter = new EventEmitter();
  private runProgress$: DeferredPromise | null = null;

  constructor(
    configuration: NorthConnectorDTO,
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string,
    manifest: NorthConnectorManifest
  ) {
    this.configuration = configuration;
    this.encryptionService = encryptionService;
    this.proxyService = proxyService;
    this.repositoryService = repositoryService;
    this.logger = logger;
    this.baseFolder = baseFolder;
    this.manifest = manifest;

    this.archiveService = new ArchiveService(this.logger, this.baseFolder, this.configuration.archive);
    this.valueCacheService = new ValueCacheService(this.logger, this.baseFolder, this.configuration.caching);
    this.fileCacheService = new FileCacheService(this.logger, this.baseFolder);

    this.taskRunner.on('next', async () => {
      if (this.taskJobQueue.length > 0) {
        await this.run(this.taskJobQueue[0]);
      } else {
        this.logger.trace('No more task to run');
      }
    });
  }

  enabled(): boolean {
    return this.configuration.enabled;
  }

  /**
   * Initialize services at startup
   */
  async start(): Promise<void> {
    await this.valueCacheService.start();
    await this.fileCacheService.start();

    if (!this.enabled()) {
      this.logger.trace(`North connector "${this.configuration.name}" not enabled`);
      return;
    }
    this.logger.trace(`North connector "${this.configuration.name}" enabled. Starting services...`);
    await this.archiveService.start();
    await this.connect();
  }

  /**
   * Method called by Engine to initialize a North connector. This method can be surcharged in the
   * North connector implementation to allow connection to a third party application for example.
   */
  async connect(): Promise<void> {
    const scanMode = this.repositoryService.scanModeRepository.getScanMode(this.configuration.caching.scanModeId);
    if (scanMode) {
      this.createCronJob(scanMode);
    } else {
      this.logger.error(`Scan mode ${this.configuration.caching.scanModeId} not found`);
    }

    this.logger.info(`North connector "${this.configuration.name}" of type ${this.configuration.type} started`);
  }

  /**
   * Create a job used to populate the queue where each element of the queue is a job to call, associated to its scan mode
   */
  createCronJob(scanMode: ScanModeDTO): void {
    const existingCronJob = this.cronByScanModeIds.get(scanMode.id);
    if (existingCronJob) {
      this.logger.debug(`Removing existing North cron job associated to scan mode "${scanMode.name}" (${scanMode.cron})`);
      existingCronJob.stop();
      this.cronByScanModeIds.delete(scanMode.id);
    }
    this.logger.debug(`Creating North cron job for scan mode "${scanMode.name}" (${scanMode.cron})`);
    const job = new CronJob(
      scanMode.cron,
      () => {
        this.addToQueue(scanMode);
      },
      null,
      true
    );
    this.cronByScanModeIds.set(scanMode.id, job);
  }

  addToQueue(scanMode: ScanModeDTO): void {
    const foundJob = this.taskJobQueue.find(element => element.id === scanMode.id);
    if (foundJob) {
      // If a job is already scheduled in queue, it will not be added
      this.logger.warn(`Task job not added in North connector queue for cron "${scanMode.name}" (${scanMode.cron})`);
      return;
    }

    this.taskJobQueue.push(scanMode);
    if (this.taskJobQueue.length === 1) {
      this.taskRunner.emit('next');
    }
  }

  async run(scanMode: ScanModeDTO): Promise<void> {
    if (this.runProgress$) {
      this.logger.warn(`A North task is already running with scan mode ${scanMode.name}`);
      return;
    }
    this.runProgress$ = new DeferredPromise();

    if (this.manifest.modes.points) {
      await this.handleValuesWrapper();
    }

    if (this.manifest.modes.files) {
      await this.handleFilesWrapper();
    }

    // TODO: update cache size here

    this.runProgress$.resolve();
    this.runProgress$ = null;
    this.taskJobQueue.shift();
    this.taskRunner.emit('next');
  }

  /**
   * Method called by the Engine to handle an array of values in order for example
   * to send them to a third party applications
   */
  async handleValuesWrapper(): Promise<void> {
    const arrayValues = [];
    if (!this.valuesBeingSent.size) {
      this.valuesBeingSent = await this.valueCacheService.getValuesToSend();
      this.valueErrorCount = 0;
    }
    if (this.valuesBeingSent.size) {
      for (const array of this.valuesBeingSent.values()) {
        arrayValues.push(...array);
      }
      try {
        await this.handleValues(arrayValues);
        await this.valueCacheService.removeSentValues(this.valuesBeingSent);
        this.valuesBeingSent = new Map();
      } catch (error) {
        const oibusError = this.createOIBusError(error);
        this.valueErrorCount += 1;
        this.logger.error(`Error while sending ${arrayValues.length} values (${this.valueErrorCount}). ${oibusError.message}`);
        if (this.valueErrorCount > this.configuration.caching.retryCount && !oibusError.retry) {
          await this.valueCacheService.manageErroredValues(this.valuesBeingSent!, this.valueErrorCount);
          this.fileBeingSent = null;
        }
      }
    }
  }

  async handleValues(values: Array<any>): Promise<void> {
    this.logger.warn('handleValues method must be override');
  }

  /**
   * Method called by the Engine to handle an array of values in order for example
   * to send them to a third party application.
   */
  async handleFilesWrapper(): Promise<void> {
    if (!this.fileBeingSent) {
      this.fileBeingSent = this.fileCacheService.getFileToSend();
      this.fileErrorCount = 0;
    }
    if (this.fileBeingSent) {
      try {
        await this.handleFile(this.fileBeingSent);
        this.fileCacheService.removeFileFromQueue();
        await this.archiveService.archiveOrRemoveFile(this.fileBeingSent);
        this.fileBeingSent = null;
      } catch (error) {
        const oibusError = this.createOIBusError(error);
        this.fileErrorCount += 1;
        this.logger.error(`Error while handling file "${this.fileBeingSent}" (${this.fileErrorCount}). ${oibusError.message}`);
        if (this.fileErrorCount > this.configuration.caching.retryCount && !oibusError.retry) {
          await this.fileCacheService.manageErroredFiles(this.fileBeingSent!, this.fileErrorCount);
          this.fileBeingSent = null;
        }
      }
    }
  }

  async handleFile(filePath: string): Promise<void> {
    this.logger.warn('handleFile method must be override');
  }

  /**
   * Create a OIBusError from an unknown error thrown by the handleFile or handleValues connector method
   * The error thrown can be overriden with an OIBusError to force a retry on specific cases
   */
  createOIBusError(error: unknown): OIBusError {
    // The error is unknown by default, but it can be overridden with an OIBusError. In this case, we can retrieve the message
    let message = '';

    if (typeof error === 'object') {
      message = (error as any)?.message ?? JSON.stringify(error);
    } else if (typeof error === 'string') {
      message = error;
    } else {
      message = JSON.stringify(error);
    }

    // Retry by default, other retrieve the retry flag from the OIBusError object
    const retry = typeof error === 'object' ? (error as any)?.retry ?? true : true;
    return {
      message: message,
      retry
    };
  }

  /**
   * Method called by the Engine to cache an array of values in order to cache them
   * and send them to a third party application.
   */
  async cacheValues(values: Array<any>): Promise<void> {
    this.logger.trace(`Caching ${values.length} values in North connector "${this.configuration.name}"...`);
    await this.valueCacheService.cacheValues(values);
  }

  /**
   * Method called by the Engine to cache a file and send them to a third party application.
   */
  async cacheFile(filePath: string): Promise<void> {
    this.logger.trace(`Caching file "${filePath}" in North connector "${this.configuration.name}"...`);

    await this.fileCacheService.cacheFile(filePath);
  }

  /**
   * Check whether the North is subscribed to a South.
   * If subscribedTo is not defined or an empty array, the subscription is true.
   */
  isSubscribed(southId: string): boolean {
    // if (!Array.isArray(this.subscribedTo) || this.subscribedTo.length === 0) return true;

    return true;
  }

  /**
   * Check appropriate caches emptiness
   */
  async isCacheEmpty(): Promise<boolean> {
    return (await this.fileCacheService.isEmpty()) && (await this.valueCacheService.isEmpty());
  }

  /**
   * Method called by Engine to stop a North connector. This method can be surcharged in the
   * North connector implementation to allow disconnecting to a third party application for example.
   */
  async disconnect(): Promise<void> {
    this.logger.info(`North connector "${this.configuration.name}" (${this.configuration.id}) disconnected`);
  }

  /**
   * Stop services and timer
   */
  async stop(): Promise<void> {
    this.logger.info(`Stopping North "${this.configuration.name}" (${this.configuration.id})...`);

    if (this.runProgress$) {
      this.logger.debug('Waiting for North task to finish');
      await this.runProgress$.promise;
    }

    for (const cronJob of this.cronByScanModeIds.values()) {
      cronJob.stop();
    }
    this.cronByScanModeIds.clear();
    this.taskJobQueue = [];

    await this.archiveService.stop();
    await this.valueCacheService.stop();
    await this.disconnect();
    this.logger.debug(`North connector ${this.configuration.id} stopped`);
  }

  /**
   * Get list of error files from file cache. Dates are in ISO format
   */
  async getErrorFiles(
    fromDate: string,
    toDate: string,
    fileNameContains: string
  ): Promise<Array<{ filename: string; modificationDate: Instant; size: number }>> {
    return await this.fileCacheService.getErrorFiles(fromDate, toDate, fileNameContains);
  }

  /**
   * Remove error files from file cache.
   */
  async removeErrorFiles(filenames: Array<string>): Promise<void> {
    this.logger.trace(`Removing ${filenames.length} error files from North connector "${this.configuration.name}"...`);
    await this.fileCacheService.removeErrorFiles(filenames);
  }

  /**
   * Retry error files from file cache.
   */
  async retryErrorFiles(filenames: Array<string>): Promise<void> {
    this.logger.trace(`Retrying ${filenames.length} error files in North connector "${this.configuration.name}"...`);
    await this.fileCacheService.retryErrorFiles(filenames);
  }

  /**
   * Remove all error files from file cache.
   */
  async removeAllErrorFiles(): Promise<void> {
    this.logger.trace(`Removing all error files from North connector "${this.configuration.name}"...`);
    await this.fileCacheService.removeAllErrorFiles();
  }

  /**
   * Retry all error files from file cache.
   */
  async retryAllErrorFiles(): Promise<void> {
    this.logger.trace(`Retrying all error files in North connector "${this.configuration.name}"...`);
    await this.fileCacheService.retryAllErrorFiles();
  }

  setLogger(value: pino.Logger) {
    this.logger = value;
  }
}
