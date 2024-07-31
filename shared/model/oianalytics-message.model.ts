import { BaseEntity, Instant } from './types';

export const OIANALYTICS_MESSAGE_STATUS = ['PENDING', 'COMPLETED', 'ERRORED'] as const;
export type OIAnalyticsMessageStatus = (typeof OIANALYTICS_MESSAGE_STATUS)[number];

export const OIANALYTICS_MESSAGE_TYPES = ['info', 'full-config'] as const;
export type OIAnalyticsMessageType = (typeof OIANALYTICS_MESSAGE_TYPES)[number];

export interface OIAnalyticsMessageSearchParam {
  types: Array<OIAnalyticsMessageType>;
  status: Array<OIAnalyticsMessageStatus>;
  start?: Instant;
  end?: Instant;
}

// DTO used to display messages in OIBus
interface BaseOIAnalyticsMessage extends BaseEntity {
  type: OIAnalyticsMessageType;
  status: OIAnalyticsMessageStatus;
  error: string | null;
  completedDate: Instant | null;
}

export interface OIAnalyticsMessageInfo extends BaseOIAnalyticsMessage {
  type: 'info';
}

// No need to store the config, it will be sent at run time
export interface OIAnalyticsMessageFullConfig extends BaseOIAnalyticsMessage {
  type: 'full-config';
}

export type OIAnalyticsMessage = OIAnalyticsMessageInfo | OIAnalyticsMessageFullConfig;

// DTO used to update or create messages in OIBus and send messages to OIAnalytics
interface BaseOIAnalyticsMessageCommandDTO {
  type: OIAnalyticsMessageType;
}

export interface OIAnalyticsMessageInfoCommandDTO extends BaseOIAnalyticsMessageCommandDTO {
  type: 'info';
}

export interface OIAnalyticsMessageFullConfigCommandDTO extends BaseOIAnalyticsMessageCommandDTO {
  type: 'full-config';
}
export type OIAnalyticsMessageCommandDTO = OIAnalyticsMessageInfoCommandDTO | OIAnalyticsMessageFullConfigCommandDTO;
