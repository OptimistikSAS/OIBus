import { BaseEntity, Instant } from './types';
import { OIBusCommandStatus, OIBusCommandType } from '../../../shared/model/command.model';

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
  commandContent: any;
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
