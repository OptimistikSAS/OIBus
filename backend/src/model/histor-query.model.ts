import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { BaseEntity } from './types';
import { HistoryQueryStatus } from '../../shared/model/history-query.model';
import { NorthSettings } from '../../shared/model/north-settings.model';
import { OIBusNorthType } from '../../shared/model/north-connector.model';
import { OIBusSouthType } from '../../shared/model/south-connector.model';

export interface HistoryQueryEntityLight extends BaseEntity {
  name: string;
  description: string;
  status: HistoryQueryStatus;
  startTime: string;
  endTime: string;
  southType: OIBusSouthType;
  northType: OIBusNorthType;
}

export interface HistoryQueryEntity<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings> extends BaseEntity {
  name: string;
  description: string;
  status: HistoryQueryStatus;
  startTime: string;
  endTime: string;
  southType: OIBusSouthType;
  northType: OIBusNorthType;
  southSettings: S;
  northSettings: N;
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
      archive: { enabled: boolean; retentionDuration: number };
    };
  };
  items: Array<HistoryQueryItemEntity<I>>;
}

export interface HistoryQueryItemEntity<T extends SouthItemSettings> extends BaseEntity {
  name: string;
  enabled: boolean;
  settings: T;
}
