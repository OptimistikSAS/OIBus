import { OIAnalyticsMessageStatus, OIAnalyticsMessageType } from '../../shared/model/oianalytics-message.model';
import { BaseEntity, Instant } from './types';

export interface IOIAnalyticsMessageService {
  createFullConfigMessageIfNotPending(): void;
  createFullHistoryQueriesMessageIfNotPending(): void;
}

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
export interface OIAnalyticsMessageHistoryQueries extends BaseOIAnalyticsMessage {
  type: 'history-queries';
}

// Unlike the two above, a workflow run's discovered records are a one-off snapshot that can't be
// recomputed later without re-running discovery, so this message type stores its own payload directly.
export interface OIAnalyticsMessageConfigurationWorkflowResult extends BaseOIAnalyticsMessage {
  type: 'configuration-workflow-result';
  workflowRunId: string;
  /** JSON-serialized OIBusConfigurationWorkflowResultCommandDTO, sent to OIAnalytics verbatim. */
  payload: string;
}

export type OIAnalyticsMessage =
  OIAnalyticsMessageFullConfig | OIAnalyticsMessageHistoryQueries | OIAnalyticsMessageConfigurationWorkflowResult;
