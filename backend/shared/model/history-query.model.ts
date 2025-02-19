import { BaseEntity } from './types';
import { SouthItemSettings, SouthSettings } from './south-settings.model';
import { NorthItemSettings, NorthSettings } from './north-settings.model';
import { OIBusSouthType } from './south-connector.model';
import { OIBusNorthType } from './north-connector.model';
import { Transformer } from '../../src/model/transformer.model';

export const HISTORY_QUERY_STATUS = ['PENDING', 'RUNNING', 'PAUSED', 'FINISHED', 'ERRORED'] as const;
export type HistoryQueryStatus = (typeof HISTORY_QUERY_STATUS)[number];

export interface HistoryQueryLightDTO extends BaseEntity {
  name: string;
  description: string;
  status: HistoryQueryStatus;
  startTime: string;
  endTime: string;
  southType: OIBusSouthType;
  northType: OIBusNorthType;
}

export interface HistoryQueryDTO<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings, J extends NorthItemSettings>
  extends BaseEntity {
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
  southItems: Array<HistoryQuerySouthItemDTO<I>>;
  northItems: Array<HistoryQueryNorthItemDTO<J>>;
  southTransformers: Array<{ order: number; transformer: Transformer }>;
  northTransformers: Array<{ order: number; transformer: Transformer }>;
}

export interface HistoryQueryCommandDTO<
  S extends SouthSettings,
  N extends NorthSettings,
  I extends SouthItemSettings,
  J extends NorthItemSettings
> {
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  southType: OIBusSouthType;
  northType: OIBusNorthType;
  southSettings: S;
  northSettings: N;
  caching: {
    scanModeId: string | null;
    scanModeName: string | null;
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
  southItems: Array<HistoryQuerySouthItemCommandDTO<I>>;
  northItems: Array<HistoryQueryNorthItemCommandDTO<J>>;
  southTransformers: Array<{ order: number; id: string }>;
  northTransformers: Array<{ order: number; id: string }>;
}

export interface HistoryQueryItemSearchParam {
  name?: string;
  enabled?: boolean;
  page?: number;
}

export interface HistoryQuerySouthItemDTO<T extends SouthItemSettings> extends BaseEntity {
  name: string;
  enabled: boolean;
  settings: T;
}

export interface HistoryQueryNorthItemDTO<T extends NorthItemSettings> extends BaseEntity {
  name: string;
  enabled: boolean;
  settings: T;
}

export interface HistoryQuerySouthItemCommandDTO<T extends SouthItemSettings> {
  id: string | null;
  name: string;
  enabled: boolean;
  settings: T;
}

export interface HistoryQueryNorthItemCommandDTO<T extends NorthItemSettings> {
  id: string | null;
  name: string;
  enabled: boolean;
  settings: T;
}
