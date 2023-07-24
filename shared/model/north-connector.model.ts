import { OibFormControl } from './form.model';
import { BaseEntity, Instant } from './types';
import { NorthSettings } from './north-settings.model';

export interface NorthCacheSettingsDTO {
  scanModeId: string;
  retryInterval: number;
  retryCount: number;
  groupCount: number;
  maxSendCount: number;
  sendFileImmediately: boolean;
  maxSize: number;
}

export interface NorthArchiveSettings {
  enabled: boolean;
  retentionDuration: number;
}

export interface NorthType {
  id: string;
  category: string;
  name: string;
  description: string;
  modes: {
    files: boolean;
    points: boolean;
  };
}

/**
 * DTO for North connectors
 */
export interface NorthConnectorDTO<T extends NorthSettings = any> extends BaseEntity {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  settings: T;
  caching: NorthCacheSettingsDTO;
  archive: NorthArchiveSettings;
}

/**
 * Command DTO for North connector
 */
export interface NorthConnectorCommandDTO<T extends NorthSettings = any> {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  settings: T;
  caching: NorthCacheSettingsDTO;
  archive: NorthArchiveSettings;
}

export interface NorthConnectorManifest {
  id: string;
  category: string;
  name: string;
  description: string;
  modes: {
    files: boolean;
    points: boolean;
  };
  settings: Array<OibFormControl>;
}

export interface NorthCacheFiles {
  filename: string;
  modificationDate: Instant;
  size: number;
}

export interface NorthArchiveFiles extends NorthCacheFiles {}
