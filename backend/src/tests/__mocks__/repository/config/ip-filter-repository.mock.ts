import { mock } from 'node:test';
import type { Database } from 'better-sqlite3';
import { IPFilter } from '../../../../model/ip-filter.model';
import IpFilterRepository from '../../../../repository/config/ip-filter.repository';

/**
 * Create a mock object for IP Filter repository
 */
export default class IpFilterRepositoryMock extends IpFilterRepository {
  constructor() {
    super({} as Database);
  }
  override list = mock.fn((): Array<IPFilter> => []);
  override findById = mock.fn((_id: string): IPFilter | null => null);
  override create = mock.fn(
    (_command: Omit<IPFilter, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>, _createdBy: string): IPFilter =>
      ({}) as IPFilter
  );
  override update = mock.fn(
    (_id: string, _command: Omit<IPFilter, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>, _updatedBy: string): void =>
      undefined
  );
  override delete = mock.fn((_id: string): void => undefined);
}
