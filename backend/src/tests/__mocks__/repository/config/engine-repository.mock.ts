import { mock } from 'node:test';

import type { Database } from 'better-sqlite3';

import {
  EngineLoggerCommand,
  EngineProxyCommand,
  EngineSettings,
  EngineSettingsCommand,
  EngineWebServerCommand
} from '../../../../model/engine.model';
import EngineRepository from '../../../../repository/config/engine.repository';
import { createAuditServiceMock } from '../../../utils/test-utils';

/**
 * Create a mock object for Engine repository
 */
export default class EngineRepositoryMock extends EngineRepository {
  constructor() {
    super({} as Database, createAuditServiceMock(), '');
  }
  protected override createDefault(): void {
    return;
  }
  override get = mock.fn((): EngineSettings | null => null);
  override update = mock.fn((_command: EngineSettingsCommand, _updatedBy: string): void => undefined);
  override updateName = mock.fn((_name: string, _updatedBy: string): void => undefined);
  override updateWebServer = mock.fn((_command: EngineWebServerCommand, _updatedBy: string): void => undefined);
  override updateProxy = mock.fn((_command: EngineProxyCommand, _updatedBy: string): void => undefined);
  override updateLogger = mock.fn((_command: EngineLoggerCommand, _updatedBy: string): void => undefined);
  override updateVersion = mock.fn((_version: string, _launcherVersion: string): void => undefined);
}
