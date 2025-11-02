import { OIBusArrayAttribute, OIBusObjectAttribute } from './form.model';
import { BaseEntity, Instant } from './types';
import { SouthItemSettings, SouthSettings } from './south-settings.model';
import { ScanModeDTO } from './scan-mode.model';

export const OIBUS_SOUTH_CATEGORIES = ['file', 'iot', 'database', 'api'] as const;
export type OIBusSouthCategory = (typeof OIBUS_SOUTH_CATEGORIES)[number];

export const OIBUS_SOUTH_TYPES = [
  'ads',
  'folder-scanner',
  'ftp',
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

export interface SouthConnectorDTO extends BaseEntity {
  name: string;
  type: OIBusSouthType;
  description: string;
  enabled: boolean;
  settings: SouthSettings;
  items: Array<SouthConnectorItemDTO>;
}

export interface SouthConnectorCommandDTO {
  name: string;
  type: OIBusSouthType;
  description: string;
  enabled: boolean;
  settings: SouthSettings;
  items: Array<SouthConnectorItemCommandDTO>;
}

/**
 * DTO used for an item to query within a south
 */
export interface SouthConnectorItemDTO extends BaseEntity {
  name: string;
  enabled: boolean;
  settings: SouthItemSettings;
  scanMode: ScanModeDTO;
}

export interface SouthConnectorItemCommandDTO {
  id: string | null;
  enabled: boolean;
  name: string;
  settings: SouthItemSettings;
  scanModeId: string | null;
  scanModeName: string | null;
}

export interface SouthConnectorItemSearchParam {
  name?: string;
  scanModeId?: string;
  enabled?: boolean;
  page: number;
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
  settings: OIBusObjectAttribute;
  items: OIBusArrayAttribute;
}

export interface SouthCache {
  southId: string;
  scanModeId: string;
  itemId: string;
  maxInstant: Instant;
}
