import { mock } from 'node:test';
import type { Database } from 'better-sqlite3';
import { EngineSettings } from '../../../../model/engine.model';
import { EngineSettingsCommandDTO } from '../../../../../shared/model/engine.model';
import EngineRepository from '../../../../repository/config/engine.repository';

/**
 * Create a mock object for Engine repository
 */
export default class EngineRepositoryMock extends EngineRepository {
  constructor() {
    super({} as Database, '');
  }
  protected override createDefault(): void {}
  override get = mock.fn((): EngineSettings | null => null);
  override update = mock.fn((_command: EngineSettingsCommandDTO, _updatedBy: string): void => undefined);
  override updateVersion = mock.fn((_version: string, _launcherVersion: string): void => undefined);
}
