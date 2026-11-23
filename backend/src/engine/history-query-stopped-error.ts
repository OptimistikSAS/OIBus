/**
 * Thrown to a history query run when content cannot be cached because the history query is stopping (see
 * HistoryQuery.cacheContent). The run must end without saving its progress, so that the interval is queried again on
 * restart: a south catching errors of addContent to go on reading must rethrow this one.
 */
export default class HistoryQueryStoppedError extends Error {
  constructor() {
    super('History query stopping: content not cached');
    this.name = 'HistoryQueryStoppedError';
  }
}
