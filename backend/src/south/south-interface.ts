import { SouthConnectorItemDTO } from '../../../shared/model/south-connector.model';
import { Instant } from '../../../shared/model/types';

export interface QueriesFile {
  fileQuery(items: Array<SouthConnectorItemDTO>): Promise<void>;
}

export interface QueriesLastPoint {
  lastPointQuery(items: Array<SouthConnectorItemDTO>): Promise<void>;
}

export interface QueriesHistory {
  historyQuery(items: Array<SouthConnectorItemDTO>, startTime: Instant, endTime: Instant): Promise<Instant>;
}

export interface QueriesSubscription {
  subscribe(items: Array<SouthConnectorItemDTO>): Promise<void>;
  unsubscribe(items: Array<SouthConnectorItemDTO>): Promise<void>;
}
