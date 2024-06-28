import { NorthArchiveSettings, NorthCacheSettingsCommandDTO, NorthCacheSettingsDTO } from "./north-connector.model";
import { SouthConnectorHistorySettings, SouthConnectorItemDTO } from './south-connector.model';
import { BaseEntity } from './types';
import { SouthItemSettings } from './south-settings.model';

export const HISTORY_QUERY_STATUS = ['PENDING', 'RUNNING', 'PAUSED', 'FINISHED', 'ERRORED'] as const;
export type HistoryQueryStatus = (typeof HISTORY_QUERY_STATUS)[number];

/**
 * DTO for history queries
 */
export interface HistoryQueryDTO extends BaseEntity {
  name: string;
  description: string;
  status: HistoryQueryStatus;
  startTime: string;
  endTime: string;
  southType: string;
  northType: string;
  southSettings: any;
  southSharedConnection: boolean;
  northSettings: any;
  history: SouthConnectorHistorySettings;
  caching: NorthCacheSettingsDTO;
  archive: NorthArchiveSettings;
}

/**
 * Command DTO for history queries creation
 */
export interface HistoryQueryCommandDTO {
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  southType: string;
  northType: string;
  southSettings: object;
  southSharedConnection: boolean;
  northSettings: object;
  history: SouthConnectorHistorySettings;
  caching: NorthCacheSettingsCommandDTO;
  archive: NorthArchiveSettings;
}

/**
 * Command DTO for history queries
 */
export interface HistoryQueryCreateCommandDTO {
  historyQuery: HistoryQueryCommandDTO;
  items: Array<SouthHistoryQueryItemDTO>;
  fromSouthId: string | null; // used to retrieve passwords
  fromNorthId: string | null; // used to retrieve passwords
}


export interface  SouthHistoryQueryItemDTO<T extends SouthItemSettings = any> extends Omit<SouthConnectorItemDTO,'scanModeId'> {
  name: string;
  enabled: boolean;
  connectorId: string;
  settings: T;
}
