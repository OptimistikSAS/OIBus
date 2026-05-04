import { mock } from 'node:test';
import { ScanMode } from '../../../../model/scan-mode.model';

/**
 * Create a mock object for Scan Mode repository
 */
export default class ScanModeRepositoryMock {
  findAll = mock.fn((): Array<ScanMode> => []);
  findById = mock.fn((_id: string): ScanMode | null => null);
  create = mock.fn(
    (_command: Omit<ScanMode, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>, _createdBy: string): ScanMode =>
      ({}) as ScanMode
  );
  update = mock.fn(
    (_id: string, _command: Omit<ScanMode, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>, _updatedBy: string): void =>
      undefined
  );
  delete = mock.fn((_id: string): void => undefined);
}
