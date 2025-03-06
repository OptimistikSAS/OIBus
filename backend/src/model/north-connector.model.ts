import { BaseEntity } from './types';
import { NorthSettings } from '../../shared/model/north-settings.model';
import { SouthConnectorEntityLight } from './south-connector.model';
import { OIBusNorthType } from '../../shared/model/north-connector.model';

export interface NorthConnectorEntityLight extends BaseEntity {
  name: string;
  type: OIBusNorthType;
  description: string;
  enabled: boolean;
}

export interface NorthConnectorEntity<T extends NorthSettings> extends BaseEntity {
  name: string;
  type: OIBusNorthType;
  description: string;
  enabled: boolean;
  settings: T;
  caching: {
    scanModeId: string;
    retryInterval: number;
    retryCount: number;
    runMinDelay: number;
    maxSize: number;
    oibusTimeValues: {
      groupCount: number;
      maxSendCount: number;
    };
    rawFiles: {
      sendFileImmediately: boolean;
    };
    archive: {
      enabled: boolean;
      retentionDuration: number;
    };
  };
  subscriptions: Array<SouthConnectorEntityLight>;
}
