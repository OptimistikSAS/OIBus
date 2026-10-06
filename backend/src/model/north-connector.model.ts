import { OIBusNorthType } from '../../shared/model/connector/north-manifest.model';
import { NorthSettings } from '../../shared/model/connector/north-settings.model';

import { ScanMode } from './scan-mode.model';
import { NorthTransformerWithOptions } from './transformer.model';
import { BaseEntity } from './types';

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
      scanMode: ScanMode;
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
  transformers: Array<NorthTransformerWithOptions>;
}
