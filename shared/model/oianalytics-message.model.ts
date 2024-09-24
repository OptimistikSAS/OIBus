import { BaseEntity, Instant } from './types';

export const OIANALYTICS_MESSAGE_STATUS = ['PENDING', 'COMPLETED', 'ERRORED'] as const;
export type OIAnalyticsMessageStatus = (typeof OIANALYTICS_MESSAGE_STATUS)[number];

export const OIANALYTICS_MESSAGE_TYPES = ['INFO'] as const;
export type OIAnalyticsMessageType = (typeof OIANALYTICS_MESSAGE_TYPES)[number];

interface BaseOIAnalyticsMessageDTO extends BaseEntity {
  type: OIAnalyticsMessageType;
  status: OIAnalyticsMessageStatus;
  error?: string;
  completedDate?: Instant;
}

interface BaseOIAnalyticsMessageCommandDTO {
  type: string;
}

export interface OIAnalyticsMessageSearchParam {
  types: Array<OIAnalyticsMessageType>;
  status: Array<OIAnalyticsMessageStatus>;
  start?: Instant;
  end?: Instant;
}

export interface InfoMessageContent {
  version: string;
  oibusName: string;
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

export interface OIAnalyticsMessageInfoCommandDTO extends BaseOIAnalyticsMessageCommandDTO {
  type: 'INFO';
  version: string;
  oibusName: string;
  oibusId: string;
  dataDirectory: string;
  binaryDirectory: string;
  processId: string;
  hostname: string;
  operatingSystem: string;
  architecture: string;
  platform: string;
}

export type OIAnalyticsMessageCommand = OIAnalyticsMessageInfoCommandDTO;
export type OIAnalyticsMessageDTO = OIAnalyticsMessageInfoDTO;
export type InfoMessage = InfoMessageContent;
