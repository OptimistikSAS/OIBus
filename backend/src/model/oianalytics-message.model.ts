import { OIAnalyticsMessageStatus, OIAnalyticsMessageType } from '../../shared/model/oianalytics-message.model';
import { BaseEntity, Instant } from './types';

interface BaseOIAnalyticsMessage extends BaseEntity {
  type: OIAnalyticsMessageType;
  status: OIAnalyticsMessageStatus;
  error: string | null;
  completedDate: Instant | null;
}

// No need to store the config, it will be sent at run time
export interface OIAnalyticsMessageFullConfig extends BaseOIAnalyticsMessage {
  type: 'full-config';
}

export type OIAnalyticsMessage = OIAnalyticsMessageFullConfig;
