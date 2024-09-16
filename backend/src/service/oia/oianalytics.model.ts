//
// DTO to send to OIAnalytics
//
export interface OIBusCryptoSettingsCommandDTO {
  algorithm: string;
  secretKey: string;
  initVector: string;
}

export interface OIBusScanModeCommandDTO {
  oIBusInternalId: string;
  name: string;
  settings: any;
}

export interface OIBusEngineCommandDTO {
  oIBusInternalId: string;
  name: string;
  softwareVersion: string;
  architecture: string;
  operatingSystem: string;
  settings: any;
}

export interface OIBusSouthCommandDTO {
  oIBusInternalId: string;
  type: string;
  name: string;
  settings: any;
}

export interface OIBusNorthCommandDTO {
  oIBusInternalId: string;
  type: string;
  name: string;
  settings: any;
}

export interface OIBusFullConfigurationCommandDTO {
  engine: OIBusEngineCommandDTO | null;
  cryptoSettings: OIBusCryptoSettingsCommandDTO | null;
  scanModes: Array<OIBusScanModeCommandDTO>;
  southConnectors: Array<OIBusSouthCommandDTO>;
  northConnectors: Array<OIBusNorthCommandDTO>;
}

//
// DTO fetch from OIAnalytics
//
export const OIANALYTICS_FETCH_COMMAND_TYPES = [
  'UPGRADE',
  'update-version',
  'restart-engine',
  'update-engine-settings',
  'create-scan-mode',
  'update-scan-mode',
  'delete-scan-mode',
  'create-south',
  'update-south',
  'delete-south',
  'create-north',
  'update-north',
  'delete-north'
] as const;
export type OIAnalyticsFetchCommandType = (typeof OIANALYTICS_FETCH_COMMAND_TYPES)[number];

export interface BaseOIAnalyticsFetchCommandDTO {
  id: string;
  type: OIAnalyticsFetchCommandType;
}

export interface OIAnalyticsFetchUpdateVersionCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'update-version';
  assetId: string;
  version: string;
}

export interface OIAnalyticsFetchRestartEngineCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'restart-engine';
}

export interface OIAnalyticsFetchUpdateEngineSettingsCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'update-engine-settings';
  targetVersion: string;
  commandContent: any;
}

export interface OIAnalyticsFetchCreateScanModeCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'create-scan-mode';
  targetVersion: string;
  commandContent: any;
}

export interface OIAnalyticsFetchUpdateScanModeCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'update-scan-mode';
  targetVersion: string;
  scanModeId: string;
  commandContent: any;
}

export interface OIAnalyticsFetchDeleteScanModeCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'delete-scan-mode';
  targetVersion: string;
  scanModeId: string;
}

export interface OIAnalyticsFetchCreateSouthConnectorCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'create-south';
  targetVersion: string;
  commandContent: any;
}

export interface OIAnalyticsFetchUpdateSouthConnectorCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'update-south';
  targetVersion: string;
  southConnectorId: string;
  commandContent: any;
}

export interface OIAnalyticsFetchDeleteSouthConnectorCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'delete-south';
  targetVersion: string;
  southConnectorId: string;
}

export interface OIAnalyticsFetchCreateNorthConnectorCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'create-north';
  targetVersion: string;
  commandContent: any;
}

export interface OIAnalyticsFetchUpdateNorthConnectorCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'update-north';
  targetVersion: string;
  northConnectorId: string;
  commandContent: any;
}

export interface OIAnalyticsFetchDeleteNorthConnectorCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'delete-north';
  targetVersion: string;
  northConnectorId: string;
}

export type OIAnalyticsFetchCommandDTO =
  | OIAnalyticsFetchUpdateVersionCommandDTO
  | OIAnalyticsFetchRestartEngineCommandDTO
  | OIAnalyticsFetchUpdateEngineSettingsCommandDTO
  | OIAnalyticsFetchCreateScanModeCommandDTO
  | OIAnalyticsFetchUpdateScanModeCommandDTO
  | OIAnalyticsFetchDeleteScanModeCommandDTO
  | OIAnalyticsFetchCreateSouthConnectorCommandDTO
  | OIAnalyticsFetchUpdateSouthConnectorCommandDTO
  | OIAnalyticsFetchDeleteSouthConnectorCommandDTO
  | OIAnalyticsFetchCreateNorthConnectorCommandDTO
  | OIAnalyticsFetchUpdateNorthConnectorCommandDTO
  | OIAnalyticsFetchDeleteNorthConnectorCommandDTO;
