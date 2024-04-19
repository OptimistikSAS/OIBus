import { ManagedConnection, ManagedConnectionSettings } from '../service/connection.service';
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
