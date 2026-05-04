import { mock } from 'node:test';
import { SouthItemGroupCommand, SouthItemGroupEntity } from '../../../../model/south-connector.model';

/**
 * Create a mock object for South Item Group Repository
 */
export default class SouthItemGroupRepositoryMock {
  findById = mock.fn((_id: string): SouthItemGroupEntity | null => null);
  findBySouthId = mock.fn((_southId: string): Array<SouthItemGroupEntity> => []);
  findByNameAndSouthId = mock.fn((_name: string, _southId: string): SouthItemGroupEntity | null => null);
  create = mock.fn((_command: SouthItemGroupCommand, _createdBy: string): SouthItemGroupEntity => ({}) as SouthItemGroupEntity);
  update = mock.fn((_id: string, _command: Omit<SouthItemGroupCommand, 'southId'>, _updatedBy: string): void => undefined);
  delete = mock.fn((_id: string): void => undefined);
}
