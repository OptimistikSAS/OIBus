import { HistoryQueryStatus } from '@oibus/shared/domain/history-query.model';

/** The icon of each status of a history query, its shape and color telling them apart (as in the list of the history queries) */
export const HISTORY_QUERY_STATUS_ICONS: Record<HistoryQueryStatus, string> = {
  PENDING: 'fa-solid fa-hourglass-half status-grey',
  RUNNING: 'fa-solid fa-spinner fa-spin status-green',
  PAUSED: 'fa-solid fa-pause-circle status-yellow',
  FINISHED: 'fa-solid fa-check-circle status-blue',
  ERRORED: 'fa-solid fa-times-circle status-red'
};

/** What can be done to a history query from its status: start, pause, resume or restart it */
export interface HistoryQueryStatusAction {
  /** The status the history query goes to */
  status: HistoryQueryStatus;
  id: string;
  icon: string;
  /** The translation keys of the label of the action, and of its longer description */
  label: string;
  tooltip: string;
}

export function historyQueryStatusAction(status: HistoryQueryStatus): HistoryQueryStatusAction {
  switch (status) {
    case 'PENDING':
      return {
        status: 'RUNNING',
        id: 'history-query-start',
        icon: 'fa-solid fa-play',
        label: 'common.start',
        tooltip: 'history-query.tooltips.start'
      };
    case 'RUNNING':
      return {
        status: 'PAUSED',
        id: 'history-query-pause',
        icon: 'fa-solid fa-pause',
        label: 'common.pause',
        tooltip: 'history-query.tooltips.pause'
      };
    case 'PAUSED':
      return {
        status: 'RUNNING',
        id: 'history-query-unpause',
        icon: 'fa-solid fa-play',
        label: 'common.resume',
        tooltip: 'history-query.tooltips.resume'
      };
    case 'FINISHED':
    case 'ERRORED':
      return {
        status: 'RUNNING',
        id: 'history-query-restart',
        icon: 'fa-solid fa-arrow-rotate-right',
        label: 'common.restart',
        tooltip: 'history-query.tooltips.restart'
      };
  }
}
