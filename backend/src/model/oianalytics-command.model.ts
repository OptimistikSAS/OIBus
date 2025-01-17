import { BaseEntity, Instant } from './types';
import { OIBusCommandStatus, OIBusCommandType } from '../../shared/model/command.model';
import { EngineSettingsCommandDTO } from '../../shared/model/engine.model';
import { ScanModeCommandDTO } from '../../shared/model/scan-mode.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemTestingSettings
} from '../../shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { NorthConnectorCommandDTO } from '../../shared/model/north-connector.model';
import { NorthSettings } from '../../shared/model/north-settings.model';
import { IPFilterCommandDTO } from '../../shared/model/ip-filter.model';
import { CertificateCommandDTO } from '../../shared/model/certificate.model';

export interface BaseOIBusCommand extends BaseEntity {
  type: OIBusCommandType;
  ack: boolean;
  completedDate: Instant | null;
  retrievedDate: Instant | null;
  status: OIBusCommandStatus;
  result: string | null;
  targetVersion: string;
}

export interface OIBusUpdateVersionCommand extends BaseOIBusCommand {
  type: 'update-version';
  commandContent: {
    version: string;
    assetId: string;
    updateLauncher: boolean;
    backupFolders: string;
  };
}

export interface OIBusRestartEngineCommand extends BaseOIBusCommand {
  type: 'restart-engine';
}

export interface OIBusRegenerateCipherKeysCommand extends BaseOIBusCommand {
  type: 'regenerate-cipher-keys';
}

export interface OIBusUpdateEngineSettingsCommand extends BaseOIBusCommand {
  type: 'update-engine-settings';
  commandContent: EngineSettingsCommandDTO;
}

export interface OIBusUpdateRegistrationSettingsCommand extends BaseOIBusCommand {
  type: 'update-registration-settings';
  commandContent: {
    commandRefreshInterval: number;
    commandRetryInterval: number;
    messageRetryInterval: number;
  };
}

export interface OIBusCreateScanModeCommand extends BaseOIBusCommand {
  type: 'create-scan-mode';
  commandContent: ScanModeCommandDTO;
}

export interface OIBusUpdateScanModeCommand extends BaseOIBusCommand {
  type: 'update-scan-mode';
  scanModeId: string;
  commandContent: ScanModeCommandDTO;
}

export interface OIBusDeleteScanModeCommand extends BaseOIBusCommand {
  type: 'delete-scan-mode';
  scanModeId: string;
}

export interface OIBusCreateIPFilterCommand extends BaseOIBusCommand {
  type: 'create-ip-filter';
  commandContent: IPFilterCommandDTO;
}

export interface OIBusUpdateIPFilterCommand extends BaseOIBusCommand {
  type: 'update-ip-filter';
  ipFilterId: string;
  commandContent: IPFilterCommandDTO;
}

export interface OIBusDeleteIPFilterCommand extends BaseOIBusCommand {
  type: 'delete-ip-filter';
  ipFilterId: string;
}

export interface OIBusCreateCertificateCommand extends BaseOIBusCommand {
  type: 'create-certificate';
  commandContent: CertificateCommandDTO;
}

export interface OIBusUpdateCertificateCommand extends BaseOIBusCommand {
  type: 'update-certificate';
  certificateId: string;
  commandContent: CertificateCommandDTO;
}

export interface OIBusDeleteCertificateCommand extends BaseOIBusCommand {
  type: 'delete-certificate';
  certificateId: string;
}

export interface OIBusCreateSouthConnectorCommand extends BaseOIBusCommand {
  type: 'create-south';
  southConnectorId: string | null; // used to retrieve passwords in case of duplicate
  commandContent: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
}

export interface OIBusUpdateSouthConnectorCommand extends BaseOIBusCommand {
  type: 'update-south';
  southConnectorId: string;
  commandContent: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
}

export interface OIBusDeleteSouthConnectorCommand extends BaseOIBusCommand {
  type: 'delete-south';
  southConnectorId: string;
}

export interface OIBusTestSouthConnectorCommand extends BaseOIBusCommand {
  type: 'test-south-connection';
  targetVersion: string;
  southConnectorId: string;
  commandContent: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
}

export interface OIBusTestSouthConnectorItemCommand extends BaseOIBusCommand {
  type: 'test-south-item';
  targetVersion: string;
  southConnectorId: string;
  itemId: string;
  commandContent: {
    southCommand: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
    itemCommand: SouthConnectorItemCommandDTO<SouthItemSettings>;
    testingSettings: SouthConnectorItemTestingSettings;
  };
}

export interface OIBusCreateNorthConnectorCommand extends BaseOIBusCommand {
  type: 'create-north';
  northConnectorId: string | null; // used to retrieve passwords in case of duplicate
  commandContent: NorthConnectorCommandDTO<NorthSettings>;
}

export interface OIBusUpdateNorthConnectorCommand extends BaseOIBusCommand {
  type: 'update-north';
  northConnectorId: string;
  commandContent: NorthConnectorCommandDTO<NorthSettings>;
}

export interface OIBusDeleteNorthConnectorCommand extends BaseOIBusCommand {
  type: 'delete-north';
  northConnectorId: string;
}

export interface OIBusTestNorthConnectorCommand extends BaseOIBusCommand {
  type: 'test-north-connection';
  targetVersion: string;
  northConnectorId: string;
  commandContent: NorthConnectorCommandDTO<NorthSettings>;
}

export interface OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand extends BaseOIBusCommand {
  type: 'create-or-update-south-items-from-csv';
  southConnectorId: string;
  commandContent: {
    deleteItemsNotPresent: boolean;
    csvContent: string;
    delimiter: string;
  };
}

export type OIBusCommand =
  | OIBusUpdateVersionCommand
  | OIBusRestartEngineCommand
  | OIBusRegenerateCipherKeysCommand
  | OIBusUpdateEngineSettingsCommand
  | OIBusUpdateRegistrationSettingsCommand
  | OIBusCreateScanModeCommand
  | OIBusUpdateScanModeCommand
  | OIBusDeleteScanModeCommand
  | OIBusCreateIPFilterCommand
  | OIBusUpdateIPFilterCommand
  | OIBusDeleteIPFilterCommand
  | OIBusCreateCertificateCommand
  | OIBusUpdateCertificateCommand
  | OIBusDeleteCertificateCommand
  | OIBusCreateSouthConnectorCommand
  | OIBusUpdateSouthConnectorCommand
  | OIBusDeleteSouthConnectorCommand
  | OIBusTestSouthConnectorCommand
  | OIBusTestSouthConnectorItemCommand
  | OIBusCreateNorthConnectorCommand
  | OIBusUpdateNorthConnectorCommand
  | OIBusDeleteNorthConnectorCommand
  | OIBusTestNorthConnectorCommand
  | OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand;
