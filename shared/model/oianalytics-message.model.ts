import { BaseEntity, Instant } from './types';
import { EngineSettingsDTO, LogSettings } from './engine.model';
import { OIBusFullConfigDTO } from './command.model';

export const OIANALYTICS_MESSAGE_STATUS = ['PENDING', 'COMPLETED', 'ERRORED'] as const;
export type OIAnalyticsMessageStatus = (typeof OIANALYTICS_MESSAGE_STATUS)[number];

export const OIANALYTICS_MESSAGE_TYPES = ['INFO', 'FULL_CONFIG', 'ENGINE_CONFIG'] as const;
export type OIAnalyticsMessageType = (typeof OIANALYTICS_MESSAGE_TYPES)[number];

export interface OIAnalyticsMessageSearchParam {
  types: Array<OIAnalyticsMessageType>;
  status: Array<OIAnalyticsMessageStatus>;
  start?: Instant;
  end?: Instant;
}

// DTO used to display messages in OIBus
interface BaseOIAnalyticsMessageDTO extends BaseEntity {
  type: OIAnalyticsMessageType;
  status: OIAnalyticsMessageStatus;
  error?: string;
  completedDate?: Instant;
}

export interface InfoMessageContent {
  version: string;
  oibusId: string;
  dataDirectory: string;
  binaryDirectory: string;
  processId: string;
  hostname: string;
  operatingSystem: string;
  architecture: string;
  platform: string;
}

export interface OIAnalyticsMessageInfoDTO extends BaseOIAnalyticsMessageDTO {
  type: 'INFO';
  content: InfoMessageContent;
}

// No need to store the config, it will be sent at run time
export interface OIAnalyticsMessageFullConfigDTO extends BaseOIAnalyticsMessageDTO {
  type: 'FULL_CONFIG';
}

export interface OIAnalyticsMessageEngineConfigDTO extends BaseOIAnalyticsMessageDTO {
  type: 'ENGINE_CONFIG';
  content: Omit<EngineSettingsDTO, 'version' | 'id'>;
}

export type OIAnalyticsMessageDTO = OIAnalyticsMessageInfoDTO | OIAnalyticsMessageFullConfigDTO | OIAnalyticsMessageEngineConfigDTO;

// DTO used to update or create messages in OIBus and send messages to OIAnalytics
interface BaseOIAnalyticsMessageCommandDTO {
  type: string;
}

export interface OIAnalyticsMessageInfoCommandDTO extends BaseOIAnalyticsMessageCommandDTO {
  type: 'INFO';
  version: string;
  oibusId: string;
  dataDirectory: string;
  binaryDirectory: string;
  processId: string;
  hostname: string;
  operatingSystem: string;
  architecture: string;
  platform: string;
}

export interface OIAnalyticsMessageFullConfigCommandDTO extends BaseOIAnalyticsMessageCommandDTO {
  type: 'FULL_CONFIG';
  config?: OIBusFullConfigDTO;
}

export interface OIAnalyticsMessageEngineConfigCommandDTO extends BaseOIAnalyticsMessageCommandDTO {
  type: 'ENGINE_CONFIG';
  name: string;
  port: number;
  proxyEnabled: boolean;
  proxyPort: number;
  logParameters: LogSettings;
}

export type OIAnalyticsMessageCommand =
  | OIAnalyticsMessageInfoCommandDTO
  | OIAnalyticsMessageFullConfigCommandDTO
  | OIAnalyticsMessageEngineConfigCommandDTO;
