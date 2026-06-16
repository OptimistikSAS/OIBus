import { CronJob } from 'cron';
import { EventEmitter } from 'node:events';
import DeferredPromise from '../service/deferred-promise';
import TypedEventEmitter from '../service/typed-event-emitter';
import { Instant } from '../../shared/model/types';
import {
  CacheContentUpdateCommand,
  CacheMetadata,
  CacheMetadataSource,
  CacheSearchParam,
  CacheSearchResult,
  DataFolderType,
  FileCacheContent,
  OIBusConnectionTestResult,
  OIBusContent,
  OIBusTimeValue
} from '../../shared/model/engine.model';
import { DateTime } from 'luxon';
import { createReadStream, ReadStream } from 'node:fs';
import path from 'node:path';
import { NorthSettings } from '../../shared/model/north-settings.model';
import { createOIBusError, delay, generateRandomId, validateCronExpression } from '../service/utils';
import { NorthConnectorEntity } from '../model/north-connector.model';
import { ScanMode } from '../model/scan-mode.model';
import type { ICacheService } from '../model/cache.service.model';
import { Readable } from 'node:stream';
import { createTransformer } from '../service/transformer.service';
import IgnoreTransformer from '../transformers/ignore-transformer';
import IsoTransformer from '../transformers/iso-transformer';
import { NorthTransformerWithOptions } from '../model/transformer.model';
import { CacheSize, CONTENT_FOLDER } from '../model/engine.model';
import type { ILogger } from '../model/logger.model';
import { loggerService } from '../service/logger/logger.service';

/** Events published by a North connector's {@link NorthConnector.metricsEvent}. */
export interface NorthMetricsEvents {
  /** Current on-disk cache/error/archive sizes (gauge). Relayed from the cache service. */
  'cache-size': CacheSize;
  /** Size delta of a file just added to the cache (counter increment). */
  'cache-content-size': number;
  connect: { lastConnection: Instant };
  'run-start': { lastRunStart: Instant };
  'run-end': { lastRunDuration: number; metadata: CacheMetadata; action: 'sent' | 'errored' | 'archived' };
}

/**
 * Base class for every North connector.
 *
 * **Conceptual model**
 *  - North is **pull-based** from a local file cache. South connectors call
 *    `cacheContent(...)` to write payloads (optionally through a transformer);
 *    a separate cron-driven `run()` loop later pulls files out of the cache
 *    and hands them to the subclass's `handleContent()` for actual delivery.
 *  - This decoupling means a flaky destination doesn't block South ingestion:
 *    files just pile up in the cache and get retried on the next tick.
 *
 * **What a subclass implements**
 *  - `supportedTypes()`: which `OIBusContent.contentType` values this North
 *    can deliver (e.g. `['oianalytics', 'any']`). Unsupported types are
 *    automatically routed to the error folder by `handleContentWrapper`.
 *  - `handleContent(fileStream, metadata)`: the actual delivery. May throw —
 *    the wrapper handles retry + error-folder routing.
 *  - `testConnection()`: probe for the UI's "test" button.
 *  - Optionally override `connect()` / `disconnect()` for protocol setup —
 *    call `super.*` to keep the cron / cache lifecycle correct.
 *
 * **Transformer routing** (in `cacheContent` → `findTransformer`)
 *  - Resolution priority: items-level → group-level → south-level fallback.
 *  - Standard transformers `'ignore'` and `'iso'` short-circuit: ignore drops
 *    the data, iso skips transformation and caches the raw payload.
 *  - Resolution uses a pre-built lookup that's invalidated on the
 *    `connectorConfiguration` setter (see `transformerLookup` doc).
 *
 * **Retry semantics** (in `handleContentWrapper`)
 *  - On `handleContent` failure: increment `errorCount`, log, keep the file
 *    in the cache. Next tick re-tries the same file.
 *  - When `errorCount > caching.error.retryCount` (and the error didn't set
 *    `forceRetry`), the file is moved to the `error/` folder so the rest of
 *    the cache can keep flowing.
 */
export default abstract class NorthConnector<T extends NorthSettings> {
  protected logger!: ILogger;
  private contentBeingSent: { filename: string; metadata: CacheMetadata } | null = null;
  private errorCount = 0;

  private cronByScanModeIds: Map<string, CronJob> = new Map<string, CronJob>();
  private runProgress$: DeferredPromise | null = null;
  // The queue is needed to store the task when one is already running. For example, if we have an "Every second" task added
  // while an "Every minute" task is running, the "Every second" task while be queued and executed next, from the run method
  // through the taskRunnerEvent
  private taskJobQueue: Array<{ id: string; name: string }> = [];
  private taskRunnerEvent: EventEmitter = new EventEmitter();
  public metricsEvent: TypedEventEmitter<NorthMetricsEvents> = new TypedEventEmitter<NorthMetricsEvents>();

  private stopping = false;

  protected constructor(
    protected connector: NorthConnectorEntity<T>,
    private cacheService: ICacheService
  ) {
    this.logger = loggerService.createChildLogger('north', this.connector.id, this.connector.name);
  }

  private onCacheSize = (cacheSize: CacheSize) => {
    this.metricsEvent.emit('cache-size', cacheSize);
  };

  private onCacheContentSize = (contentSize: number) => {
    this.metricsEvent.emit('cache-content-size', contentSize);
  };

  /** Live cache/error/archive folder sizes, read from the cache service (the authoritative source). */
  getCacheSizes(): CacheSize {
    return this.cacheService.getCacheContentSizes();
  }

  /**
   * Resolver lookup for findTransformer. Built lazily on first use and rebuilt
   * when the connector configuration changes (via the setter below). Maps:
   *   - "southId\0itemId" → items-level transformer (with its position in the
   *     connector.transformers array so we can preserve list-order priority
   *     when multiple transformers match different items in the same batch)
   *   - "southId\0itemId" → group-level transformer (same shape)
   *   - "southId"          → south-level fallback transformer
   *   - "dataSourceId"     → oibus-api transformer
   *   - one entry for the oianalytics-setpoint transformer
   */
  private transformerLookup: {
    itemLevel: Map<string, { transformer: NorthTransformerWithOptions; listIndex: number }>;
    groupLevel: Map<string, { transformer: NorthTransformerWithOptions; listIndex: number }>;
    southLevel: Map<string, NorthTransformerWithOptions>;
    apiLevel: Map<string, NorthTransformerWithOptions>;
    oianalyticsSetpoint: NorthTransformerWithOptions | undefined;
  } | null = null;

  set connectorConfiguration(connectorConfiguration: NorthConnectorEntity<T>) {
    this.connector = connectorConfiguration;
    // Invalidate the lookup; rebuilt lazily on the next findTransformer call.
    this.transformerLookup = null;
  }

  get connectorConfiguration() {
    return this.connector;
  }

  /**
   * Force a transformer-lookup rebuild. Used internally when `connectorConfiguration`
   * is reassigned, and exposed for tests that mutate `connector.transformers`
   * in place (which the setter would otherwise miss). Production code reloads
   * the whole connector via the setter and never mutates transformer entries
   * in place, so this is a test/internal hatch only.
   */
  protected rebuildTransformerCache(): void {
    const itemLevel = new Map<string, { transformer: NorthTransformerWithOptions; listIndex: number }>();
    const groupLevel = new Map<string, { transformer: NorthTransformerWithOptions; listIndex: number }>();
    const southLevel = new Map<string, NorthTransformerWithOptions>();
    const apiLevel = new Map<string, NorthTransformerWithOptions>();
    let oianalyticsSetpoint: NorthTransformerWithOptions | undefined;

    // Use the null character as a path separator — guaranteed to never appear
    // in an itemId / southId, so the composite key collapses uniquely.
    const compositeKey = (southId: string, itemId: string) => `${southId}\0${itemId}`;

    this.connector.transformers.forEach((t, listIndex) => {
      const source = t.source;
      if (source.type === 'south') {
        const entry = { transformer: t, listIndex };
        // Items-level: every item in the transformer's items list maps to this
        // transformer. First-wins so order in `connector.transformers` matters.
        for (const item of source.items) {
          const key = compositeKey(source.south.id, item.id);
          if (!itemLevel.has(key)) {
            itemLevel.set(key, entry);
          }
        }
        // Group-level: every item in the group maps to this transformer.
        if (source.group) {
          for (const item of source.group.items) {
            const key = compositeKey(source.south.id, item.id);
            if (!groupLevel.has(key)) {
              groupLevel.set(key, entry);
            }
          }
        }
        // South-level fallback: only for transformers with no items and no group.
        if (!source.group && source.items.length === 0) {
          if (!southLevel.has(source.south.id)) {
            southLevel.set(source.south.id, t);
          }
        }
      } else if (source.type === 'oibus-api') {
        if (!apiLevel.has(source.dataSourceId)) {
          apiLevel.set(source.dataSourceId, t);
        }
      } else if (source.type === 'oianalytics-setpoint') {
        if (!oianalyticsSetpoint) {
          oianalyticsSetpoint = t;
        }
      }
    });

    this.transformerLookup = { itemLevel, groupLevel, southLevel, apiLevel, oianalyticsSetpoint };
  }

  private getTransformerLookup() {
    if (!this.transformerLookup) {
      this.rebuildTransformerCache();
    }
    return this.transformerLookup!;
  }

  /**
   * Wire up event listeners and start the cache. Always boots the cache (so
   * the UI can search cached/error/archive even when the connector is
   * disabled); only calls `connect()` (which installs the cron) when enabled.
   */
  async start(): Promise<void> {
    this.cacheService.cacheSizeEventEmitter.on('cache-size', this.onCacheSize);
    this.cacheService.cacheSizeEventEmitter.on('cache-content-size', this.onCacheContentSize);
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
   * Install the send-cron and check whether there's already content in the
   * cache to flush.
   *
   * Subclasses MAY override to open a session / socket / HTTP client to the
   * destination. Overrides should call `super.connect()` so the cron + initial
   * trigger sweep run.
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
   * Create (or replace) the cron job that periodically enqueues a "send" tick.
   * Each cron firing adds a task to the queue via `addTaskToQueue`, which the
   * `'run'` event handler drains.
   *
   * Invalid cron expressions are logged and skipped — a misconfigured cron
   * must not crash the North.
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

  /**
   * Enqueue a "send" task. Same de-duplication contract as South's
   * `addToQueue`: identical task ids are coalesced, and an empty queue
   * triggers `'run'` immediately. Tasks come from three sources:
   *   - the cron (scan-mode tick),
   *   - `triggerRunIfNecessary` (file count / element count threshold reached),
   *   - retry after `errorCount > 0`.
   */
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

  /**
   * Drain one queued task: pull a file from the cache and try to deliver it.
   *
   * Guards: skip entirely if a previous `run()` is still in flight
   * (`runProgress$`) or the connector is shutting down. The deferred is
   * cleared at every exit path — including on an unexpected error outside
   * `handleContentWrapper`'s own try/catch (e.g. a cache read failure) — so
   * `stop()` can be cleanly awaited and this connector is never left
   * permanently locked out of future runs.
   *
   * After the run, decides what to do next:
   *  - more tasks queued → emit `'run'` to keep draining.
   *  - queue empty → call `triggerRunIfNecessary` with either the retry
   *    interval (if the last attempt errored) or the configured throttling
   *    minimum, which may re-enqueue if cache thresholds are breached.
   */
  async run(taskDescription: { id: string; name: string }): Promise<void> {
    this.logger.trace(`North run triggered by task "${taskDescription.name}" (${taskDescription.id})`);
    if (this.runProgress$ || this.stopping) {
      this.logger.debug(`Task "${taskDescription.name}" not run because the connector is stopping or a run is already in progress`);
      return;
    }
    this.runProgress$ = new DeferredPromise();
    try {
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
    } catch (error: unknown) {
      this.logger.error(`Unhandled error in North task runner: ${(error as Error).message}`);
      this.taskJobQueue.shift();
      this.runProgress$!.resolve();
      this.runProgress$ = null;
    }
  }

  /**
   * One "deliver from cache" attempt. The full lifecycle:
   *  1. Pull the next pending file from the cache (or reuse a previously
   *     pulled one if we're retrying — `contentBeingSent` holds the cursor).
   *  2. Reject unsupported content types straight to the error folder.
   *  3. Stream the file into the subclass's `handleContent()`.
   *  4. On success: archive or remove the file per the connector's archive
   *     setting, reset `errorCount`, emit `'run-end'` with action `'sent'`
   *     or `'archived'`.
   *  5. On failure: keep the file, increment `errorCount`, and (if past the
   *     retry-count threshold and the error wasn't `forceRetry`) move it to
   *     the error folder so the queue can keep flowing.
   *
   * The metadata structure is `JSON.parse(JSON.stringify(...))`-cloned before
   * use so a subclass that mutates the metadata can't corrupt the in-flight
   * cursor.
   */
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
      this.contentBeingSent = null;
      this.errorCount = 0;
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
        this.contentBeingSent = null;
        this.errorCount = 0;
      }
      // Otherwise keep `contentBeingSent` and `errorCount` so the next run retries the same content
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
  }

  /**
   * Engine-facing entry point. Called by `data-stream-engine.addContent` for
   * every batch of data the South emits.
   *
   * Routing:
   *  - Cache full → drop on the floor (the cache-full warning is debounced
   *    inside `cacheIsFull`).
   *  - No transformer matches → `handleNoTransformer` (caches raw if the
   *    type is supported, else logs and drops).
   *  - Transformer is the standard `'ignore'` → drop intentionally.
   *  - Transformer is the standard `'iso'` → cache as-is (pass-through).
   *  - Otherwise → run the transformer and cache its output.
   *
   * After caching, `triggerRunIfNecessary(0)` is called so a configured
   * trigger threshold (file count, element count) can promote this batch to
   * an immediate send instead of waiting for the next cron tick.
   */
  async cacheContent(data: OIBusContent, source: CacheMetadataSource): Promise<void> {
    if (this.cacheService.cacheIsFull(this.connector.caching.throttling.maxSize)) {
      return;
    }

    // A single batch coming from a south can carry values from several items, each potentially
    // routed to a different transformer (per item, per group, or the south-level fallback).
    // `buildRoutingGroups` splits the batch so every group is transformed by the transformer that
    // actually targets it, instead of routing the whole batch to a single (earliest) transformer.
    for (const group of this.buildRoutingGroups(data, source)) {
      await this.applyTransformer(group.data, group.transformer, group.source);
    }

    // No delay needed here, we check for trigger right now, once the cache is updated for every group
    await this.triggerRunIfNecessary(0);
  }

  /**
   * Transform and cache a single routing group. Mirrors the standard/ignore/iso handling but does
   * NOT trigger a run — `cacheContent` triggers once after all groups have been cached.
   */
  private async applyTransformer(
    data: OIBusContent,
    transformerConfig: NorthTransformerWithOptions | undefined,
    source: CacheMetadataSource
  ): Promise<void> {
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
      return this.cacheWithoutTransform(data);
    }

    this.logger.trace(
      `Transforming data of type ${data.type} into ${transformerConfig.transformer.outputType} using transformer ${transformerConfig.transformer.id}`
    );
    await this.executeTransformation(data, transformerConfig, source);
  }

  /**
   * Split an incoming batch into groups that each map to a single transformer.
   *
   * Only south-sourced `time-values` batches can both (a) carry several items routed to different
   * transformers and (b) be split safely (each value references its item via `pointId === item.name`).
   * Every other case — non-south sources, opaque `any-content`/file payloads, or a batch whose items
   * all resolve to the same transformer (e.g. a south-level-only transformer) — is returned as a
   * single group, preserving the previous behaviour with no extra work.
   */
  private buildRoutingGroups(
    data: OIBusContent,
    source: CacheMetadataSource
  ): Array<{ transformer: NorthTransformerWithOptions | undefined; data: OIBusContent; source: CacheMetadataSource }> {
    const singleGroup = () => [{ transformer: this.findTransformer(source), data, source }];

    if (source.source !== 'south' || data.type !== 'time-values') {
      return singleGroup();
    }

    const lookup = this.getTransformerLookup();
    const resolve = (itemId: string): NorthTransformerWithOptions | undefined => {
      const key = `${source.southId}\0${itemId}`;
      return lookup.itemLevel.get(key)?.transformer ?? lookup.groupLevel.get(key)?.transformer ?? lookup.southLevel.get(source.southId);
    };

    // Resolve the transformer of every item in the batch and index it by item name (= pointId).
    const transformerByItemName = new Map<string, NorthTransformerWithOptions | undefined>();
    const distinctTransformers = new Set<NorthTransformerWithOptions | undefined>();
    for (const item of source.items) {
      const transformer = resolve(item.id);
      transformerByItemName.set(item.name, transformer);
      distinctTransformers.add(transformer);
    }

    // All items share the same transformer (incl. south-level-only) → no split needed.
    if (distinctTransformers.size <= 1) {
      return singleGroup();
    }

    // Partition the values by the transformer their point is routed to. If any value cannot be
    // attributed to a known item, fall back to a single group to avoid silently dropping data.
    const contentByTransformer = new Map<NorthTransformerWithOptions | undefined, Array<OIBusTimeValue>>();
    for (const value of data.content) {
      if (!transformerByItemName.has(value.pointId)) {
        this.logger.warn(
          `Cannot route point "${value.pointId}" to a transformer: it does not match any source item. Routing the whole batch to a single transformer`
        );
        return singleGroup();
      }
      const transformer = transformerByItemName.get(value.pointId);
      const values = contentByTransformer.get(transformer);
      if (values) {
        values.push(value);
      } else {
        contentByTransformer.set(transformer, [value]);
      }
    }

    return Array.from(contentByTransformer.entries()).map(([transformer, content]) => {
      const pointIds = new Set(content.map(value => value.pointId));
      return {
        transformer,
        data: { type: 'time-values', content } as OIBusContent,
        source: { ...source, items: source.items.filter(item => pointIds.has(item.name)) }
      };
    });
  }

  private findTransformer(metadataSource: CacheMetadataSource): NorthTransformerWithOptions | undefined {
    const lookup = this.getTransformerLookup();

    if (metadataSource.source === 'south') {
      // For items-level and group-level matches we need to preserve the
      // original `.find()` semantics: among all transformers matching ANY of
      // the batch's items, return the one earliest in `connector.transformers`.
      // We track that via `listIndex` stored at cache build time and pick the
      // smallest one across the batch's items.
      const pickEarliest = (table: Map<string, { transformer: NorthTransformerWithOptions; listIndex: number }>) => {
        let best: { transformer: NorthTransformerWithOptions; listIndex: number } | undefined;
        for (const item of metadataSource.items) {
          const candidate = table.get(`${metadataSource.southId}\0${item.id}`);
          if (candidate && (!best || candidate.listIndex < best.listIndex)) {
            best = candidate;
            // Tiny shortcut: index 0 is the floor, can't beat it.
            if (best.listIndex === 0) break;
          }
        }
        return best?.transformer;
      };

      // 1) Items-level (most specific)
      const byItem = pickEarliest(lookup.itemLevel);
      if (byItem) return byItem;

      // 2) Group-level
      const byGroup = pickEarliest(lookup.groupLevel);
      if (byGroup) return byGroup;

      // 3) South-level fallback
      return lookup.southLevel.get(metadataSource.southId);
    }

    if (metadataSource.source === 'oibus-api') {
      return lookup.apiLevel.get(metadataSource.dataSourceId);
    }

    if (metadataSource.source === 'oianalytics-setpoints') {
      return lookup.oianalyticsSetpoint;
    }

    return undefined;
  }

  private async handleNoTransformer(data: OIBusContent): Promise<void> {
    if (!this.supportedTypes().includes(data.type)) {
      this.logger.trace(`Data type "${data.type}" not supported by the connector. Data will be ignored.`);
      return;
    }
    await this.cacheWithoutTransform(data);
  }

  private async executeTransformation(data: OIBusContent, config: NorthTransformerWithOptions, source: CacheMetadataSource): Promise<void> {
    const transformer = createTransformer(config, this.connector, this.logger);

    // In-memory payloads (time-values / setpoint / any-content) go through
    // `transformInMemory`, which lets specialised transformers (e.g. the
    // OIAnalytics one) bypass the JSON.stringify → stream → collect-chunks →
    // JSON.parse round-trip. The base-class default still streamifies for
    // transformers that haven't been specialised
    switch (data.type) {
      case 'time-values':
        {
          const maxElements = this.connector.caching.throttling.maxNumberOfElements;
          const content = data.content;

          if (maxElements > 0 && content.length > maxElements) {
            // Chunk processing
            for (let i = 0; i < content.length; i += maxElements) {
              const chunk = content.slice(i, i + maxElements);
              const { metadata, output } = await transformer.transformInMemory(chunk, source, null);
              await this.cacheService.addCacheContent(output, {
                contentType: metadata.contentType,
                contentFilename: metadata.contentFile,
                numberOfElement: metadata.numberOfElement
              });
            }
          } else {
            // Single batch
            const { metadata, output } = await transformer.transformInMemory(content, source, null);
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
          const { metadata, output } = await transformer.transformInMemory(data.content, source, null);
          await this.cacheService.addCacheContent(output, {
            contentType: metadata.contentType,
            contentFilename: metadata.contentFile,
            numberOfElement: metadata.numberOfElement
          });
        }
        break;
      case 'any-content':
        {
          // any-content is already a serialised string; pass it through as-is
          // so the default base-class fallback can wrap it without an extra
          // JSON.stringify round-trip (string is short-circuited).
          const { metadata, output } = await transformer.transformInMemory(data.content, source, null);
          await this.cacheService.addCacheContent(output, {
            contentType: metadata.contentType,
            contentFilename: metadata.contentFile,
            numberOfElement: metadata.numberOfElement
          });
        }
        break;

      case 'any':
        {
          // True file-on-disk path stays on the stream API — we don't want to
          // slurp the whole file into memory.
          const randomId = generateRandomId(10);
          // Use the logical filename when provided (e.g. "subdir/file.json" from folder-scanner),
          // otherwise fall back to the basename of the disk path.
          const logicalName = data.filename ?? path.basename(data.filePath);
          const { name, ext } = path.parse(logicalName);
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
        // Use the logical filename when provided (preserves relative sub-paths like "subdir/file.json").
        // Fall back to the basename so that absolute paths are never leaked into cache metadata.
        contentFilename: data.filename ?? path.basename(data.filePath)
      });
    } else if (data.type === 'any-content') {
      await this.cacheService.addCacheContent(Readable.from(data.content), {
        contentType: data.type
      });
    } else {
      if (this.connector.caching.throttling.maxNumberOfElements > 0) {
        for (let i = 0; i < data.content.length; i += this.connector.caching.throttling.maxNumberOfElements) {
          const chunks: Array<object> = data.content.slice(i, i + this.connector.caching.throttling.maxNumberOfElements);
          await this.cacheService.addCacheContent(Readable.from(JSON.stringify(chunks)), {
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
   * Release transport resources and stop the cache's debounce timers.
   * Subclasses MAY override to close their HTTP client / socket / session;
   * overrides should call `super.disconnect()` so the cache shuts down its
   * internal timers cleanly.
   */
  disconnect(): Promise<void> {
    this.cacheService.stop();
    this.logger.info(`"${this.connector.name}" (${this.connector.id}) disconnected`);
    return Promise.resolve();
  }

  /**
   * Graceful shutdown. Symmetric to South's `stop()`:
   *  1. Flip `stopping` and detach the queue listener.
   *  2. Wait for any in-flight `run()` to finish.
   *  3. Stop crons, clear the queue, disconnect.
   */
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

  refreshLogger(): void {
    this.logger = loggerService.createChildLogger('north', this.connector.id, this.connector.name);
    this.cacheService.refreshLogger('north', this.connector.id, this.connector.name);
  }

  /**
   * Empty the cache (cache + error + archive folders). Triggered by the
   * operator from the UI. Subclasses do NOT need to override; this only
   * touches files, not transport state.
   */
  async resetCache(): Promise<void> {
    await this.cacheService.removeAllCacheContent();
  }

  /**
   * Propagate a scan-mode cron change from the engine. Only rebuilds the
   * cron if this North actually uses that scan mode (otherwise no-op).
   */
  updateScanMode(scanMode: ScanMode): void {
    if (this.cronByScanModeIds.get(scanMode.id)) {
      this.createCronJob(scanMode);
    }
  }

  /**
   * Check cache state and possibly enqueue an immediate send tick. Three
   * trigger paths, in order:
   *  1. `errorCount > 0` → a retry task so a previously failed send gets
   *     another shot without waiting for the next cron.
   *  2. Raw-file queue depth past `caching.trigger.numberOfFiles` → flush.
   *  3. Element queue depth past `caching.trigger.numberOfElements` → flush.
   *
   * `timeToWait` lets the caller defer the check (used by `run()` to honour
   * `caching.throttling.runMinDelay` between back-to-back sends). The
   * `stopping` flag short-circuits after the wait so a shutdown during the
   * delay doesn't re-arm the queue.
   */
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

  /**
   * Content types this North can deliver, expressed as the `contentType`
   * strings produced by South connectors and transformers (e.g.
   * `'oianalytics'`, `'any'`, `'modbus'`). The wrapper routes any other
   * content type to the error folder so misrouted payloads don't get
   * delivered to a destination that can't handle them.
   */
  abstract supportedTypes(): Array<string>;

  /**
   * Probe the destination with the connector's current settings. Surfaces
   * protocol-specific diagnostics for the UI's "test connection" button.
   * Must not mutate connector state.
   */
  abstract testConnection(): Promise<OIBusConnectionTestResult>;

  /**
   * The actual send. Receives the cached file as a read stream plus its
   * metadata. May throw — `handleContentWrapper` handles retry and
   * error-folder routing. If a thrown error sets `forceRetry`, the file stays
   * in the cache forever (no error-folder fallback); use it when the failure
   * is transient by definition (network blip).
   */
  abstract handleContent(fileStream: ReadStream, cacheMetadata: CacheMetadata): Promise<void>;

  /** Absolute path of the cache root for this connector. */
  protected getCacheFolder() {
    return this.cacheService.cacheFolder;
  }
}
