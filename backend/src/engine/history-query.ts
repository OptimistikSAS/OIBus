import { delay, generateIntervals } from '../service/utils';
import NorthConnector from '../north/north-connector';
import SouthConnector from '../south/south-connector';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { NorthSettings } from '../../shared/model/north-settings.model';
import {
  CacheContentUpdateCommand,
  CacheMetadata,
  CacheSearchParam,
  CacheSearchResult,
  DataFolderType,
  FileCacheContent,
  HistoryQueryItemStatus,
  OIBusTimeValue
} from '../../shared/model/engine.model';
import { HistoryQueryEntity } from '../model/histor-query.model';
import { SouthConnectorItemEntity } from '../model/south-connector.model';
import { EventEmitter } from 'node:events';
import { Instant } from '../model/types';
import { ScanMode } from '../model/scan-mode.model';
import { CacheSize } from '../model/engine.model';
import TypedEventEmitter from '../service/typed-event-emitter';
import type { ILogger } from '../model/logger.model';
import { loggerService } from '../service/logger/logger.service';
import { Interval } from '../../shared/model/types';
import { ScanMode } from '../model/scan-mode.model';

const FINISH_INTERVAL = 5000;

// Per-item runtime status is tracked across a history query run, for progress-monitoring UIs, using
// the canonical `HistoryQueryItemStatus` shape from `../../shared/model/engine.model` (shared with
// the frontend). It's seeded at `start()` from the south connector's persisted cache snapshot
// (`getHistoryQuerySnapshot`) so a resumed run reflects the correct starting point instead of
// looking like it starts from scratch, then kept live via the `history-query-item-start` /
// `add-values` / `add-file` / `south-history-query-stop` events.

/** Events published by a History Query's {@link HistoryQuery.metricsEvent} (relayed from its north/south). */
export interface HistoryMetricsEvents {
  'north-connect': { lastConnection: Instant };
  'north-run-start': { lastRunStart: Instant };
  'north-run-end': { lastRunDuration: number; metadata: CacheMetadata; action: 'sent' | 'errored' | 'archived' };
  'north-cache-size': CacheSize;
  'north-cache-content-size': number;
  'south-connect': { lastConnection: Instant };
  'south-run-start': { lastRunStart: Instant };
  'south-run-end': { lastRunDuration: number };
  'south-history-query-start': { running: boolean };
  'south-history-query-interval': {
    running: boolean;
    // Ratcheted progress against the whole, fixed configured time range — never regresses, even
    // when a multi-item connector moves on to an item whose own window starts well before where
    // the previous item left off.
    intervalProgress: number;
    currentIntervalStart: Instant;
    currentIntervalEnd: Instant;
    currentIntervalNumber: number;
    numberOfIntervals: number;
    // Item identity, only set for SOUTH_SINGLE_ITEMS connectors (items queried one at a time).
    itemName?: string;
    currentItemNumber?: number;
    numberOfItems?: number;
    // Progress scoped to the CURRENT item's own interval list (raw, not ratcheted) — resets to
    // (close to) 0 for every new item, unlike `intervalProgress`.
    itemIntervalProgress?: number;
    // Raw pass-through of the current lead's own interval index/total (not ratcheted), for display
    // purposes (e.g. "12 / 34"). Same source data as `itemIntervalProgress`, just surfaced raw.
    itemIntervalNumber?: number;
    itemNumberOfIntervals?: number;
  };
  'south-history-query-stop': { running: boolean };
  // Emitted once per item (SOUTH_SINGLE_ITEMS connectors only), when the run moves to a new item —
  // carries the full up-to-date itemsStatus array so the UI never needs to reconstruct it itself.
  'south-history-query-item': {
    itemName: string;
    currentItemNumber: number;
    numberOfItems: number;
    itemsStatus: Array<HistoryQueryItemStatus>;
  };
  'south-add-values': { numberOfValuesRetrieved: number; lastValueRetrieved: OIBusTimeValue | null };
  'south-add-file': { lastFileRetrieved: string };
}

export default class HistoryQuery {
  private finishInterval: NodeJS.Timeout | null = null;
  private stopping = false;
  private logger!: ILogger;
  private intervals: Array<Interval> = [];
  // Ratcheted high-water mark of `currentIntervalEnd` seen so far. Never allowed to regress — see
  // `computeCurrentProgress`. Seeded at `start()` from the persisted south cache so a resumed run
  // doesn't visually restart from zero.
  private maxIntervalEndReached: Instant | null = null;
  // Per-item runtime status, keyed by itemId. Seeded at `start()`, then kept live via item-start /
  // add-values / add-file / stop events.
  private itemsStatus: Map<string, HistoryQueryItemStatus> = new Map<string, HistoryQueryItemStatus>();

  public metricsEvent: TypedEventEmitter<HistoryMetricsEvents> = new TypedEventEmitter<HistoryMetricsEvents>();
  public finishEvent: EventEmitter = new EventEmitter();

  constructor(
    private historyConfiguration: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>,
    private north: NorthConnector<NorthSettings>,
    private south: SouthConnector<SouthSettings, SouthItemSettings>
  ) {
    this.logger = loggerService.createChildLogger('history-query', this.historyConfiguration.id, this.historyConfiguration.name);
    this.intervals = generateIntervals(
      historyConfiguration.queryTimeRange.startTime,
      historyConfiguration.queryTimeRange.endTime,
      historyConfiguration.queryTimeRange.maxReadInterval
    );
  }

  /** Live north cache/error/archive folder sizes, read from the cache service (the authoritative source). */
  getNorthCacheSizes(): CacheSize {
    return this.north.getCacheSizes();
  }

  /**
   * Relay a scan-mode tick to the north, which decides whether the scan mode is its caching
   * trigger. Only the north is ticked: the south side of a history query is a one-shot backfill
   * driven by its own completion loop, not by a scan mode.
   */
  triggerNorth(scanMode: ScanMode): void {
    this.north.trigger(scanMode);
  }

  async start(): Promise<void> {
    this.north.metricsEvent.on('connect', (data: { lastConnection: Instant }) => {
      this.metricsEvent.emit('north-connect', data);
    });
    this.north.metricsEvent.on('run-start', (data: { lastRunStart: Instant }) => {
      this.metricsEvent.emit('north-run-start', data);
    });
    this.north.metricsEvent.on(
      'run-end',
      (data: { lastRunDuration: number; metadata: CacheMetadata; action: 'sent' | 'errored' | 'archived' }) => {
        this.metricsEvent.emit('north-run-end', data);
      }
    );
    this.north.metricsEvent.on('cache-size', (cacheSize: { cache: number; error: number; archive: number }) => {
      this.metricsEvent.emit('north-cache-size', cacheSize);
    });
    this.north.metricsEvent.on('cache-content-size', (cachedSize: number) => {
      this.metricsEvent.emit('north-cache-content-size', cachedSize);
    });
    await this.north.start();

    const southItems = this.buildSouthItems();
    this.seedItemsStatus(southItems);

    this.south.connectedEvent.on('connected', () => {
      this.metricsEvent.emit('south-history-query-start', { running: true });
      this.south!.historyQueryHandler(
        southItems,
        this.historyConfiguration.queryTimeRange.startTime,
        this.historyConfiguration.queryTimeRange.endTime
      )
        .then(() => {
          // The run completed normally: whichever item was still marked 'running' is done. If we're
          // in the middle of stopping, leave it as 'running' so a resumed run picks it back up.
          if (!this.stopping) {
            for (const status of this.itemsStatus.values()) {
              if (status.status === 'running') {
                status.status = 'done';
              }
            }
          }
          this.metricsEvent.emit('south-history-query-stop', { running: false });
        })
        .catch(async error => {
          this.logger.error(`Error while executing history query. ${error}`);
          await delay(FINISH_INTERVAL);
          if (this.historyConfiguration.status === 'RUNNING' && !this.stopping) {
            await this.south!.stop();
            await this.south!.start();
          }
        });
      if (this.finishInterval) {
        clearInterval(this.finishInterval);
      }
      this.finishInterval = setInterval(this.finish.bind(this), FINISH_INTERVAL);
    });
    this.south.metricsEvent.on('connect', (data: { lastConnection: Instant }) => {
      this.metricsEvent.emit('south-connect', data);
    });
    this.south.metricsEvent.on('run-start', (data: { lastRunStart: Instant }) => {
      this.metricsEvent.emit('south-run-start', data);
    });
    this.south.metricsEvent.on('run-end', (data: { lastRunDuration: number }) => {
      this.metricsEvent.emit('south-run-end', data);
    });
    this.south.metricsEvent.on(
      'history-query-interval',
      (data: {
        currentIntervalStart: Instant;
        currentIntervalEnd: Instant;
        currentIntervalNumber?: number;
        numberOfIntervals?: number;
        itemName?: string;
        currentItemNumber?: number;
        numberOfItems?: number;
      }) => {
        this.metricsEvent.emit('south-history-query-interval', this.computeCurrentProgress(data));
      }
    );
    this.south.metricsEvent.on(
      'history-query-item-start',
      (data: { itemName: string; currentItemNumber: number; numberOfItems: number }) => {
        for (const status of this.itemsStatus.values()) {
          if (status.status === 'running') {
            status.status = 'done';
          }
        }
        const currentStatus = Array.from(this.itemsStatus.values()).find(status => status.itemName === data.itemName);
        if (currentStatus) {
          currentStatus.status = 'running';
        }
        this.metricsEvent.emit('south-history-query-item', {
          itemName: data.itemName,
          currentItemNumber: data.currentItemNumber,
          numberOfItems: data.numberOfItems,
          itemsStatus: Array.from(this.itemsStatus.values())
        });
      }
    );
    this.south.metricsEvent.on('add-values', (data: { numberOfValuesRetrieved: number; lastValueRetrieved: OIBusTimeValue | null }) => {
      this.updateRunningItemStatus(data.numberOfValuesRetrieved, data.lastValueRetrieved?.timestamp ?? null);
      this.metricsEvent.emit('south-add-values', data);
    });
    this.south.metricsEvent.on('add-file', (data: { lastFileRetrieved: string }) => {
      this.updateRunningItemStatus(1, null);
      this.metricsEvent.emit('south-add-file', data);
    });
    await this.south.start();
  }

  /**
   * Build the SouthConnectorItemEntity-shaped item list `historyQueryHandler` / `getHistoryQuerySnapshot`
   * expect, from the history query's own configured items — adding the synthetic 'history' scan mode
   * and the query-time-range-derived interval settings every history query item shares.
   */
  private buildSouthItems(): Array<SouthConnectorItemEntity<SouthItemSettings>> {
    return this.historyConfiguration.items
      .filter(item => item.enabled)
      .map(item => ({
        ...item,
        group: null,
        syncWithGroup: false,
        scanMode: {
          id: 'history',
          name: 'history',
          description: '',
          type: 'cron',
          cron: '',
          interval: null,
          activationWindow: null,
          createdBy: '',
          updatedBy: '',
          createdAt: '',
          updatedAt: ''
        },
        maxReadInterval: this.historyConfiguration.queryTimeRange.maxReadInterval,
        readDelay: this.historyConfiguration.queryTimeRange.readDelay,
        startTimeOffset: null,
        endTimeOffset: null,
        recoveryStrategy: null
      }));
  }

  /**
   * Seed `maxIntervalEndReached` and `itemsStatus` from the south connector's persisted cache
   * snapshot, so a resumed run reflects the correct starting point (progress bar, per-item status)
   * instead of visually restarting from zero.
   */
  private seedItemsStatus(items: Array<SouthConnectorItemEntity<SouthItemSettings>>): void {
    const snapshot = this.south.getHistoryQuerySnapshot(items);
    this.maxIntervalEndReached = snapshot.items.reduce<Instant | null>((max, item) => {
      if (!item.trackedInstant) return max;
      return !max || item.trackedInstant > max ? item.trackedInstant : max;
    }, null);
    this.itemsStatus = new Map(
      snapshot.items.map(item => [
        item.itemId,
        {
          itemId: item.itemId,
          itemName: item.itemName,
          status: (item.trackedInstant && item.trackedInstant >= this.historyConfiguration.queryTimeRange.endTime
            ? 'done'
            : 'pending') as HistoryQueryItemStatus['status'],
          lastValueTimestamp: item.trackedInstant,
          recordsCount: 0
        }
      ])
    );
  }

  /** Update whichever item is currently marked `'running'` with newly retrieved records. No-op if no item is running (e.g. batched connectors, which never emit `history-query-item-start`). */
  private updateRunningItemStatus(recordsDelta: number, lastValueTimestamp: Instant | null): void {
    for (const status of this.itemsStatus.values()) {
      if (status.status === 'running') {
        status.recordsCount += recordsDelta;
        if (lastValueTimestamp) {
          status.lastValueTimestamp = lastValueTimestamp;
        }
        break;
      }
    }
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.finishInterval) {
      clearInterval(this.finishInterval);
      this.finishInterval = null;
    }

    this.south.connectedEvent.removeAllListeners();
    await this.south.stop();
    this.south.metricsEvent.removeAllListeners();
    await this.north.stop();
    this.north.metricsEvent.removeAllListeners();

    this.stopping = false;
  }

  async resetCache(): Promise<void> {
    await this.south.resetCache();
    await this.north.resetCache();
  }

  async finish(): Promise<void> {
    if (this.north.isCacheEmpty() && !this.south.historyIsRunning) {
      this.logger.info(`Finish History query "${this.historyConfiguration.name}" (${this.historyConfiguration.id})`);
      await this.stop();
      this.finishEvent.emit('finished');
    } else {
      this.logger.trace(`History query "${this.historyConfiguration.name}" is still running`);
    }
  }

  refreshLogger(): void {
    this.logger = loggerService.createChildLogger('history-query', this.historyConfiguration.id, this.historyConfiguration.name);
  }

  get historyQueryConfiguration() {
    return this.historyConfiguration;
  }

  set historyQueryConfiguration(historyQueryConfiguration: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>) {
    this.historyConfiguration = historyQueryConfiguration;
    this.south.connectorConfiguration = {
      id: historyQueryConfiguration.id,
      name: historyQueryConfiguration.name,
      description: historyQueryConfiguration.description,
      enabled: historyQueryConfiguration.status === 'RUNNING',
      type: historyQueryConfiguration.southType,
      settings: historyQueryConfiguration.southSettings,
      items: [],
      groups: [],
      createdBy: historyQueryConfiguration.createdBy,
      updatedBy: historyQueryConfiguration.updatedBy,
      createdAt: historyQueryConfiguration.createdAt,
      updatedAt: historyQueryConfiguration.updatedAt
    };
    this.north.connectorConfiguration = {
      id: historyQueryConfiguration.id,
      name: historyQueryConfiguration.name,
      description: historyQueryConfiguration.description,
      enabled: historyQueryConfiguration.status === 'RUNNING',
      type: historyQueryConfiguration.northType,
      settings: historyQueryConfiguration.northSettings,
      caching: historyQueryConfiguration.caching,
      transformers: historyQueryConfiguration.northTransformers.map(element => ({
        id: element.id,
        transformer: element.transformer,
        options: element.options,
        items: element.items,
        source: {
          type: 'south',
          south: {
            id: historyQueryConfiguration.id,
            name: historyQueryConfiguration.name,
            type: historyQueryConfiguration.southType,
            description: historyQueryConfiguration.description,
            enabled: historyQueryConfiguration.status === 'RUNNING',
            createdBy: historyQueryConfiguration.createdBy,
            updatedBy: historyQueryConfiguration.updatedBy,
            createdAt: historyQueryConfiguration.createdAt,
            updatedAt: historyQueryConfiguration.updatedAt
          },
          items: element.items,
          group: undefined
        }
      })),
      createdBy: historyQueryConfiguration.createdBy,
      updatedBy: historyQueryConfiguration.updatedBy,
      createdAt: historyQueryConfiguration.createdAt,
      updatedAt: historyQueryConfiguration.updatedAt
    };
  }

  async searchCacheContent(searchParams: CacheSearchParam): Promise<Omit<CacheSearchResult, 'metrics'>> {
    return await this.north.searchCacheContent(searchParams);
  }

  async getFileFromCache(folder: DataFolderType, filename: string): Promise<FileCacheContent> {
    return await this.north.getFileFromCache(folder, filename);
  }

  async updateCacheContent(updateCommand: CacheContentUpdateCommand): Promise<void> {
    await this.north.updateCacheContent(updateCommand);
  }

  private computeCurrentProgress(data: {
    currentIntervalStart: Instant;
    currentIntervalEnd: Instant;
    currentIntervalNumber?: number;
    numberOfIntervals?: number;
    itemName?: string;
    currentItemNumber?: number;
    numberOfItems?: number;
  }): HistoryMetricsEvents['south-history-query-interval'] {
    // this.intervals is the full, fixed breakdown of the history query's configured time range
    // (oldest to newest), computed once in the constructor. It's independent of the south
    // connector's own per-run sub-intervals (which vary with recovery strategy and cache state),
    // so counting how many of its slots are fully covered by the ratcheted `maxIntervalEndReached`
    // gives a stable overall progress measure across restarts.
    //
    // The ratchet itself is what fixes the sawtooth bug: a multi-item connector reports its own,
    // independent `currentIntervalEnd` per item, which is usually much earlier than where the
    // previous item left off when the run moves on to a new item. Recomputing `currentIntervalNumber`
    // fresh from that raw value every call (the old behavior) made the overall progress bar visibly
    // jump backwards on every item transition. Ratcheting the high-water mark forward-only means
    // `currentIntervalNumber` here only ever advances.
    const numberOfIntervals = this.intervals.length || 1;
    if (this.maxIntervalEndReached === null || data.currentIntervalEnd > this.maxIntervalEndReached) {
      this.maxIntervalEndReached = data.currentIntervalEnd;
    }
    const currentIntervalNumber = this.intervals.filter(interval => interval.end <= this.maxIntervalEndReached!).length;

    return {
      running: true,
      intervalProgress: currentIntervalNumber / numberOfIntervals,
      currentIntervalStart: data.currentIntervalStart,
      currentIntervalEnd: data.currentIntervalEnd,
      currentIntervalNumber,
      numberOfIntervals,
      ...(data.itemName !== undefined ? { itemName: data.itemName } : {}),
      ...(data.currentItemNumber !== undefined ? { currentItemNumber: data.currentItemNumber } : {}),
      ...(data.numberOfItems !== undefined ? { numberOfItems: data.numberOfItems } : {}),
      // Scoped to the current item's own raw interval count (NOT ratcheted) so it resets to (near)
      // 0 for each new item, unlike the ratcheted `intervalProgress` above.
      ...(data.numberOfIntervals ? { itemIntervalProgress: (data.currentIntervalNumber ?? 0) / data.numberOfIntervals } : {}),
      itemIntervalNumber: data.currentIntervalNumber,
      itemNumberOfIntervals: data.numberOfIntervals
    };
  }
}
