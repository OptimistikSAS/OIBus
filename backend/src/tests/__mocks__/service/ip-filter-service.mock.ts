import { EventEmitter } from 'node:events';
import { mock } from 'node:test';
import { IPFilter } from '../../../model/ip-filter.model';
import { IPFilterCommandDTO } from '../../../../shared/model/ip-filter.model';

/**
 * Create a mock object for IP Filter Service
 */
export default class IpFilterServiceMock {
  list = mock.fn((): Array<IPFilter> => []);
  findById = mock.fn((_ipFilterId: string): IPFilter => ({}) as IPFilter);
  create = mock.fn(async (_command: IPFilterCommandDTO, _createdBy: string): Promise<IPFilter> => ({}) as IPFilter);
  update = mock.fn(async (_ipFilterId: string, _command: IPFilterCommandDTO, _updatedBy: string): Promise<void> => undefined);
  delete = mock.fn(async (_ipFilterId: string): Promise<void> => undefined);
  whiteListEvent = new EventEmitter();
}
