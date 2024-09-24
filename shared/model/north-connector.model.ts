import { OibFormControl } from './form.model';
import { BaseEntity, Instant } from './types';
import { NorthSettings } from './north-settings.model';
import { OIBusSubscription } from './subscription.model';

export interface NorthCacheSettingsDTO {
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
    archive: NorthArchiveSettings;
  };
}

export interface NorthCacheSettingsCommandDTO {
  scanModeId?: string;
  scanModeName?: string;
  retryInterval: number;
  retryCount: number;
  maxSize: number;
  oibusTimeValues: {
    groupCount: number;
    maxSendCount: number;
  };
  rawFiles: {
    sendFileImmediately: boolean;
    archive: NorthArchiveSettings;
  };
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
  caching: NorthCacheSettingsCommandDTO;
}

/**
 * Command DTO for South connector
 */
export interface NorthConnectorWithItemsCommandDTO<> {
  north: NorthConnectorCommandDTO;
  subscriptions: Array<OIBusSubscription>;
  subscriptionsToDelete: Array<OIBusSubscription>;
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

export type NorthArchiveFiles = NorthCacheFiles;

export interface NorthValueFiles {
  filename: string;
  valuesCount: number;
}
