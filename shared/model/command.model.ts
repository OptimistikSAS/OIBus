import { BaseEntity, Instant } from './types';
import { EngineSettingsCommandDTO } from './engine.model';

export const OIBUS_COMMAND_TYPES = [
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
export type OIBusCommandType = (typeof OIBUS_COMMAND_TYPES)[number];

export const OIBUS_COMMAND_STATUS = ['RETRIEVED', 'RUNNING', 'ERRORED', 'CANCELLED', 'COMPLETED'] as const;
export type OIBusCommandStatus = (typeof OIBUS_COMMAND_STATUS)[number];

export interface BaseOIBusCommandDTO {
  id: string;
  type: OIBusCommandType;
}

export interface OIBusUpdateVersionCommandDTO extends BaseOIBusCommandDTO {
  type: 'update-version';
  assetId: string;
  version: string;
}

export interface OIBusRestartEngineCommandDTO extends BaseOIBusCommandDTO {
  type: 'restart-engine';
}

export interface OIBusUpdateEngineSettingsCommandDTO extends BaseOIBusCommandDTO {
  type: 'update-engine-settings';
  targetVersion: string;
  commandContent: EngineSettingsCommandDTO;
}

export interface OIBusCreateScanModeCommandDTO extends BaseOIBusCommandDTO {
  type: 'create-scan-mode';
  targetVersion: string;
  commandContent: any;
}

export interface OIBusUpdateScanModeCommandDTO extends BaseOIBusCommandDTO {
  type: 'update-scan-mode';
  targetVersion: string;
  scanModeId: string;
  commandContent: any;
}

export interface OIBusDeleteScanModeCommandDTO extends BaseOIBusCommandDTO {
  type: 'delete-scan-mode';
  targetVersion: string;
  scanModeId: string;
}

export interface OIBusCreateSouthConnectorCommandDTO extends BaseOIBusCommandDTO {
  type: 'create-south';
  targetVersion: string;
  commandContent: any;
}

export interface OIBusUpdateSouthConnectorCommandDTO extends BaseOIBusCommandDTO {
  type: 'update-south';
  targetVersion: string;
  southConnectorId: string;
  commandContent: any;
}

export interface OIBusDeleteSouthConnectorCommandDTO extends BaseOIBusCommandDTO {
  type: 'delete-south';
  targetVersion: string;
  southConnectorId: string;
}

export interface OIBusCreateNorthConnectorCommandDTO extends BaseOIBusCommandDTO {
  type: 'create-north';
  targetVersion: string;
  commandContent: any;
}

export interface OIBusUpdateNorthConnectorCommandDTO extends BaseOIBusCommandDTO {
  type: 'update-north';
  targetVersion: string;
  northConnectorId: string;
  commandContent: any;
}

export interface OIBusDeleteNorthConnectorCommandDTO extends BaseOIBusCommandDTO {
  type: 'delete-north';
  targetVersion: string;
  northConnectorId: string;
}

export type OIBusCommandDTO =
  | OIBusUpdateVersionCommandDTO
  | OIBusRestartEngineCommandDTO
  | OIBusUpdateEngineSettingsCommandDTO
  | OIBusCreateScanModeCommandDTO
  | OIBusUpdateScanModeCommandDTO
  | OIBusDeleteScanModeCommandDTO
  | OIBusCreateSouthConnectorCommandDTO
  | OIBusUpdateSouthConnectorCommandDTO
  | OIBusDeleteSouthConnectorCommandDTO
  | OIBusCreateNorthConnectorCommandDTO
  | OIBusUpdateNorthConnectorCommandDTO
  | OIBusDeleteNorthConnectorCommandDTO;

export interface BaseOIBusCommand extends BaseEntity {
  type: OIBusCommandType;
  ack: boolean;
  completedDate: Instant | null;
  retrievedDate: Instant | null;
  status: OIBusCommandStatus;
  result: string | null;
}

export interface OIBusUpdateVersionCommand extends BaseOIBusCommand {
  type: 'update-version';
  version: string;
  assetId: string;
}

export interface OIBusRestartEngineCommand extends BaseOIBusCommand {
  type: 'restart-engine';
}

export interface OIBusUpdateEngineSettingsCommand extends BaseOIBusCommand {
  type: 'update-engine-settings';
  targetVersion: string;
  commandContent: EngineSettingsCommandDTO;
}

export interface OIBusCreateScanModeCommand extends BaseOIBusCommand {
  type: 'create-scan-mode';
  targetVersion: string;
  commandContent: any;
}

export interface OIBusUpdateScanModeCommand extends BaseOIBusCommand {
  type: 'update-scan-mode';
  targetVersion: string;
  scanModeId: string;
  commandContent: any;
}

export interface OIBusDeleteScanModeCommand extends BaseOIBusCommand {
  type: 'delete-scan-mode';
  targetVersion: string;
  scanModeId: string;
}

export interface OIBusCreateSouthConnectorCommand extends BaseOIBusCommand {
  type: 'create-south';
  targetVersion: string;
  commandContent: any;
}

export interface OIBusUpdateSouthConnectorCommand extends BaseOIBusCommand {
  type: 'update-south';
  targetVersion: string;
  southConnectorId: string;
  commandContent: any;
}

export interface OIBusDeleteSouthConnectorCommand extends BaseOIBusCommand {
  type: 'delete-south';
  targetVersion: string;
  southConnectorId: string;
}

export interface OIBusCreateNorthConnectorCommand extends BaseOIBusCommand {
  type: 'create-north';
  targetVersion: string;
  commandContent: any;
}

export interface OIBusUpdateNorthConnectorCommand extends BaseOIBusCommand {
  type: 'update-north';
  targetVersion: string;
  northConnectorId: string;
  commandContent: any;
}

export interface OIBusDeleteNorthConnectorCommand extends BaseOIBusCommand {
  type: 'delete-north';
  targetVersion: string;
  northConnectorId: string;
}

export type OIBusCommand =
  | OIBusUpdateVersionCommand
  | OIBusRestartEngineCommand
  | OIBusUpdateEngineSettingsCommand
  | OIBusCreateScanModeCommand
  | OIBusUpdateScanModeCommand
  | OIBusDeleteScanModeCommand
  | OIBusCreateSouthConnectorCommand
  | OIBusUpdateSouthConnectorCommand
  | OIBusDeleteSouthConnectorCommand
  | OIBusCreateNorthConnectorCommand
  | OIBusUpdateNorthConnectorCommand
  | OIBusDeleteNorthConnectorCommand;

export interface CommandSearchParam {
  page?: number;
  types: Array<OIBusCommandType>;
  status: Array<OIBusCommandStatus>;
  ack?: boolean;
}
