import Joi from 'joi';
import { OibFormControl } from './form.model';
import { ScanModeDTO } from './scan-mode.model';

export interface NorthCacheSettingsDTO {
  scanMode: ScanModeDTO;
  retryInterval: number;
  retryCount: number;
  groupCount: number;
  maxSendCount: number;
  timeout: number;
}

export interface NorthCacheSettingsLightDTO {
  scanModeId: string;
  retryInterval: number;
  retryCount: number;
  groupCount: number;
  maxSendCount: number;
  timeout: number;
}

export interface NorthCacheSettingsCommandDTO {
  scanModeId: string;
  retryInterval: number;
  retryCount: number;
  groupCount: number;
  maxSendCount: number;
  timeout: number;
}

export interface NorthArchiveSettings {
  enabled: boolean;
  retentionDuration: number;
}

export interface NorthType {
  category: string;
  type: string;
  description: string;
  modes: {
    files: boolean;
    points: boolean;
  };
}

/**
 * DTO for North connectors
 */
export interface NorthConnectorDTO {
  id: string;
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  settings: any;
  caching: NorthCacheSettingsLightDTO;
  archive: NorthArchiveSettings;
}

/**
 * Command DTO for North connector
 */
export interface NorthConnectorCommandDTO {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
  settings: object;
  caching: NorthCacheSettingsCommandDTO;
  archive: NorthArchiveSettings;
}

export interface NorthConnectorManifest {
  category: string;
  name: string;
  description: string;
  modes: {
    files: boolean;
    points: boolean;
  };
  settings: Array<OibFormControl>;
  schema: Joi.ObjectSchema;
}
