import { Instant } from './types';

export const OIANALYTICS_MESSAGE_STATUS = ['PENDING', 'COMPLETED', 'ERRORED'] as const;
export type OIAnalyticsMessageStatus = (typeof OIANALYTICS_MESSAGE_STATUS)[number];

export const OIANALYTICS_MESSAGE_TYPES = ['full-config'] as const;
export type OIAnalyticsMessageType = (typeof OIANALYTICS_MESSAGE_TYPES)[number];

export interface OIAnalyticsMessageSearchParam {
  types: Array<OIAnalyticsMessageType>;
  status: Array<OIAnalyticsMessageStatus>;
  start?: Instant;
  end?: Instant;
}

// DTO used to update or create messages in OIBus and send messages to OIAnalytics
interface BaseOIAnalyticsMessageCommandDTO {
  type: OIAnalyticsMessageType;
}

export interface OIAnalyticsMessageFullConfigCommandDTO extends BaseOIAnalyticsMessageCommandDTO {
  type: 'full-config';
}
export type OIAnalyticsMessageCommandDTO = OIAnalyticsMessageFullConfigCommandDTO;
