import { OIBusObjectAttribute } from './form.model';
import { BaseEntity } from './types';
import { NorthSettings } from './north-settings.model';
import { SouthConnectorLightDTO } from './south-connector.model';
import { TransformerDTOWithOptions, TransformerIdWithOptions } from './transformer.model';
import { OIBusDataType } from './engine.model';
import { ScanModeDTO } from './scan-mode.model';

export const OIBUS_NORTH_CATEGORIES = ['debug', 'api', 'file', 'iot'] as const;
export type OIBusNorthCategory = (typeof OIBUS_NORTH_CATEGORIES)[number];

export const OIBUS_NORTH_TYPES = [
  'azure-blob',
  'aws-s3',
  'console',
  'file-writer',
  'oianalytics',
  'sftp',
  'rest',
  'opcua',
  'mqtt',
  'modbus'
] as const;
export type OIBusNorthType = (typeof OIBUS_NORTH_TYPES)[number];

export interface NorthType {
  id: OIBusNorthType;
  category: OIBusNorthCategory;
  types: Array<OIBusDataType>;
}

export interface NorthConnectorLightDTO extends BaseEntity {
  name: string;
  type: OIBusNorthType;
  description: string;
  enabled: boolean;
}

export interface NorthConnectorDTO extends BaseEntity {
  name: string;
  type: OIBusNorthType;
  description: string;
  enabled: boolean;
  settings: NorthSettings;
  caching: {
    trigger: {
      scanMode: ScanModeDTO;
      numberOfElements: number;
      numberOfFiles: number;
    };
    throttling: {
      runMinDelay: number;
      maxSize: number;
      maxNumberOfElements: number;
    };
    error: {
      retryInterval: number;
      retryCount: number;
      retentionDuration: number;
    };
    archive: {
      enabled: boolean;
      retentionDuration: number;
    };
  };
  subscriptions: Array<SouthConnectorLightDTO>;
  transformers: Array<TransformerDTOWithOptions>;
}

export interface NorthConnectorCommandDTO {
  name: string;
  type: OIBusNorthType;
  description: string;
  enabled: boolean;
  settings: NorthSettings;
  caching: {
    trigger: {
      scanModeId: string;
      scanModeName: string | null;
      numberOfElements: number;
      numberOfFiles: number;
    };
    throttling: {
      runMinDelay: number;
      maxSize: number;
      maxNumberOfElements: number;
    };
    error: {
      retryInterval: number;
      retryCount: number;
      retentionDuration: number;
    };
    archive: {
      enabled: boolean;
      retentionDuration: number;
    };
  };
  subscriptions: Array<string>;
  transformers: Array<TransformerIdWithOptions>;
}

export interface NorthConnectorManifest {
  id: OIBusNorthType;
  category: OIBusNorthCategory;
  types: Array<string>;
  settings: OIBusObjectAttribute;
}
