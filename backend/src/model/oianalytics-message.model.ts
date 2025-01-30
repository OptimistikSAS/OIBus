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

// No need to store the history query, it will be sent at run time
export interface OIAnalyticsSaveHistoryQuery extends BaseOIAnalyticsMessage {
  type: 'save-history-query';
  historyId: string;
}

export interface OIAnalyticsDeleteHistoryQuery extends BaseOIAnalyticsMessage {
  type: 'delete-history-query';
  historyId: string;
}

export type OIAnalyticsMessage = OIAnalyticsMessageFullConfig | OIAnalyticsSaveHistoryQuery | OIAnalyticsDeleteHistoryQuery;
