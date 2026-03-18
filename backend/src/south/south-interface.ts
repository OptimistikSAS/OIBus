import { Instant } from '../../shared/model/types';
import { SouthItemSettings } from '../../shared/model/south-settings.model';
import { SouthConnectorItemEntity } from '../model/south-connector.model';

export interface SouthDirectQuery {
  directQuery(items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<unknown | null>;
}

export interface SouthHistoryQuery {
  /**
   * @param items
   * @param startTime - the start of the current interval being requested (when the original interval is split)
   * @param endTime - the end of the current interval
   * @param startTimeFromCache - the start of the history query (may differ of start time if split in intervals). The origin start
   * time is used to not skip an interval in case a history query throws an error instead of retrieving values
   */
  historyQuery(
    items: Array<SouthConnectorItemEntity<SouthItemSettings>>,
    startTime: Instant,
    endTime: Instant,
    startTimeFromCache: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }>;
}

export interface SouthSubscription {
  subscribe(items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void>;
  unsubscribe(items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void>;
}
