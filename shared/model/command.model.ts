import { BaseEntity, Instant } from './types';

export const OIBUS_COMMAND_TYPES = ['UPGRADE'] as const;
export type OIBusCommandType = (typeof OIBUS_COMMAND_TYPES)[number];

export const OIBUS_COMMAND_STATUS = ['PENDING', 'ERRORED', 'CANCELLED', 'COMPLETED'] as const;
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
  completedDate?: Instant;
  retrievedDate?: Instant;
  type: OIBusCommandType;
  status: OIBusCommandStatus;
  result?: string;
}

export interface OIBusUpgradeCommandDTO extends BaseOIBusCommandDTO {
  type: 'UPGRADE';
  version: string;
}

export type OIBusCommandDTO = OIBusUpgradeCommandDTO;

export interface CommandSearchParam {
  page?: number;
  types: Array<OIBusCommandType>;
  status: Array<OIBusCommandStatus>;
}
