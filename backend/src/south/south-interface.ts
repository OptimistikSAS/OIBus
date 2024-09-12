import { SouthConnectorItemDTO } from '../../../shared/model/south-connector.model';
import { Instant } from '../../../shared/model/types';

export interface QueriesFile {
  fileQuery(items: Array<SouthConnectorItemDTO>): Promise<void>;
}

export interface QueriesLastPoint {
  lastPointQuery(items: Array<SouthConnectorItemDTO>): Promise<void>;
}

export interface QueriesHistory {
  /**
   *
   * @param items
   * @param startTime - the start of the current interval being requested (when the original interval is split)
   * @param endTime - the end of the current interval
   * @param startTimeFromCache - the start of the history query (may differ of start time if split in intervals). The origin start
   * time is used to not skip interval in case history query throw an error instead of retrieving values
   */
  historyQuery(items: Array<SouthConnectorItemDTO>, startTime: Instant, endTime: Instant, startTimeFromCache: Instant): Promise<Instant>;
}

export interface QueriesSubscription {
  subscribe(items: Array<SouthConnectorItemDTO>): Promise<void>;
  unsubscribe(items: Array<SouthConnectorItemDTO>): Promise<void>;
}
