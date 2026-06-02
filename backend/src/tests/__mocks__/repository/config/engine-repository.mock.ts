import { mock } from 'node:test';
import type { Database } from 'better-sqlite3';
import { EngineSettings } from '../../../../model/engine.model';
import {
  EngineLoggerCommandDTO,
  EngineProxyCommandDTO,
  EngineSettingsCommandDTO,
  EngineWebServerCommandDTO
} from '../../../../../shared/model/engine.model';
import EngineRepository from '../../../../repository/config/engine.repository';

/**
 * Create a mock object for Engine repository
 */
export default class EngineRepositoryMock extends EngineRepository {
  constructor() {
    super({} as Database, '');
  }
  protected override createDefault(): void {
    return;
  }
  override get = mock.fn((): EngineSettings | null => null);
  override update = mock.fn((_command: EngineSettingsCommandDTO, _updatedBy: string): void => undefined);
  override updateName = mock.fn((_name: string, _updatedBy: string): void => undefined);
  override updateWebServer = mock.fn((_command: EngineWebServerCommandDTO, _updatedBy: string): void => undefined);
  override updateProxy = mock.fn((_command: EngineProxyCommandDTO, _updatedBy: string): void => undefined);
  override updateLogger = mock.fn((_command: EngineLoggerCommandDTO, _updatedBy: string): void => undefined);
  override updateVersion = mock.fn((_version: string, _launcherVersion: string): void => undefined);
}
