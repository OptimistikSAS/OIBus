import { BaseEntity } from './types';
import { SouthItemSettings, SouthSettings } from './south-settings.model';
import { NorthSettings } from './north-settings.model';
import { OIBusSouthType } from './south-connector.model';
import { OIBusNorthType } from './north-connector.model';
import { TransformerDTOWithOptions, TransformerIdWithOptions } from './transformer.model';
import { ScanModeDTO } from './scan-mode.model';

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

export interface HistoryQueryDTO<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings> extends BaseEntity {
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
    trigger: {
      scanMode: ScanModeDTO;
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
  items: Array<HistoryQueryItemDTO<I>>;
  northTransformers: Array<TransformerDTOWithOptions>;
}

export interface HistoryQueryCommandDTO<S extends SouthSettings, N extends NorthSettings, I extends SouthItemSettings> {
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  southType: OIBusSouthType;
  northType: OIBusNorthType;
  southSettings: S;
  northSettings: N;
  caching: {
    trigger: {
      scanModeId: string;
      scanModeName: string | null;
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
  items: Array<HistoryQueryItemCommandDTO<I>>;
  northTransformers: Array<TransformerIdWithOptions>;
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
