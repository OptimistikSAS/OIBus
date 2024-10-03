//
// DTO to send to OIAnalytics
//
import { EngineSettingsCommandDTO } from '../../../shared/model/engine.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthItemSettings, NorthSettings } from '../../../shared/model/north-settings.model';
import { NorthConnectorCommandDTO } from '../../../shared/model/north-connector.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemTestingSettings
} from '../../../shared/model/south-connector.model';
import { CertificateCommandDTO, CertificateDTO } from '../../../shared/model/certificate.model';
import { UserCommandDTO } from '../../../shared/model/user.model';
import { IPFilterCommandDTO } from '../../../shared/model/ip-filter.model';
import { ScanModeCommandDTO } from '../../../shared/model/scan-mode.model';
import { HistoryQueryCommandDTO, HistoryQuerySouthItemCommandDTO, HistoryQueryStatus } from '../../../shared/model/history-query.model';

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
  settings: NorthConnectorCommandDTO<NorthSettings, NorthItemSettings>;
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

export interface OIBusHistoryQueriesCommandDTO {
  historyQueries: Array<{
    oIBusInternalId: string | null;
    settings: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings, NorthItemSettings>;
  }>;
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
  'test-south-connection',
  'test-south-item',
  'create-north',
  'update-north',
  'delete-north',
  'test-north-connection',
  'create-history-query',
  'update-history-query',
  'delete-history-query',
  'test-history-query-north-connection',
  'test-history-query-south-connection',
  'test-history-query-south-item',
  'create-or-update-history-query-south-items-from-csv',
  'update-history-query-status'
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

export interface OIAnalyticsFetchCreateOrUpdateSouthConnectorItemsFromCSVCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'create-or-update-south-items-from-csv';
  southConnectorId: string;
  deleteItemsNotPresent: boolean;
  csvContent: string;
  delimiter: string;
}

export interface OIAnalyticsFetchTestSouthConnectionCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'test-south-connection';
  southConnectorId: string;
  commandContent: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
}

export interface OIAnalyticsFetchTestSouthItemCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'test-south-item';
  southConnectorId: string;
  itemId: string;
  commandContent: {
    southCommand: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
    itemCommand: SouthConnectorItemCommandDTO<SouthItemSettings>;
    testingSettings: SouthConnectorItemTestingSettings;
  };
}

export interface OIAnalyticsFetchCreateNorthConnectorCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'create-north';
  retrieveSecretsFromNorth: string | null; // used to retrieve passwords in case of duplicate
  commandContent: NorthConnectorCommandDTO<NorthSettings, NorthItemSettings>;
}

export interface OIAnalyticsFetchUpdateNorthConnectorCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'update-north';
  northConnectorId: string;
  commandContent: NorthConnectorCommandDTO<NorthSettings, NorthItemSettings>;
}

export interface OIAnalyticsFetchDeleteNorthConnectorCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'delete-north';
  northConnectorId: string;
}

export interface OIAnalyticsFetchTestNorthConnectionCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'test-north-connection';
  northConnectorId: string;
  commandContent: NorthConnectorCommandDTO<NorthSettings, NorthItemSettings>;
}

export interface OIAnalyticsFetchCreateHistoryQueryCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'create-history-query';
  retrieveSecretsFromSouth: string | null;
  retrieveSecretsFromNorth: string | null;
  retrieveSecretsFromHistoryQuery: string | null;
  commandContent: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings, NorthItemSettings>;
}

export interface OIAnalyticsFetchUpdateHistoryQueryCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'update-history-query';
  historyId: string;
  commandContent: {
    resetCache: boolean;
    historyQuery: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings, NorthItemSettings>;
  };
}

export interface OIAnalyticsFetchDeleteHistoryQueryCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'delete-history-query';
  historyId: string;
}

export interface OIAnalyticsFetchTestHistoryQueryNorthConnectionCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'test-history-query-north-connection';
  historyId: string;
  northConnectorId: string;
  commandContent: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings, NorthItemSettings>;
}

export interface OIAnalyticsFetchTestHistoryQuerySouthConnectionCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'test-history-query-south-connection';
  historyId: string;
  southConnectorId: string;
  commandContent: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings, NorthItemSettings>;
}

export interface OIAnalyticsFetchTestHistoryQuerySouthItemConnectionCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'test-history-query-south-item';
  historyId: string;
  southConnectorId: string;
  itemId: string;
  commandContent: {
    historyCommand: HistoryQueryCommandDTO<SouthSettings, NorthSettings, SouthItemSettings, NorthItemSettings>;
    itemCommand: HistoryQuerySouthItemCommandDTO<SouthItemSettings>;
    testingSettings: SouthConnectorItemTestingSettings;
  };
}

export interface OIAnalyticsFetchCreateOrUpdateHistoryQuerySouthItemsFromCSVCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'create-or-update-history-query-south-items-from-csv';
  historyId: string;
  deleteItemsNotPresent: boolean;
  csvContent: string;
  delimiter: string;
}

export interface OIAnalyticsFetchUpdateHistoryQueryStatusCommandDTO extends BaseOIAnalyticsFetchCommandDTO {
  type: 'update-history-query-status';
  historyId: string;
  historyQueryStatus: HistoryQueryStatus;
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
  | OIAnalyticsFetchTestSouthConnectionCommandDTO
  | OIAnalyticsFetchTestSouthItemCommandDTO
  | OIAnalyticsFetchCreateOrUpdateSouthConnectorItemsFromCSVCommandDTO
  | OIAnalyticsFetchCreateNorthConnectorCommandDTO
  | OIAnalyticsFetchUpdateNorthConnectorCommandDTO
  | OIAnalyticsFetchDeleteNorthConnectorCommandDTO
  | OIAnalyticsFetchTestNorthConnectionCommandDTO
  | OIAnalyticsFetchCreateHistoryQueryCommandDTO
  | OIAnalyticsFetchUpdateHistoryQueryCommandDTO
  | OIAnalyticsFetchDeleteHistoryQueryCommandDTO
  | OIAnalyticsFetchTestHistoryQueryNorthConnectionCommandDTO
  | OIAnalyticsFetchTestHistoryQuerySouthConnectionCommandDTO
  | OIAnalyticsFetchTestHistoryQuerySouthItemConnectionCommandDTO
  | OIAnalyticsFetchCreateOrUpdateHistoryQuerySouthItemsFromCSVCommandDTO
  | OIAnalyticsFetchUpdateHistoryQueryStatusCommandDTO;
