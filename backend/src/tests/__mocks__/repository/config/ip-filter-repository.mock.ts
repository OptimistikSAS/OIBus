import { mock } from 'node:test';
import { IPFilter } from '../../../../model/ip-filter.model';

/**
 * Create a mock object for IP Filter repository
 */
export default class IpFilterRepositoryMock {
  list = mock.fn((): Array<IPFilter> => []);
  findById = mock.fn((_id: string): IPFilter | null => null);
  create = mock.fn(
    (_command: Omit<IPFilter, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>, _createdBy: string): IPFilter =>
      ({}) as IPFilter
  );
  update = mock.fn(
    (_id: string, _command: Omit<IPFilter, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>, _updatedBy: string): void =>
      undefined
  );
  delete = mock.fn((_id: string): void => undefined);
}
