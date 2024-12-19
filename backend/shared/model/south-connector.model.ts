import { OibFormControl } from './form.model';
import { BaseEntity, Instant } from './types';
import { SouthItemSettings, SouthSettings } from './south-settings.model';

export const OIBUS_SOUTH_CATEGORIES = ['file', 'iot', 'database', 'api'] as const;
export type OIBusSouthCategory = (typeof OIBUS_SOUTH_CATEGORIES)[number];

export const OIBUS_SOUTH_TYPES = [
  'ads',
  'folder-scanner',
  'modbus',
  'mqtt',
  'mssql',
  'mysql',
  'odbc',
  'oianalytics',
  'oledb',
  'opc',
  'opcua',
  'oracle',
  'osisoft-pi',
  'postgresql',
  'sftp',
  'slims',
  'sqlite'
] as const;
export type OIBusSouthType = (typeof OIBUS_SOUTH_TYPES)[number];

export interface SouthType {
  id: OIBusSouthType;
  category: OIBusSouthCategory;
  modes: {
    subscription: boolean;
    lastPoint: boolean;
    lastFile: boolean;
    history: boolean;
  };
}

export interface SouthConnectorLightDTO extends BaseEntity {
  name: string;
  type: OIBusSouthType;
  description: string;
  enabled: boolean;
}

export interface SouthConnectorDTO<T extends SouthSettings, I extends SouthItemSettings> extends BaseEntity {
  name: string;
  type: OIBusSouthType;
  description: string;
  enabled: boolean;
  settings: T;
  items: Array<SouthConnectorItemDTO<I>>;
}

export interface SouthConnectorCommandDTO<T extends SouthSettings, I extends SouthItemSettings> {
  name: string;
  type: OIBusSouthType;
  description: string;
  enabled: boolean;
  settings: T;
  items: Array<SouthConnectorItemCommandDTO<I>>;
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
  scanMode: 'POLL' | 'SUBSCRIPTION' | 'SUBSCRIPTION_AND_POLL';
  settings: Array<OibFormControl>;
}

export interface SouthConnectorItemTestingSettings {
  history?: {
    startTime: string;
    endTime: string;
  };
}

export interface SouthConnectorManifest {
  id: OIBusSouthType;
  category: OIBusSouthCategory;
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
  southId: string;
  scanModeId: string;
  itemId: string;
  maxInstant: Instant;
}
