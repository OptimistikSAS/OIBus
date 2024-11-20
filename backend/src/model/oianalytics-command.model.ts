import { BaseEntity, Instant } from './types';
import { OIBusCommandStatus, OIBusCommandType } from '../../shared/model/command.model';
import { EngineSettingsCommandDTO } from '../../shared/model/engine.model';
import { ScanModeCommandDTO } from '../../shared/model/scan-mode.model';
import { SouthConnectorCommandDTO } from '../../shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import { NorthConnectorCommandDTO } from '../../shared/model/north-connector.model';
import { NorthSettings } from '../../shared/model/north-settings.model';

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
  | OIBusCreateScanModeCommand
  | OIBusUpdateScanModeCommand
  | OIBusDeleteScanModeCommand
  | OIBusCreateSouthConnectorCommand
  | OIBusUpdateSouthConnectorCommand
  | OIBusDeleteSouthConnectorCommand
  | OIBusCreateNorthConnectorCommand
  | OIBusUpdateNorthConnectorCommand
  | OIBusDeleteNorthConnectorCommand
  | OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommand;
