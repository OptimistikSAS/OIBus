import type { Instant } from '../../../shared/model/types';
import type { NorthMetricsEvents } from '../../north/north-connector';

/**
 * The mutable subset of north metrics that is accumulated from connector events.
 *
 * Both {@link NorthConnectorMetrics} (standalone north) and `HistoryQueryMetrics['north']`
 * (north side of a history query) structurally satisfy this shape, so the same
 * accumulation logic drives both — previously this was duplicated in the two metrics
 * services and had to be fixed in both places when it drifted.
 *
 * The `current*` size gauges are intentionally absent: they are pulled live from the
 * cache service at read time, not accumulated from events.
 */
export interface NorthMetricsState {
  lastConnection: Instant | null;
  lastRunStart: Instant | null;
  lastRunDuration: number | null;
  lastContentSent: string | null;
  contentSentSize: number;
  contentCachedSize: number;
  contentErroredSize: number;
  contentArchivedSize: number;
}

/** Apply a north `connect` event. */
export function applyNorthConnect(state: NorthMetricsState, data: NorthMetricsEvents['connect']): void {
  state.lastConnection = data.lastConnection;
}

/** Apply a north `run-start` event. */
export function applyNorthRunStart(state: NorthMetricsState, data: NorthMetricsEvents['run-start']): void {
  state.lastRunStart = data.lastRunStart;
}

/**
 * Apply a north `run-end` event.
 *
 * `archived` content is also counted as sent (it was delivered, then kept a copy),
 * so both `contentArchivedSize` and `contentSentSize` grow. `errored` content only
 * grows `contentErroredSize` and does not update `lastContentSent`.
 */
export function applyNorthRunEnd(state: NorthMetricsState, data: NorthMetricsEvents['run-end']): void {
  state.lastRunDuration = data.lastRunDuration;
  if (data.action === 'sent') {
    state.lastContentSent = data.metadata.contentFile;
    state.contentSentSize += data.metadata.contentSize;
  } else if (data.action === 'archived') {
    state.lastContentSent = data.metadata.contentFile;
    state.contentArchivedSize += data.metadata.contentSize;
    state.contentSentSize += data.metadata.contentSize;
  } else {
    state.contentErroredSize += data.metadata.contentSize;
  }
}

/** Apply a north `cache-content-size` event (cumulative counter of all content ever cached). */
export function applyNorthCacheContentSize(state: NorthMetricsState, cachedSize: NorthMetricsEvents['cache-content-size']): void {
  state.contentCachedSize += cachedSize;
}
