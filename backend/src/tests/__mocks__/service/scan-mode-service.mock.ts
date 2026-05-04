import { mock } from 'node:test';
import { ScanMode } from '../../../model/scan-mode.model';
import { ScanModeCommandDTO, ValidatedCronExpression } from '../../../../shared/model/scan-mode.model';

/**
 * Create a mock object for Scan Mode Service
 */
export default class ScanModeServiceMock {
  list = mock.fn((): Array<ScanMode> => []);
  findById = mock.fn((_scanModeId: string): ScanMode => ({}) as ScanMode);
  create = mock.fn(async (_command: ScanModeCommandDTO, _createdBy: string): Promise<ScanMode> => ({}) as ScanMode);
  update = mock.fn(async (_scanModeId: string, _command: ScanModeCommandDTO, _updatedBy: string): Promise<void> => undefined);
  delete = mock.fn(async (_scanModeId: string): Promise<void> => undefined);
  verifyCron = mock.fn(async (_command: { cron: string }): Promise<ValidatedCronExpression> => ({}) as ValidatedCronExpression);
}
