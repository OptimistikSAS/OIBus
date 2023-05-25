import { OibusItemDTO } from '../../../shared/model/south-connector.model';
import { Instant } from '../../../shared/model/types';

export interface QueriesFile {
  fileQuery(items: Array<OibusItemDTO>): Promise<void>;
}

export interface QueriesLastPoint {
  lastPointQuery(items: Array<OibusItemDTO>): Promise<void>;
}

export interface QueriesHistory {
  historyQuery(items: Array<OibusItemDTO>, startTime: Instant, endTime: Instant): Promise<Instant>;
}

export interface QueriesSubscription {
  subscribe(items: Array<OibusItemDTO>): Promise<void>;
}
