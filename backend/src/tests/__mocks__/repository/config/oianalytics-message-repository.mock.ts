import { mock } from 'node:test';
import type { Database } from 'better-sqlite3';
import { OIAnalyticsMessage } from '../../../../model/oianalytics-message.model';
import { OIAnalyticsMessageSearchParam } from '../../../../../shared/model/oianalytics-message.model';
import { Instant, Page } from '../../../../../shared/model/types';
import OIAnalyticsMessageRepository from '../../../../repository/config/oianalytics-message.repository';

/**
 * Create a mock object for OIAnalytics Message repository
 */
export default class OianalyticsMessageRepositoryMock extends OIAnalyticsMessageRepository {
  constructor() {
    super({} as Database);
  }
  override search = mock.fn(
    (_searchParams: OIAnalyticsMessageSearchParam, _page: number): Page<OIAnalyticsMessage> => ({
      content: [],
      size: 50,
      number: 0,
      totalElements: 0,
      totalPages: 0
    })
  );
  override list = mock.fn((_searchParams: OIAnalyticsMessageSearchParam): Array<OIAnalyticsMessage> => []);
  override findById = mock.fn((_id: string): OIAnalyticsMessage | null => null);
  override create = mock.fn((_message: Pick<OIAnalyticsMessage, 'type'>): OIAnalyticsMessage => ({}) as OIAnalyticsMessage);
  override markAsCompleted = mock.fn((_id: string, _completedDate: Instant): void => undefined);
  override markAsErrored = mock.fn((_id: string, _completedDate: Instant, _result: string): void => undefined);
  override delete = mock.fn((_id: string): void => undefined);
}
