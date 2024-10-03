import { BaseEntity } from './types';
import { NorthItemSettings, NorthSettings } from '../../shared/model/north-settings.model';
import { SouthConnectorEntityLight } from './south-connector.model';
import { OIBusNorthType } from '../../shared/model/north-connector.model';
import { Transformer } from './transformer.model';

export interface NorthConnectorEntityLight extends BaseEntity {
  name: string;
  type: OIBusNorthType;
  description: string;
  enabled: boolean;
}

export interface NorthConnectorEntity<T extends NorthSettings, I extends NorthItemSettings> extends BaseEntity {
  name: string;
  type: OIBusNorthType;
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
  transformers: Array<{ order: number; transformer: Transformer }>;
  items: Array<NorthConnectorItemEntity<I>>;
}

export interface NorthConnectorItemEntity<T extends NorthItemSettings> extends BaseEntity {
  name: string;
  enabled: boolean;
  settings: T;
}
