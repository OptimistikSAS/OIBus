import { mock } from 'node:test';
import { EngineSettings } from '../../../../model/engine.model';
import { EngineSettingsCommandDTO } from '../../../../../shared/model/engine.model';

/**
 * Create a mock object for Engine repository
 */
export default class EngineRepositoryMock {
  get = mock.fn((): EngineSettings | null => null);
  update = mock.fn((_command: EngineSettingsCommandDTO, _updatedBy: string): void => undefined);
  updateVersion = mock.fn((_version: string, _launcherVersion: string): void => undefined);
}
