import { EventEmitter } from 'node:events';
import { delay, generateIntervals, groupItemsByGroup } from '../service/utils';

import {
  SOUTH_SINGLE_ITEMS,
  SouthConnectorItemQueryResult,
  SouthConnectorItemTestingSettings,
  SouthHistoryRecoveryStrategy,
  SouthItemLastValue
} from '../../shared/model/south-connector.model';
import { Instant, Interval } from '../../shared/model/types';
import DeferredPromise from '../service/deferred-promise';
import { DateTime } from 'luxon';
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
  'history-query-interval': {
    currentIntervalStart: Instant;
    currentIntervalEnd: Instant;
  };
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
 *  - Cron ownership lives in the engine (`DataStreamEngine`), which runs a single shared cron per
 *    scan mode and calls `trigger(scanMode)` on every south connector on each tick, regardless
 *    of whether that connector actually uses it — `trigger` itself is the one place that decides
 *    whether there's anything to do, so the engine doesn't need to track per-connector interest.
 *    Enabled items are grouped via `groupItemsByGroup` (so multi-item connectors batch grouped
 *    items into a single request, and single-item connectors get one call per item) into one or
 *    more work-units, bucketed by scan mode ahead of time in `itemGroupsByScanModeId` — rebuilt
 *    once whenever `connector.items` changes, not on every tick — so `trigger()` just looks up
 *    this scan mode's work-units.
 *  - Every enabled item tracks a status: `'pending'` (idle) → `'queued'`
 *    (enqueued by a cron tick, waiting for a free execution slot) →
 *    `'running'` (currently being queried) → back to `'pending'`. A work-unit
 *    whose items are already `'queued'` or `'running'` is dropped when its
 *    scan mode fires again (backpressure signal, throttled to one warning per
 *    hour per work-unit) — the rest of that scan mode's work-units, and any
 *    other scan mode's work-units, are unaffected.
 *  - `dispatch()` drains `taskQueue` into `runTask()` while the number of
 *    in-flight tasks is below `getMaxParallelRun()` (default 1, i.e. today's
 *    fully-sequential behavior; connectors that can safely handle more
 *    concurrent queries override it). It is called synchronously — with no
 *    `await` between checking for a free slot and claiming it — every time
 *    new work is queued or a task finishes, so a freed slot is picked up
 *    immediately.
 *  - `stop()` flips a `stopping` flag and awaits both any in-flight
 *    `runProgress$` deferred (used by one-shot History Query runs that call
 *    `historyQueryHandler` directly, bypassing this scheduler entirely) and
 *    every in-flight task from `runningTasks`, so the engine can shut down
 *    cleanly mid-scan regardless of how many queries are running at once.
 */
export default abstract class SouthConnector<T extends SouthSettings, I extends SouthItemSettings> {
  protected logger!: ILogger;
  // Last time a "previous cron still running" warning was emitted per work-unit (group id, or item
  // id for connectors/items that don't group). Used to throttle that warning to once an hour
  // (logging the in-between occurrences as trace) to avoid flooding.
  private lastBackpressureWarnByUnitId: Map<string, DateTime> = new Map<string, DateTime>();
  // Per-item scheduling status. Only enabled items are tracked; a missing entry is equivalent to 'pending'.
  private itemStatus = new Map<string, 'pending' | 'queued' | 'running'>();
  // FIFO queue of work-units (groups, or singleton arrays for connectors in SOUTH_SINGLE_ITEMS) waiting for a free slot.
  private taskQueue: Array<{ scanModeId: string; items: Array<SouthConnectorItemEntity<I>> }> = [];
  // Every currently-running task's promise. Its size is the current concurrency; stop() awaits all of them.
  private runningTasks = new Set<Promise<void>>();
  // Enabled items grouped via `groupItemsByGroup`, bucketed by their effective scan mode id (own
  // scan mode, or the group's when synced). Rebuilt once whenever `connector.items` changes (see
  // the constructor and the `connectorConfiguration` setter) so `trigger()` — called on every scan
  // mode tick for every south connector, most of which are no-ops — doesn't redo this filter/group
  // work on every single tick.
  private itemGroupsByScanModeId = new Map<string, Array<Array<SouthConnectorItemEntity<I>>>>();
  private stopping = false;
  // Used only by callers that drive historyQueryHandler() directly, bypassing this scheduler (see HistoryQuery).
  private runProgress$: DeferredPromise | null = null;
  private subscribedItems: Array<SouthConnectorItemEntity<I>> = [];
  protected readonly tmpFolder: string;

  public connectedEvent: EventEmitter = new EventEmitter();
  public metricsEvent: TypedEventEmitter<SouthMetricsEvents> = new TypedEventEmitter<SouthMetricsEvents>();

  // Counts concurrently in-flight historyQueryHandler() calls. historyIsRunning below is derived
  // from this counter (rather than being set true/false directly) since more than one work-unit's
  // history query can be running at once — a plain boolean would let one task's completion
  // prematurely clear the flag while a sibling task is still running.
  private historyRunningCount = 0;
  historyIsRunning = false;

  protected constructor(
    protected connector: SouthConnectorEntity<T, I>,
    private engineAddContentCallback: (
      southId: string,
      data: OIBusContent,
      queryTime: Instant,
      items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ) => Promise<void>,
    protected readonly southCacheRepository: SouthCacheRepository,
    protected cacheFolderPath: string
  ) {
    this.logger = loggerService.createChildLogger('south', this.connector.id, this.connector.name);
    this.tmpFolder = path.resolve(cacheFolderPath, 'tmp');
    this.rebuildItemGroupsByScanMode();
  }

  /**
   * Recompute `itemGroupsByScanModeId` from the current `connector.items`. Called once from the
   * constructor and again whenever `connectorConfiguration` is reassigned (the only place
   * `connector` itself changes) — never from `trigger()`, which just reads the result.
   */
  private rebuildItemGroupsByScanMode(): void {
    this.itemGroupsByScanModeId.clear();
    const itemsByScanModeId = new Map<string, Array<SouthConnectorItemEntity<I>>>();
    // Some throwaway test fixtures construct a connector entity without `items` (e.g. `{} as
    // SouthConnectorEntity<...>` for a metrics-only mock) — real entities from the repository
    // always populate it, so this is just defensive, not a real production case.
    for (const item of this.connector.items ?? []) {
      if (!item.enabled) continue;
      const scanModeId = item.syncWithGroup && item.group ? item.group.scanMode.id : item.scanMode!.id;
      const items = itemsByScanModeId.get(scanModeId);
      if (items) {
        items.push(item);
      } else {
        itemsByScanModeId.set(scanModeId, [item]);
      }
    }
    for (const [scanModeId, items] of itemsByScanModeId) {
      this.itemGroupsByScanModeId.set(scanModeId, groupItemsByGroup<I>(this.connector.type, items));
    }
  }

  /**
   * Maximum number of work-units this connector may query concurrently. Defaults to 1 (today's
   * fully-sequential behavior). Connectors whose session/connection model can safely support more
   * concurrent queries override this, reading their own settings and applying their own hard
   * ceiling (there's no common `maxParallelRun` field on the `SouthSettings` union, so this stays
   * per-subclass rather than cast against it here).
   */
  protected getMaxParallelRun(): number {
    return 1;
  }

  /**
   * Stable key identifying a work-unit for backpressure dedup/warning purposes.
   *
   * Derived from the ACTUAL shape of `items` (as produced by `groupItemsByGroup`) rather than
   * re-inferring from the lead item's own `group`/`syncWithGroup` flags: `groupItemsByGroup` only
   * merges items into a multi-item array when every one of them has `syncWithGroup: true` and
   * shares the same group — e.g. a configured group whose first item has `syncWithGroup: false`
   * but whose other items have it `true` produces `[[first], [rest...]]`, not one array. Keying
   * off `items.length` matches that reality directly: a length-1 array is never actually behaving
   * as a merged group in this scheduling context, whether because the item isn't synced, its
   * connector type doesn't support grouping (`SOUTH_SINGLE_ITEMS`), or it's simply the only
   * currently-eligible item in its group — checking the lead item's own flags instead would wrongly
   * collide two independent singleton items that happen to share a group id.
   */
  private getUnitKey(items: Array<SouthConnectorItemEntity<I>>): string {
    const lead = items[0];
    return items.length > 1 && lead.group ? `group:${lead.group.id}` : `item:${lead.id}`;
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
   * Signal the connector is ready to schedule work.
   *
   * Subclasses MAY override to establish the underlying transport (TCP, OPC
   * UA session, MQTT client, etc.). Overrides should call `super.connect()` so
   * subscription bookkeeping and the `'connected'` event are kept in sync.
   */
  connect(): Promise<void> {
    this.logger.info(`South connector "${this.connector.name}" of type ${this.connector.type} started`);

    this.subscribedItems = [];
    this.metricsEvent.emit('connect', {
      lastConnection: DateTime.now().toUTC().toISO()!
    });

    this.connectedEvent.emit('connected');
    return Promise.resolve();
  }

  /**
   * Diff the configured subscription items against what we're currently
   * subscribed to and call `subscribe()` / `unsubscribe()` to reconcile.
   *
   * "Subscription items" are items whose *effective* scan mode is the
   * reserved `'subscription'` id — push-driven rather than pull-driven, so
   * they don't run through the cron loop. Read straight from
   * `itemGroupsByScanModeId` (the same effective-scan-mode bucketing
   * `trigger()` uses, keyed here by the reserved id instead of a real scan
   * mode), flattened back into one array since grouping doesn't matter for
   * subscriptions. Subclasses must implement `SouthSubscription` for this to
   * do anything; non-subscription connectors get a trace log and return.
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
    // itemGroupsByScanModeId already buckets enabled items by this same effective scan mode
    // (own, or the group's when synced) — 'subscription' is just another bucket key in it.
    const subscriptionItems = (this.itemGroupsByScanModeId.get('subscription') ?? []).flat();
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
   * Handle a scan-mode tick. Called by the engine (`DataStreamEngine`), which owns a single shared
   * cron per scan mode and fans out to every south connector on each tick — this method is a no-op
   * for a disabled connector or one with no items on this scan mode, so the engine doesn't need to
   * track which connectors currently care about which scan mode.
   *
   * Looks up this scan mode's work-units from `itemGroupsByScanModeId` — enabled items already
   * grouped via `groupItemsByGroup` (so multi-item connectors batch grouped items into a single
   * request, single-item connectors get one call per item) and bucketed by scan mode, computed
   * once in `rebuildItemGroupsByScanMode()` rather than refiltered/regrouped on every tick. A
   * work-unit is dropped (logged but not re-enqueued) when any of its items is already `'queued'`
   * or `'running'` — i.e. the previous tick's work for that same group/item hasn't finished yet.
   * This is a backpressure signal — usually it means the scan interval is too short for the work
   * being done — surfaced as a throttled warning (once per hour per work-unit) so operators see it
   * without flooding the logs. Other work-units for the same scan mode, and any other scan mode,
   * are unaffected.
   *
   * Newly-queued work-units are handed to `dispatch()`, which starts them
   * immediately if a concurrency slot is free.
   */
  trigger(scanMode: ScanMode): void {
    // The engine calls this unconditionally for every south connector on every scan-mode tick
    // (it no longer tracks which connectors are enabled/interested), so a disabled connector must
    // ignore the tick itself rather than relying on a cron that only used to exist while enabled.
    if (!this.isEnabled()) {
      this.logger.trace(`Connector is disabled. Cron "${scanMode.name}" (${scanMode.cron}) not added`);
      return;
    }
    if (this.stopping) {
      this.logger.trace(`Connector is exiting. Cron "${scanMode.name}" (${scanMode.cron}) not added`);
      return;
    }
    const groupedItemsList = this.itemGroupsByScanModeId.get(scanMode.id);
    if (!groupedItemsList || groupedItemsList.length === 0) {
      this.logger.trace(`No items to run for scan mode ${scanMode.name}`);
      return;
    }

    const itemCount = groupedItemsList.reduce((count, items) => count + items.length, 0);
    this.logger.trace(`Queuing ${itemCount} items for scan mode ${scanMode.name}, grouped in ${groupedItemsList.length} groups`);

    for (const items of groupedItemsList) {
      if (items.some(item => this.itemStatus.get(item.id) === 'queued' || this.itemStatus.get(item.id) === 'running')) {
        this.warnBackpressure(scanMode, items);
        continue;
      }
      for (const item of items) {
        this.itemStatus.set(item.id, 'queued');
      }
      this.taskQueue.push({ scanModeId: scanMode.id, items });
    }
    this.dispatch();
  }

  /**
   * Log (and throttle) the backpressure warning for a work-unit that was skipped because it was
   * already queued or running. Throttled to once an hour per work-unit, with in-between
   * occurrences logged as trace, to avoid flooding the logs when a scan interval is too short.
   */
  private warnBackpressure(scanMode: ScanMode, items: Array<SouthConnectorItemEntity<I>>): void {
    const unitKey = this.getUnitKey(items);
    const now = DateTime.now();
    const lastWarn = this.lastBackpressureWarnByUnitId.get(unitKey);
    const message = `Task job not added in South connector queue for cron "${scanMode.name}" (${scanMode.cron}). The previous cron was still running`;
    if (!lastWarn || now.diff(lastWarn).as('hours') >= 1) {
      this.lastBackpressureWarnByUnitId.set(unitKey, now);
      this.logger.warn(`${message}. The next occurrences will be logged as trace for the next hour`);
    } else {
      this.logger.trace(message);
    }
  }

  /**
   * Drain `taskQueue` into `runTask()` while under the concurrency limit. Synchronous — no `await`
   * between checking for a free slot and claiming it — so this stays race-free under Node's
   * single-threaded execution; this invariant must be preserved if this method is ever changed.
   * Called whenever new work is queued (`trigger`) or a task finishes (below), so a freed slot
   * is picked up immediately.
   */
  private dispatch(): void {
    while (!this.stopping && this.runningTasks.size < this.getMaxParallelRun() && this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!;
      for (const item of task.items) {
        this.itemStatus.set(item.id, 'running');
      }
      const taskPromise: Promise<void> = this.runTask(task)
        .catch((error: unknown) => {
          // Safety net for anything unexpected outside runTask's own per-branch try/catch (e.g. a
          // metrics emit throwing synchronously). Logged rather than left as an unhandled
          // rejection; this.taskQueue/itemStatus cleanup below still runs via finally() regardless.
          this.logger.error(`Unhandled error in South task runner: ${(error as Error).message}`);
        })
        .finally(() => {
          this.runningTasks.delete(taskPromise);
          for (const item of task.items) {
            this.itemStatus.set(item.id, 'pending');
          }
          if (!this.stopping) {
            this.dispatch();
          }
        });
      this.runningTasks.add(taskPromise);
    }
  }

  /**
   * Execute one work-unit (group, or single item).
   *
   *  1. If the connector implements `SouthDirectQuery`, run `directQueryHandler`.
   *  2. If the connector implements `SouthHistoryQuery`, run
   *     `historyQueryHandler` with a time window of "now − maxReadInterval"
   *     to "now". The `trackedInstant` cache then narrows this window on
   *     subsequent runs so we don't re-query already-fetched data.
   *
   * Errors from `direct`/`history` are caught and logged here — a single bad
   * work-unit must not abort or hide errors from any other concurrently
   * running work-unit.
   */
  private async runTask(task: { scanModeId: string; items: Array<SouthConnectorItemEntity<I>> }): Promise<void> {
    const { items } = task;
    const runStart = DateTime.now();
    this.metricsEvent.emit('run-start', {
      lastRunStart: runStart.toUTC().toISO()!
    });

    if (this.hasDirectQuery()) {
      try {
        await this.directQueryHandler(items);
      } catch (error: unknown) {
        const logCtx =
          items.length === 1
            ? { itemId: items[0].id, itemName: items[0].name }
            : items[0].group
              ? { groupId: items[0].group.id, groupName: items[0].group.name }
              : {};
        this.logger.error(logCtx, `Error when querying items with direct access: ${(error as Error).message}`);
      }
    }
    if (this.hasHistoryQuery()) {
      try {
        // By default, retrieve the last hour. If the scan mode has already run and retrieves data, the max instant will
        // be retrieved from the South cache inside the history query handler
        const maxReadInterval = items[0].group?.maxReadInterval ?? items[0].maxReadInterval!;
        // Capture a single `now` so that endTime - startTime == maxReadInterval exactly.
        // Two separate DateTime.now() calls can differ by 1 ms, making the interval
        // fractionally larger than maxReadInterval and causing generateIntervals to
        // produce a spurious 1 ms second sub-interval.
        const now = DateTime.now().toUTC();
        await this.historyQueryHandler(items, now.minus((maxReadInterval || 3600) * 1000).toISO() as Instant, now.toISO() as Instant);
      } catch (error: unknown) {
        const logCtx =
          items.length === 1
            ? { itemId: items[0].id, itemName: items[0].name }
            : items[0].group
              ? { groupId: items[0].group.id, groupName: items[0].group.name }
              : {};
        this.logger.error(logCtx, `Error when querying items with history capabilities: ${(error as Error).message}`);
      }
    }

    this.metricsEvent.emit('run-end', {
      lastRunDuration: DateTime.now().toMillis() - runStart.toMillis()
    });
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

    this.southCacheRepository.saveItemLastValue(this.connector.id, {
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
   *  - The effective start is `max(startTime, cache.trackedInstant + startTimeOffset)`.
   *    A negative startTimeOffset extends the window backwards for late-arriving samples.
   *  - The effective end is `endTime + endTimeOffset`; if it is not after the effective
   *    start, the query is skipped until time advances enough.
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
    this.historyRunningCount++;
    this.historyIsRunning = true;
    try {
      if (SOUTH_SINGLE_ITEMS.includes(this.connector.type)) {
        // Each item is queried independently so that each has its own cache entry and trackedInstant.
        // This mirrors how groupItemsByGroup() sends singleton arrays during normal scan flow.
        for (const item of itemsToRead) {
          await this.runHistoryQueryForLead(item, [item], null, startTime, endTime);
          if (this.stopping) break;
        }
      } else {
        const lead = itemsToRead[0];
        const groupId = lead.group && lead.syncWithGroup ? lead.group.id : null;
        await this.runHistoryQueryForLead(lead, itemsToRead, groupId, startTime, endTime);
      }
    } finally {
      // Guaranteed even if runHistoryQueryForLead throws, so a failed history query can't leave
      // historyIsRunning stuck true for other concurrently running work-units.
      this.historyRunningCount--;
      this.historyIsRunning = this.historyRunningCount > 0;
    }
  }

  /**
   * Query one interval-bounded window of history for `items`, using `lead`'s (item- or
   * group-level, whichever applies) throttling/offset/recovery settings and `lead`'s cache entry.
   * Shared by the single-item and grouped code paths of `historyQueryHandler`, which only differ
   * in which item leads the cache lookup and whether other items ride along in the same query.
   */
  private async runHistoryQueryForLead(
    lead: SouthConnectorItemEntity<I>,
    items: Array<SouthConnectorItemEntity<I>>,
    groupId: string | null,
    startTime: Instant,
    endTime: Instant
  ): Promise<void> {
    let southCache = this.southCacheRepository.getItemLastValue(this.connector.id, lead.id);
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

    // Group settings apply only when the lead item is synced with its group; otherwise the lead's
    // own settings apply. Groups and items share the same field names/types for all of these.
    const settingsSource = lead.group && lead.syncWithGroup ? lead.group : lead;
    const maxReadInterval = settingsSource.maxReadInterval ?? 0;
    const readDelay = settingsSource.readDelay ?? 0;
    const startTimeOffset = settingsSource.startTimeOffset ?? 0;
    const endTimeOffset = settingsSource.endTimeOffset ?? 0;
    const recoveryStrategy = settingsSource.recoveryStrategy ?? 'oldest';

    const queryWindow = this.computeQueryWindow(southCache.trackedInstant, endTime, startTimeOffset, endTimeOffset);
    if (!queryWindow) return;
    const { effectiveStartTime, effectiveEndTime } = queryWindow;
    const intervals = generateIntervals(effectiveStartTime, effectiveEndTime, maxReadInterval, recoveryStrategy);
    this.logIntervals(intervals);
    await this.queryIntervals(intervals, items, southCache, readDelay, recoveryStrategy);
  }

  private async queryIntervals(
    intervals: Array<Interval>,
    items: Array<SouthConnectorItemEntity<I>>,
    southCache: Omit<SouthItemLastValue, 'itemName' | 'groupName'>,
    readDelay: number,
    strategy: SouthHistoryRecoveryStrategy
  ) {
    // For 'newest' strategy, track the max trackedInstant seen across all intervals. Intervals are
    // queried newest-first (see generateIntervals), so this is expected to resolve on the first
    // interval that has data — the comparison is a safety net, not a substitute for that ordering.
    let latestValue: { trackedInstant: Instant; value: unknown } | null = null;

    for (let index = 0; index < intervals.length; index++) {
      const queryTime = DateTime.now().toUTC().toISO()!;
      const interval = intervals[index];

      this.metricsEvent.emit('history-query-interval', { currentIntervalStart: interval.start, currentIntervalEnd: interval.end });
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const lastValue: { trackedInstant: Instant; value: unknown } | null = await this.historyQuery(items, interval.start, interval.end);

      if (strategy === 'oldest') {
        // We update the max instant only if the start interval is lower than the lastInstantRetrieved (i.e., we found data)
        // With a negative startTimeOffset the window extends backwards, so lastInstantRetrieved may be below trackedInstant — check both conditions
        if (lastValue && (!southCache.trackedInstant || lastValue.trackedInstant > southCache.trackedInstant)) {
          this.logger.debug(`Saving last value ${JSON.stringify(lastValue.value)}, trackedInstant ${lastValue.trackedInstant}`);
          this.southCacheRepository.saveItemLastValue(this.connector.id, {
            groupId: southCache.groupId,
            itemId: southCache.itemId,
            queryTime,
            value: lastValue.value,
            trackedInstant: lastValue.trackedInstant
          });
        }
      } else if (lastValue && (!latestValue || lastValue.trackedInstant > latestValue.trackedInstant)) {
        latestValue = lastValue;
      }

      if (this.stopping) {
        this.logger.debug(`Connector is stopping. Exiting history query at interval ${index}: [${interval.start}, ${interval.end}]`);
        return;
      }

      if (index !== intervals.length - 1) {
        await delay(readDelay);
      }
    }

    // For 'newest' strategy: only advance trackedInstant once all intervals have been queried.
    // This prevents a mid-run restart from skipping the not-yet-queried older intervals.
    // Only save if data was actually found — otherwise leave the cache untouched.
    if (strategy === 'newest' && !this.stopping && latestValue) {
      this.logger.debug(`Saving last value ${JSON.stringify(latestValue.value)}, trackedInstant ${latestValue.trackedInstant}`);
      this.southCacheRepository.saveItemLastValue(this.connector.id, {
        groupId: southCache.groupId,
        itemId: southCache.itemId,
        queryTime: DateTime.now().toUTC().toISO()!,
        value: latestValue.value,
        trackedInstant: latestValue.trackedInstant
      });
    }
  }

  private computeQueryWindow(
    startTime: Instant,
    endTime: Instant,
    startTimeOffset: number,
    endTimeOffset: number
  ): { effectiveStartTime: Instant; effectiveEndTime: Instant } | null {
    const effectiveStartTime = DateTime.fromISO(startTime).plus({ milliseconds: startTimeOffset }).toUTC().toISO()!;
    const effectiveEndTime = DateTime.fromISO(endTime).plus({ milliseconds: endTimeOffset }).toUTC().toISO()!;

    if (effectiveEndTime <= effectiveStartTime) {
      this.logger.warn(
        `Skipping history query: effective window [${effectiveStartTime}, ${effectiveEndTime}] does not extend past ` +
          `the tracked instant or the query start ${startTime} (startTimeOffset: ${startTimeOffset} ms, endTimeOffset: ${endTimeOffset} ms)`
      );
      return null;
    }
    return { effectiveStartTime, effectiveEndTime };
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
   * Drain the queue, release transport resources. Subclasses MAY override to
   * close sessions / sockets; overrides should call `super.disconnect()` so
   * queue state is reset.
   *
   * Idempotent — safe to call when already disconnected.
   */
  disconnect(): Promise<void> {
    this.taskQueue = [];
    this.itemStatus.clear();

    this.logger.debug(`South connector "${this.connector.name}" (${this.connector.id}) disconnected`);
    return Promise.resolve();
  }

  /**
   * Graceful shutdown. Flips `stopping`, awaits any in-flight direct-call history query via
   * `runProgress$` and every in-flight scheduled task via `runningTasks`, then disconnects. Used
   * by the engine on connector delete / config reload / OIBus shutdown.
   */
  async stop(): Promise<void> {
    this.stopping = true;
    this.logger.debug(`Stopping South "${this.connector.name}" (${this.connector.id})...`);

    if (this.runProgress$) {
      this.logger.debug('Waiting for South task to finish');
      await this.runProgress$.promise;
    }
    if (this.runningTasks.size > 0) {
      this.logger.debug(`Waiting for ${this.runningTasks.size} South task(s) to finish`);
      await Promise.all(this.runningTasks);
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
    this.southCacheRepository.deleteItemsBySouth(this.connector.id);
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
    this.rebuildItemGroupsByScanMode();
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
   * raw content alongside how long connecting to the source and running the
   * query each took. Backs the UI's per-item test action.
   */
  abstract testItem(
    item: SouthConnectorItemEntity<I>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult>;
}
