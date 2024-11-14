//
// DTO to send to OIAnalytics
//
import { EngineSettingsCommandDTO } from '../../../shared/model/engine.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { NorthConnectorCommandDTO } from '../../../shared/model/north-connector.model';
import { SouthConnectorCommandDTO } from '../../../shared/model/south-connector.model';
import { CertificateDTO } from '../../../shared/model/certificate.model';
import { UserCommandDTO } from '../../../shared/model/user.model';
import { IPFilterCommandDTO } from '../../../shared/model/ip-filter.model';
import { ScanModeCommandDTO } from '../../../shared/model/scan-mode.model';

export interface OIAnalyticsScanModeCommandDTO {
  oIBusInternalId: string | null;
  settings: ScanModeCommandDTO;
}

export interface OIAnalyticsIPFilterCommandDTO {
  oIBusInternalId: string | null;
  settings: IPFilterCommandDTO;
}

export interface OIAnalyticsCertificateCommandDTO {
  oIBusInternalId: string | null;
  settings: Omit<CertificateDTO, 'id'>;
}

export interface OIAnalyticsUserCommandDTO {
  oIBusInternalId: string;
  settings: UserCommandDTO;
}

export interface OIAnalyticsEngineCommandDTO {
  oIBusInternalId: string;
  name: string;
  softwareVersion: string;
  launcherVersion: string;
  architecture: string;
  operatingSystem: string;
  publicKey: string;
  settings: EngineSettingsCommandDTO;
}

export interface OIAnalyticsSouthCommandDTO {
  oIBusInternalId: string | null;
  type: string;
  settings: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
}

export interface OIAnalyticsNorthCommandDTO {
  oIBusInternalId: string | null;
  type: string;
  settings: NorthConnectorCommandDTO<NorthSettings>;
}

export interface OIBusFullConfigurationCommandDTO {
  engine: OIAnalyticsEngineCommandDTO;
  scanModes: Array<OIAnalyticsScanModeCommandDTO>;
  ipFilters: Array<OIAnalyticsIPFilterCommandDTO>;
  certificates: Array<OIAnalyticsCertificateCommandDTO>;
  southConnectors: Array<OIAnalyticsSouthCommandDTO>;
  northConnectors: Array<OIAnalyticsNorthCommandDTO>;
  users: Array<OIAnalyticsUserCommandDTO>;
}

//
// DTO fetch from OIAnalytics
//
export const OIANALYTICS_FETCH_COMMAND_TYPES = [
  'UPGRADE',
  'update-version',
  'restart-engine',
  'regenerate-cipher-keys',
  'update-engine-settings',
  'create-scan-mode',
  'update-scan-mode',
  'delete-scan-mode',
  'create-south',
  'update-south',
  'delete-south',
  'create-north',
  'update-north',
  'delete-north',
  'create-or-update-south-items-from-csv'
] as const;
export type OIAnalyticsFetchCommandType = (typeof OIANALYTICS_FETCH_COMMAND_TYPES)[number];

export interface BaseOIAnalyticsFetchCommandDTO {
  id: string;
  type: OIAnalyticsFetchCommandType;
  targetVersion: string;
}

export interface OIAnalyticsFetchUpdateVersionCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'update-version';
  version: string;
  assetId: string;
  updateLauncher: boolean;
  backupFolders: string;
}

export interface OIAnalyticsFetchRestartEngineCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'restart-engine';
}

export interface OIAnalyticsFetchRegenerateCipherKeysCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'regenerate-cipher-keys';
}

export interface OIAnalyticsFetchUpdateEngineSettingsCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'update-engine-settings';
  commandContent: EngineSettingsCommandDTO;
}

export interface OIAnalyticsFetchCreateScanModeCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'create-scan-mode';
  commandContent: ScanModeCommandDTO;
}

export interface OIAnalyticsFetchUpdateScanModeCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'update-scan-mode';
  scanModeId: string;
  commandContent: ScanModeCommandDTO;
}

export interface OIAnalyticsFetchDeleteScanModeCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'delete-scan-mode';
  scanModeId: string;
}

export interface OIAnalyticsFetchCreateSouthConnectorCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'create-south';
  commandContent: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
}

export interface OIAnalyticsFetchUpdateSouthConnectorCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'update-south';
  southConnectorId: string;
  commandContent: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
}

export interface OIAnalyticsFetchDeleteSouthConnectorCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'delete-south';
  southConnectorId: string;
}

export interface OIAnalyticsFetchCreateNorthConnectorCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'create-north';
  commandContent: NorthConnectorCommandDTO<NorthSettings>;
}

export interface OIAnalyticsFetchUpdateNorthConnectorCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'update-north';
  northConnectorId: string;
  commandContent: NorthConnectorCommandDTO<NorthSettings>;
}

export interface OIAnalyticsFetchDeleteNorthConnectorCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'delete-north';
  northConnectorId: string;
}

export interface OIAnalyticsFetchCreateOrUpdateSouthConnectorItemsFromCSVCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'create-or-update-south-items-from-csv';
  southConnectorId: string;
  deleteItemsNotPresent: boolean;
  csvContent: string;
  delimiter: string;
}

export type OIAnalyticsFetchCommandDTO =
  | OIAnalyticsFetchUpdateVersionCommandDTO
  | OIAnalyticsFetchRestartEngineCommandDTO
  | OIAnalyticsFetchRegenerateCipherKeysCommandDTO
  | OIAnalyticsFetchUpdateEngineSettingsCommandDTO
  | OIAnalyticsFetchCreateScanModeCommandDTO
  | OIAnalyticsFetchUpdateScanModeCommandDTO
  | OIAnalyticsFetchDeleteScanModeCommandDTO
  | OIAnalyticsFetchCreateSouthConnectorCommandDTO
  | OIAnalyticsFetchUpdateSouthConnectorCommandDTO
  | OIAnalyticsFetchDeleteSouthConnectorCommandDTO
  | OIAnalyticsFetchCreateNorthConnectorCommandDTO
  | OIAnalyticsFetchUpdateNorthConnectorCommandDTO
  | OIAnalyticsFetchDeleteNorthConnectorCommandDTO
  | OIAnalyticsFetchCreateOrUpdateSouthConnectorItemsFromCSVCommandDTO;
