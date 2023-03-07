import RepositoryService from './repository.service';
import LoggerService from './logger/logger.service';

import { EngineSettingsDTO } from '../../shared/model/engine.model';
import pino from 'pino';
import HealthSignalService from './health-signal-service';
import NorthService from './north.service';
import SouthService from './south.service';

export default class ReloadService {
  private readonly _repositoryService: RepositoryService;
  private readonly _loggerService: LoggerService;
  private readonly _healthSignalService: HealthSignalService;
  private readonly _northService: NorthService;
  private readonly _southService: SouthService;
  private webServerChangeLoggerCallback: (logger: pino.Logger) => void = () => {};
  private webServerChangePortCallback: (port: number) => Promise<void> = () => Promise.resolve();

  constructor(
    loggerService: LoggerService,
    repositoryService: RepositoryService,
    healthSignalService: HealthSignalService,
    northService: NorthService,
    southService: SouthService
  ) {
    this._loggerService = loggerService;
    this._repositoryService = repositoryService;
    this._healthSignalService = healthSignalService;
    this._northService = northService;
    this._southService = southService;
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

  get northService(): NorthService {
    return this._northService;
  }

  get southService(): SouthService {
    return this._southService;
  }

  setWebServerChangeLogger(callback: (logger: pino.Logger) => void): void {
    this.webServerChangeLoggerCallback = callback;
  }

  setWebServerChangePort(callback: (port: number) => Promise<void>): void {
    this.webServerChangePortCallback = callback;
  }

  async onUpdateOibusSettings(oldSettings: EngineSettingsDTO | null, newSettings: EngineSettingsDTO): Promise<void> {
    if (!oldSettings || JSON.stringify(oldSettings.logParameters) !== JSON.stringify(newSettings.logParameters)) {
      await this.loggerService.stop();
      await this.loggerService.start(newSettings.id, newSettings.logParameters);
      await this.webServerChangeLoggerCallback(this.loggerService.createChildLogger('web-server'));
      await this.healthSignalService.setLogger(this.loggerService.createChildLogger('health'));
    }
    if (!oldSettings || oldSettings.port !== newSettings.port) {
      await this.webServerChangePortCallback(newSettings.port);
    }
    if (!oldSettings || JSON.stringify(oldSettings.healthSignal) !== JSON.stringify(newSettings.healthSignal)) {
      await this.healthSignalService.setSettings(newSettings.healthSignal);
    }
  }
}
