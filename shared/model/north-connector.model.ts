import { OibFormControl } from './form.model';
import { BaseEntity, Instant } from './types';
import { NorthSettings } from './north-settings.model';
import { SubscriptionDTO } from './subscription.model';

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
  subscriptions: Array<SubscriptionDTO>;
  subscriptionsToDelete: Array<SubscriptionDTO>;
}

export interface NorthConnectorItemManifest {
  settings: Array<OibFormControl>;
}

interface NorthConnectorManifestBase<THandlesItems = boolean> {
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
export type NorthConnectorManifest<THandlesItems = boolean> = THandlesItems extends true
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

// TODO: Change this type with generated types for every type of north item settings. Also change in NorthConnector class
type NorthItemSettings = any;

/**
 * DTO used for an item to query within a north
 */
export interface NorthConnectorItemDTO<T extends NorthItemSettings = any> extends BaseEntity {
  name: string;
  enabled: boolean;
  connectorId: string;
  settings: T;
}

/**
 * Command DTO used to create an NorthConnectorItem
 */
export interface NorthConnectorItemCommandDTO<T extends NorthItemSettings = any> {
  id?: string;
  enabled: boolean;
  name: string;
  settings: T;
}

export interface NorthConnectorItemSearchParam {
  name?: string;
  enabled?: boolean;
  page?: number;
}
