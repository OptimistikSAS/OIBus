import { EventEmitter } from 'node:events';
import { CronJob } from 'cron';
import { delay, generateIntervals, groupItemsByGroup, validateCronExpression } from '../service/utils';

import { SOUTH_SINGLE_ITEMS, SouthConnectorItemTestingSettings, SouthItemLastValue } from '../../shared/model/south-connector.model';
import { Instant, Interval } from '../../shared/model/types';
import pino from 'pino';
import DeferredPromise from '../service/deferred-promise';
import { DateTime } from 'luxon';
import SouthCacheService from '../service/south-cache.service';
import { SouthDirectQuery, SouthHistoryQuery, SouthSubscription } from './south-interface';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import {
  OIBusAnyContent,
  OIBusConnectionTestResult,
  OIBusContent,
  OIBusFileContent,
  OIBusTimeValueContent
} from '../../shared/model/engine.model';
import path from 'node:path';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../model/south-connector.model';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import { ScanMode } from '../model/scan-mode.model';

/**
 * Class SouthConnector: provides general attributes and methods for South connectors.
 */
export default abstract class SouthConnector<T extends SouthSettings, I extends SouthItemSettings> {
  private taskJobQueue: Array<ScanMode> = [];
  private cronByScanModeIds: Map<string, CronJob> = new Map<string, CronJob>();
  private taskRunner: EventEmitter = new EventEmitter();
  private stopping = false;
  private runProgress$: DeferredPromise | null = null;
  private subscribedItems: Array<SouthConnectorItemEntity<I>> = [];
  protected cacheService: SouthCacheService | null = null;
  protected readonly tmpFolder: string;

  public connectedEvent: EventEmitter = new EventEmitter();
  public metricsEvent: EventEmitter = new EventEmitter();

  historyIsRunning = false;

  protected constructor(
    protected connector: SouthConnectorEntity<T, I>,
    private engineAddContentCallback: (
      southId: string,
      data: OIBusContent,
      queryTime: Instant,
      items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ) => Promise<void>,
    private readonly southCacheRepository: SouthCacheRepository,
    protected logger: pino.Logger,
    protected cacheFolderPath: string
  ) {
    this.cacheService = new SouthCacheService(this.southCacheRepository);
    this.tmpFolder = path.resolve(cacheFolderPath, 'tmp');
    this.taskRunner.on('next', async () => {
      if (this.taskJobQueue.length > 0) {
        if (this.runProgress$) {
          this.logger.warn('A South task is already running');
          return;
        }
        const scanMode = this.taskJobQueue[0];
        const itemsToRun = this.connector.items.filter(
          item =>
            item.enabled &&
            ((item.scanMode.id === scanMode.id && (!item.syncWithGroup || !item.group)) ||
              (item.syncWithGroup && item.group && item.group.scanMode.id === scanMode.id))
        );
        if (itemsToRun.length > 0) {
          this.logger.trace(`Running South with scan mode ${scanMode.name} for ${this.connector.items.length} items`);
          await this.run(scanMode.id, itemsToRun);
        }
      } else {
        this.logger.trace('No more task to run');
      }
    });
  }

  async start(): Promise<void> {
    this.logger.debug(`South connector ${this.connector.name} enabled. Starting services...`);
    if (this.isEnabled()) {
      // Create an item value table for this connector
      this.cacheService!.createItemValueTable(this.connector.id);
      await this.connect();
    }
  }

  async connect(): Promise<void> {
    this.logger.info(`South connector "${this.connector.name}" of type ${this.connector.type} started`);

    for (const cronJob of this.cronByScanModeIds.values()) {
      cronJob.stop();
    }
    this.cronByScanModeIds.clear();
    this.subscribedItems = [];
    this.metricsEvent.emit('connect', {
      lastConnection: DateTime.now().toUTC().toISO()!
    });

    this.connectedEvent.emit('connected');
  }

  updateCronJobs(): void {
    // Collect all unique scan modes from enabled items (excluding 'subscription')
    const scanModes = new Map<string, ScanMode>();
    this.connector.items
      .filter(item => item.scanMode.id && item.scanMode.id !== 'subscription' && item.enabled)
      .forEach(item => scanModes.set(item.scanMode.id!, item.scanMode));

    // Create cron jobs for new scan modes
    scanModes.forEach(scanMode => {
      if (!this.cronByScanModeIds.has(scanMode.id!)) {
        this.createOrUpdateCronJob(scanMode);
      }
    });

    // Stop and remove cron jobs for scan modes no longer in use
    this.cronByScanModeIds.forEach((cron, cronScanModeId) => {
      if (!scanModes.has(cronScanModeId)) {
        cron.stop();
        this.cronByScanModeIds.delete(cronScanModeId);
      }
    });
  }

  /**
   * Used when the cron of a scan mode is changed in the Engine
   * The cron expression must be propagated to each South
   */
  updateScanModeIfUsed(scanMode: ScanMode): void {
    if (this.cronByScanModeIds.get(scanMode.id)) {
      this.createOrUpdateCronJob(scanMode);
    }
  }

  createOrUpdateCronJob(scanMode: ScanMode): void {
    const existingCronJob = this.cronByScanModeIds.get(scanMode.id);
    if (existingCronJob) {
      this.logger.debug(`Removing existing South cron job associated to scan mode "${scanMode.name}" (${scanMode.cron})`);
      existingCronJob.stop();
      this.cronByScanModeIds.delete(scanMode.id);
    }

    this.logger.debug(`Creating South cron job for scan mode "${scanMode.name}" (${scanMode.cron})`);
    try {
      validateCronExpression(scanMode.cron);
      const job = new CronJob(scanMode.cron, this.addToQueue.bind(this, scanMode), null, true);
      this.cronByScanModeIds.set(scanMode.id, job);
    } catch (error: unknown) {
      this.logger.error(
        `Error when creating South cron job for scan mode "${scanMode.name}" (${scanMode.cron}): ${(error as Error).message}`
      );
    }
  }

  async updateSubscriptions(): Promise<void> {
    if (!this.hasSubscription()) {
      this.logger.trace('This connector does not support subscriptions');
      return;
    }
    // Get all subscription items
    const subscriptionItems = this.connector.items.filter(item => item.scanMode.id === 'subscription' && item.enabled);
    // Get the IDs of currently subscribed items
    const subscribedIds = new Set(this.subscribedItems.map(item => item.id));

    // Items to unsubscribe: those in subscribedItems but not in subscriptionItems
    const itemsToUnsubscribe = this.subscribedItems.filter(item => !subscriptionItems.some(subItem => subItem.id === item.id));
    // Items to subscribe: those in subscriptionItems but not already subscribed
    const itemsToSubscribe = subscriptionItems.filter(item => !subscribedIds.has(item.id));

    // Unsubscribe from items no longer needed
    if (itemsToUnsubscribe.length > 0) {
      try {
        this.logger.trace(`Unsubscribing from ${itemsToUnsubscribe.length} items`);
        await this.unsubscribe(itemsToUnsubscribe);
        this.subscribedItems = this.subscribedItems.filter(item => !itemsToUnsubscribe.includes(item));
      } catch (error: unknown) {
        this.logger.error(`Error when unsubscribing from items: ${(error as Error).message}`);
      }
    }
    // Subscribe to new items
    if (itemsToSubscribe.length > 0) {
      try {
        this.logger.trace(`Subscribing to ${itemsToSubscribe.length} new items`);
        await this.subscribe(itemsToSubscribe);
        this.subscribedItems.push(...itemsToSubscribe);
      } catch (error: unknown) {
        this.logger.error(`Error when subscribing to new items: ${(error as Error).message}`);
      }
    }
  }

  isEnabled(): boolean {
    return this.connector.enabled;
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

    const groupedItemsList = groupItemsByGroup<I>(this.connector.type, items);
    this.logger.debug(`Querying ${items.length} items grouped in ${groupedItemsList.length} groups`);

    for (const [index, groupedElements] of groupedItemsList.entries()) {
      if (this.stopping) {
        this.logger.debug(`Connector is stopping. Exiting run`);
        return;
      }

      if (this.hasDirectQuery()) {
        try {
          await this.directQueryHandler(groupedElements);
        } catch (error: unknown) {
          this.logger.error(`Error when calling directQuery: ${(error as Error).message}`);
        }
      }
      if (this.hasHistoryQuery()) {
        try {
          // By default, retrieve the last hour. If the scan mode has already run and retrieves data, the max instant will
          // be retrieved from the South cache inside the history query handler
          const maxReadInterval = groupedElements[0].group?.maxReadInterval ?? groupedElements[0].maxReadInterval!;
          await this.historyQueryHandler(
            groupedElements,
            DateTime.now()
              .minus((maxReadInterval || 3600) * 1000)
              .toUTC()
              .toISO() as Instant,
            DateTime.now().toUTC().toISO() as Instant
          );
        } catch (error: unknown) {
          this.historyIsRunning = false;
          this.logger.error(`Error when calling historyQuery: ${(error as Error).message}`);
        }
      }

      const readDelay = groupedElements[0].group?.readDelay ?? groupedElements[0].readDelay!;
      if (index !== groupedItemsList.length - 1 && readDelay) {
        await delay(readDelay);
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
   * This allows calling historyQueryHandler from outside (like history query engine) in a blocking way for other
   * calls
   */
  createDeferredPromise(): void {
    this.runProgress$ = new DeferredPromise();
  }

  /**
   * Method used to resolve and unset the DeferredPromise kept in the runProgress$ variable
   * This allows controlling the promise from an outside class (like history query engine)
   */
  resolveDeferredPromise(): void {
    if (this.runProgress$) {
      this.runProgress$.resolve();
      this.runProgress$ = null;
    }
  }

  async directQueryHandler(items: Array<SouthConnectorItemEntity<I>>): Promise<void> {
    const itemsToRead = this.filterDirectItems(items);
    if (!itemsToRead.length) {
      this.logger.trace('No direct items to read. Ignoring directQuery');
      return;
    }
    this.logger.trace(`Direct querying ${items.length} items`);
    const startTime = DateTime.now().toUTC().toISO()!;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const lastValue = await this.directQuery(items);

    this.cacheService!.saveItemLastValue(this.connector.id, {
      groupId: items[0].group && items[0].syncWithGroup && !SOUTH_SINGLE_ITEMS.includes(this.connector.type) ? items[0].group.id : null,
      itemId: items[0].id,
      queryTime: startTime,
      value: lastValue,
      trackedInstant: null
    });
  }

  async historyQueryHandler(items: Array<SouthConnectorItemEntity<I>>, startTime: Instant, endTime: Instant): Promise<void> {
    const itemsToRead = this.filterHistoryItems(items);
    if (!itemsToRead.length) {
      this.logger.trace('No history items to read. Ignoring historyQuery');
      return;
    }
    this.logger.trace(`History querying ${items.length} items`);
    this.historyIsRunning = true;

    const groupId =
      items[0].group && items[0].syncWithGroup && !SOUTH_SINGLE_ITEMS.includes(this.connector.type) ? items[0].group.id : null;
    let southCache = this.cacheService!.getItemLastValue(this.connector.id, groupId, items[0].id);
    if (!southCache) {
      southCache = {
        itemId: items[0].id,
        groupId,
        trackedInstant: null,
        queryTime: null,
        value: null
      };
    }
    if (!southCache.trackedInstant) {
      southCache.trackedInstant = startTime;
    }

    let maxReadInterval: number;
    let readDelay: number;
    let overlap: number;
    if (items[0].group && items[0].syncWithGroup) {
      maxReadInterval = items[0].group.maxReadInterval!;
      readDelay = items[0].group.readDelay!;
      overlap = items[0].group.overlap!;
    } else {
      // standalone item
      maxReadInterval = items[0].maxReadInterval!;
      readDelay = items[0].readDelay!;
      overlap = items[0].overlap || 0; // stick to 0 in case of history queries
    }
    const startTimeFromCache = DateTime.fromISO(southCache.trackedInstant).minus({ milliseconds: overlap }).toUTC().toISO()!;
    const { intervals, numberOfIntervalsDone } = generateIntervals(startTime, startTimeFromCache, endTime, maxReadInterval);
    this.logIntervals(intervals);
    await this.queryIntervals(intervals, itemsToRead, southCache!, readDelay, numberOfIntervalsDone);

    this.metricsEvent.emit('history-query-stop', {
      running: false
    });
    this.historyIsRunning = false;
  }

  private async queryIntervals(
    intervals: Array<Interval>,
    items: Array<SouthConnectorItemEntity<I>>,
    southCache: Omit<SouthItemLastValue, 'itemName' | 'groupName'>,
    readDelay: number,
    numberOfIntervalsDone: number
  ) {
    this.metricsEvent.emit('history-query-start', {
      running: true,
      intervalProgress: this.calculateIntervalProgress(intervals.length, numberOfIntervalsDone)
    });

    for (let index = numberOfIntervalsDone; index < intervals.length; index++) {
      const startTime = DateTime.now().toUTC().toISO()!;
      const interval = intervals[index];
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const lastValue: { trackedInstant: Instant; value: unknown } | null = await this.historyQuery(items, interval.start, interval.end);

      // We update the max instant only if the start interval is lower than the lastInstantRetrieved (i.e., we found data)
      // With overlap, it may return a lastInstantRetrieved inferior to the max instant, so we also check this condition
      if (lastValue && (!southCache.trackedInstant || lastValue.trackedInstant > southCache.trackedInstant)) {
        this.cacheService!.saveItemLastValue(this.connector.id, {
          groupId: southCache.groupId,
          itemId: southCache.itemId,
          queryTime: startTime,
          value: lastValue.value,
          trackedInstant: lastValue.trackedInstant
        });
      }

      this.metricsEvent.emit('history-query-interval', {
        running: true,
        intervalProgress: this.calculateIntervalProgress(intervals.length, index + 1), // this index has been done, so we increment
        currentIntervalStart: interval.start,
        currentIntervalEnd: interval.end,
        currentIntervalNumber: index + 1,
        numberOfIntervals: intervals.length
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

  private calculateIntervalProgress(numberOfIntervals: number, currentIntervalIndex: number) {
    if (currentIntervalIndex === numberOfIntervals) {
      return 1;
    }
    // round to 2 decimals
    return Math.round((currentIntervalIndex / numberOfIntervals + Number.EPSILON) * 100) / 100;
  }

  async addContent(data: OIBusContent, queryTime: Instant, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) {
    switch (data.type) {
      case 'time-values':
        return this.addValues(data, queryTime, items);
      case 'any-content':
        return this.addAnyContent(data, queryTime, items);
      case 'any':
        return this.addFile(data, queryTime, items);
    }
  }

  private async addAnyContent(
    data: OIBusAnyContent,
    queryTime: Instant,
    items: Array<SouthConnectorItemEntity<SouthItemSettings>>
  ): Promise<void> {
    this.logger.debug(`Add ${data.content.length} bytes of content to cache from South "${this.connector.name}"`);
    await this.engineAddContentCallback(this.connector.id, data, queryTime, items);
    this.metricsEvent.emit('add-values', {
      numberOfValuesRetrieved: data.content.length,
      lastValueRetrieved: data.content
    });
  }

  private async addValues(
    data: OIBusTimeValueContent,
    queryTime: Instant,
    items: Array<SouthConnectorItemEntity<SouthItemSettings>>
  ): Promise<void> {
    if (data.content.length > 0) {
      this.logger.debug(`Add ${data.content.length} values to cache from South "${this.connector.name}"`);
      await this.engineAddContentCallback(this.connector.id, data, queryTime, items);
      this.metricsEvent.emit('add-values', {
        numberOfValuesRetrieved: data.content.length,
        lastValueRetrieved: data.content[data.content.length - 1]
      });
    }
  }

  private async addFile(
    data: OIBusFileContent,
    queryTime: Instant,
    items: Array<SouthConnectorItemEntity<SouthItemSettings>>
  ): Promise<void> {
    this.logger.debug(`Add file "${data.filePath}" to cache from South "${this.connector.name}"`);
    await this.engineAddContentCallback(this.connector.id, data, queryTime, items);
    this.metricsEvent.emit('add-file', {
      lastFileRetrieved: path.parse(data.filePath).base
    });
  }

  async disconnect(): Promise<void> {
    for (const cronJob of this.cronByScanModeIds.values()) {
      cronJob.stop();
    }
    this.cronByScanModeIds.clear();
    this.taskJobQueue = [];

    this.logger.debug(`South connector "${this.connector.name}" (${this.connector.id}) disconnected`);
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.logger.debug(`Stopping South "${this.connector.name}" (${this.connector.id})...`);

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
    this.cacheService!.dropItemValueTable(this.connector.id);
  }

  filterHistoryItems(items: Array<SouthConnectorItemEntity<I>>): Array<SouthConnectorItemEntity<I>> {
    return items;
  }

  filterDirectItems(items: Array<SouthConnectorItemEntity<I>>): Array<SouthConnectorItemEntity<I>> {
    return items;
  }

  hasDirectQuery(): this is SouthDirectQuery {
    return 'directQuery' in this;
  }

  hasHistoryQuery(): this is SouthHistoryQuery {
    return 'historyQuery' in this;
  }

  hasSubscription(): this is SouthSubscription {
    return 'subscribe' in this && 'unsubscribe' in this;
  }

  set connectorConfiguration(connectorConfiguration: SouthConnectorEntity<T, I>) {
    this.connector = connectorConfiguration;
  }

  get connectorConfiguration(): SouthConnectorEntity<T, I> {
    return this.connector;
  }

  abstract testConnection(): Promise<OIBusConnectionTestResult>;

  abstract testItem(item: SouthConnectorItemEntity<I>, testingSettings: SouthConnectorItemTestingSettings): Promise<OIBusContent>;
}
