import { mock } from 'node:test';
import { OIAnalyticsMessage } from '../../../../model/oianalytics-message.model';
import { OIAnalyticsMessageSearchParam } from '../../../../../shared/model/oianalytics-message.model';
import { Instant, Page } from '../../../../../shared/model/types';

/**
 * Create a mock object for OIAnalytics Message repository
 */
export default class OianalyticsMessageRepositoryMock {
  search = mock.fn(
    (_searchParams: OIAnalyticsMessageSearchParam, _page: number): Page<OIAnalyticsMessage> => ({
      content: [],
      size: 50,
      number: 0,
      totalElements: 0,
      totalPages: 0
    })
  );
  list = mock.fn((_searchParams: OIAnalyticsMessageSearchParam): Array<OIAnalyticsMessage> => []);
  findById = mock.fn((_id: string): OIAnalyticsMessage | null => null);
  create = mock.fn((_message: Pick<OIAnalyticsMessage, 'type'>): OIAnalyticsMessage => ({}) as OIAnalyticsMessage);
  markAsCompleted = mock.fn((_id: string, _completedDate: Instant): void => undefined);
  markAsErrored = mock.fn((_id: string, _completedDate: Instant, _result: string): void => undefined);
  delete = mock.fn((_id: string): void => undefined);
}
