import { OibFormControl } from './form.model';
import { Instant } from './types';
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
export interface SouthConnectorDTO<T extends SouthSettings = any> {
  id: string;
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
 * DTO used for an item to query within a south
 */
export interface SouthConnectorItemDTO<T extends SouthItemSettings = any> {
  id: string;
  name: string;
  connectorId: string;
  settings: T;
  scanModeId: string;
}

/**
 * Command DTO used to create an SouthConnectorItem
 */
export interface SouthConnectorItemCommandDTO<T extends SouthItemSettings = any> {
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
  };
  settings: Array<OibFormControl>;
  items: SouthConnectorItemManifest;
}

export interface SouthCache {
  scanModeId: string;
  itemId: string;
  intervalIndex: number;
  maxInstant: Instant;
}
