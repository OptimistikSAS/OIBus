import { BaseEntity } from './types';
import { SouthItemSettings, SouthSettings } from './south-settings.model';
import { NorthSettings } from './north-settings.model';

export const HISTORY_QUERY_STATUS = ['PENDING', 'RUNNING', 'PAUSED', 'FINISHED', 'ERRORED'] as const;
export type HistoryQueryStatus = (typeof HISTORY_QUERY_STATUS)[number];

export interface HistoryQueryLightDTO extends BaseEntity {
  name: string;
  description: string;
  status: HistoryQueryStatus;
  startTime: string;
  endTime: string;
  southType: string;
  northType: string;
}

export interface HistoryQueryDTO<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings> extends BaseEntity {
  name: string;
  description: string;
  status: HistoryQueryStatus;
  startTime: string;
  endTime: string;
  southType: string;
  northType: string;
  southSettings: S;
  southSharedConnection: boolean;
  northSettings: N;
  history: {
    maxInstantPerItem: boolean;
    maxReadInterval: number;
    readDelay: number;
  };
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
  items: Array<HistoryQueryItemDTO<I>>;
}

export interface HistoryQueryCommandDTO<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings> {
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  southType: string;
  northType: string;
  southSettings: S;
  southSharedConnection: boolean;
  northSettings: N;
  history: {
    maxInstantPerItem: boolean;
    maxReadInterval: number;
    readDelay: number;
  };
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
  items: Array<HistoryQueryItemCommandDTO<I>>;
}

export interface HistoryQueryItemSearchParam {
  name?: string;
  enabled?: boolean;
  page?: number;
}

export interface HistoryQueryItemDTO<T extends SouthItemSettings> extends BaseEntity {
  name: string;
  enabled: boolean;
  settings: T;
}

export interface HistoryQueryItemCommandDTO<T extends SouthItemSettings> {
  id: string | null;
  name: string;
  enabled: boolean;
  settings: T;
}
