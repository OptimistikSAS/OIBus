import { EventEmitter } from 'node:events';
import { CronJob } from 'cron';
import { createBaseFolders, delay, generateIntervals, validateCronExpression } from '../service/utils';

import { SouthCache, SouthConnectorItemTestingSettings } from '../../shared/model/south-connector.model';
import { Instant, Interval } from '../../shared/model/types';
import pino from 'pino';
import EncryptionService from '../service/encryption.service';
import DeferredPromise from '../service/deferred-promise';
import { DateTime } from 'luxon';
import SouthCacheService from '../service/south-cache.service';
import { DelegatesConnection, QueriesFile, QueriesHistory, QueriesLastPoint, QueriesSubscription } from './south-interface';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { OIBusContent, OIBusRawContent, OIBusTimeValueContent } from '../../shared/model/engine.model';
import path from 'node:path';
import ConnectionService, { ManagedConnectionDTO } from '../service/connection.service';
import { SouthConnectorEntity, SouthConnectorItemEntity, SouthThrottlingSettings } from '../model/south-connector.model';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import { ScanMode } from '../model/scan-mode.model';
import { BaseFolders } from '../model/types';

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
export default abstract class SouthConnector<T extends SouthSettings, I extends SouthItemSettings> {
  private taskJobQueue: Array<ScanMode> = [];
  private cronByScanModeIds: Map<string, CronJob> = new Map<string, CronJob>();
  private taskRunner: EventEmitter = new EventEmitter();
  private stopping = false;
  private runProgress$: DeferredPromise | null = null;
  private subscribedItems: Array<SouthConnectorItemEntity<I>> = [];
  protected cacheService: SouthCacheService | null = null;

  public connectedEvent: EventEmitter = new EventEmitter();
  public metricsEvent: EventEmitter = new EventEmitter();

  historyIsRunning = false;

  /**
   * Constructor for SouthConnector
   */
  protected constructor(
    protected connector: SouthConnectorEntity<T, I>,
    private engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    protected readonly encryptionService: EncryptionService,
    private readonly southConnectorRepository: SouthConnectorRepository,
    private readonly southCacheRepository: SouthCacheRepository,
    private readonly scanModeRepository: ScanModeRepository,
    protected logger: pino.Logger,
    protected readonly baseFolders: BaseFolders,
    // The value is null in order to incrementally refactor connectors to use the ConnectionService
    private readonly connectionService: ConnectionService | null = null
  ) {
    if (this.connector.id !== 'test') {
      this.cacheService = new SouthCacheService(this.southCacheRepository);
    }
    this.taskRunner.on('next', async () => {
      if (this.taskJobQueue.length > 0) {
        if (this.runProgress$) {
          this.logger.warn('A South task is already running');
          return;
        }
        const scanMode = this.taskJobQueue[0];

        const itemsToRun = this.connector.items.filter(item => item.scanModeId === scanMode.id && item.enabled);
        if (itemsToRun.length > 0) {
          this.logger.trace(`Running South with scan mode ${scanMode.name} for ${this.connector.items.length} items`);
          await this.run(scanMode.id, itemsToRun);
        }
      } else {
        this.logger.trace('No more task to run');
      }
    });
  }

  async start(dataStream = true): Promise<void> {
    if (this.connector.id !== 'test') {
      await createBaseFolders(this.baseFolders);
    }
    if (dataStream) {
      // Reload the settings only on data stream case, otherwise let the history query manage the settings
      this.connector = this.southConnectorRepository.findSouthById(this.connector.id)!;
    }
    this.logger.debug(`South connector ${this.connector.name} enabled. Starting services...`);
    await this.connect();
  }

  async connect(): Promise<void> {
    if (this.delegatesConnection()) {
      const connectionDTO: ManagedConnectionDTO<unknown> = {
        type: this.connector.type,
        connectorSettings: this.connector.settings,
        createSessionFn: this.createSession.bind(this),
        settings: this.connectionSettings
      };

      this.connection = this.connectionService!.create(this.connector.id, connectionDTO);
    }

    this.logger.info(`South connector "${this.connector.name}" of type ${this.connector.type} started`);

    for (const cronJob of this.cronByScanModeIds.values()) {
      cronJob.stop();
    }
    this.cronByScanModeIds.clear();
    this.subscribedItems = [];
    if (this.connector.id !== 'test') {
      this.metricsEvent.emit('connect', {
        lastConnection: DateTime.now().toUTC().toISO()!
      });
    }
    this.connectedEvent.emit('connected');
  }

  async manageSouthCacheOnChange(
    oldSettings: SouthConnectorEntity<SouthSettings, SouthItemSettings>,
    newSettings: SouthConnectorEntity<SouthSettings, SouthItemSettings>,
    previousMaxInstantPerItem: boolean
  ) {
    const newMaxInstantPerItem = (this as unknown as QueriesHistory).getMaxInstantPerItem(newSettings.settings);
    if (previousMaxInstantPerItem !== newMaxInstantPerItem) {
      // Handle all cases regarding cache changes when max instant per item changes
      this.onSouthMaxInstantPerItemChange(newSettings.id, oldSettings.items, newMaxInstantPerItem);
    }

    const deletedItems = oldSettings.items.filter(item => !newSettings.items.find(element => element.id === item.id));
    for (const item of deletedItems) {
      this.safeDeleteSouthCacheEntry(newSettings, item.id, item.scanModeId, newMaxInstantPerItem);
    }

    const oldScanModeChangedItems = oldSettings.items.filter(item =>
      newSettings.items.find(element => element.id === item.id && element.scanModeId !== item.scanModeId)
    );
    for (const previousItem of oldScanModeChangedItems) {
      this.onSouthItemScanModeChange(
        newSettings,
        newMaxInstantPerItem ? previousItem.id : 'all',
        previousItem.scanModeId,
        newSettings.items.find(element => element.id === previousItem.id)!.scanModeId,
        newMaxInstantPerItem
      );
    }
  }

  /**
   * Reset the cron and subscriptions if necessary on item changes
   */
  async onItemChange(): Promise<void> {
    if (this.queriesHistory()) {
      await this.manageSouthCacheOnChange(
        this.connector,
        this.southConnectorRepository.findSouthById(this.connector.id)!,
        this.getMaxInstantPerItem(this.connector.settings)
      );
    }
    this.connector.items = this.southConnectorRepository.findAllItemsForSouth(this.connector.id);

    if (!this.connector.enabled) {
      return;
    }
    const scanModes = new Map<string, ScanMode>();
    this.connector.items
      .filter(item => item.scanModeId && item.scanModeId !== 'subscription' && item.enabled)
      .forEach(item => {
        if (!scanModes.get(item.scanModeId!)) {
          const scanMode = this.scanModeRepository.findById(item.scanModeId!)!;
          scanModes.set(scanMode.id, scanMode);
        }
      });
    for (const scanMode of scanModes.values()) {
      if (!this.cronByScanModeIds.has(scanMode.id!)) {
        this.createCronJob(scanMode);
      }
    }
    for (const [cronScanModeId, cron] of this.cronByScanModeIds.entries()) {
      if (!scanModes.has(cronScanModeId)) {
        cron.stop();
        this.cronByScanModeIds.delete(cronScanModeId);
      }
    }

    if (this.queriesSubscription()) {
      const subscriptionItems = this.connector.items.filter(item => item.scanModeId === 'subscription' && item.enabled);
      const alreadySubscribedItemIds = new Set(this.subscribedItems.map(item => item.id));
      const allSubscriptionItemIds = new Set(subscriptionItems.map(item => item.id));

      // Determine items to subscribe and unsubscribe
      const itemsToSubscribe = subscriptionItems.filter(item => !alreadySubscribedItemIds.has(item.id));
      const itemsToUnsubscribe = this.subscribedItems.filter(item => !allSubscriptionItemIds.has(item.id));

      // Unsubscribe from items no longer needed
      if (itemsToUnsubscribe.length > 0) {
        try {
          this.logger.trace(`Unsubscribing from ${itemsToUnsubscribe.length} items`);
          await this.unsubscribe(itemsToUnsubscribe);
          this.subscribedItems = this.subscribedItems.filter(item => !itemsToUnsubscribe.includes(item));
        } catch (error) {
          this.logger.error(`Error when unsubscribing from items. ${error}`);
        }
      }

      // Subscribe to new items
      if (itemsToSubscribe.length > 0) {
        try {
          this.logger.trace(`Subscribing to ${itemsToSubscribe.length} new items`);
          await this.subscribe(itemsToSubscribe);
          this.subscribedItems.push(...itemsToSubscribe);
        } catch (error) {
          this.logger.error(`Error when subscribing to new items. ${error}`);
        }
      }
    }
  }

  async updateScanMode(scanMode: ScanMode): Promise<void> {
    if (this.cronByScanModeIds.get(scanMode.id)) {
      this.createCronJob(scanMode);
    }
  }

  isEnabled(): boolean {
    return this.connector.enabled;
  }

  /**
   * Create a job used to populate the queue where each element of the queue is a job to call, associated to its scan mode
   */
  createCronJob(scanMode: ScanMode): void {
    const existingCronJob = this.cronByScanModeIds.get(scanMode.id);
    if (existingCronJob) {
      this.logger.debug(`Removing existing South cron job associated to scan mode "${scanMode.name}" (${scanMode.cron})`);
      existingCronJob.stop();
      this.cronByScanModeIds.delete(scanMode.id);
    }
    this.logger.debug(`Creating South cron job for scan mode "${scanMode.name}" (${scanMode.cron})`);

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
    } catch (error: unknown) {
      this.logger.error(
        `Error when creating South cron job for scan mode "${scanMode.name}" (${scanMode.cron}): ${(error as Error).message}`
      );
    }
  }

  addToQueue(scanMode: ScanMode): void {
    if (this.stopping) {
      this.logger.trace(`Connector is exiting. Cron "${scanMode.name}" (${scanMode.cron}) not added`);
      return;
    }
    const foundJob = this.taskJobQueue.find(element => element.id === scanMode.id);
    if (foundJob) {
      // If a job is already scheduled in queue, it will not be added
      this.logger.warn(
        `Task job not added in South connector queue for cron "${scanMode.name}" (${scanMode.cron}). The previous cron was still running`
      );
      return;
    }

    this.taskJobQueue.push(scanMode);
    if (this.taskJobQueue.length === 1) {
      this.taskRunner.emit('next');
    }
  }

  async run(scanModeId: string, items: Array<SouthConnectorItemEntity<I>>): Promise<void> {
    this.createDeferredPromise();

    const runStart = DateTime.now();
    this.metricsEvent.emit('run-start', {
      lastRunStart: runStart.toUTC().toISO()!
    });

    if (this.queriesFile()) {
      try {
        this.logger.trace(`Querying file for ${items.length} items`);
        await this.fileQuery(items);
      } catch (error) {
        this.logger.error(`Error when calling fileQuery. ${error}`);
      }
    }
    if (this.queriesLastPoint()) {
      try {
        this.logger.trace(`Querying points for ${items.length} items`);
        await this.lastPointQuery(items);
      } catch (error) {
        this.logger.error(`Error when calling lastPointQuery. ${error}`);
      }
    }

    if (this.queriesHistory()) {
      try {
        // By default, retrieve the last hour. If the scan mode has already run, and retrieve a data, the max instant will
        // be retrieved from the South cache inside the history query handler
        const throttling = this.getThrottlingSettings(this.connector.settings);
        await this.historyQueryHandler(
          items,
          DateTime.now()
            .minus((throttling.maxReadInterval || 3600) * 1000)
            .toUTC()
            .toISO() as Instant,
          DateTime.now().toUTC().toISO() as Instant,
          scanModeId,
          throttling,
          this.getMaxInstantPerItem(this.connector.settings),
          this.getOverlap(this.connector.settings)
        );
      } catch (error) {
        this.historyIsRunning = false;
        this.logger.error(`Error when calling historyQuery. ${error}`);
      }
    }

    this.metricsEvent.emit('run-end', {
      lastRunDuration: DateTime.now().toMillis() - runStart.toMillis()
    });
    this.taskJobQueue.shift();
    this.resolveDeferredPromise();

    if (!this.stopping) {
      this.taskRunner.emit('next');
    }
  }

  /**
   * Method used to set the runProgress$ variable with a DeferredPromise
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

  async historyQueryHandler(
    items: Array<SouthConnectorItemEntity<I>>,
    startTime: Instant,
    endTime: Instant,
    scanModeId: string,
    throttling: SouthThrottlingSettings,
    maxInstantPerItem: boolean,
    overlap: number
  ): Promise<void> {
    const itemsToRead = this.filterHistoryItems(items);
    if (!itemsToRead.length) {
      this.logger.trace('No history items to read. Ignoring historyQuery');
      return;
    }

    this.logger.trace(`Querying history for ${itemsToRead.length} items`);

    this.historyIsRunning = true;
    if (maxInstantPerItem) {
      for (const [index, item] of itemsToRead.entries()) {
        if (this.stopping) {
          this.logger.debug(`Connector is stopping. Exiting history query at item ${item.name}`);
          this.metricsEvent.emit('history-query-stop', {
            running: false
          });
          this.historyIsRunning = false;
          return;
        }

        const southCache = this.cacheService!.getSouthCache(this.connector.id, scanModeId, item.id, startTime);
        // maxReadInterval will divide a huge request (for example 1 year of data) into smaller
        // requests. For example only one hour if maxReadInterval is 3600 (in s)
        const startTimeFromCache = DateTime.fromISO(southCache.maxInstant).minus({ milliseconds: overlap }).toUTC().toISO()!;
        const intervals = generateIntervals(startTimeFromCache, endTime, throttling.maxReadInterval);
        let numberOfIntervalsDone = 0;
        if (startTime !== startTimeFromCache) {
          numberOfIntervalsDone = generateIntervals(startTime, startTimeFromCache, throttling.maxReadInterval).length;
        }
        this.logIntervals(intervals);
        await this.queryIntervals(intervals, [item], southCache, startTimeFromCache, throttling.readDelay, numberOfIntervalsDone);
        if (index !== itemsToRead.length - 1) {
          await delay(throttling.readDelay);
        }
      }
    } else {
      const southCache = this.cacheService!.getSouthCache(this.connector.id, scanModeId, 'all', startTime);
      const startTimeFromCache = DateTime.fromISO(southCache.maxInstant).minus({ milliseconds: overlap }).toUTC().toISO()!;
      // maxReadInterval will divide a huge request (for example 1 year of data) into smaller
      // requests. For example only one hour if maxReadInterval is 3600 (in s)
      const intervals = generateIntervals(startTimeFromCache, endTime, throttling.maxReadInterval);
      let numberOfIntervalsDone = 0;
      if (startTime !== startTimeFromCache) {
        numberOfIntervalsDone = generateIntervals(startTime, startTimeFromCache, throttling.maxReadInterval).length;
      }
      this.logIntervals(intervals);

      await this.queryIntervals(intervals, itemsToRead, southCache, startTime, throttling.readDelay, numberOfIntervalsDone);
    }
    this.metricsEvent.emit('history-query-stop', {
      running: false
    });
    this.historyIsRunning = false;
  }

  private async queryIntervals(
    intervals: Array<Interval>,
    items: Array<SouthConnectorItemEntity<I>>,
    southCache: SouthCache,
    startTime: Instant,
    readDelay: number,
    numberOfIntervalsDone: number
  ) {
    this.metricsEvent.emit('history-query-start', {
      running: true,
      intervalProgress: this.calculateIntervalProgress(intervals, 0, startTime)
    });

    for (const [index, interval] of intervals.entries()) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const lastInstantRetrieved = await this.historyQuery(items, interval.start, interval.end);

      // We update the max instant only if the start interval is lower than the lastInstantRetrieved (i.e. we found a data)
      // With overlap, it may return a lastInstantRetrieved inferior to the max instant so we also check this condition
      if (lastInstantRetrieved && lastInstantRetrieved > southCache.maxInstant) {
        this.cacheService!.saveSouthCache({
          southId: this.connector.id,
          scanModeId: southCache.scanModeId,
          itemId: southCache.itemId,
          maxInstant: lastInstantRetrieved
        });
      }

      this.metricsEvent.emit('history-query-interval', {
        running: true,
        intervalProgress: this.calculateIntervalProgress(intervals, index, startTime),
        currentIntervalStart: interval.start,
        currentIntervalEnd: interval.end,
        currentIntervalNumber: numberOfIntervalsDone + index + 1,
        numberOfIntervals: numberOfIntervalsDone + intervals.length
      });

      if (this.stopping) {
        this.logger.debug(`Connector is stopping. Exiting history query at interval ${index}: [${interval.start}, ${interval.end}]`);
        return;
      }

      if (index !== intervals.length - 1) {
        await delay(readDelay);
      }
    }
  }

  private logIntervals(intervals: Array<Interval>) {
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
  }

  /**
   * Calculate the progress of the current interval
   */
  private calculateIntervalProgress(intervals: Array<Interval>, currentIntervalIndex: number, startTime: Instant) {
    // calculate progress based on time
    const progress =
      1 -
      (DateTime.fromISO(intervals[intervals.length - 1].end).toMillis() -
        DateTime.fromISO(intervals[currentIntervalIndex].start).toMillis()) /
        (DateTime.fromISO(intervals[intervals.length - 1].end).toMillis() - DateTime.fromISO(startTime).toMillis());

    // round to 2 decimals
    const roundedProgress = Math.round((progress + Number.EPSILON) * 100) / 100;

    // in the chance that the rounded progress is 0.99, but it's the last interval, we want to return 1
    if (currentIntervalIndex === intervals.length - 1) {
      return 1;
    }

    return roundedProgress;
  }

  async addContent(data: OIBusContent) {
    switch (data.type) {
      case 'time-values':
        return this.addValues(data);
      case 'raw':
        return this.addFile(data);
    }
  }

  /**
   * Add new values to the South connector buffer.
   */
  private async addValues(data: OIBusTimeValueContent): Promise<void> {
    if (data.content.length > 0 && this.connector.id !== 'test') {
      this.logger.debug(`Add ${data.content.length} values to cache from South "${this.connector.name}"`);
      await this.engineAddContentCallback(this.connector.id, data);
      this.metricsEvent.emit('add-values', {
        numberOfValuesRetrieved: data.content.length,
        lastValueRetrieved: data.content[data.content.length - 1]
      });
    }
  }

  /**
   * Add a new file to the Engine.
   */
  private async addFile(data: OIBusRawContent): Promise<void> {
    this.logger.debug(`Add file "${data.filePath}" to cache from South "${this.connector.name}"`);
    await this.engineAddContentCallback(this.connector.id, data);
    this.metricsEvent.emit('add-file', {
      lastFileRetrieved: path.parse(data.filePath).base
    });
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

    if (this.delegatesConnection()) {
      await this.connectionService!.remove(this.connector.type, this.connector.id);
    }

    this.logger.debug(`South connector "${this.connector.name}" (${this.connector.id}) disconnected`);
  }

  async stop(dataStream = true): Promise<void> {
    this.stopping = true;
    this.logger.debug(`Stopping South "${this.connector.name}" (${this.connector.id})...`);

    if (dataStream) {
      // Reload the settings only on data stream case, otherwise let the history query manage the settings
      this.connector = this.southConnectorRepository.findSouthById(this.connector.id)!;
    }

    if (this.runProgress$) {
      this.logger.debug('Waiting for South task to finish');
      await this.runProgress$.promise;
    }

    await this.disconnect();
    this.stopping = false;
    this.logger.info(`South connector "${this.connector.name}" stopped`);
  }

  setLogger(value: pino.Logger) {
    this.logger = value;
  }

  async resetCache(): Promise<void> {
    this.cacheService!.resetSouthCache(this.connector.id);
  }

  queriesFile(): this is QueriesFile {
    return 'fileQuery' in this;
  }

  filterHistoryItems(items: Array<SouthConnectorItemEntity<I>>): Array<SouthConnectorItemEntity<I>> {
    return items;
  }

  queriesLastPoint(): this is QueriesLastPoint {
    return 'lastPointQuery' in this;
  }

  queriesHistory(): this is QueriesHistory {
    return 'historyQuery' in this && 'getThrottlingSettings' in this && 'getMaxInstantPerItem' in this && 'getOverlap' in this;
  }

  queriesSubscription(): this is QueriesSubscription {
    return 'subscribe' in this && 'unsubscribe' in this;
  }

  delegatesConnection<T>(): this is DelegatesConnection<T> {
    return 'connectionSettings' in this && 'createSession' in this;
  }

  get settings(): SouthConnectorEntity<T, I> {
    return this.connector;
  }

  abstract testConnection(): Promise<void>;

  abstract testItem(
    item: SouthConnectorItemEntity<I>,
    testingSettings: SouthConnectorItemTestingSettings,
    _callback: (data: OIBusContent) => void
  ): Promise<void>;

  /**
   * Safely delete the cache entries of a south item, when the south item is deleted
   */
  private safeDeleteSouthCacheEntry(
    southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings>,
    southItemId: string,
    scanModeId: string,
    maxInstantPerItem: boolean
  ) {
    if (maxInstantPerItem) {
      this.southCacheRepository.deleteAllBySouthItem(southItemId);
    } else {
      const isOldScanModeUnused = !southConnector.items.some(item => item.scanModeId === scanModeId);
      if (isOldScanModeUnused) {
        this.southCacheRepository.delete(southItemId, scanModeId, 'all');
      }
    }
  }

  /**
   * Handle the change of a south item's scan mode
   */
  private onSouthItemScanModeChange(
    southConnector: SouthConnectorEntity<SouthSettings, SouthItemSettings>,
    southItemId: string,
    previousScanModeId: string,
    newScanModeId: string,
    maxInstantPerItem: boolean
  ) {
    const previousCacheEntry = this.southCacheRepository.getSouthCache(southConnector.id, previousScanModeId, southItemId);

    // If the south hasn't been started yet, the previous cache entry won't exist
    if (!previousCacheEntry) {
      return;
    }

    // 1. Remove the previous cache entry
    this.safeDeleteSouthCacheEntry(southConnector, southItemId, previousScanModeId, maxInstantPerItem);

    // Max instant per item is enabled
    if (maxInstantPerItem) {
      // 2. Create the new cache entry, with the previous max instant
      this.southCacheRepository.save({
        southId: southConnector.id,
        itemId: southItemId,
        scanModeId: newScanModeId,
        maxInstant: previousCacheEntry.maxInstant
      });
    }

    // Max instant per item is disabled
    if (!maxInstantPerItem) {
      const newCacheEntry = this.southCacheRepository.getSouthCache(southConnector.id, newScanModeId, southItemId);
      // 2. Create the new cache entry, with the previous max instant, if it's not already created
      if (!newCacheEntry) {
        this.southCacheRepository.save({
          southId: southConnector.id,
          itemId: 'all',
          scanModeId: newScanModeId,
          maxInstant: previousCacheEntry.maxInstant
        });
      }
    }
  }

  /**
   * Handle the change of the max instant per item setting of a south connector
   */
  private onSouthMaxInstantPerItemChange(
    southConnectorId: string,
    previousItems: Array<SouthConnectorItemEntity<SouthItemSettings>>,
    maxInstantPerItem: boolean
  ) {
    const maxInstantsByScanMode = this.southCacheRepository.getLatestMaxInstants(southConnectorId);
    // If the south hasn't been started yet, the cache entries won't exist
    if (!maxInstantsByScanMode) {
      return;
    }

    // 1. Remove all previous cache entries
    this.southCacheRepository.deleteAllBySouthConnector(southConnectorId);

    // Max instant per item is being enabled
    if (maxInstantPerItem) {
      // 2. Create new cache entries for each item
      // The max instant of these new entries, will be the max instant of the previously removed ones, based on scan mode
      for (const item of previousItems) {
        const maxInstant = maxInstantsByScanMode.get(item.scanModeId);
        if (maxInstant) {
          this.southCacheRepository.save({
            southId: southConnectorId,
            itemId: item.id,
            scanModeId: item.scanModeId,
            maxInstant
          });
        }
      }
    }

    // Max instant per item is being disabled
    if (!maxInstantPerItem) {
      // 2. Create a single cache entry for all scan modes
      // The max instant of these new entries, will be the *latest* max instant of the previously removed ones
      for (const [scanModeId, maxInstant] of maxInstantsByScanMode) {
        this.southCacheRepository.save({ southId: southConnectorId, itemId: 'all', scanModeId, maxInstant });
      }
    }
  }
}
