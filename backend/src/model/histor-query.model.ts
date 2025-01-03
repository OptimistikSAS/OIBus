import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { BaseEntity } from './types';
import { HistoryQueryStatus } from '../../shared/model/history-query.model';
import { NorthItemSettings, NorthSettings } from '../../shared/model/north-settings.model';
import { OIBusNorthType } from '../../shared/model/north-connector.model';
import { OIBusSouthType } from '../../shared/model/south-connector.model';
import { Transformer } from './transformer.model';

export interface HistoryQueryEntityLight extends BaseEntity {
  name: string;
  description: string;
  status: HistoryQueryStatus;
  startTime: string;
  endTime: string;
  southType: OIBusSouthType;
  northType: OIBusNorthType;
}

export interface HistoryQueryEntity<
  S extends SouthSettings,
  N extends NorthSettings,
  I extends SouthItemSettings,
  J extends NorthItemSettings
> extends BaseEntity {
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
  southItems: Array<SouthHistoryQueryItemEntity<I>>;
  northItems: Array<NorthHistoryQueryItemEntity<J>>;
  southTransformers: Array<{ order: number; transformer: Transformer }>;
  northTransformers: Array<{ order: number; transformer: Transformer }>;
}

export interface SouthHistoryQueryItemEntity<T extends SouthItemSettings> extends BaseEntity {
  name: string;
  enabled: boolean;
  settings: T;
}

export interface NorthHistoryQueryItemEntity<T extends NorthItemSettings> extends BaseEntity {
  name: string;
  enabled: boolean;
  settings: T;
}
