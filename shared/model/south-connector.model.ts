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

export interface SouthConnectorLightDTO extends BaseEntity {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
}

export interface SouthConnectorDTO<T extends SouthSettings, I extends SouthItemSettings> extends BaseEntity {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  sharedConnection: boolean;
  settings: T;
  history: {
    maxInstantPerItem: boolean;
    maxReadInterval: number;
    readDelay: number;
    overlap: number;
  };
  items: Array<SouthConnectorItemDTO<I>>;
}

export interface SouthConnectorCommandDTO<T extends SouthSettings, I extends SouthItemSettings> {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  sharedConnection: boolean;
  history: {
    maxInstantPerItem: boolean;
    maxReadInterval: number;
    readDelay: number;
    overlap: number;
  };
  settings: T;
  items: Array<SouthConnectorItemCommandDTO<I>>;
}

export interface SouthConnectorWithoutItemsCommandDTO<T extends SouthSettings> {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  sharedConnection: boolean;
  history: {
    maxInstantPerItem: boolean;
    maxReadInterval: number;
    readDelay: number;
    overlap: number;
  };
  settings: T;
}

/**
 * DTO used for an item to query within a south
 */
export interface SouthConnectorItemDTO<T extends SouthItemSettings> extends BaseEntity {
  name: string;
  enabled: boolean;
  settings: T;
  scanModeId: string;
}

export interface SouthConnectorItemCommandDTO<T extends SouthItemSettings> {
  id: string | null;
  enabled: boolean;
  name: string;
  settings: T;
  scanModeId: string | null;
  scanModeName: string | null;
}

export interface SouthConnectorItemSearchParam {
  name?: string;
  scanModeId?: string;
  enabled?: boolean;
  page?: number;
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
    sharedConnection: boolean;
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
