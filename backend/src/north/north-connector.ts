import pino from 'pino';
import { CronJob } from 'cron';
import { EventEmitter } from 'node:events';
import DeferredPromise from '../service/deferred-promise';
import { CacheMetadata, CacheSearchParam, OIBusContent } from '../../shared/model/engine.model';
import { DateTime } from 'luxon';
import { createReadStream, ReadStream } from 'node:fs';
import path from 'node:path';
import { NorthSettings } from '../../shared/model/north-settings.model';
import { delay, generateRandomId, validateCronExpression } from '../service/utils';
import { NorthConnectorEntity } from '../model/north-connector.model';
import { ScanMode } from '../model/scan-mode.model';
import { OIBusError } from '../model/engine.model';
import CacheService from '../service/cache/cache.service';
import { Readable } from 'node:stream';
import fsAsync from 'node:fs/promises';
import { createTransformer } from '../service/transformer.service';
import IgnoreTransformer from '../service/transformers/ignore-transformer';
import IsoTransformer from '../service/transformers/iso-transformer';

/**
 * Class NorthConnector: provides general attributes and methods for north connectors.
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
export default abstract class NorthConnector<T extends NorthSettings> {
  private cacheSize = {
    cacheSize: 0,
    errorSize: 0,
    archiveSize: 0
  };

  private contentBeingSent: { metadataFilename: string; metadata: CacheMetadata } | null = null;
  private errorCount = 0;

  private cronByScanModeIds: Map<string, CronJob> = new Map<string, CronJob>();
  private runProgress$: DeferredPromise | null = null;
  // The queue is needed to store the task when one is already running. For example, if we have an "Every second" task added
  // while an "Every minute" task is running, the "Every second" task while be queued and executed next, from the run method
  // through the taskRunnerEvent
  private taskJobQueue: Array<{ id: string; name: string }> = [];
  private taskRunnerEvent: EventEmitter = new EventEmitter();
  public metricsEvent: EventEmitter = new EventEmitter();

  private cacheSizeWarningHasBeenTriggered = false;
  private stopping = false;

  protected constructor(
    protected connector: NorthConnectorEntity<T>,
    protected logger: pino.Logger,
    protected cacheFolderPath: string,
    private cacheService: CacheService
  ) {
    if (this.connector.id === 'test') {
      return;
    }

    this.cacheService.cacheSizeEventEmitter.on(
      'cache-size',
      (sizeToAdd: { cacheSizeToAdd: number; errorSizeToAdd: number; archiveSizeToAdd: number }) => {
        this.cacheSize.cacheSize += sizeToAdd.cacheSizeToAdd;
        this.cacheSize.errorSize += sizeToAdd.errorSizeToAdd;
        this.cacheSize.archiveSize += sizeToAdd.archiveSizeToAdd;
        this.cacheSizeWarningHasBeenTriggered = false; // If the cache size is updated, allow the warning to trigger again
        this.metricsEvent.emit('cache-size', this.cacheSize);
      }
    );

    this.cacheService.cacheSizeEventEmitter.on(
      'init-cache-size',
      (initialCacheSize: { cacheSizeToAdd: number; errorSizeToAdd: number; archiveSizeToAdd: number }) => {
        this.cacheSize.cacheSize = initialCacheSize.cacheSizeToAdd;
        this.cacheSize.errorSize = initialCacheSize.errorSizeToAdd;
        this.cacheSize.archiveSize = initialCacheSize.archiveSizeToAdd;
        this.metricsEvent.emit('cache-size', this.cacheSize);
      }
    );
  }

  set connectorConfiguration(connectorConfiguration: NorthConnectorEntity<T>) {
    this.connector = connectorConfiguration;
  }

  get connectorConfiguration() {
    return this.connector;
  }

  async start(): Promise<void> {
    if (this.connector.id !== 'test') {
      this.taskRunnerEvent.on('run', async (taskDescription: { id: string; name: string }) => {
        await this.run(taskDescription);
      });
      this.logger.debug(`North connector "${this.connector.name}" enabled`);
    }
    this.cacheSizeWarningHasBeenTriggered = false;
    await this.cacheService.start();
    await this.connect();
  }

  isEnabled(): boolean {
    return this.connector.enabled;
  }

  /**
   * Method called by Engine to initialize a North connector. This method can be surcharged in the
   * North connector implementation to allow connection to a third party application for example.
   */
  async connect(): Promise<void> {
    if (this.connector.id !== 'test') {
      this.metricsEvent.emit('connect', {
        lastConnection: DateTime.now().toUTC().toISO()!
      });
      this.createCronJob(this.connector.caching.trigger.scanMode);
      // Check at startup if a run must be triggered
      await this.triggerRunIfNecessary(this.connector.caching.throttling.runMinDelay);
    }
    this.logger.info(`North connector "${this.connector.name}" of type ${this.connector.type} started`);
  }

  /**
   * Create a job used to populate the queue where each element of the queue is a job to call, associated to its scan mode
   */
  createCronJob(scanMode: ScanMode): void {
    const existingCronJob = this.cronByScanModeIds.get(scanMode.id);
    if (existingCronJob) {
      this.logger.debug(`Removing existing cron job associated to scan mode "${scanMode.name}" (${scanMode.cron})`);
      existingCronJob.stop();
      this.cronByScanModeIds.delete(scanMode.id);
    }
    this.logger.debug(`Creating cron job for scan mode "${scanMode.name}" (${scanMode.cron})`);
    try {
      validateCronExpression(scanMode.cron);
      const job = new CronJob(
        scanMode.cron,
        () => {
          this.addTaskToQueue.bind(this).call(this, { id: scanMode.id, name: scanMode.name });
        },
        null,
        true
      );
      this.cronByScanModeIds.set(scanMode.id, job);
    } catch (error: unknown) {
      this.logger.error(`Error when creating cron job for scan mode "${scanMode.name}" (${scanMode.cron}): ${(error as Error).message}`);
    }
  }

  addTaskToQueue(taskDescription: { id: string; name: string }): void {
    const foundJob = this.taskJobQueue.find(element => element.id === taskDescription.id);
    if (foundJob) {
      // If a job is already scheduled in queue, it will not be added
      this.logger.debug(`Task "${taskDescription.name}" is already in queue`);
      return;
    }

    this.taskJobQueue.push(taskDescription);
    if (this.taskJobQueue.length === 1) {
      // Run right away if a task job is in queue, otherwise the run method will trigger the next run
      this.taskRunnerEvent.emit('run', taskDescription);
    }
  }

  async run(taskDescription: { id: string; name: string }): Promise<void> {
    this.logger.trace(`North run triggered by task "${taskDescription.name}" (${taskDescription.id})`);
    if (this.runProgress$ || this.stopping) {
      this.logger.debug(`Task "${taskDescription.name}" not run because the connector is stopping or a run is already in progress`);
      return;
    }
    this.runProgress$ = new DeferredPromise();
    await this.handleContentWrapper();
    this.taskJobQueue.shift();
    this.runProgress$!.resolve();
    this.runProgress$ = null;
    if (this.taskJobQueue.length > 0) {
      this.taskRunnerEvent.emit('run', this.taskJobQueue[0]);
    } else {
      // If the task queue is empty, add one task if necessary, otherwise, it will be added by the cron
      await this.triggerRunIfNecessary(
        this.errorCount ? this.connector.caching.error.retryInterval : this.connector.caching.throttling.runMinDelay
      );
    }
  }

  async handleContentWrapper(): Promise<void> {
    if (!this.contentBeingSent) {
      this.contentBeingSent = await this.cacheService.getCacheContentToSend(this.connector.caching.throttling.maxNumberOfElements);
    }
    if (!this.contentBeingSent) {
      return;
    }
    const runStart = DateTime.now();
    try {
      // Transform content filename into a full path of a file to ease the treatment in each north connector
      const contentToSend: {
        metadataFilename: string;
        metadata: CacheMetadata;
      } = JSON.parse(JSON.stringify(this.contentBeingSent));
      contentToSend.metadata.contentFile = path.join(
        this.cacheService.cacheFolder,
        this.cacheService.CONTENT_FOLDER,
        contentToSend.metadata.contentFile
      );
      this.metricsEvent.emit('run-start', {
        lastRunStart: runStart.toUTC().toISO()!
      });
      await this.handleContent(contentToSend.metadata);
      if (this.connector.caching.archive.enabled) {
        await this.cacheService.moveCacheContent('cache', 'archive', this.contentBeingSent!);
        this.metricsEvent.emit('run-end', {
          lastRunDuration: DateTime.now().toMillis() - runStart.toMillis(),
          metadata: this.contentBeingSent!.metadata,
          action: 'archived'
        });
      } else {
        await this.cacheService.removeCacheContent('cache', this.contentBeingSent!);
        this.metricsEvent.emit('run-end', {
          lastRunDuration: DateTime.now().toMillis() - runStart.toMillis(),
          metadata: this.contentBeingSent!.metadata,
          action: 'sent'
        });
      }
      this.contentBeingSent = null;
      this.errorCount = 0;
    } catch (error: unknown) {
      const oibusError = this.createOIBusError(error);
      this.logger.error(
        `Could not send content "${JSON.stringify(this.contentBeingSent)}" (${this.errorCount}). Error: ${oibusError.message}`
      );
      this.metricsEvent.emit('run-end', {
        lastRunDuration: DateTime.now().toMillis() - runStart.toMillis(),
        metadata: this.contentBeingSent!.metadata,
        action: 'errored'
      });
      this.errorCount += 1;
      if (!oibusError.retry && this.errorCount > this.connector.caching.error.retryCount) {
        this.logger.warn(`Moving content into error after ${this.errorCount} errors`);
        await this.cacheService.moveCacheContent('cache', 'error', this.contentBeingSent!);
        this.metricsEvent.emit('content-errored', {
          filename: this.contentBeingSent!.metadata.contentFile,
          size: this.contentBeingSent!.metadata.contentSize
        });
        this.contentBeingSent = null;
        this.errorCount = 0;
      }
    }
  }

  /**
   * Create an OIBusError from an unknown error thrown by the handleFile or handleValues connector method
   * The error thrown can be overridden with an OIBusError to force a retry on specific cases
   */
  createOIBusError(error: unknown): OIBusError {
    if (typeof error === 'object' && error !== null && '_isOIBusError' in error) {
      return error as OIBusError;
    } else if (error instanceof Error) {
      return new OIBusError(error.message, false);
    } else if (typeof error === 'string') {
      return new OIBusError(error, false);
    } else {
      return new OIBusError(JSON.stringify(error), false);
    }
  }

  async cacheContent(data: OIBusContent, source: string): Promise<void> {
    const cacheSize = this.cacheSize.cacheSize + this.cacheSize.errorSize + this.cacheSize.archiveSize;
    if (this.connector.caching.throttling.maxSize !== 0 && cacheSize >= this.connector.caching.throttling.maxSize * 1024 * 1024) {
      if (!this.cacheSizeWarningHasBeenTriggered) {
        this.logger.warn(
          `North cache is exceeding the maximum allowed size (${Math.floor((cacheSize / 1024 / 1024) * 100) / 100} MB >= ${this.connector.caching.throttling.maxSize} MB). Values will be discarded until the cache is emptied (by sending files/values or manual removal)`
        );
        this.cacheSizeWarningHasBeenTriggered = true;
      }
      return;
    }

    const transformerWithOptions = this.connector.transformers.find(element => element.inputType === data.type);
    if (!transformerWithOptions) {
      if (!this.supportedTypes().includes(data.type)) {
        this.logger.trace(`Data type "${data.type}" not supported by the connector. Data will be ignored.`);
      } else {
        await this.cacheWithoutTransform(data, source);
        // No delay needed here, we check for trigger right now, once the cache is updated
        await this.triggerRunIfNecessary(0);
      }
      return;
    }
    if (
      transformerWithOptions &&
      transformerWithOptions.transformer.type === 'standard' &&
      transformerWithOptions.transformer.functionName === IgnoreTransformer.transformerName
    ) {
      this.logger.trace(`Ignoring data of type ${data.type}`);
      return;
    }

    // Iso data
    if (
      transformerWithOptions.transformer.type === 'standard' &&
      transformerWithOptions.transformer.functionName === IsoTransformer.transformerName
    ) {
      await this.cacheWithoutTransform(data, source);
      // No delay needed here, we check for trigger right now, once the cache is updated
      await this.triggerRunIfNecessary(0);
      return;
    }

    // Transform data
    this.logger.trace(
      `Transforming data of type ${data.type} into ${transformerWithOptions.transformer.outputType} type with transformer ${transformerWithOptions.transformer.id}`
    );
    const transformer = createTransformer(transformerWithOptions, this.connector, this.logger);
    switch (data.type) {
      case 'time-values':
        if (this.connector.caching.throttling.maxNumberOfElements > 0) {
          for (let i = 0; i < data.content.length; i += this.connector.caching.throttling.maxNumberOfElements) {
            const chunks: Array<object> = data.content.slice(i, i + this.connector.caching.throttling.maxNumberOfElements);
            const { metadata, output } = await transformer.transform(Readable.from(JSON.stringify(chunks)), source, null);
            await this.persistDataInCache(metadata, output);
          }
        } else {
          const { metadata, output } = await transformer.transform(Readable.from(JSON.stringify(data.content)), source, null);
          await this.persistDataInCache(metadata, output);
        }
        break;
      case 'setpoint':
        {
          const { metadata, output } = await transformer.transform(Readable.from(JSON.stringify(data.content)), source, null);
          await this.persistDataInCache(metadata, output);
        }
        break;
      case 'any':
        // Use a random ID to be sure to have a unique filename
        const randomId = generateRandomId(10);
        const cacheFilename = `${path.parse(data.filePath).name}-${randomId}${path.parse(data.filePath).ext}`;
        const { metadata, output } = await transformer.transform(createReadStream(data.filePath), source, cacheFilename);
        await this.persistDataInCache(metadata, output);
        break;
    }

    // No delay needed here, we check for trigger right now, once the cache is updated
    await this.triggerRunIfNecessary(0);
  }

  private async cacheWithoutTransform(data: OIBusContent, source: string) {
    if (data.type === 'any') {
      const randomId = generateRandomId(10);
      const cacheFilename = `${path.parse(data.filePath).name}-${randomId}${path.parse(data.filePath).ext}`;
      await this.persistDataInCache(
        {
          contentFile: cacheFilename,
          contentSize: 0,
          createdAt: '',
          numberOfElement: 0,
          contentType: data.type,
          source,
          options: {}
        },
        createReadStream(data.filePath)
      );
    } else {
      if (this.connector.caching.throttling.maxNumberOfElements > 0) {
        for (let i = 0; i < data.content.length; i += this.connector.caching.throttling.maxNumberOfElements) {
          const chunks: Array<object> = data.content.slice(i, i + this.connector.caching.throttling.maxNumberOfElements);
          const randomId = generateRandomId(10);
          await this.persistDataInCache(
            {
              contentFile: randomId,
              contentSize: 0,
              createdAt: '',
              numberOfElement: chunks.length,
              contentType: data.type,
              source,
              options: {}
            },
            Readable.from(JSON.stringify(chunks))
          );
        }
      } else {
        const randomId = generateRandomId(10);
        await this.persistDataInCache(
          {
            contentFile: randomId,
            contentSize: 0,
            createdAt: '',
            numberOfElement: data.content.length,
            contentType: data.type,
            source,
            options: {}
          },
          Readable.from(JSON.stringify(data.content))
        );
      }
    }
  }

  async persistDataInCache(metadata: CacheMetadata, output: string | ReadStream | Readable) {
    await fsAsync.writeFile(path.join(this.cacheService.cacheFolder, this.cacheService.CONTENT_FOLDER, metadata.contentFile), output, {
      encoding: 'utf-8',
      flag: 'w'
    });
    const fileStat = await fsAsync.stat(path.join(this.cacheService.cacheFolder, this.cacheService.CONTENT_FOLDER, metadata.contentFile));
    metadata.contentSize = fileStat.size;
    metadata.createdAt = DateTime.fromMillis(fileStat.ctimeMs).toUTC().toISO()!;
    const metadataFilename = `${generateRandomId(10)}.json`;
    await fsAsync.writeFile(
      path.join(this.cacheService.cacheFolder, this.cacheService.METADATA_FOLDER, metadataFilename),
      JSON.stringify(metadata),
      {
        encoding: 'utf-8',
        flag: 'w'
      }
    );
    this.cacheService.addCacheContentToQueue({ metadataFilename, metadata });
    this.metricsEvent.emit('cache-content-size', fileStat.size);
  }

  isCacheEmpty(): boolean {
    return this.cacheService.cacheIsEmpty();
  }

  async searchCacheContent(
    searchParams: CacheSearchParam,
    folder: 'cache' | 'archive' | 'error'
  ): Promise<Array<{ metadataFilename: string; metadata: CacheMetadata }>> {
    return await this.cacheService.searchCacheContent(searchParams, folder);
  }

  async metadataFileListToCacheContentList(folder: 'cache' | 'archive' | 'error', metadataFilenameList: Array<string>) {
    return await this.cacheService.metadataFileListToCacheContentList(folder, metadataFilenameList);
  }

  async getCacheContentFileStream(folder: 'cache' | 'archive' | 'error', filename: string): Promise<ReadStream | null> {
    return await this.cacheService.getCacheContentFileStream(folder, filename);
  }

  async removeCacheContent(
    folder: 'cache' | 'archive' | 'error',
    cacheContentList: Array<{ metadataFilename: string; metadata: CacheMetadata }>
  ): Promise<void> {
    for (const cacheContent of cacheContentList) {
      await this.cacheService.removeCacheContent(folder, cacheContent);
    }
  }

  async removeAllCacheContent(folder: 'cache' | 'archive' | 'error'): Promise<void> {
    await this.cacheService.removeAllCacheContent(folder);
  }

  async moveCacheContent(
    originFolder: 'cache' | 'archive' | 'error',
    destinationFolder: 'cache' | 'archive' | 'error',
    cacheContentList: Array<{ metadataFilename: string; metadata: CacheMetadata }>
  ): Promise<void> {
    for (const cacheContent of cacheContentList) {
      await this.cacheService.moveCacheContent(originFolder, destinationFolder, cacheContent);
    }
  }

  async moveAllCacheContent(originFolder: 'cache' | 'archive' | 'error', destinationFolder: 'cache' | 'archive' | 'error'): Promise<void> {
    await this.cacheService.moveAllCacheContent(originFolder, destinationFolder);
  }

  /**
   * Check whether the North is subscribed to a South.
   * If subscribedTo is not defined or an empty array, the subscription is true.
   */
  isSubscribed(southId: string): boolean {
    return this.connector.subscriptions.length === 0 || this.connector.subscriptions.some(south => south.id === southId);
  }

  /**
   * Method called by Engine to stop a North connector. This method can be surcharged in the
   * North connector implementation to allow disconnecting to a third party application for example.
   */
  async disconnect(): Promise<void> {
    this.logger.info(`"${this.connector.name}" (${this.connector.id}) disconnected`);
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.logger.debug(`Stopping "${this.connector.name}" (${this.connector.id})...`);
    this.taskRunnerEvent.removeAllListeners();

    if (this.runProgress$) {
      this.logger.debug('Waiting for task to finish');
      await this.runProgress$.promise;
    }

    for (const cronJob of this.cronByScanModeIds.values()) {
      cronJob.stop();
    }
    this.cronByScanModeIds.clear();
    this.taskJobQueue = [];

    await this.disconnect();

    this.stopping = false;
    this.logger.info(`"${this.connector.name}" stopped`);
  }

  setLogger(value: pino.Logger) {
    this.logger = value;
    this.cacheService.setLogger(value);
  }

  async resetCache(): Promise<void> {
    await this.cacheService.removeAllCacheContent('cache');
    await this.cacheService.removeAllCacheContent('error');
    await this.cacheService.removeAllCacheContent('archive');
  }

  async updateScanMode(scanMode: ScanMode): Promise<void> {
    if (this.cronByScanModeIds.get(scanMode.id)) {
      this.createCronJob(scanMode);
    }
  }

  private async triggerRunIfNecessary(timeToWait: number): Promise<void> {
    if (timeToWait) {
      await delay(timeToWait);
    }
    // If the connector is stopping during the time the process was waiting, it must exit
    if (this.stopping) {
      return;
    }

    if (this.errorCount > 0) {
      this.addTaskToQueue({ id: 'retry', name: `Retry content after ${this.errorCount} errors` });
      return;
    }

    // Trigger because a file is in the queue and it must be sent immediately
    const numberOfFiles = this.cacheService.getNumberOfRawFilesInQueue();
    if (numberOfFiles >= this.connector.caching.trigger.numberOfFiles && this.connector.caching.trigger.numberOfFiles > 0) {
      this.addTaskToQueue({ id: 'limit-reach', name: `${numberOfFiles} files in queue, sending it immediately` });
      return;
    }
    // Trigger because a group count is reach
    const numberOfElement = this.cacheService.getNumberOfElementsInQueue();
    if (numberOfElement >= this.connector.caching.trigger.numberOfElements && this.connector.caching.trigger.numberOfElements > 0) {
      this.addTaskToQueue({
        id: 'limit-reach',
        name: `Limit reach: ${numberOfElement} elements in queue >= ${this.connector.caching.trigger.numberOfElements}`
      });
      return;
    }
  }

  abstract testConnection(): Promise<void>;

  abstract handleContent(cacheMetadata: CacheMetadata): Promise<void>;

  abstract supportedTypes(): Array<string>;
}
