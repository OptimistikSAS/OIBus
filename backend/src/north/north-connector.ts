import pino from 'pino';
import { CronJob } from 'cron';
import { EventEmitter } from 'node:events';
import DeferredPromise from '../service/deferred-promise';
import {
  CacheContentUpdateCommand,
  CacheMetadata,
  CacheMetadataSource,
  CacheSearchParam,
  CacheSearchResult,
  DataFolderType,
  FileCacheContent,
  OIBusConnectionTestResult,
  OIBusContent
} from '../../shared/model/engine.model';
import { DateTime } from 'luxon';
import { createReadStream, ReadStream } from 'node:fs';
import path from 'node:path';
import { NorthSettings } from '../../shared/model/north-settings.model';
import { createOIBusError, delay, generateRandomId, validateCronExpression } from '../service/utils';
import { NorthConnectorEntity } from '../model/north-connector.model';
import { ScanMode } from '../model/scan-mode.model';
import CacheService from '../service/cache/cache.service';
import { Readable } from 'node:stream';
import { createTransformer } from '../service/transformer.service';
import IgnoreTransformer from '../transformers/ignore-transformer';
import IsoTransformer from '../transformers/iso-transformer';
import { NorthTransformerWithOptions } from '../model/transformer.model';
import { CONTENT_FOLDER } from '../model/engine.model';

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
  private contentBeingSent: { filename: string; metadata: CacheMetadata } | null = null;
  private errorCount = 0;

  private cronByScanModeIds: Map<string, CronJob> = new Map<string, CronJob>();
  private runProgress$: DeferredPromise | null = null;
  // The queue is needed to store the task when one is already running. For example, if we have an "Every second" task added
  // while an "Every minute" task is running, the "Every second" task while be queued and executed next, from the run method
  // through the taskRunnerEvent
  private taskJobQueue: Array<{ id: string; name: string }> = [];
  private taskRunnerEvent: EventEmitter = new EventEmitter();
  public metricsEvent: EventEmitter = new EventEmitter();

  private stopping = false;

  protected constructor(
    protected connector: NorthConnectorEntity<T>,
    protected logger: pino.Logger,
    private cacheService: CacheService
  ) {}

  private onCacheSize = (cacheSize: { cache: number; error: number; archive: number }) => {
    this.metricsEvent.emit('cache-size', cacheSize);
  };

  set connectorConfiguration(connectorConfiguration: NorthConnectorEntity<T>) {
    this.connector = connectorConfiguration;
  }

  get connectorConfiguration() {
    return this.connector;
  }

  async start(): Promise<void> {
    this.cacheService.cacheSizeEventEmitter.on('cache-size', this.onCacheSize);
    this.taskRunnerEvent.on('run', async (taskDescription: { id: string; name: string }) => {
      await this.run(taskDescription);
    });
    this.logger.debug(`North connector "${this.connector.name}" enabled`);
    await this.cacheService.start();
    if (this.isEnabled()) {
      await this.connect();
    }
  }

  isEnabled(): boolean {
    return this.connector.enabled;
  }

  /**
   * Method called by Engine to initialize a North connector. This method can be surcharged in the
   * North connector implementation to allow connection to a third party application for example.
   */
  async connect(): Promise<void> {
    this.metricsEvent.emit('connect', {
      lastConnection: DateTime.now().toUTC().toISO()!
    });
    this.createCronJob(this.connector.caching.trigger.scanMode);
    // Check at startup if a run must be triggered
    await this.triggerRunIfNecessary(this.connector.caching.throttling.runMinDelay);

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

    // Transform content filename into a full path of a file to ease the treatment in each north connector
    const contentToSend: {
      filename: string;
      metadata: CacheMetadata;
    } = JSON.parse(JSON.stringify(this.contentBeingSent));
    this.metricsEvent.emit('run-start', {
      lastRunStart: runStart.toUTC().toISO()!
    });

    if (!this.supportedTypes().includes(contentToSend.metadata.contentType)) {
      this.logger.error(`Unsupported data type: ${contentToSend.metadata.contentType} (file ${contentToSend.filename})`);
      this.metricsEvent.emit('run-end', {
        lastRunDuration: DateTime.now().toMillis() - runStart.toMillis(),
        metadata: contentToSend.metadata,
        action: 'errored'
      });
      await this.manageErrorContent(contentToSend);
      this.contentBeingSent = null;
      this.errorCount = 0;
      return;
    }
    const fileStream = createReadStream(path.join(this.getCacheFolder(), CONTENT_FOLDER, contentToSend.filename));
    try {
      await this.handleContent(fileStream, contentToSend.metadata);
      fileStream.close();
      if (this.connector.caching.archive.enabled) {
        await this.cacheService.updateCacheContent({
          cache: {
            remove: [],
            move: [{ to: 'archive', filename: contentToSend.filename }]
          },
          archive: { remove: [], move: [] },
          error: { remove: [], move: [] }
        });
        this.metricsEvent.emit('run-end', {
          lastRunDuration: DateTime.now().toMillis() - runStart.toMillis(),
          metadata: contentToSend.metadata,
          action: 'archived'
        });
      } else {
        await this.cacheService.updateCacheContent({
          cache: { remove: [contentToSend.filename], move: [] },
          archive: { remove: [], move: [] },
          error: { remove: [], move: [] }
        });
        this.metricsEvent.emit('run-end', {
          lastRunDuration: DateTime.now().toMillis() - runStart.toMillis(),
          metadata: contentToSend.metadata,
          action: 'sent'
        });
      }
    } catch (error: unknown) {
      fileStream.close();
      const oibusError = createOIBusError(error);
      this.logger.error(`Could not send content "${JSON.stringify(contentToSend)}" (${this.errorCount}). Error: ${oibusError.message}`);
      this.metricsEvent.emit('run-end', {
        lastRunDuration: DateTime.now().toMillis() - runStart.toMillis(),
        metadata: contentToSend.metadata,
        action: 'errored'
      });
      this.errorCount += 1;
      if (!oibusError.forceRetry && this.errorCount > this.connector.caching.error.retryCount) {
        this.logger.warn(`Moving content into error after ${this.errorCount} errors`);
        await this.manageErrorContent(this.contentBeingSent!);
      }
    } finally {
      this.contentBeingSent = null;
      this.errorCount = 0;
    }
  }

  private async manageErrorContent(content: { filename: string; metadata: CacheMetadata }) {
    await this.cacheService.updateCacheContent({
      cache: {
        remove: [],
        move: [{ to: 'error', filename: content.filename }]
      },
      error: {
        remove: [],
        move: []
      },
      archive: {
        remove: [],
        move: []
      }
    });
    this.metricsEvent.emit('content-errored', {
      filename: content.metadata.contentFile,
      size: content.metadata.contentSize
    });
  }

  async cacheContent(data: OIBusContent, source: CacheMetadataSource): Promise<void> {
    if (this.cacheService.cacheIsFull(this.connector.caching.throttling.maxSize)) {
      return;
    }

    const transformerConfig = this.findTransformer(data, source);
    if (!transformerConfig) {
      return this.handleNoTransformer(data);
    }

    if (
      transformerConfig.transformer.type === 'standard' &&
      transformerConfig.transformer.functionName === IgnoreTransformer.transformerName
    ) {
      this.logger.trace(`Ignoring data of type ${data.type}`);
      return;
    }

    if (
      transformerConfig.transformer.type === 'standard' &&
      transformerConfig.transformer.functionName === IsoTransformer.transformerName
    ) {
      return this.cacheWithoutTransformAndTrigger(data);
    }

    this.logger.trace(
      `Transforming data of type ${data.type} into ${transformerConfig.transformer.outputType} using transformer ${transformerConfig.transformer.id}`
    );
    await this.executeTransformation(data, transformerConfig, source);

    // No delay needed here, we check for trigger right now, once the cache is updated
    await this.triggerRunIfNecessary(0);
  }

  private findTransformer(data: OIBusContent, metadataSource: CacheMetadataSource): NorthTransformerWithOptions | undefined {
    // First check with south id (most specific)
    let transformerWithOptions: NorthTransformerWithOptions | undefined;
    if (metadataSource.source === 'south') {
      transformerWithOptions = this.connector.transformers.find(element => {
        // first check input type, south and items
        return (
          element.inputType &&
          element.south &&
          element.items.length &&
          element.inputType === data.type &&
          element.south.id === metadataSource.southId &&
          metadataSource.items.some(itemMetadata => element.items.find(item => item.id === itemMetadata.id))
        );
      });

      // then check input type and south
      if (!transformerWithOptions) {
        transformerWithOptions = this.connector.transformers.find(element => {
          return (
            element.inputType &&
            element.south &&
            !element.items.length &&
            element.inputType === data.type &&
            element.south.id === metadataSource.southId
          );
        });
      }

      // last check input type
      if (!transformerWithOptions) {
        transformerWithOptions = this.connector.transformers.find(element => {
          return element.inputType && !element.south && !element.items.length && element.inputType === data.type;
        });
      }
    } else {
      // case oianalytics, api or test
      transformerWithOptions = this.connector.transformers.find(element => {
        return element.inputType === data.type && !element.south && !element.items.length;
      });
    }

    return transformerWithOptions;
  }

  private async handleNoTransformer(data: OIBusContent): Promise<void> {
    if (!this.supportedTypes().includes(data.type)) {
      this.logger.trace(`Data type "${data.type}" not supported by the connector. Data will be ignored.`);
      return;
    }
    await this.cacheWithoutTransformAndTrigger(data);
  }

  private async cacheWithoutTransformAndTrigger(data: OIBusContent): Promise<void> {
    await this.cacheWithoutTransform(data);
    await this.triggerRunIfNecessary(0);
  }

  private async executeTransformation(data: OIBusContent, config: NorthTransformerWithOptions, source: CacheMetadataSource): Promise<void> {
    const transformer = createTransformer(config, this.connector, this.logger);

    switch (data.type) {
      case 'time-values':
        {
          const maxElements = this.connector.caching.throttling.maxNumberOfElements;
          const content = data.content;

          if (maxElements > 0 && content.length > maxElements) {
            // Chunk processing
            for (let i = 0; i < content.length; i += maxElements) {
              const chunk = content.slice(i, i + maxElements);
              const { metadata, output } = await transformer.transform(Readable.from(JSON.stringify(chunk)), source, null);
              await this.cacheService.addCacheContent(output, {
                contentType: metadata.contentType,
                contentFilename: metadata.contentFile,
                numberOfElement: metadata.numberOfElement
              });
            }
          } else {
            // Single batch
            const { metadata, output } = await transformer.transform(Readable.from(JSON.stringify(content)), source, null);
            await this.cacheService.addCacheContent(output, {
              contentType: metadata.contentType,
              contentFilename: metadata.contentFile,
              numberOfElement: metadata.numberOfElement
            });
          }
        }
        break;

      case 'setpoint':
        {
          const { metadata, output } = await transformer.transform(Readable.from(JSON.stringify(data.content)), source, null);
          await this.cacheService.addCacheContent(output, {
            contentType: metadata.contentType,
            contentFilename: metadata.contentFile,
            numberOfElement: metadata.numberOfElement
          });
        }
        break;
      case 'any-content':
        {
          const { metadata, output } = await transformer.transform(Readable.from(data.content), source, null);
          await this.cacheService.addCacheContent(output, {
            contentType: metadata.contentType,
            contentFilename: metadata.contentFile,
            numberOfElement: metadata.numberOfElement
          });
        }
        break;

      case 'any':
        {
          const randomId = generateRandomId(10);
          const { name, ext } = path.parse(data.filePath);
          const cacheFilename = `${name}-${randomId}${ext}`;

          const { metadata, output } = await transformer.transform(createReadStream(data.filePath), source, cacheFilename);
          await this.cacheService.addCacheContent(output, {
            contentType: metadata.contentType,
            contentFilename: metadata.contentFile,
            numberOfElement: metadata.numberOfElement
          });
        }
        break;
    }
  }

  private async cacheWithoutTransform(data: OIBusContent) {
    if (data.type === 'any') {
      await this.cacheService.addCacheContent(createReadStream(data.filePath), {
        contentType: data.type,
        contentFilename: data.filePath
      });
    } else if (data.type === 'any-content') {
      await this.cacheService.addCacheContent(Readable.from(data.content), {
        contentType: data.type
      });
    } else {
      if (this.connector.caching.throttling.maxNumberOfElements > 0) {
        for (let i = 0; i < data.content.length; i += this.connector.caching.throttling.maxNumberOfElements) {
          const chunks: Array<object> = data.content.slice(i, i + this.connector.caching.throttling.maxNumberOfElements);
          await this.cacheService.addCacheContent(Readable.from(JSON.stringify(data.content)), {
            contentType: data.type,
            numberOfElement: chunks.length
          });
        }
      } else {
        await this.cacheService.addCacheContent(Readable.from(JSON.stringify(data.content)), {
          contentType: data.type,
          numberOfElement: data.content.length
        });
      }
    }
  }

  isCacheEmpty(): boolean {
    return this.cacheService.cacheIsEmpty();
  }

  async searchCacheContent(searchParams: CacheSearchParam): Promise<Omit<CacheSearchResult, 'metrics'>> {
    return await this.cacheService.searchCacheContent(searchParams);
  }

  async getFileFromCache(folder: DataFolderType, filename: string): Promise<FileCacheContent> {
    return await this.cacheService.getFileFromCache(folder, filename);
  }

  async updateCacheContent(updateCommand: CacheContentUpdateCommand): Promise<void> {
    await this.cacheService.updateCacheContent(updateCommand);
  }

  /**
   * Method called by Engine to stop a North connector. This method can be surcharged in the
   * North connector implementation to allow disconnecting to a third party application for example.
   */
  async disconnect(): Promise<void> {
    this.cacheService.stop();
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
    await this.cacheService.removeAllCacheContent();
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

  abstract supportedTypes(): Array<string>;

  abstract testConnection(): Promise<OIBusConnectionTestResult>;

  abstract handleContent(fileStream: ReadStream, cacheMetadata: CacheMetadata): Promise<void>;

  protected getCacheFolder() {
    return this.cacheService.cacheFolder;
  }
}
