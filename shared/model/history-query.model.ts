import { NorthArchiveSettings, NorthCacheSettingsDTO } from './north-connector.model';
import { SouthConnectorHistorySettings, SouthConnectorItemDTO } from './south-connector.model';
import { BaseEntity } from './types';

/**
 * DTO for history queries
 */
export interface HistoryQueryDTO extends BaseEntity {
  name: string;
  description: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
  southType: string;
  northType: string;
  southSettings: any;
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
  enabled: boolean;
  startTime: string;
  endTime: string;
  southType: string;
  northType: string;
  southSettings: object;
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
  items: Array<SouthConnectorItemDTO>;
  fromSouthId: string | null; // used to retrieve passwords
  fromNorthId: string | null; // used to retrieve passwords
}
