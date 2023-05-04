import { OibFormControl } from './form.model';
import { Instant } from './types';

export interface SouthType {
  category: string;
  type: string;
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
export interface SouthConnectorDTO {
  id: string;
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  settings: any;
  history: SouthConnectorHistorySettings;
}

/**
 * Command DTO for South connector
 */
export interface SouthConnectorCommandDTO {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  history: SouthConnectorHistorySettings;
  settings: any;
}

/**
 * DTO used for South scan (a point/query/regexp and its settings linked to a scan mode)
 */
export interface OibusItemDTO {
  id: string;
  name: string;
  connectorId: string;
  settings: any;
  scanModeId?: string;
}

/**
 * Command DTO used for South scan (a point/query/folder and its settings linked to a scan mode)
 */
export interface OibusItemCommandDTO {
  name: string;
  settings: any;
  scanModeId: string | null;
}

export interface OibusItemSearchParam {
  name: string | null;
  page: number;
}

export interface OibusItemManifest {
  scanMode: {
    acceptSubscription: boolean;
    subscriptionOnly: boolean;
  };
  settings: Array<OibFormControl>;
}

export interface SouthConnectorManifest {
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
  items: OibusItemManifest;
}

export interface SouthCache {
  scanModeId: string;
  itemId: string;
  intervalIndex: number;
  maxInstant: Instant;
}
