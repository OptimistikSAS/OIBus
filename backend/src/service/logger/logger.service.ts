import path from 'node:path';

import pino from 'pino';

import { ScopeType } from '../../../shared/model/engine.model';

import FileCleanupService from './file-cleanup.service';
import EncryptionService from '../encryption.service';
import { EngineSettings } from '../../model/engine.model';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';

const LOG_DB_NAME = 'logs.db';
const LOG_FILE_NAME = 'journal.log';

/**
 * Manage pino loggers
 * Four loggers are supported:
 *  - Console
 *  - File
 *  - SQLite
 *  - Loki
 * @class LoggerService
 */
class LoggerService {
  logger: pino.Logger | null = null;
  fileCleanUpService: FileCleanupService | null = null;

  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly folder: string
  ) {}

  /**
   * Run the appropriate pino log transports according to the configuration
   */
  async start(engineSettings: EngineSettings, registration: OIAnalyticsRegistration | null): Promise<void> {
    const targets = [];
    targets.push({
      target: 'pino-pretty',
      options: { colorize: true, singleLine: true },
      level: engineSettings.logParameters.console.level
    });

    targets.push({
      target: 'pino-roll',
      options: {
        file: path.resolve(this.folder, LOG_FILE_NAME),
        size: engineSettings.logParameters.file.maxFileSize
      },
      level: engineSettings.logParameters.file.level
    });

    if (engineSettings.logParameters.database.maxNumberOfLogs > 0) {
      targets.push({
        target: path.join(__dirname, 'sqlite-transport.js'),
        options: {
          filename: path.resolve(this.folder, LOG_DB_NAME),
          maxNumberOfLogs: engineSettings.logParameters.database.maxNumberOfLogs
        },
        level: engineSettings.logParameters.database.level
      });
    }

    if (engineSettings.logParameters.loki.address && engineSettings.logParameters.loki.level !== 'silent') {
      try {
        targets.push({
          target: 'pino-loki',
          options: {
            batching: true,
            interval: engineSettings.logParameters.loki.interval,
            host: engineSettings.logParameters.loki.address,
            basicAuth: {
              username: engineSettings.logParameters.loki.username,
              password: engineSettings.logParameters.loki.password
                ? await this.encryptionService.decryptText(engineSettings.logParameters.loki.password)
                : ''
            },
            labels: { name: engineSettings.name }
          },
          level: engineSettings.logParameters.loki.level
        });
      } catch (error) {
        // In case of bad decryption, an error is triggered, so instead of leaving the process, the error will just be
        // logged in the console and loki won't be activated
        console.error(error);
      }
    }

    if (registration && registration.status === 'REGISTERED' && engineSettings.logParameters.oia.level !== 'silent') {
      try {
        targets.push({
          target: path.join(__dirname, './oianalytics-transport.js'),
          options: {
            interval: engineSettings.logParameters.oia.interval,
            host: registration.host,
            token: registration.token ? await this.encryptionService.decryptText(registration.token) : '',
            useProxy: registration.useProxy,
            proxyUrl: registration.proxyUrl,
            proxyUsername: registration.proxyUsername,
            proxyPassword: registration.proxyPassword ? await this.encryptionService.decryptText(registration.proxyPassword) : '',
            acceptUnauthorized: registration.acceptUnauthorized
          },
          level: engineSettings.logParameters.oia.level
        });
      } catch (error) {
        // In case of bad decryption, an error is triggered, so instead of leaving the process, the error will just be
        // logged in the console and loki won't be activated
        console.error(error);
      }
    }

    this.logger = pino({
      base: undefined,
      level: 'trace', // default to trace since each transport has its defined level
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: { targets }
    }).child({ scopeType: 'internal' });

    this.fileCleanUpService = new FileCleanupService(
      this.folder,
      this.logger,
      LOG_FILE_NAME,
      engineSettings.logParameters.file.numberOfFiles
    );
    await this.fileCleanUpService.start();
  }

  /**
   * Create a child logger from the main logger already set up, with the appropriate scope (South, North, Engine...)
   */
  createChildLogger(scopeType: ScopeType, scopeId?: string, scopeName?: string): pino.Logger {
    return this.logger!.child({ scopeType, scopeId, scopeName });
  }

  /**
   * Stop the logger and associated services
   */
  stop(): void {
    if (this.fileCleanUpService) {
      this.fileCleanUpService.stop();
    }
  }
}

export default LoggerService;
