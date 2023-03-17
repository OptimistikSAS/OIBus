import { NorthArchiveSettings, NorthCacheSettingsLightDTO } from './north-connector.model';

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
  caching: NorthCacheSettingsLightDTO;
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
  caching: NorthCacheSettingsLightDTO;
  archive: NorthArchiveSettings;
}

/**
 * Command DTO for history queries
 */
export interface HistoryQueryCreateCommandDTO {
  name: string;
  description: string;
  southType: string | null;
  northType: string | null;
  southId: string | null;
  northId: string | null;
}
