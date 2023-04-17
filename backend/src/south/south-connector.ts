import path from 'node:path';
import { EventEmitter } from 'node:events';
import { CronJob } from 'cron';
import { delay, generateIntervals } from '../service/utils';

import { OibusItemCommandDTO, OibusItemDTO, SouthConnectorDTO, SouthConnectorManifest } from '../../../shared/model/south-connector.model';
import { ScanModeDTO } from '../../../shared/model/scan-mode.model';
import { Instant } from '../../../shared/model/types';
import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import ProxyService from '../service/proxy.service';
import RepositoryService from '../service/repository.service';
import DeferredPromise from '../service/deferred-promise';
import { DateTime } from 'luxon';
import SouthCacheService from '../service/south-cache.service';

/**
 * Class SouthConnector : provides general attributes and methods for south connectors.
 * Building a new South connector means to extend this class, and to surcharge the following methods:
 * - **historyQuery**: receives a scanMode, a startTime and an endTime. Interval split can occur in this class. The
 * main logic must be developed in the surcharged method.
 * - **lastPointQuery**: receives a scanMode. The main logic must be developed in the surcharged method.
 * - **fileQuery**:  receives a scanMode. The main logic must be developed in the surcharged method.
 * - **subscribe**: A special scanMode is used (for example with MQTT). In this configuration, the driver will be able
 * to "listen" for updated values.
 * - **connect** (optional): to establish proper connection to the South connector
 * - **disconnect** (optional): to disconnect
 *
 * In addition, it is possible to use a number of helper functions:
 * - **addValues**: is an **important** method to be used when retrieving values. This will allow to push an array
 * of values to the engine to cache them
 * - **addFile**: is the equivalent of addValues but for a file.
 * - **logger**: to log an event with different levels (error,warning,info,debug,trace).
 *
 * All other operations (cache, store&forward, communication to North connectors) will be handled by the OIBus engine
 * and should not be taken care at the South level.
 */
export default class SouthConnector {
  protected itemsByScanModeIds: Map<string, Map<string, OibusItemDTO>> = new Map<string, Map<string, OibusItemDTO>>();
  private taskJobQueue: Array<ScanModeDTO> = [];
  private cronByScanModeIds: Map<string, CronJob> = new Map<string, CronJob>();
  private taskRunner: EventEmitter = new EventEmitter();
  private stopping = false;
  private runProgress$: DeferredPromise | null = null;

  protected southCacheService: SouthCacheService;

  /**
   * Constructor for SouthConnector
   */
  constructor(
    protected configuration: SouthConnectorDTO,
    items: Array<OibusItemDTO>,
    private engineAddValuesCallback: (southId: string, values: Array<any>) => Promise<void>,
    private engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    protected readonly encryptionService: EncryptionService,
    protected readonly proxyService: ProxyService,
    private readonly repositoryService: RepositoryService,
    protected logger: pino.Logger,
    protected readonly baseFolder: string,
    private readonly streamMode: boolean,
    private manifest: SouthConnectorManifest
  ) {
    items
      .filter(item => item.scanModeId)
      .forEach(item => {
        if (!this.itemsByScanModeIds.get(item.scanModeId!)) {
          this.itemsByScanModeIds.set(item.scanModeId!, new Map<string, OibusItemDTO>());
        }
        this.itemsByScanModeIds.get(item.scanModeId!)!.set(item.id, item);
      });

    this.southCacheService = new SouthCacheService(path.resolve(this.baseFolder, 'cache.db'));
    if (this.manifest.modes.historyFile || this.manifest.modes.historyPoint) {
      this.southCacheService.createCacheHistoryTable();
    }

    if (this.streamMode) {
      this.taskRunner.on('next', async () => {
        if (this.taskJobQueue.length > 0) {
          await this.run(this.taskJobQueue[0]);
        } else {
          this.logger.trace('No more task to run');
        }
      });
    }
  }

  async start(): Promise<void> {
    this.logger.trace(`South connector ${this.configuration.name} enabled. Starting services...`);
    await this.connect();
  }

  async connect(): Promise<void> {
    if (!this.streamMode) {
      return;
    }
    if (this.manifest.modes.subscription) {
      const items = Array.from(this.itemsByScanModeIds.get('subscription') || new Map(), ([_scanModeId, item]) => item);
      this.logger.debug(`Subscribing to ${items.length} items`);
      await this.subscribe(items);
    }

    for (const scanModeId of this.itemsByScanModeIds.keys()) {
      if (scanModeId === 'subscription') {
        continue;
      }
      const scanMode = this.repositoryService.scanModeRepository.getScanMode(scanModeId);
      if (!scanMode) {
        this.logger.error(`Scan mode ${scanModeId} not found`);
      } else {
        if (scanMode.id !== 'subscription' && scanMode.id !== 'history') {
          this.createCronJob(scanMode);
        }
      }
    }
  }

  isEnabled(): boolean {
    return this.configuration.enabled;
  }

  /**
   * Create a job used to populate the queue where each element of the queue is a job to call, associated to its scan mode
   */
  createCronJob(scanMode: ScanModeDTO): void {
    const existingCronJob = this.cronByScanModeIds.get(scanMode.id);
    if (existingCronJob) {
      this.logger.debug(`Removing existing South cron job associated to scan mode "${scanMode.name}" (${scanMode.cron})`);
      existingCronJob.stop();
      this.cronByScanModeIds.delete(scanMode.id);
    }
    this.logger.debug(`Creating South cron job for scan mode "${scanMode.name}" (${scanMode.cron})`);
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
      this.logger.warn(`Task job not added in South connector queue for cron "${scanMode.name}" (${scanMode.cron})`);
      return;
    }

    this.taskJobQueue.push(scanMode);
    if (this.taskJobQueue.length === 1) {
      this.taskRunner.emit('next');
    }
  }

  async run(scanMode: ScanModeDTO): Promise<void> {
    if (this.runProgress$) {
      this.logger.warn(`A South task is already running with scan mode ${scanMode.name}`);
      return;
    }

    const items = Array.from(this.itemsByScanModeIds.get(scanMode.id) || new Map(), ([_scanModeId, item]) => item);
    this.logger.trace(`Running South with scan mode ${scanMode.name} and ${items.length} items`);
    this.createDeferredPromise();

    if (this.manifest.modes.historyFile || this.manifest.modes.historyPoint) {
      try {
        // By default, retrieve the last hour. If the scan mode has already run, and retrieve a data, the max instant will
        // be retrieved from the South cache inside the history query handler
        await this.historyQueryHandler(
          items,
          DateTime.now()
            .minus(3600 * 1000)
            .toUTC()
            .toISO(),
          DateTime.now().toUTC().toISO(),
          scanMode.id
        );
      } catch (error) {
        this.logger.error(`Error when calling historyQuery ${error}`);
      }
    }
    if (this.manifest.modes.lastFile && this.streamMode) {
      try {
        await this.fileQuery(items);
      } catch (error) {
        this.logger.error(`Error when calling fileQuery ${error}`);
      }
    }
    if (this.manifest.modes.lastPoint && this.streamMode) {
      try {
        await this.lastPointQuery(items);
      } catch (error) {
        this.logger.error(`Error when calling lastPointQuery ${error}`);
      }
    }

    this.resolveDeferredPromise();

    if (!this.stopping) {
      this.taskJobQueue.shift();
      this.taskRunner.emit('next');
    }
  }

  /**
   * Methode used to set the runProgress$ variable with a DeferredPromise
   * This allows to call historyQueryHandler from outside (like history query engine) in a blocking way for other
   * calls
   */
  createDeferredPromise(): void {
    this.runProgress$ = new DeferredPromise();
  }

  /**
   * Method used to resolve and unset the DeferredPromise kept in the runProgress$ variable
   * This allows to control the promise from an outside class (like history query engine)
   */
  resolveDeferredPromise(): void {
    if (this.runProgress$) {
      this.runProgress$.resolve();
      this.runProgress$ = null;
    }
  }

  async historyQueryHandler(items: Array<OibusItemDTO>, startTime: Instant, endTime: Instant, scanModeId: string): Promise<void> {
    const southCache = this.southCacheService.getSouthCache(scanModeId, startTime);

    // maxReadInterval will divide a huge request (for example 1 year of data) into smaller
    // requests. For example only one hour if maxReadInterval is 3600 (in s)
    const intervals = generateIntervals(southCache.maxInstant, endTime, this.configuration.settings.maxReadInterval);

    if (intervals.length > 2) {
      this.logger.trace(
        `Interval split in ${intervals.length} sub-intervals: \r\n` +
          `[${JSON.stringify(intervals[0], null, 2)}\r\n` +
          `${JSON.stringify(intervals[1], null, 2)}\r\n` +
          '...\r\n' +
          `${JSON.stringify(intervals[intervals.length - 1], null, 2)}]`
      );
    } else if (intervals.length === 2) {
      this.logger.trace(
        `Interval split in ${intervals.length} sub-intervals: \r\n` +
          `[${JSON.stringify(intervals[0], null, 2)}\r\n` +
          `${JSON.stringify(intervals[1], null, 2)}]`
      );
    } else {
      this.logger.trace(`Querying interval: ${JSON.stringify(intervals[0], null, 2)}`);
    }

    for (const [index, interval] of intervals.entries()) {
      const lastInstantRetrieved = await this.historyQuery(items, interval.start, interval.end);

      if (index !== intervals.length - 1) {
        this.southCacheService.createOrUpdateCacheScanMode({
          scanModeId: southCache.scanModeId,
          maxInstant: lastInstantRetrieved,
          intervalIndex: index + southCache.intervalIndex
        });
        if (this.stopping) {
          this.logger.debug(`Connector is stopping. Exiting history query at interval ${index}: [${interval.start}, ${interval.end}]`);
          return;
        }
        await delay(this.configuration.settings.readIntervalDelay);
      } else {
        this.southCacheService.createOrUpdateCacheScanMode({
          scanModeId: southCache.scanModeId,
          maxInstant: lastInstantRetrieved,
          intervalIndex: 0
        });
      }
    }
  }

  async historyQuery(items: Array<OibusItemDTO>, startTime: Instant, endTime: Instant): Promise<Instant> {
    this.logger.warn('historyQuery method must be override');
    return '';
  }

  async fileQuery(items: Array<OibusItemDTO>): Promise<void> {
    this.logger.warn('fileQuery method must be override');
  }

  async lastPointQuery(items: Array<OibusItemDTO>): Promise<void> {
    this.logger.warn('lastPointQuery method must be override');
  }

  async subscribe(items: Array<OibusItemDTO>): Promise<void> {
    this.logger.warn('subscribe method must be override');
  }

  /**
   * Add new values to the South connector buffer.
   */
  async addValues(values: Array<any>): Promise<void> {
    if (values.length > 0) {
      this.logger.debug(`Add ${values.length} values to cache from South "${this.configuration.name}"`);
      await this.engineAddValuesCallback(this.configuration.id, values);
    }
  }

  /**
   * Add a new file to the Engine.
   */
  async addFile(filePath: string): Promise<void> {
    this.logger.debug(`Add file "${filePath}" to cache from South "${this.configuration.name}"`);
    await this.engineAddFileCallback(this.configuration.id, filePath);
  }

  /**
   * Method called by Engine to stop a South connector. This method can be surcharged in the
   * South connector implementation to allow disconnecting to a third party application for example.
   */
  async disconnect(): Promise<void> {
    for (const cronJob of this.cronByScanModeIds.values()) {
      cronJob.stop();
    }
    this.cronByScanModeIds.clear();
    this.taskJobQueue = [];
    this.logger.info(`South connector "${this.configuration.name}" (${this.configuration.id}) disconnected`);
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.logger.info(`Stopping South "${this.configuration.name}" (${this.configuration.id})...`);

    if (this.runProgress$) {
      this.logger.debug('Waiting for South task to finish');
      await this.runProgress$.promise;
    }

    await this.disconnect();
    this.stopping = false;
  }

  addItem(item: OibusItemDTO): void {
    if (item.scanModeId) {
      const scanMode = this.repositoryService.scanModeRepository.getScanMode(item.scanModeId);
      if (!scanMode) {
        this.logger.error(`Error when creating South item in cron jobs: scan mode ${item.scanModeId} not found`);
        return;
      }

      let newCronJob = false;
      if (!this.itemsByScanModeIds.get(item.scanModeId)) {
        newCronJob = true;
        this.itemsByScanModeIds.set(item.scanModeId, new Map());
      }
      this.itemsByScanModeIds.get(item.scanModeId)!.set(item.id, item);

      // Create a new cron job if the scan mode was not already set, other the item will be taken by the task
      if (newCronJob) {
        this.createCronJob(scanMode);
      }
    }
  }

  updateItem(oldItem: OibusItemDTO, newItem: OibusItemCommandDTO): void {
    if (newItem.scanModeId) {
      const scanMode = this.repositoryService.scanModeRepository.getScanMode(newItem.scanModeId);
      if (!scanMode) {
        this.logger.error(`Error when creating South item in cron jobs: scan mode ${newItem.scanModeId} not found`);
        return;
      }
    }

    this.deleteItem(oldItem);
    this.addItem(oldItem);
  }

  deleteItem(item: OibusItemDTO) {
    if (!item.scanModeId) {
      return;
    }
    if (!this.itemsByScanModeIds.get(item.scanModeId)) {
      this.logger.error(`Error when removing South item from cron jobs: scan mode ${item.scanModeId} was not set`);
      return;
    }

    if (!this.itemsByScanModeIds.get(item.scanModeId)!.get(item.id)) {
      this.logger.error(`Error when removing South item from cron jobs: item ${item.id} was not set`);
      return;
    }

    this.itemsByScanModeIds.get(item.scanModeId)!.delete(item.id);
    if (this.itemsByScanModeIds.get(item.scanModeId)!.size === 0) {
      this.itemsByScanModeIds.delete(item.scanModeId);
      this.cronByScanModeIds.get(item.scanModeId)?.stop();
      this.cronByScanModeIds.delete(item.scanModeId);
    }
  }

  setLogger(value: pino.Logger) {
    this.logger = value;
  }

  async resetCache(): Promise<void> {
    this.southCacheService.resetCache();
  }
}
