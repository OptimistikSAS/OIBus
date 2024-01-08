import { BaseEntity, Instant } from './types';

export const OIBUS_COMMAND_TYPES = ['UPGRADE'];
export type OIBusCommandType = (typeof OIBUS_COMMAND_TYPES)[number];

export const OIBUS_COMMAND_STATUS = ['PENDING', 'ERRORED', 'CANCELLED', 'COMPLETED'];
export type OIBusCommandStatus = (typeof OIBUS_COMMAND_STATUS)[number];

export interface BaseOIBusCommand {
  type: OIBusCommandType;
}

export interface OIBusUpgradeCommand extends BaseOIBusCommand {
  type: 'UPGRADE';
  version: string;
}

export type OIBusCommand = OIBusUpgradeCommand;

export interface BaseOIBusCommandDTO extends BaseEntity {
  retrievedDate?: Instant;
  completedDate?: Instant;
  type: OIBusCommandType;
  status: OIBusCommandStatus;
  result?: string;
}

export interface OIBusUpgradeCommandDTO extends BaseOIBusCommandDTO {
  type: 'UPGRADE';
  version: string;
}

export type OIBusCommandDTO = OIBusUpgradeCommandDTO;
