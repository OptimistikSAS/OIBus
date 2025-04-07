import { BaseEntity } from './types';
import { NorthSettings } from '../../shared/model/north-settings.model';
import { SouthConnectorEntityLight } from './south-connector.model';
import { OIBusNorthType } from '../../shared/model/north-connector.model';
import { TransformerWithOptions } from './transformer.model';

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
    trigger: {
      scanModeId: string;
      numberOfElements: number;
      numberOfFiles: number;
    };
    throttling: {
      runMinDelay: number;
      maxSize: number;
      maxNumberOfElements: number;
    };
    error: {
      retryInterval: number;
      retryCount: number;
      retentionDuration: number;
    };
    archive: {
      enabled: boolean;
      retentionDuration: number;
    };
  };
  subscriptions: Array<SouthConnectorEntityLight>;
  transformers: Array<TransformerWithOptions>;
}
