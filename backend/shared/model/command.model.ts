import { EngineSettingsCommandDTO } from './engine.model';
import { Instant } from './types';
import { ScanModeCommandDTO } from './scan-mode.model';
import { SouthConnectorCommandDTO } from './south-connector.model';
import { SouthItemSettings, SouthSettings } from './south-settings.model';
import { NorthConnectorCommandDTO } from './north-connector.model';
import { NorthSettings } from './north-settings.model';
import { IPFilterCommandDTO } from './ip-filter.model';
import { CertificateCommandDTO } from './certificate.model';

export const OIBUS_COMMAND_TYPES = [
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
  'create-north',
  'update-north',
  'delete-north',
  'create-or-update-south-items-from-csv'
] as const;
export type OIBusCommandType = (typeof OIBUS_COMMAND_TYPES)[number];

export const OIBUS_COMMAND_STATUS = ['RETRIEVED', 'RUNNING', 'ERRORED', 'CANCELLED', 'COMPLETED'] as const;
export type OIBusCommandStatus = (typeof OIBUS_COMMAND_STATUS)[number];

export interface BaseOIBusCommandDTO {
  id: string;
  type: OIBusCommandType;
  status: OIBusCommandStatus;
  ack: boolean;
  retrievedDate: Instant | null;
  completedDate: Instant | null;
  result: string | null;
}

export interface OIBusUpdateVersionCommandDTO extends BaseOIBusCommandDTO {
  type: 'update-version';
  commandContent: {
    version: string;
    assetId: string;
    updateLauncher: boolean;
    backupFolders: string;
  };
}

export interface OIBusRestartEngineCommandDTO extends BaseOIBusCommandDTO {
  type: 'restart-engine';
}

export interface OIBusRegenerateCipherKeysCommandDTO extends BaseOIBusCommandDTO {
  type: 'regenerate-cipher-keys';
}

export interface OIBusUpdateEngineSettingsCommandDTO extends BaseOIBusCommandDTO {
  type: 'update-engine-settings';
  targetVersion: string;
  commandContent: EngineSettingsCommandDTO;
}

export interface OIBusUpdateRegistrationSettingsCommandDTO extends BaseOIBusCommandDTO {
  type: 'update-registration-settings';
  targetVersion: string;
  commandContent: {
    commandRefreshInterval: number;
    commandRetryInterval: number;
    messageRetryInterval: number;
  };
}

export interface OIBusCreateScanModeCommandDTO extends BaseOIBusCommandDTO {
  type: 'create-scan-mode';
  targetVersion: string;
  commandContent: ScanModeCommandDTO;
}

export interface OIBusUpdateScanModeCommandDTO extends BaseOIBusCommandDTO {
  type: 'update-scan-mode';
  targetVersion: string;
  scanModeId: string;
  commandContent: ScanModeCommandDTO;
}

export interface OIBusDeleteScanModeCommandDTO extends BaseOIBusCommandDTO {
  type: 'delete-scan-mode';
  targetVersion: string;
  scanModeId: string;
}

export interface OIBusCreateIPFilterCommandDTO extends BaseOIBusCommandDTO {
  type: 'create-ip-filter';
  targetVersion: string;
  commandContent: IPFilterCommandDTO;
}

export interface OIBusUpdateIPFilterCommandDTO extends BaseOIBusCommandDTO {
  type: 'update-ip-filter';
  targetVersion: string;
  ipFilterId: string;
  commandContent: IPFilterCommandDTO;
}

export interface OIBusDeleteIPFilterCommandDTO extends BaseOIBusCommandDTO {
  type: 'delete-ip-filter';
  targetVersion: string;
  ipFilterId: string;
}

export interface OIBusCreateCertificateCommandDTO extends BaseOIBusCommandDTO {
  type: 'create-certificate';
  targetVersion: string;
  commandContent: CertificateCommandDTO;
}

export interface OIBusUpdateCertificateCommandDTO extends BaseOIBusCommandDTO {
  type: 'update-certificate';
  targetVersion: string;
  certificateId: string;
  commandContent: CertificateCommandDTO;
}

export interface OIBusDeleteCertificateCommandDTO extends BaseOIBusCommandDTO {
  type: 'delete-certificate';
  targetVersion: string;
  certificateId: string;
}

export interface OIBusCreateSouthConnectorCommandDTO extends BaseOIBusCommandDTO {
  type: 'create-south';
  targetVersion: string;
  commandContent: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
}

export interface OIBusUpdateSouthConnectorCommandDTO extends BaseOIBusCommandDTO {
  type: 'update-south';
  targetVersion: string;
  southConnectorId: string;
  commandContent: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
}

export interface OIBusDeleteSouthConnectorCommandDTO extends BaseOIBusCommandDTO {
  type: 'delete-south';
  targetVersion: string;
  southConnectorId: string;
}

export interface OIBusCreateNorthConnectorCommandDTO extends BaseOIBusCommandDTO {
  type: 'create-north';
  targetVersion: string;
  commandContent: NorthConnectorCommandDTO<NorthSettings>;
}

export interface OIBusUpdateNorthConnectorCommandDTO extends BaseOIBusCommandDTO {
  type: 'update-north';
  targetVersion: string;
  northConnectorId: string;
  commandContent: NorthConnectorCommandDTO<NorthSettings>;
}

export interface OIBusDeleteNorthConnectorCommandDTO extends BaseOIBusCommandDTO {
  type: 'delete-north';
  targetVersion: string;
  northConnectorId: string;
}

export interface OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommandDTO extends BaseOIBusCommandDTO {
  type: 'create-or-update-south-items-from-csv';
  targetVersion: string;
  southConnectorId: string;
  commandContent: {
    deleteItemsNotPresent: boolean;
    csvContent: string;
    delimiter: string;
  };
}

export type OIBusCommandDTO =
  | OIBusUpdateVersionCommandDTO
  | OIBusRegenerateCipherKeysCommandDTO
  | OIBusRestartEngineCommandDTO
  | OIBusUpdateEngineSettingsCommandDTO
  | OIBusUpdateRegistrationSettingsCommandDTO
  | OIBusCreateScanModeCommandDTO
  | OIBusUpdateScanModeCommandDTO
  | OIBusDeleteScanModeCommandDTO
  | OIBusCreateIPFilterCommandDTO
  | OIBusUpdateIPFilterCommandDTO
  | OIBusDeleteIPFilterCommandDTO
  | OIBusCreateCertificateCommandDTO
  | OIBusUpdateCertificateCommandDTO
  | OIBusDeleteCertificateCommandDTO
  | OIBusCreateSouthConnectorCommandDTO
  | OIBusUpdateSouthConnectorCommandDTO
  | OIBusDeleteSouthConnectorCommandDTO
  | OIBusCreateNorthConnectorCommandDTO
  | OIBusUpdateNorthConnectorCommandDTO
  | OIBusDeleteNorthConnectorCommandDTO
  | OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommandDTO;

export interface CommandSearchParam {
  page?: number;
  types: Array<string>;
  status: Array<string>;
  ack?: boolean;
}
