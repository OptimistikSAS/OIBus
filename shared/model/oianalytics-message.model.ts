import { BaseEntity, Instant } from './types';

export const OIANALYTICS_MESSAGE_STATUS = ['PENDING', 'COMPLETED', 'ERRORED'] as const;
export type OIAnalyticsMessageStatus = (typeof OIANALYTICS_MESSAGE_STATUS)[number];

export const OIANALYTICS_MESSAGE_TYPES = ['INFO'] as const;
export type OIAnalyticsMessageType = (typeof OIANALYTICS_MESSAGE_TYPES)[number];

interface BaseOIAnalyticsMessageDTO<T> extends BaseEntity {
  type: OIAnalyticsMessageType;
  status: OIAnalyticsMessageStatus;
  error?: string;
  completedDate?: Instant;
  content: T;
}

interface OIAnalyticsMessageCommandDTO<T> extends Omit<BaseOIAnalyticsMessageDTO<T>, 'id' | 'creationDate' | 'lastEditInstant' | 'status'| 'error' | 'completedDate' > {}

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

export interface OIAnalyticsMessageInfoDTO extends BaseOIAnalyticsMessageDTO<InfoMessageContent> {
  type: 'INFO'
}

export interface OIAnalyticsMessageInfoCommandDTO extends OIAnalyticsMessageCommandDTO<InfoMessageContent> {
  type: 'INFO'
}

export type OIAnalyticsMessageCommand = OIAnalyticsMessageInfoCommandDTO
export type OIAnalyticsMessageDTO = OIAnalyticsMessageInfoDTO
