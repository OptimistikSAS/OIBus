import { OibFormControl } from './form.model';
import { BaseEntity, Instant } from './types';
import { SouthSettings, SouthItemSettings } from './south-settings.model';

export interface SouthType {
  id: string;
  category: string;
  name: string;
  description: string;
  modes: {
    subscription: boolean;
    lastPoint: boolean;
    lastFile: boolean;
    history: boolean;
  };
}

export interface SouthConnectorHistorySettings {
  maxInstantPerItem: boolean;
  maxReadInterval: number;
  readDelay: number;
}

/**
 * DTO for South connectors
 */
export interface SouthConnectorDTO<T extends SouthSettings = any> extends BaseEntity {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  settings: T;
  history: SouthConnectorHistorySettings;
}

/**
 * Command DTO for South connector
 */
export interface SouthConnectorCommandDTO<T = any> {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  history: SouthConnectorHistorySettings;
  settings: T;
}

/**
 * Command DTO for South connector
 */
export interface SouthConnectorCreationCommandDTO<> {
  south: SouthConnectorDTO;
  items: Array<SouthConnectorItemDTO>;
}

/**
 * DTO used for an item to query within a south
 */
export interface SouthConnectorItemDTO<T extends SouthItemSettings = any> extends BaseEntity {
  name: string;
  enabled: boolean;
  connectorId: string;
  settings: T;
  scanModeId: string;
}

/**
 * Command DTO used to create an SouthConnectorItem
 */
export interface SouthConnectorItemCommandDTO<T extends SouthItemSettings = any> {
  id?: string;
  name: string;
  settings: T;
  scanModeId: string;
}

export interface SouthConnectorItemSearchParam {
  name: string | null;
  page: number;
}

export interface SouthConnectorItemManifest {
  scanMode: {
    acceptSubscription: boolean;
    subscriptionOnly: boolean;
  };
  settings: Array<OibFormControl>;
}

export interface SouthConnectorManifest {
  id: string;
  category: string;
  name: string;
  description: string;
  modes: {
    subscription: boolean;
    lastPoint: boolean;
    lastFile: boolean;
    history: boolean;
    forceMaxInstantPerItem: boolean;
  };
  settings: Array<OibFormControl>;
  items: SouthConnectorItemManifest;
}

export interface SouthCache {
  southId: string;
  scanModeId: string;
  itemId: string;
  maxInstant: Instant;
}
