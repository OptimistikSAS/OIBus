import ArchiveService from '../service/cache/archive.service';

import {
  NorthArchiveFiles,
  NorthCacheFiles,
  NorthConnectorDTO,
  NorthConnectorItemDTO,
  NorthValueFiles
} from '../../../shared/model/north-connector.model';
import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import ValueCacheService from '../service/cache/value-cache.service';
import FileCacheService from '../service/cache/file-cache.service';
import RepositoryService from '../service/repository.service';
import { CronJob } from 'cron';
import { EventEmitter } from 'node:events';
import { ScanModeDTO } from '../../../shared/model/scan-mode.model';
import DeferredPromise from '../service/deferred-promise';
import { OIBusContent, OIBusError, OIBusRawContent, OIBusTimeValue, OIBusTimeValueContent } from '../../../shared/model/engine.model';
import { SubscriptionDTO } from '../../../shared/model/subscription.model';
import { DateTime } from 'luxon';
import { PassThrough } from 'node:stream';
import { ReadStream } from 'node:fs';
import path from 'node:path';
import NorthConnectorMetricsService from '../service/north-connector-metrics.service';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { dirSize, validateCronExpression } from '../service/utils';

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
export default class NorthConnector<T extends NorthSettings = any, I = any> {
  public static type: string;

  private archiveService: ArchiveService;
  private valueCacheService: ValueCacheService;
  private fileCacheService: FileCacheService;
  protected metricsService: NorthConnectorMetricsService | null = null;
  private subscribedTo: Array<SubscriptionDTO> = [];
  protected items: Array<NorthConnectorItemDTO<I>> = [];

  private cacheSize = 0;

  private fileBeingSent: string | null = null;
  private fileErrorCount = 0;
  private valuesBeingSent: Map<string, Array<OIBusTimeValue>> = new Map();
  private valueErrorCount = 0;

  private taskJobQueue: Array<ScanModeDTO> = [];
  private cronByScanModeIds: Map<string, CronJob> = new Map<string, CronJob>();
  private taskRunner: EventEmitter = new EventEmitter();
  private runProgress$: DeferredPromise | null = null;
  private stopping = false;

  constructor(
    protected connector: NorthConnectorDTO<T>,
    protected readonly encryptionService: EncryptionService,
    protected readonly repositoryService: RepositoryService,
    protected logger: pino.Logger,
    protected readonly baseFolder: string
  ) {
    this.archiveService = new ArchiveService(this.logger, this.baseFolder, this.connector.caching.rawFiles.archive);
    this.valueCacheService = new ValueCacheService(this.logger, this.baseFolder, this.connector.caching);
    this.fileCacheService = new FileCacheService(this.logger, this.baseFolder, this.connector.caching);

    if (this.connector.id === 'test') {
      return;
    }

    this.metricsService = new NorthConnectorMetricsService(this.connector.id, this.repositoryService.northMetricsRepository);
    this.metricsService.initMetrics();

    this.taskRunner.on('next', async () => {
      if (this.taskJobQueue.length > 0) {
        this.logger.trace(`Next trigger: ${!this.runProgress$}`);
        if (!this.runProgress$ && !this.stopping) {
          await this.run('scan');
        }
      } else {
        this.logger.trace('No more task to run');
      }
    });

    this.valueCacheService.triggerRun.on('next', async () => {
      this.taskJobQueue.push({ id: 'value-trigger', cron: '', name: '', description: '' });
      this.logger.trace(`Value cache trigger immediately: ${!this.runProgress$}`);
      if (!this.runProgress$ && !this.stopping) {
        await this.run('value-trigger');
      }
    });

    this.valueCacheService.triggerRun.on('cache-size', async (sizeToAdd: number) => {
      this.cacheSize += sizeToAdd;
      this.metricsService!.updateMetrics(this.connector.id, {
        ...this.metricsService!.metrics,
        cacheSize: this.cacheSize
      });
    });

    this.fileCacheService.triggerRun.on('next', async () => {
      this.taskJobQueue.push({ id: 'file-trigger', cron: '', name: '', description: '' });
      this.logger.trace(`File cache trigger immediately: ${!this.runProgress$}`);
      if (!this.runProgress$ && !this.stopping) {
        await this.run('file-trigger');
      }
    });

    this.fileCacheService.triggerRun.on('cache-size', async (sizeToAdd: number) => {
      this.cacheSize += sizeToAdd;
      this.metricsService!.updateMetrics(this.connector.id, {
        ...this.metricsService!.metrics,
        cacheSize: this.cacheSize
      });
    });

    this.archiveService.triggerRun.on('cache-size', async (sizeToAdd: number) => {
      this.cacheSize += sizeToAdd;
      this.metricsService!.updateMetrics(this.connector.id, {
        ...this.metricsService!.metrics,
        cacheSize: this.cacheSize
      });
    });
  }

  isEnabled(): boolean {
    return this.connector.enabled;
  }

  /**
   * Initialize services at startup
   */
  async start(dataStream = true): Promise<void> {
    if (dataStream) {
      // Reload the settings only on data stream case, otherwise let the history query manage the settings
      this.connector = this.repositoryService.northConnectorRepository.getNorthConnector(this.connector.id)!;
    }
    this.logger.debug(`North connector "${this.connector.name}" enabled. Starting services...`);
    if (this.connector.id !== 'test') {
      this.cacheSize = await dirSize(this.baseFolder);
      this.metricsService!.updateMetrics(this.connector.id, {
        ...this.metricsService!.metrics,
        cacheSize: this.cacheSize
      });
      this.updateConnectorSubscription();
    }
    await this.valueCacheService.start();
    await this.fileCacheService.start();
    await this.archiveService.start();
    await this.connect();
  }

  updateConnectorSubscription() {
    this.subscribedTo = this.repositoryService.subscriptionRepository.getNorthSubscriptions(this.connector.id);
  }

  /**
   * Method called by Engine to initialize a North connector. This method can be surcharged in the
   * North connector implementation to allow connection to a third party application for example.
   */
  async connect(): Promise<void> {
    if (this.connector.id !== 'test') {
      this.metricsService!.updateMetrics(this.connector.id, {
        ...this.metricsService!.metrics,
        lastConnection: DateTime.now().toUTC().toISO()
      });

      const scanMode = this.repositoryService.scanModeRepository.getScanMode(this.connector.caching.scanModeId);
      if (scanMode) {
        this.createCronJob(scanMode);
      } else {
        this.logger.error(`Scan mode ${this.connector.caching.scanModeId} not found`);
      }
    }
    this.logger.info(`North connector "${this.connector.name}" of type ${this.connector.type} started`);
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
    try {
      validateCronExpression(scanMode.cron);
      const job = new CronJob(
        scanMode.cron,
        () => {
          this.addToQueue.bind(this).call(this, scanMode);
        },
        null,
        true
      );
      this.cronByScanModeIds.set(scanMode.id, job);
    } catch (error: any) {
      this.logger.error(`Error when creating North cron job for scan mode "${scanMode.name}" (${scanMode.cron}): ${error.message}`);
    }
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

  /**
   * Method used to set the runProgress$ variable with a DeferredPromise
   */
  createDeferredPromise(): void {
    this.runProgress$ = new DeferredPromise();
  }

  /**
   * Method used to resolve and unset the DeferredPromise kept in the runProgress$ variable
   * This allows to control the promise from an outside class
   */
  resolveDeferredPromise(): void {
    if (this.runProgress$) {
      this.runProgress$.resolve();
      this.runProgress$ = null;
    }
  }

  async run(flag: 'scan' | 'file-trigger' | 'value-trigger'): Promise<void> {
    this.createDeferredPromise();
    this.logger.trace(`North run triggered with flag ${flag}`);

    const runStart = DateTime.now();
    if (this.connector.id !== 'test') {
      this.metricsService!.updateMetrics(this.connector.id, { ...this.metricsService!.metrics, lastRunStart: runStart.toUTC().toISO() });
    }

    await this.handleContentWrapper(flag);
    if (this.connector.id !== 'test') {
      this.metricsService!.updateMetrics(this.connector.id, {
        ...this.metricsService!.metrics,
        lastRunDuration: DateTime.now().toMillis() - runStart.toMillis()
      });
    }

    this.taskJobQueue.shift();
    this.resolveDeferredPromise();
    this.taskRunner.emit('next');
  }

  async handleContentWrapper(flag: 'scan' | 'file-trigger' | 'value-trigger') {
    // TODO: check connector compatibility, including transformer (to be developed)
    if (flag === 'scan' || flag === 'value-trigger') {
      await this.handleValuesWrapper();
    }

    if (flag === 'scan' || flag === 'file-trigger') {
      await this.handleFilesWrapper();
    }
  }

  /**
   * Method called by the Engine to handle an array of values in order for example
   * to send them to a third party applications
   */
  async handleValuesWrapper(): Promise<void> {
    const arrayValues: Array<OIBusTimeValue> = [];
    if (!this.valuesBeingSent.size) {
      this.valuesBeingSent = await this.valueCacheService.getValuesToSend();
      this.valueErrorCount = 0;
    }
    if (this.valuesBeingSent.size) {
      for (const array of this.valuesBeingSent.values()) {
        arrayValues.push(...array);
      }
      try {
        const content: OIBusTimeValueContent = {
          type: 'time-values',
          content: arrayValues
        };
        await this.handleContent(content);

        await this.valueCacheService.removeSentValues(this.valuesBeingSent);
        const currentMetrics = this.metricsService!.metrics;
        this.metricsService!.updateMetrics(this.connector.id, {
          ...currentMetrics,
          numberOfValuesSent: currentMetrics.numberOfValuesSent + arrayValues.length,
          lastValueSent: arrayValues[arrayValues.length - 1]
        });
        this.valuesBeingSent = new Map();
      } catch (error) {
        const oibusError = this.createOIBusError(error);
        this.valueErrorCount += 1;
        this.logger.error(`Error while sending ${arrayValues.length} values (${this.valueErrorCount}). ${oibusError.message}`);
        if (this.valueErrorCount > this.connector.caching.retryCount && !oibusError.retry) {
          await this.valueCacheService.manageErroredValues(this.valuesBeingSent, this.valueErrorCount);
          this.valuesBeingSent = new Map();
        }
      }
    }
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
        const content: OIBusRawContent = {
          type: 'raw',
          filePath: this.fileBeingSent
        };
        await this.handleContent(content);
        const currentMetrics = this.metricsService!.metrics;
        this.metricsService!.updateMetrics(this.connector.id, {
          ...currentMetrics,
          numberOfFilesSent: currentMetrics.numberOfFilesSent + 1,
          lastFileSent: path.parse(this.fileBeingSent).base
        });
        this.fileCacheService.removeFileFromQueue();
        await this.archiveService.archiveOrRemoveFile(this.fileBeingSent);
        this.fileBeingSent = null;
      } catch (error) {
        const oibusError = this.createOIBusError(error);
        this.fileErrorCount += 1;
        this.logger.error(`Error while handling file "${this.fileBeingSent}" (${this.fileErrorCount}). ${oibusError.message}`);
        if (this.fileErrorCount > this.connector.caching.retryCount && !oibusError.retry) {
          await this.fileCacheService.manageErroredFiles(this.fileBeingSent!, this.fileErrorCount);
          this.fileBeingSent = null;
        }
      }
    }
  }

  /**
   * Create a OIBusError from an unknown error thrown by the handleFile or handleValues connector method
   * The error thrown can be overridden with an OIBusError to force a retry on specific cases
   */
  createOIBusError(error: unknown): OIBusError {
    // The error is unknown by default, but it can be overridden with an OIBusError. In this case, we can retrieve the message
    let message;
    if (typeof error === 'object') {
      message = (error as any)?.message ?? JSON.stringify(error);
    } else if (typeof error === 'string') {
      message = error;
    } else {
      message = JSON.stringify(error);
    }

    // Do not retry by default, other retrieve the retry flag from the OIBusError object
    const retry = typeof error === 'object' ? ((error as any)?.retry ?? false) : false;
    return {
      message: message,
      retry
    };
  }

  /**
   * Method called by the Engine to cache an array of values in order to cache them
   * and send them to a third party application.
   */
  async cacheValues(values: Array<OIBusTimeValue>): Promise<void> {
    if (this.connector.caching.maxSize !== 0 && this.cacheSize >= this.connector.caching.maxSize * 1024 * 1024) {
      this.logger.debug(
        `North cache is exceeding the maximum allowed size ` +
          `(${Math.floor((this.cacheSize / 1024 / 1024) * 100) / 100} MB >= ${this.connector.caching.maxSize} MB). ` +
          'Values will be discarded until the cache is emptied (by sending files/values or manual removal)'
      );
      return;
    }

    const chunkSize = this.connector.caching.oibusTimeValues.maxSendCount;
    for (let i = 0; i < values.length; i += chunkSize) {
      const chunk = values.slice(i, i + chunkSize);
      this.logger.debug(`Caching ${values.length} values (cache size: ${Math.floor((this.cacheSize / 1024 / 1024) * 100) / 100} MB)`);
      await this.valueCacheService.cacheValues(chunk);
    }
  }

  /**
   * Method called by the Engine to cache a file and send them to a third party application.
   */
  async cacheFile(filePath: string): Promise<void> {
    if (this.connector.caching.maxSize !== 0 && this.cacheSize >= this.connector.caching.maxSize * 1024 * 1024) {
      this.logger.debug(
        `North cache is exceeding the maximum allowed size ` +
          `(${Math.floor((this.cacheSize / 1024 / 1024) * 100) / 100} MB >= ${this.connector.caching.maxSize} MB). ` +
          'Files will be discarded until the cache is emptied (by sending files/values or manual removal)'
      );
      return;
    }
    this.logger.debug(`Caching file "${filePath}" in North connector "${this.connector.name}"...`);
    await this.fileCacheService.cacheFile(filePath);
  }

  /**
   * Check whether the North is subscribed to a South.
   * If subscribedTo is not defined or an empty array, the subscription is true.
   */
  isSubscribed(southId: string): boolean {
    return this.subscribedTo.length === 0 || this.subscribedTo.includes(southId);
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
    this.logger.info(`North connector "${this.connector.name}" (${this.connector.id}) disconnected`);
  }

  /**
   * Stop services and timer
   */
  async stop(dataStream = true): Promise<void> {
    this.stopping = true;
    this.logger.debug(`Stopping North "${this.connector.name}" (${this.connector.id})...`);

    if (dataStream) {
      // Reload the settings only on data stream case, otherwise let the history query manage the settings
      this.connector = this.repositoryService.northConnectorRepository.getNorthConnector(this.connector.id)!;
    }

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

    this.stopping = false;
    this.logger.info(`North connector "${this.connector.name}" stopped`);
  }

  /**
   * Get list of error files from file cache. Dates are in ISO format
   */
  async getErrorFiles(fromDate: string, toDate: string, fileNameContains: string): Promise<Array<NorthCacheFiles>> {
    return await this.fileCacheService.getErrorFiles(fromDate, toDate, fileNameContains);
  }

  /**
   * Get error file content as a read stream.
   */
  async getErrorFileContent(filename: string): Promise<ReadStream | null> {
    return await this.fileCacheService.getErrorFileContent(filename);
  }

  /**
   * Remove error files from file cache.
   */
  async removeErrorFiles(filenames: Array<string>): Promise<void> {
    this.logger.trace(`Removing ${filenames.length} error files from North connector "${this.connector.name}"...`);
    await this.fileCacheService.removeFiles(this.fileCacheService.errorFolder, filenames);
  }

  /**
   * Retry error files from file cache.
   */
  async retryErrorFiles(filenames: Array<string>): Promise<void> {
    this.logger.trace(`Retrying ${filenames.length} error files in North connector "${this.connector.name}"...`);
    await this.fileCacheService.retryErrorFiles(filenames);
  }

  /**
   * Remove all error files from file cache.
   */
  async removeAllErrorFiles(): Promise<void> {
    this.logger.trace(`Removing all error files from North connector "${this.connector.name}"...`);
    await this.fileCacheService.removeAllErrorFiles();
  }

  /**
   * Retry all error files from file cache.
   */
  async retryAllErrorFiles(): Promise<void> {
    this.logger.trace(`Retrying all error files in North connector "${this.connector.name}"...`);
    await this.fileCacheService.retryAllErrorFiles();
  }

  /**
   * Get list of cache files. Dates are in ISO format
   */
  async getCacheFiles(fromDate: string, toDate: string, fileNameContains: string): Promise<Array<NorthCacheFiles>> {
    return await this.fileCacheService.getCacheFiles(fromDate, toDate, fileNameContains);
  }

  /**
   * Get cache file content as a read stream.
   */
  async getCacheFileContent(filename: string): Promise<ReadStream | null> {
    return await this.fileCacheService.getCacheFileContent(filename);
  }

  /**
   * Remove cache files.
   */
  async removeCacheFiles(filenames: Array<string>): Promise<void> {
    this.logger.trace(`Removing ${filenames.length} cache files from North connector "${this.connector.name}"...`);
    await this.fileCacheService.removeFiles(this.fileCacheService.fileFolder, filenames);
  }

  /**
   * Move cache files into archive.
   */
  async archiveCacheFiles(filenames: Array<string>): Promise<void> {
    this.logger.trace(`Moving ${filenames.length} cache files into archive from North connector "${this.connector.name}"...`);
    for (const filename of filenames) {
      await this.archiveService.archiveOrRemoveFile(path.join(this.fileCacheService.fileFolder, filename));
      this.fileCacheService.removeFileFromQueue(path.join(this.fileCacheService.fileFolder, filename));
    }
  }

  /**
   * Get list of archive files from file cache. Dates are in ISO format
   */
  async getArchiveFiles(fromDate: string, toDate: string, fileNameContains: string): Promise<Array<NorthArchiveFiles>> {
    return await this.archiveService.getArchiveFiles(fromDate, toDate, fileNameContains);
  }

  /**
   * Get archive file content as a read stream.
   */
  async getArchiveFileContent(filename: string): Promise<ReadStream | null> {
    return await this.archiveService.getArchiveFileContent(filename);
  }

  /**
   * Remove archive files from file cache.
   */
  async removeArchiveFiles(filenames: Array<string>): Promise<void> {
    this.logger.trace(`Removing ${filenames.length} archive files from North connector "${this.connector.name}"...`);
    await this.archiveService.removeFiles(filenames);
    this.cacheSize = await dirSize(this.baseFolder);
  }

  /**
   * Retry archive files from file cache.
   */
  async retryArchiveFiles(filenames: Array<string>): Promise<void> {
    this.logger.trace(`Retrying ${filenames.length} archive files in North connector "${this.connector.name}"...`);
    await this.fileCacheService.retryFiles(this.archiveService.archiveFolder, filenames);
  }

  /**
   * Remove all archive files from file cache.
   */
  async removeAllArchiveFiles(): Promise<void> {
    this.logger.trace(`Removing all archive files from North connector "${this.connector.name}"...`);
    await this.archiveService.removeAllArchiveFiles();
  }

  /**
   * Retry all archive files from file cache.
   */
  async retryAllArchiveFiles(): Promise<void> {
    this.logger.trace(`Retrying all archive files in North connector "${this.connector.name}"...`);
    await this.fileCacheService.retryAllFiles(this.archiveService.archiveFolder);
  }

  setLogger(value: pino.Logger) {
    this.logger = value;
    this.fileCacheService.setLogger(value);
    this.valueCacheService.setLogger(value);
    this.archiveService.setLogger(value);
  }

  async resetCache(): Promise<void> {
    try {
      await this.fileCacheService.removeAllErrorFiles();
    } catch (err) {
      this.logger.error(`Error while removing error files. ${err}`);
    }
    try {
      await this.fileCacheService.removeAllCacheFiles();
    } catch (err) {
      this.logger.error(`Error while removing cache files. ${err}`);
    }
  }

  getCacheValues(fileNameContains: string): Array<NorthValueFiles> {
    return this.valueCacheService.getQueuedFilesMetadata(fileNameContains);
  }

  async removeCacheValues(filenames: Array<string>): Promise<void> {
    const sentValues = new Map<string, OIBusTimeValue[]>(
      filenames.map(filename => [path.join(this.valueCacheService.valueFolder, filename), []])
    );
    await this.valueCacheService.removeSentValues(sentValues);
  }

  async removeAllCacheValues(): Promise<void> {
    await this.valueCacheService.removeAllValues();
  }

  async getValueErrors(fromDate: string, toDate: string, fileNameContains: string): Promise<Array<NorthArchiveFiles>> {
    return await this.valueCacheService.getErrorValueFiles(fromDate, toDate, fileNameContains);
  }

  async removeValueErrors(filenames: Array<string>): Promise<void> {
    this.logger.trace(`Removing ${filenames.length} value error files from North connector "${this.connector.name}"...`);
    await this.valueCacheService.removeErrorValues(filenames);
  }

  async removeAllValueErrors(): Promise<void> {
    this.logger.trace(`Removing all value error files from North connector "${this.connector.name}"...`);
    await this.valueCacheService.removeAllErrorValues();
  }

  async retryValueErrors(filenames: Array<string>): Promise<void> {
    this.logger.trace(`Retrying ${filenames.length} value error files in North connector "${this.connector.name}"...`);
    await this.valueCacheService.retryErrorValues(filenames);
  }

  async retryAllValueErrors(): Promise<void> {
    this.logger.trace(`Retrying all value error files in North connector "${this.connector.name}"...`);
    await this.valueCacheService.retryAllErrorValues();
  }

  /**
   * Reset the items of the North connector
   */
  async onItemChange(): Promise<void> {
    this.items = this.repositoryService.northItemRepository.listNorthItems(this.connector.id, {
      enabled: true
    });
  }

  getMetricsDataStream(): PassThrough {
    return this.metricsService!.stream;
  }

  resetMetrics(): void {
    this.metricsService!.resetMetrics();
  }

  /**
   * @throws {Error} Error with a message specifying wrong settings
   */
  async testConnection(): Promise<void> {
    this.logger.warn('testConnection must be override');
  }

  async handleContent(_data: OIBusContent): Promise<void> {
    this.logger.warn('handleContent must be override');
  }

  async updateScanMode(scanMode: ScanModeDTO): Promise<void> {
    if (this.cronByScanModeIds.get(scanMode.id)) {
      this.createCronJob(scanMode);
    }
  }

  get settings(): NorthConnectorDTO<T> {
    return this.connector;
  }
}
