import { OibFormControl } from './form.model';
import { BaseEntity, Instant } from './types';
import { NorthSettings } from './north-settings.model';
import { SouthConnectorLightDTO } from './south-connector.model';

export const OIBUS_NORTH_CATEGORIES = ['debug', 'api', 'file'] as const;
export type OIBusNorthCategory = (typeof OIBUS_NORTH_CATEGORIES)[number];

export const OIBUS_NORTH_TYPES = ['azure-blob', 'aws-s3', 'console', 'file-writer', 'oianalytics', 'sftp', 'rest'] as const;
export type OIBusNorthType = (typeof OIBUS_NORTH_TYPES)[number];

export interface NorthType {
  id: OIBusNorthType;
  category: OIBusNorthCategory;
  modes: {
    files: boolean;
    points: boolean;
  };
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
      archive: {
        enabled: boolean;
        retentionDuration: number;
      };
    };
  };
  subscriptions: Array<SouthConnectorLightDTO>;
}

export interface NorthConnectorCommandDTO<T extends NorthSettings> {
  name: string;
  type: OIBusNorthType;
  description: string;
  enabled: boolean;
  settings: T;
  caching: {
    scanModeId: string | null;
    scanModeName: string | null;
    retryInterval: number;
    retryCount: number;
    maxSize: number;
    oibusTimeValues: {
      groupCount: number;
      maxSendCount: number;
    };
    rawFiles: {
      sendFileImmediately: boolean;
      archive: {
        enabled: boolean;
        retentionDuration: number;
      };
    };
  };
  subscriptions: Array<string>;
}

export interface NorthConnectorManifest {
  id: OIBusNorthType;
  category: OIBusNorthCategory;
  modes: {
    files: boolean;
    points: boolean;
  };
  settings: Array<OibFormControl>;
}

export interface NorthCacheFiles {
  filename: string;
  modificationDate: Instant;
  size: number;
}
