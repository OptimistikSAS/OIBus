import RepositoryService from './repository.service';
import LoggerService from './logger/logger.service';

import { EngineSettingsDTO } from '../../shared/model/engine.model';
import pino from 'pino';
import HealthSignalService from './health-signal-service';

export default class ReloadService {
  private readonly _repositoryService: RepositoryService;
  private readonly _loggerService: LoggerService;
  private readonly _healthSignalService: HealthSignalService;
  private webServerChangeLoggerCallback: (logger: pino.Logger) => void = () => {};
  private webServerChangePortCallback: (port: number) => Promise<void> = () => Promise.resolve();

  constructor(loggerService: LoggerService, repositoryService: RepositoryService, healthSignalService: HealthSignalService) {
    this._loggerService = loggerService;
    this._repositoryService = repositoryService;
    this._healthSignalService = healthSignalService;
  }

  get repositoryService(): RepositoryService {
    return this._repositoryService;
  }

  get loggerService(): LoggerService {
    return this._loggerService;
  }

  get healthSignalService(): HealthSignalService {
    return this._healthSignalService;
  }

  setWebServerChangeLogger(callback: (logger: pino.Logger) => void): void {
    this.webServerChangeLoggerCallback = callback;
  }

  setWebServerChangePort(callback: (port: number) => Promise<void>): void {
    this.webServerChangePortCallback = callback;
  }

  async onUpdateOibusSettings(oldSettngs: EngineSettingsDTO | null, newSettings: EngineSettingsDTO): Promise<void> {
    if (!oldSettngs || JSON.stringify(oldSettngs.logParameters) !== JSON.stringify(newSettings.logParameters)) {
      await this.loggerService.stop();
      await this.loggerService.start(newSettings.id, newSettings.logParameters);
      await this.webServerChangeLoggerCallback(this.loggerService.createChildLogger('web-server'));
      await this.healthSignalService.setLogger(this.loggerService.createChildLogger('health'));
    }
    if (!oldSettngs || oldSettngs.port !== newSettings.port) {
      await this.webServerChangePortCallback(newSettings.port);
    }
    if (!oldSettngs || JSON.stringify(oldSettngs.healthSignal) !== JSON.stringify(newSettings.healthSignal)) {
      await this.healthSignalService.setSettings(newSettings.healthSignal);
    }
  }
}
