import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { BaseEntity, Instant } from './types';
import { HistoryQueryStatus } from '../../shared/model/history-query.model';
import { NorthSettings } from '../../shared/model/north-settings.model';
import { OIBusNorthType } from '../../shared/model/north-connector.model';
import { OIBusSouthType } from '../../shared/model/south-connector.model';
import { HistoryTransformerWithOptions } from './transformer.model';
import { ScanMode } from './scan-mode.model';

export interface HistoryQueryEntityLight extends BaseEntity {
  name: string;
  description: string;
  status: HistoryQueryStatus;
  startTime: Instant;
  endTime: Instant;
  southType: OIBusSouthType;
  northType: OIBusNorthType;
}

export interface HistoryQueryEntity<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings> extends BaseEntity {
  name: string;
  description: string;
  status: HistoryQueryStatus;
  southType: OIBusSouthType;
  southSettings: S;
  queryTimeRange: {
    startTime: Instant;
    endTime: Instant;
    maxReadInterval: number;
    readDelay: number;
  };
  northType: OIBusNorthType;
  northSettings: N;
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
  items: Array<HistoryQueryItemEntity<I>>;
  northTransformers: Array<HistoryTransformerWithOptions>;
}

export interface HistoryQueryItemEntity<T extends SouthItemSettings> extends BaseEntity {
  name: string;
  enabled: boolean;
  settings: T;
}
