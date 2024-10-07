import { OibFormControl } from './form.model';
import { BaseEntity, Instant } from './types';
import { NorthSettings } from './north-settings.model';
import { SouthConnectorLightDTO } from './south-connector.model';

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
    archive: {
      enabled: boolean;
      retentionDuration: number;
    };
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

export interface NorthConnectorLightDTO extends BaseEntity {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
}

export interface NorthConnectorDTO<T extends NorthSettings> extends BaseEntity {
  name: string;
  type: string;
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
  type: string;
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

export interface NorthConnectorWithoutSubscriptionsCommandDTO<T extends NorthSettings = any> {
  name: string;
  type: string;
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
}

export interface NorthConnectorManifest {
  id: string;
  category: string;
  name: string;
  description: string;
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

export type NorthArchiveFiles = NorthCacheFiles;

export interface NorthValueFiles {
  filename: string;
  valuesCount: number;
}
