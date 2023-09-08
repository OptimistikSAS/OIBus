import { OibFormControl } from './form.model';
import { BaseEntity, Instant } from './types';
import { NorthSettings } from './north-settings.model';
import { OIBusSubscription } from './subscription.model';

export interface NorthCacheSettingsDTO {
  scanModeId: string;
  retryInterval: number;
  retryCount: number;
  groupCount: number;
  maxSendCount: number;
  sendFileImmediately: boolean;
  maxSize: number;
}

export interface NorthCacheSettingsCommandDTO {
  scanModeId?: string;
  scanModeName?: string;
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
  caching: NorthCacheSettingsCommandDTO;
  archive: NorthArchiveSettings;
}

/**
 * Command DTO for South connector
 */
export interface NorthConnectorWithItemsCommandDTO<> {
  north: NorthConnectorCommandDTO;
  subscriptions: Array<OIBusSubscription>;
  subscriptionsToDelete: Array<OIBusSubscription>;
}

export interface NorthConnectorItemManifest {
  settings: Array<OibFormControl>;
}

interface NorthConnectorManifestBase<THandlesItems = false | true> {
  id: string;
  category: string;
  name: string;
  description: string;
  modes: {
    files: boolean;
    points: boolean;
    items: THandlesItems;
  };
  settings: Array<OibFormControl>;
}

// When modes.items is set to true, require an items definition
export type NorthConnectorManifest<THandlesItems = false | true> = THandlesItems extends true
  ? NorthConnectorManifestBase<THandlesItems> & { items: NorthConnectorItemManifest }
  : NorthConnectorManifestBase<THandlesItems>;

export interface NorthCacheFiles {
  filename: string;
  modificationDate: Instant;
  size: number;
}

export interface NorthArchiveFiles extends NorthCacheFiles {}

export interface NorthValueFiles {
  filename: string;
  valuesCount: number;
}
