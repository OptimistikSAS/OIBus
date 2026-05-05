import { mock } from 'node:test';
import type { Database } from 'better-sqlite3';
import { ScanMode } from '../../../../model/scan-mode.model';
import ScanModeRepository from '../../../../repository/config/scan-mode.repository';

/**
 * Create a mock object for Scan Mode repository
 */
export default class ScanModeRepositoryMock extends ScanModeRepository {
  constructor() {
    super({} as Database);
  }
  protected override createDefault(): void {
    return;
  }
  override findAll = mock.fn((): Array<ScanMode> => []);
  override findById = mock.fn((_id: string): ScanMode | null => null);
  override create = mock.fn(
    (_command: Omit<ScanMode, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>, _createdBy: string): ScanMode =>
      ({}) as ScanMode
  );
  override update = mock.fn(
    (_id: string, _command: Omit<ScanMode, 'id' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'>, _updatedBy: string): void =>
      undefined
  );
  override delete = mock.fn((_id: string): void => undefined);
}
