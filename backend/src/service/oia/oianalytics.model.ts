//
// DTO to send to OIAnalytics
//
import { EngineSettingsCommandDTO } from '../../../shared/model/engine.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { NorthConnectorCommandDTO } from '../../../shared/model/north-connector.model';
import { SouthConnectorCommandDTO } from '../../../shared/model/south-connector.model';
import { CertificateCommandDTO, CertificateDTO } from '../../../shared/model/certificate.model';
import { UserCommandDTO } from '../../../shared/model/user.model';
import { IPFilterCommandDTO } from '../../../shared/model/ip-filter.model';
import { ScanModeCommandDTO } from '../../../shared/model/scan-mode.model';
import { HistoryQueryCommandDTO } from '../../../shared/model/history-query.model';

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

export interface OIAnalyticsRegistrationCommandDTO {
  publicKey: string;
  settings: {
    commandRefreshInterval: number;
    commandRetryInterval: number;
    messageRetryInterval: number;
    commandPermissions: {
      updateVersion: boolean;
      restartEngine: boolean;
      regenerateCipherKeys: boolean;
      updateEngineSettings: boolean;
      updateRegistrationSettings: boolean;
      createScanMode: boolean;
      updateScanMode: boolean;
      deleteScanMode: boolean;
      createIpFilter: boolean;
      updateIpFilter: boolean;
      deleteIpFilter: boolean;
      createCertificate: boolean;
      updateCertificate: boolean;
      deleteCertificate: boolean;
      createHistoryQuery: boolean;
      updateHistoryQuery: boolean;
      deleteHistoryQuery: boolean;
      createOrUpdateHistoryItemsFromCsv: boolean;
      createSouth: boolean;
      updateSouth: boolean;
      deleteSouth: boolean;
      createOrUpdateSouthItemsFromCsv: boolean;
      createNorth: boolean;
      updateNorth: boolean;
      deleteNorth: boolean;
    };
  };
}

export interface OIAnalyticsEngineCommandDTO {
  oIBusInternalId: string;
  name: string;
  softwareVersion: string;
  launcherVersion: string;
  architecture: string;
  operatingSystem: string;
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
  registration: OIAnalyticsRegistrationCommandDTO;
  scanModes: Array<OIAnalyticsScanModeCommandDTO>;
  ipFilters: Array<OIAnalyticsIPFilterCommandDTO>;
  certificates: Array<OIAnalyticsCertificateCommandDTO>;
  southConnectors: Array<OIAnalyticsSouthCommandDTO>;
  northConnectors: Array<OIAnalyticsNorthCommandDTO>;
  users: Array<OIAnalyticsUserCommandDTO>;
}

export interface OIBusHistoryQueryCommandDTO {
  oIBusInternalId: string | null;
  settings: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings>;
}

//
// DTO fetch from OIAnalytics
//
export const OIANALYTICS_FETCH_COMMAND_TYPES = [
  'update-version',
  'restart-engine',
  'regenerate-cipher-keys',
  'update-engine-settings',
  'update-registration-settings',
  'create-scan-mode',
  'update-scan-mode',
  'delete-scan-mode',
  'create-ip-filter',
  'update-ip-filter',
  'delete-ip-filter',
  'create-certificate',
  'update-certificate',
  'delete-certificate',
  'create-south',
  'update-south',
  'delete-south',
  'create-or-update-south-items-from-csv',
  'create-north',
  'update-north',
  'delete-north'
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
  backupFoldersPattern: string;
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

export interface OIAnalyticsFetchUpdateRegistrationSettingsCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'update-registration-settings';
  commandContent: {
    commandRefreshInterval: number;
    commandRetryInterval: number;
    messageRetryInterval: number;
  };
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

export interface OIAnalyticsFetchCreateIPFilterCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'create-ip-filter';
  commandContent: IPFilterCommandDTO;
}

export interface OIAnalyticsFetchUpdateIPFilterCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'update-ip-filter';
  ipFilterId: string;
  commandContent: IPFilterCommandDTO;
}

export interface OIAnalyticsFetchDeleteIPFilterCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'delete-ip-filter';
  ipFilterId: string;
}

export interface OIAnalyticsFetchCreateCertificateCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'create-certificate';
  commandContent: CertificateCommandDTO;
}

export interface OIAnalyticsFetchUpdateCertificateCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'update-certificate';
  certificateId: string;
  commandContent: CertificateCommandDTO;
}

export interface OIAnalyticsFetchDeleteCertificateCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'delete-certificate';
  certificateId: string;
}

export interface OIAnalyticsFetchCreateSouthConnectorCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'create-south';
  retrieveSecretsFromSouth: string | null; // used to retrieve passwords in case of duplicate
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
  retrieveSecretsFromNorth: string | null; // used to retrieve passwords in case of duplicate
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
  | OIAnalyticsFetchUpdateRegistrationSettingsCommandDTO
  | OIAnalyticsFetchCreateScanModeCommandDTO
  | OIAnalyticsFetchUpdateScanModeCommandDTO
  | OIAnalyticsFetchDeleteScanModeCommandDTO
  | OIAnalyticsFetchCreateIPFilterCommandDTO
  | OIAnalyticsFetchUpdateIPFilterCommandDTO
  | OIAnalyticsFetchDeleteIPFilterCommandDTO
  | OIAnalyticsFetchCreateCertificateCommandDTO
  | OIAnalyticsFetchUpdateCertificateCommandDTO
  | OIAnalyticsFetchDeleteCertificateCommandDTO
  | OIAnalyticsFetchCreateSouthConnectorCommandDTO
  | OIAnalyticsFetchUpdateSouthConnectorCommandDTO
  | OIAnalyticsFetchDeleteSouthConnectorCommandDTO
  | OIAnalyticsFetchCreateNorthConnectorCommandDTO
  | OIAnalyticsFetchUpdateNorthConnectorCommandDTO
  | OIAnalyticsFetchDeleteNorthConnectorCommandDTO
  | OIAnalyticsFetchCreateOrUpdateSouthConnectorItemsFromCSVCommandDTO;
