export interface NorthCacheSettingsDTO {
  scanModeId: string;
  groupCount: number;
  retryInterval: number;
  retryCount: number;
  maxSendCount: number;
  timeout: number;
}

export interface NorthCacheSettingsCommandDTO {
  scanModeId: string;
  retryInterval: number;
  retryCount: number;
  groupCount: number;
  maxSendCount: number;
  timeout: number;
}

export interface NorthArchiveSettings {
  enabled: boolean;
  retentionDuration: number;
}

export interface NorthType {
  category: string;
  type: string;
  description: string;
}

/**
 * DTO for North connectors
 */
export interface NorthConnectorDTO {
  id: string;
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  settings: any;
  caching: NorthCacheSettingsDTO;
  archive: NorthArchiveSettings;
}

/**
 * Command DTO for North connector
 */
export interface NorthConnectorCommandDTO {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  settings: object;
  caching: NorthCacheSettingsCommandDTO;
  archive: NorthArchiveSettings;
}
