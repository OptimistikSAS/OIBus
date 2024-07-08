import { NorthArchiveSettings, NorthCacheSettingsDTO } from './north-connector.model';
import { SouthConnectorHistorySettings, SouthConnectorItemDTO, SouthConnectorItemScanModeNameDTO } from './south-connector.model';
import { BaseEntity } from './types';

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
  caching: NorthCacheSettingsDTO;
  archive: NorthArchiveSettings;
}

/**
 * Command DTO for history queries
 */
export interface HistoryQueryCreateCommandDTO {
  historyQuery: HistoryQueryCommandDTO;
  items: Array<SouthConnectorItemDTO> | Array<SouthConnectorItemScanModeNameDTO>;
  fromSouthId: string | null; // used to retrieve passwords
  fromNorthId: string | null; // used to retrieve passwords
}

export interface HistoryQueryCreateCommandScanModeNameDTO {
  historyQuery: HistoryQueryCommandDTO;
  items: Array<SouthConnectorItemScanModeNameDTO>;
  fromSouthId: string | null; // used to retrieve passwords
  fromNorthId: string | null; // used to retrieve passwords
}