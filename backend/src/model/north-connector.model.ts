import { BaseEntity } from './types';
import { NorthSettings } from '../../shared/model/north-settings.model';
import { SouthConnectorEntityLight } from './south-connector.model';

export interface NorthConnectorEntityLight extends BaseEntity {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
}

export interface NorthConnectorEntity<T extends NorthSettings> extends BaseEntity {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  settings: T;
  caching: {
    scanModeId: string;
    retryInterval: number;
    retryCount: number;
    maxSize: number;
    oibusTimeValues: {
      groupCount: number;
      maxSendCount: number;
    };
    rawFiles: {
      sendFileImmediately: boolean;
      archive: {
        enabled: boolean;
        retentionDuration: number;
      };
    };
  };
  subscriptions: Array<SouthConnectorEntityLight>;
}

// TODO: Change this type with generated types for every type of north item settings. Also change in NorthConnector class
type NorthItemSettings = any;

export interface NorthConnectorItemEntity<T extends NorthItemSettings = any> extends BaseEntity {
  name: string;
  enabled: boolean;
  settings: T;
}
