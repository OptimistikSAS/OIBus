import { NorthArchiveSettings, NorthCacheSettingsDTO } from './north-connector.model';

/**
 * DTO for history queries
 */
export interface HistoryQueryDTO {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
  southType: string;
  northType: string;
  southSettings: object;
  northSettings: object;
  caching: NorthCacheSettingsDTO;
  archive: NorthArchiveSettings;
}

/**
 * Command DTO for history queries
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
  caching: NorthCacheSettingsDTO;
  archive: NorthArchiveSettings;
}
