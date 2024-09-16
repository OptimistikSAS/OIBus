import { EngineSettingsCommandDTO } from './engine.model';
import { Instant } from './types';

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
  status: OIBusCommandStatus;
  ack: boolean;
  retrievedDate: Instant | null;
  completedDate: Instant | null;
  result: string | null;
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

export interface CommandSearchParam {
  page?: number;
  types: Array<OIBusCommandType>;
  status: Array<OIBusCommandStatus>;
  ack?: boolean;
}
