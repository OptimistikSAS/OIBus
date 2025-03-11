import { OibFormControl } from './form.model';
import { BaseEntity } from './types';
import { NorthSettings } from './north-settings.model';
import { SouthConnectorLightDTO } from './south-connector.model';
import { TransformerLightDTO } from './transformer.model';
import { OIBusDataType } from './engine.model';

export const OIBUS_NORTH_CATEGORIES = ['debug', 'api', 'file'] as const;
export type OIBusNorthCategory = (typeof OIBUS_NORTH_CATEGORIES)[number];

export const OIBUS_NORTH_TYPES = ['azure-blob', 'aws-s3', 'console', 'file-writer', 'oianalytics', 'sftp', 'rest'] as const;
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

export interface NorthConnectorDTO<T extends NorthSettings> extends BaseEntity {
  name: string;
  type: OIBusNorthType;
  description: string;
  enabled: boolean;
  settings: T;
  caching: {
    trigger: {
      scanModeId: string;
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
  transformers: Array<TransformerLightDTO>;
}

export interface NorthConnectorCommandDTO<T extends NorthSettings> {
  name: string;
  type: OIBusNorthType;
  description: string;
  enabled: boolean;
  settings: T;
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
  transformers: Array<string>;
}

export interface NorthConnectorManifest {
  id: OIBusNorthType;
  category: OIBusNorthCategory;
  types: Array<OIBusDataType>;
  settings: Array<OibFormControl>;
}
