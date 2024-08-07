import { BaseEntity, Instant } from './types';

export const OIBUS_COMMAND_TYPES = ['UPGRADE', 'RESTART', 'ENGINE_CONFIG'] as const;
export type OIBusCommandType = (typeof OIBUS_COMMAND_TYPES)[number];

export const OIBUS_COMMAND_STATUS = ['RETRIEVED', 'RUNNING', 'ERRORED', 'CANCELLED', 'COMPLETED'] as const;
export type OIBusCommandStatus = (typeof OIBUS_COMMAND_STATUS)[number];

export interface BaseOIBusCommand {
  type: OIBusCommandType;
}

export interface OIBusUpgradeCommand extends BaseOIBusCommand {
  type: 'UPGRADE';
  assetId: string;
  version: string;
}

export interface OIBusRestartCommand extends BaseOIBusCommand {
  type: 'RESTART';
}

export interface OIBusFullConfigCommand extends BaseOIBusCommand {
  type: 'ENGINE_CONFIG';
  settings: OIAnalyticsEngineSettingsDTO;
}

export type OIBusCommand = OIBusUpgradeCommand | OIBusRestartCommand | OIBusFullConfigCommand;

export interface BaseOIBusCommandDTO extends BaseEntity {
  ack: boolean;
  completedDate?: Instant;
  retrievedDate?: Instant;
  type: OIBusCommandType;
  status: OIBusCommandStatus;
  result?: string;
}

export interface OIBusUpgradeCommandDTO extends BaseOIBusCommandDTO {
  type: 'UPGRADE';
  version: string;
  assetId: string;
}

export interface OIBusRestartCommandDTO extends BaseOIBusCommandDTO {
  type: 'RESTART';
}

export interface OIBusEngineConfigCommandDTO extends BaseOIBusCommandDTO {
  type: 'ENGINE_CONFIG';
  settings: OIAnalyticsEngineSettingsDTO;
}

export type OIBusCommandDTO = OIBusUpgradeCommandDTO | OIBusRestartCommandDTO | OIBusEngineConfigCommandDTO;

export interface CommandSearchParam {
  page?: number;
  types: Array<OIBusCommandType>;
  status: Array<OIBusCommandStatus>;
  ack?: boolean;
}

export interface OIAnalyticsEngineSettingsDTO {
  oIBusInternalId: string;
  name: string;
  softwareVersion: string;
  architecture: string;
  operatingSystem: string;
  settings: {
    port: number;
    proxyEnabled: boolean;
    proxyPort: number;
  };
}

export interface OIAnalyticsScanModeDTO {
  oIBusInternalId: string;
  name: string;
  settings: {
    description: string;
    cron: string;
  };
}

export interface OIAnalyticsIpFilterDTO {
  oIBusInternalId: string;
  settings: {
    description: string;
    address: string;
  };
}

export interface OIAnalyticsNorthConnectorDTO<T> {
  oIBusInternalId: string;
  type: string;
  name: string;
  settings: {
    description: string;
    enabled: boolean;
    settings: T;
    scanModeId: string;
    retryInterval: number;
    retryCount: number;
    maxSize: number;
    southSubscriptionIds: Array<string>;
  };
}

export interface OIAnalyticsSouthConnectorItemDTO<T> {
  oIBusInternalId: string;
  name: string;
  settings: {
    scanModeId: string;
    enabled: boolean;
    settings: T;
  };
}

export interface OIAnalyticsSouthConnectorDTO<T, I> {
  oIBusInternalId: string;
  type: string;
  name: string;
  settings: {
    description: string;
    enabled: boolean;
    settings: T;
    southItems: Array<OIAnalyticsSouthConnectorItemDTO<I>>;
  };
}

export interface OIBusFullConfigDTO {
  engine: OIAnalyticsEngineSettingsDTO;
  scanModes: Array<OIAnalyticsScanModeDTO>;
  ipFilters: Array<OIAnalyticsIpFilterDTO>;
  northConnectors: Array<OIAnalyticsNorthConnectorDTO<any>>;
  southConnectors: Array<OIAnalyticsSouthConnectorDTO<any, any>>;
}
