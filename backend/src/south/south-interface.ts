import { ManagedConnection, ManagedConnectionSettings } from '../service/connection.service';
import { Instant } from '../../../shared/model/types';
import { SouthItemSettings } from '../../../shared/model/south-settings.model';
import { SouthConnectorItemEntity } from '../model/south-connector.model';

export interface QueriesFile {
  fileQuery(items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void>;
}

export interface QueriesLastPoint {
  lastPointQuery(items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void>;
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
  historyQuery(
    items: Array<SouthConnectorItemEntity<SouthItemSettings>>,
    startTime: Instant,
    endTime: Instant,
    startTimeFromCache: Instant
  ): Promise<Instant>;
}

export interface QueriesSubscription {
  subscribe(items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void>;
  unsubscribe(items: Array<SouthConnectorItemEntity<SouthItemSettings>>): Promise<void>;
}

export interface DelegatesConnection<TConnection = any> {
  /**
   * The connection that is being managed
   */
  connection: ManagedConnection<TConnection>;
  /**
   * The settings for the connection
   */
  connectionSettings: ManagedConnectionSettings<TConnection>;
  /**
   * The function to create a new session
   *
   * This function will be called by the connection service to create a new session using
   * the context of the class that implements this interface
   */
  createSession(): Promise<TConnection | null>;
}
