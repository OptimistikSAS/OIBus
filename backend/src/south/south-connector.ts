import { EventEmitter } from 'node:events';
import { CronJob } from 'cron';
import { delay, generateIntervals, groupItemsByGroup, validateCronExpression } from '../service/utils';

import { SOUTH_SINGLE_ITEMS, SouthConnectorItemTestingSettings, SouthItemLastValue } from '../../shared/model/south-connector.model';
import { Instant, Interval } from '../../shared/model/types';
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
  OIBusTimeValue,
  OIBusTimeValueContent
} from '../../shared/model/engine.model';
import path from 'node:path';
import TypedEventEmitter from '../service/typed-event-emitter';

/** Events published by a South connector's {@link SouthConnector.metricsEvent}. */
export interface SouthMetricsEvents {
  connect: { lastConnection: Instant };
  'run-start': { lastRunStart: Instant };
  'run-end': { lastRunDuration: number };
  'history-query-start': { running: boolean; intervalProgress: number };
  'history-query-interval': {
    running: boolean;
    intervalProgress: number;
    currentIntervalStart: Instant;
    currentIntervalEnd: Instant;
    currentIntervalNumber: number;
    numberOfIntervals: number;
  };
  'history-query-stop': { running: boolean };
  // `any-content` (opaque payloads) has no time value, hence the `| null`.
  'add-values': { numberOfValuesRetrieved: number; lastValueRetrieved: OIBusTimeValue | null };
  'add-file': { lastFileRetrieved: string };
}
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../model/south-connector.model';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import { ScanMode } from '../model/scan-mode.model';
import type { ILogger } from '../model/logger.model';
import { loggerService } from '../service/logger/logger.service';

/**
 * Base class for every South connector.
 *
 * **Responsibilities**
 *  - Run a per-scan-mode cron that calls `run()` (which fans out to
 *    `directQueryHandler` and/or `historyQueryHandler` depending on the
 *    capabilities the subclass implements).
 *  - Persist a per-item `trackedInstant` in the South cache so history queries
 *    are resumable across restarts (no re-querying already-fetched data).
 *  - Manage subscription items (`scanMode.id === 'subscription'`) by diffing
 *    the desired item set against the live subscriptions.
 *  - Forward retrieved content (time-values / files / opaque payloads) to the
 *    engine via the `addContent*` family.
 *
 * **What a subclass implements**
 *  - One or more capability interfaces from `./south-interface`:
 *      `SouthDirectQuery`     → implement `directQuery(items)` for one-shot reads
 *      `SouthHistoryQuery`    → implement `historyQuery(items, start, end)` for HA
 *      `SouthSubscription`    → implement `subscribe(items)` + `unsubscribe(items)`
 *    Capabilities are discovered via `hasDirectQuery()` / `hasHistoryQuery()` /
 *    `hasSubscription()` which do a structural `in`-check, so subclasses don't
 *    need to declare a flag.
 *  - `testConnection()` and `testItem()` for the UI's "test" buttons.
 *
 * **Run-loop contract**
 *  - Each cron tick enqueues a `ScanMode` via `addToQueue`. If a job for the
 *    same scan mode is already queued or running, the new one is dropped (a
 *    cron firing while its previous tick is still in flight is normal).
 *  - `run()` consumes the queue head, groups the items via `groupItemsByGroup`
 *    (so multi-item connectors batch grouped items into a single request, and
 *    single-item connectors get one call per item), then re-emits `'next'` so
 *    the next queued scan-mode (if any) starts immediately.
 *  - `stop()` flips a `stopping` flag and awaits any in-flight `runProgress$`
 *    deferred so the engine can shut down cleanly mid-scan.
 */
export default abstract class SouthConnector<T extends SouthSettings, I extends SouthItemSettings> {
  protected logger!: ILogger;
  private taskJobQueue: Array<ScanMode> = [];
  private cronByScanModeIds: Map<string, CronJob> = new Map<string, CronJob>();
  // Last time a "previous cron still running" warning was emitted per scan mode. Used to throttle
  // that warning to once an hour (logging the in-between occurrences as trace) to avoid flooding.
  private lastBackpressureWarnByScanModeId: Map<string, DateTime> = new Map<string, DateTime>();
  private taskRunner: EventEmitter = new EventEmitter();
  private stopping = false;
  private runProgress$: DeferredPromise | null = null;
  private subscribedItems: Array<SouthConnectorItemEntity<I>> = [];
  protected cacheService: SouthCacheService | null = null;
  protected readonly tmpFolder: string;

  public connectedEvent: EventEmitter = new EventEmitter();
  public metricsEvent: TypedEventEmitter<SouthMetricsEvents> = new TypedEventEmitter<SouthMetricsEvents>();

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
    protected cacheFolderPath: string
  ) {
    this.logger = loggerService.createChildLogger('south', this.connector.id, this.connector.name);
    this.cacheService = new SouthCacheService(this.southCacheRepository);
    this.tmpFolder = path.resolve(cacheFolderPath, 'tmp');
    this.taskRunner.on('next', () => {
      if (this.taskJobQueue.length > 0) {
        if (this.runProgress$) {
          this.logger.warn('A South task is already running');
          return;
        }
        const scanMode = this.taskJobQueue[0];
        const itemsToRun = this.connector.items.filter(
          item =>
            item.enabled &&
            (((!item.syncWithGroup || !item.group) && item.scanMode!.id === scanMode.id) ||
              (item.syncWithGroup && item.group && item.group.scanMode.id === scanMode.id))
        );
        if (itemsToRun.length > 0) {
          this.logger.trace(`Running South with scan mode ${scanMode.name} for ${this.connector.items.length} items`);
          this.run(scanMode.id, itemsToRun).catch((error: unknown) => {
            this.logger.error(`Unhandled error in South task runner: ${(error as Error).message}`);
          });
        }
      } else {
        this.logger.trace('No more task to run');
      }
    });
  }

  /**
   * Connect the south connector if it is enabled. No-op when the connector is
   * disabled — the engine still constructs it so the UI can read settings, but
   * we don't spin up cron jobs or open connections.
   */
  async start(): Promise<void> {
    if (this.isEnabled()) {
      this.logger.debug(`South connector ${this.connector.name} enabled. Starting services...`);
      await this.connect();
    }
  }

  /**
   * Reset cron state and signal the connector is ready to schedule work.
   *
   * Subclasses MAY override to establish the underlying transport (TCP, OPC
   * UA session, MQTT client, etc.). Overrides should call `super.connect()` so
   * cron jobs, subscription bookkeeping, and the `'connected'` event are kept
   * in sync.
   */
  connect(): Promise<void> {
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
    return Promise.resolve();
  }

  /**
   * Recompute the set of active cron jobs to match the current item / group
   * configuration. Creates jobs for newly-referenced scan modes, stops jobs
   * for scan modes no longer used. Idempotent — safe to call after any
   * configuration change.
   *
   * The `'subscription'` scan mode is intentionally excluded: subscription
   * items are pushed by the source, not polled, so they don't drive a cron.
   * See `updateSubscriptions()` for that path.
   */
  updateCronJobs(): void {
    // Collect all unique scan modes from enabled items (excluding 'subscription')
    const scanModes = new Map<string, ScanMode>();
    this.connector.items
      .filter(
        item =>
          item.scanMode && item.scanMode.id && item.scanMode.id !== 'subscription' && item.enabled && !(item.syncWithGroup && item.group) // group items are covered by the groups pass below
      )
      .forEach(item => scanModes.set(item.scanMode!.id!, item.scanMode!));

    this.connector.groups
      .filter(
        group =>
          group.scanMode &&
          group.scanMode.id &&
          group.scanMode.id !== 'subscription' &&
          this.connector.items.some(item => item.enabled && item.group?.id === group.id)
      )
      .forEach(group => scanModes.set(group.scanMode.id!, group.scanMode!));

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
   * Propagate a scan-mode cron-expression change from the engine. Only
   * rebuilds the cron if this connector actually uses that scan mode —
   * otherwise it's a no-op (we'd never have had a cron for it).
   */
  updateScanModeIfUsed(scanMode: ScanMode): void {
    if (this.cronByScanModeIds.get(scanMode.id)) {
      this.createOrUpdateCronJob(scanMode);
    }
  }

  /**
   * Replace or create the cron for a single scan mode. Invalid cron
   * expressions are logged and skipped without throwing — a single bad
   * expression must not prevent the rest of the connector from running.
   */
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

  /**
   * Diff the configured subscription items against what we're currently
   * subscribed to and call `subscribe()` / `unsubscribe()` to reconcile.
   *
   * "Subscription items" are items whose scan mode is the reserved
   * `'subscription'` id — push-driven rather than pull-driven, so they don't
   * run through the cron loop. Subclasses must implement `SouthSubscription`
   * for this to do anything; non-subscription connectors get a trace log and
   * return.
   *
   * Errors from `subscribe()` / `unsubscribe()` are logged per-batch but never
   * rethrown — a partial failure on either side leaves the connector running
   * with whatever subscriptions did succeed.
   */
  async updateSubscriptions(): Promise<void> {
    if (!this.hasSubscription()) {
      this.logger.trace('This connector does not support subscriptions');
      return;
    }
    // Get all subscription items
    const subscriptionItems = this.connector.items.filter(item => item.scanMode && item.scanMode.id === 'subscription' && item.enabled);
    const subscribedIds = new Set(this.subscribedItems.map(item => item.id));
    const subscriptionIds = new Set(subscriptionItems.map(item => item.id));

    // Items to unsubscribe: those in subscribedItems but not in subscriptionItems
    const itemsToUnsubscribe = this.subscribedItems.filter(item => !subscriptionIds.has(item.id));
    // Items to subscribe: those in subscriptionItems but not already subscribed
    const itemsToSubscribe = subscriptionItems.filter(item => !subscribedIds.has(item.id));

    // Unsubscribe from items no longer needed
    if (itemsToUnsubscribe.length > 0) {
      try {
        this.logger.trace(`Unsubscribing from ${itemsToUnsubscribe.length} items`);
        await this.unsubscribe(itemsToUnsubscribe);
        // After unsubscribing, the surviving subscribed items are exactly those
        // whose id is still in subscriptionIds
        this.subscribedItems = this.subscribedItems.filter(item => subscriptionIds.has(item.id));
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

  /**
   * Enqueue a scan-mode tick. Called from the cron callback in
   * `createOrUpdateCronJob`.
   *
   * Dropped (logged but not re-enqueued) when:
   *  - the connector is in the middle of `stop()`, or
   *  - a tick for the same scan mode is already in the queue (i.e. the cron
   *    fired again while the previous tick is still being processed). This is
   *    a backpressure signal — usually it means the scan interval is too short
   *    for the work being done. Surfaced as a warning so operators see it.
   *
   * If the queue was empty, also kicks the `'next'` event to start processing
   * immediately. Otherwise, `run()` will drain the queue head when it finishes.
   */
  addToQueue(scanMode: ScanMode): void {
    if (this.stopping) {
      this.logger.trace(`Connector is exiting. Cron "${scanMode.name}" (${scanMode.cron}) not added`);
      return;
    }
    const foundJob = this.taskJobQueue.find(element => element.id === scanMode.id);
    if (foundJob) {
      // If a job is already scheduled in queue, it will not be added. This can happen on every tick
      // when the scan interval is too short, so the warning is throttled to once per hour per scan
      // mode and the in-between occurrences are logged as trace to avoid flooding the logs.
      const now = DateTime.now();
      const lastWarn = this.lastBackpressureWarnByScanModeId.get(scanMode.id);
      const message = `Task job not added in South connector queue for cron "${scanMode.name}" (${scanMode.cron}). The previous cron was still running`;
      if (!lastWarn || now.diff(lastWarn).as('hours') >= 1) {
        this.lastBackpressureWarnByScanModeId.set(scanMode.id, now);
        this.logger.warn(`${message}. The next occurrences will be logged as trace for the next hour`);
      } else {
        this.logger.trace(message);
      }
      return;
    }

    this.taskJobQueue.push(scanMode);
    if (this.taskJobQueue.length === 1) {
      this.taskRunner.emit('next');
    }
  }

  /**
   * Execute one scan-mode tick for the given items.
   *
   * Items are grouped via `groupItemsByGroup` so connectors that support
   * batched reads (OPC UA, Modbus, etc.) issue one request per group;
   * "single-item" connectors (see `SOUTH_SINGLE_ITEMS`) get one call per item.
   *
   * Within the group loop:
   *  1. If the connector implements `SouthDirectQuery`, run `directQueryHandler`.
   *  2. If the connector implements `SouthHistoryQuery`, run
   *     `historyQueryHandler` with a time window of "now − maxReadInterval"
   *     to "now". The `trackedInstant` cache then narrows this window on
   *     subsequent runs so we don't re-query already-fetched data.
   *  3. Between groups, sleep `readDelay` (if configured) so the source isn't
   *     overwhelmed by back-to-back batches.
   *
   * The `stopping` flag is checked between groups so `stop()` can interrupt
   * mid-scan without waiting for the whole item list to finish.
   *
   * Errors from `direct`/`history` are caught and logged per-iteration — a
   * single bad batch must not abort the rest of the scan or hide errors from
   * later batches.
   */
  async run(scanModeId: string, items: Array<SouthConnectorItemEntity<I>>): Promise<void> {
    this.createDeferredPromise();

    try {
      const runStart = DateTime.now();
      this.metricsEvent.emit('run-start', {
        lastRunStart: runStart.toUTC().toISO()!
      });

      const groupedItemsList = groupItemsByGroup<I>(this.connector.type, items);
      this.logger.debug(`Querying ${items.length} items grouped in ${groupedItemsList.length} groups`);

      for (const [index, groupedElements] of groupedItemsList.entries()) {
        if (this.stopping) {
          this.logger.debug(`Connector is stopping. Exiting run`);
          this.resolveDeferredPromise();
          return;
        }

        if (this.hasDirectQuery()) {
          try {
            await this.directQueryHandler(groupedElements);
          } catch (error: unknown) {
            this.logger.error(`Error when querying items with direct access: ${(error as Error).message}`);
          }
        }
        if (this.hasHistoryQuery()) {
          try {
            // By default, retrieve the last hour. If the scan mode has already run and retrieves data, the max instant will
            // be retrieved from the South cache inside the history query handler
            const maxReadInterval = groupedElements[0].group?.maxReadInterval ?? groupedElements[0].maxReadInterval!;
            // Capture a single `now` so that endTime - startTime == maxReadInterval exactly.
            // Two separate DateTime.now() calls can differ by 1 ms, making the interval
            // fractionally larger than maxReadInterval and causing generateIntervals to
            // produce a spurious 1 ms second sub-interval.
            const now = DateTime.now().toUTC();
            await this.historyQueryHandler(
              groupedElements,
              now.minus((maxReadInterval || 3600) * 1000).toISO() as Instant,
              now.toISO() as Instant
            );
          } catch (error: unknown) {
            this.historyIsRunning = false;
            this.logger.error(`Error when querying items with history capabilities: ${(error as Error).message}`);
          }
        }

        const readDelay = groupedElements[0].group?.readDelay ?? groupedElements[0].readDelay!;
        if (!this.stopping && index !== groupedItemsList.length - 1 && readDelay) {
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
    } catch (error: unknown) {
      // Unexpected error outside the per-group handlers (e.g. metrics emit, groupItemsByGroup).
      // Always clean up so stop() does not hang and the queue keeps draining.
      this.taskJobQueue.shift();
      this.resolveDeferredPromise();
      if (!this.stopping) {
        this.taskRunner.emit('next');
      }
      throw error;
    }
  }

  /**
   * Arm the `runProgress$` deferred. `stop()` awaits this promise so it can
   * cleanly interrupt mid-scan; the history-query engine also reuses this
   * hook to drive history runs as if they were a single coordinated task.
   */
  createDeferredPromise(): void {
    this.runProgress$ = new DeferredPromise();
  }

  /**
   * Resolve and clear the in-flight `runProgress$`. Pairs with
   * `createDeferredPromise`; safe to call when no promise is armed (no-op).
   * Must be called on EVERY exit path of `run()`, including early-out cases,
   * otherwise `stop()` will hang.
   */
  resolveDeferredPromise(): void {
    if (this.runProgress$) {
      this.runProgress$.resolve();
      this.runProgress$ = null;
    }
  }

  /**
   * One-shot read of the current value(s). Skips the call entirely if
   * `filterDirectItems()` drops every item (subclasses may filter on settings
   * that disable direct reads for some items).
   *
   * The returned value is cached as the item's `value` so the UI can show a
   * "last value" without re-querying. `trackedInstant` stays `null` here —
   * direct reads don't bound a time window; that's what history queries do.
   */
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

  /**
   * Run a windowed history read against `items` and persist the most recent
   * timestamp seen so the next call resumes where this one left off.
   *
   * Window construction:
   *  - The effective start is `max(startTime, cache.trackedInstant - overlap)`
   *    so we never re-query data we've already cached (and the `overlap` lets
   *    operators backfill a small slack window for late-arriving samples).
   *  - The window is then split into sub-intervals of at most
   *    `maxReadInterval` seconds (via `generateIntervals`) so very wide
   *    catch-up reads don't try to fetch hours of data in one round-trip.
   *  - `numberOfIntervalsDone` lets the planner skip intervals that are
   *    entirely older than `trackedInstant` (already fetched).
   *
   * `historyIsRunning` is set for the duration so concurrent triggers and the
   * metrics layer can detect whether a historical pass is in flight.
   */
  async historyQueryHandler(items: Array<SouthConnectorItemEntity<I>>, startTime: Instant, endTime: Instant): Promise<void> {
    const itemsToRead = this.filterHistoryItems(items);
    if (!itemsToRead.length) {
      this.logger.trace('No history items to read. Ignoring historyQuery');
      return;
    }
    const skipped = items.length - itemsToRead.length;
    if (skipped > 0) {
      this.logger.trace(
        `${skipped} of ${items.length} item(s) were excluded by the connector's history filter and will not be queried: ` +
          items
            .filter(i => !itemsToRead.includes(i))
            .map(i => i.name)
            .join(', ')
      );
    }
    this.logger.trace(`History querying ${itemsToRead.length} items`);
    this.historyIsRunning = true;

    if (SOUTH_SINGLE_ITEMS.includes(this.connector.type)) {
      // Each item is queried independently so that each has its own cache entry and trackedInstant.
      // This mirrors how groupItemsByGroup() sends singleton arrays during normal scan flow.
      for (const item of itemsToRead) {
        await this.querySingleItemHistory(item, startTime, endTime);
        if (this.stopping) break;
      }
    } else {
      const lead = itemsToRead[0];
      const groupId = lead.group && lead.syncWithGroup ? lead.group.id : null;
      let southCache = this.cacheService!.getItemLastValue(this.connector.id, lead.id);
      if (!southCache) {
        southCache = {
          itemId: lead.id,
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
      if (lead.group && lead.syncWithGroup) {
        maxReadInterval = lead.group.maxReadInterval!;
        readDelay = lead.group.readDelay!;
        overlap = lead.group.overlap!;
      } else {
        maxReadInterval = lead.maxReadInterval!;
        readDelay = lead.readDelay!;
        overlap = lead.overlap || 0;
      }
      const startTimeFromCache = DateTime.fromISO(southCache.trackedInstant).minus({ milliseconds: overlap }).toUTC().toISO()!;
      const { intervals, numberOfIntervalsDone } = generateIntervals(startTime, startTimeFromCache, endTime, maxReadInterval);
      this.logIntervals(intervals);
      await this.queryIntervals(intervals, itemsToRead, southCache!, readDelay, numberOfIntervalsDone);
    }

    this.metricsEvent.emit('history-query-stop', {
      running: false
    });
    this.historyIsRunning = false;
  }

  private async querySingleItemHistory(item: SouthConnectorItemEntity<I>, startTime: Instant, endTime: Instant): Promise<void> {
    let southCache = this.cacheService!.getItemLastValue(this.connector.id, item.id);
    if (!southCache) {
      southCache = {
        itemId: item.id,
        groupId: null,
        trackedInstant: null,
        queryTime: null,
        value: null
      };
    }
    if (!southCache.trackedInstant) {
      southCache.trackedInstant = startTime;
    }
    const overlap = item.overlap || 0;
    const startTimeFromCache = DateTime.fromISO(southCache.trackedInstant).minus({ milliseconds: overlap }).toUTC().toISO()!;
    const { intervals, numberOfIntervalsDone } = generateIntervals(startTime, startTimeFromCache, endTime, item.maxReadInterval!);
    this.logIntervals(intervals);
    await this.queryIntervals(intervals, [item], southCache, item.readDelay!, numberOfIntervalsDone);
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

  /**
   * Entry point subclasses call after a successful read. Dispatches by content
   * shape to the engine callback and updates per-shape metrics:
   *   - `'time-values'`  → array of OIBusTimeValue (timestamp + pointId + data)
   *   - `'any-content'`  → opaque serialised payload (MQTT messages, etc.)
   *   - `'any'`          → a file on disk (folder-scanner, FTP, etc.)
   */
  addContent(data: OIBusContent, queryTime: Instant, items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void> {
    switch (data.type) {
      case 'time-values':
        return this.addValues(data, queryTime, items);
      case 'any-content':
        return this.addAnyContent(data, queryTime, items);
      case 'any':
        return this.addFile(data, queryTime, items);
      default:
        return Promise.resolve();
    }
  }

  private async addAnyContent(
    data: OIBusAnyContent,
    queryTime: Instant,
    items: Array<SouthConnectorItemEntity<SouthItemSettings>>
  ): Promise<void> {
    this.logger.debug(`Add ${data.content.length} bytes of content to cache from South "${this.connector.name}"`);
    await this.engineAddContentCallback(this.connector.id, data, queryTime, items);
    // `any-content` is a single opaque serialised payload, not a list of time values: count it
    // as one retrieved item (not its byte length) and carry no "last value" (no OIBusTimeValue).
    this.metricsEvent.emit('add-values', {
      numberOfValuesRetrieved: 1,
      lastValueRetrieved: null
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

  /**
   * Stop crons, drain the queue, release transport resources. Subclasses MAY
   * override to close sessions / sockets; overrides should call
   * `super.disconnect()` so cron + queue state is reset.
   *
   * Idempotent — safe to call when already disconnected.
   */
  disconnect(): Promise<void> {
    for (const cronJob of this.cronByScanModeIds.values()) {
      cronJob.stop();
    }
    this.cronByScanModeIds.clear();
    this.taskJobQueue = [];

    this.logger.debug(`South connector "${this.connector.name}" (${this.connector.id}) disconnected`);
    return Promise.resolve();
  }

  /**
   * Graceful shutdown. Flips `stopping`, awaits any in-flight `run()` via
   * `runProgress$`, then disconnects. Used by the engine on connector delete /
   * config reload / OIBus shutdown.
   */
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

  refreshLogger(): void {
    this.logger = loggerService.createChildLogger('south', this.connector.id, this.connector.name);
  }

  /**
   * Clear every item's `trackedInstant` and `value` for this connector.
   * Triggered by the engine when the operator clicks "reset cache" —
   * subsequent history queries will re-fetch from the connector's configured
   * start window.
   */
  resetCache(): Promise<void> {
    this.cacheService!.deleteItemsBySouth(this.connector.id);
    return Promise.resolve();
  }

  /**
   * Hook for subclasses that want to filter which items participate in a
   * history pass (default: all of them). Useful for connectors where some
   * items are direct-only or subscription-only.
   */
  filterHistoryItems(items: Array<SouthConnectorItemEntity<I>>): Array<SouthConnectorItemEntity<I>> {
    return items;
  }

  /**
   * Hook for subclasses that want to filter which items participate in a
   * direct read (default: all of them). Symmetric to `filterHistoryItems`.
   */
  filterDirectItems(items: Array<SouthConnectorItemEntity<I>>): Array<SouthConnectorItemEntity<I>> {
    return items;
  }

  /**
   * Capability check. Returns `true` (with a TypeScript type-guard narrowing)
   * if the subclass implements `SouthDirectQuery`. Discovery is structural —
   * subclasses don't need a flag, just an implementation of `directQuery()`.
   */
  hasDirectQuery(): this is SouthDirectQuery {
    return 'directQuery' in this;
  }

  /** Capability check — true iff the subclass implements `SouthHistoryQuery.historyQuery()`. */
  hasHistoryQuery(): this is SouthHistoryQuery {
    return 'historyQuery' in this;
  }

  /** Capability check — true iff the subclass implements both `subscribe()` and `unsubscribe()` from `SouthSubscription`. */
  hasSubscription(): this is SouthSubscription {
    return 'subscribe' in this && 'unsubscribe' in this;
  }

  set connectorConfiguration(connectorConfiguration: SouthConnectorEntity<T, I>) {
    this.connector = connectorConfiguration;
  }

  get connectorConfiguration(): SouthConnectorEntity<T, I> {
    return this.connector;
  }

  /**
   * Probe the source with the connector's current settings. Surfaces protocol-
   * specific diagnostics (server build, response counts, etc.) for the UI's
   * "test connection" button. Must not mutate the connector state.
   */
  abstract testConnection(): Promise<OIBusConnectionTestResult>;

  /**
   * Run a single item through the connector with one-off `testingSettings`
   * (overrides such as history window, sample count, etc.) and return the
   * raw content. Backs the UI's per-item test action.
   */
  abstract testItem(item: SouthConnectorItemEntity<I>, testingSettings: SouthConnectorItemTestingSettings): Promise<OIBusContent>;
}
