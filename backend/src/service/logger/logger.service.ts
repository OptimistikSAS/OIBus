import path from 'node:path';

import pino from 'pino';

import { LogSettings, ScopeType } from '../../../../shared/model/engine.model';

import FileCleanupService from './file-cleanup.service';
import EncryptionService from '../encryption.service';

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
  async start(oibusId: string, oibusName: string, logParameters: LogSettings): Promise<void> {
    const targets = [];
    targets.push({ target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: logParameters.console.level });

    targets.push({
      target: 'pino-roll',
      options: {
        file: path.resolve(this.folder, LOG_FILE_NAME),
        size: logParameters.file.maxFileSize
      },
      level: logParameters.file.level
    });

    if (logParameters.database.maxNumberOfLogs > 0) {
      targets.push({
        target: path.join(__dirname, 'sqlite-transport.js'),
        options: {
          filename: path.resolve(this.folder, LOG_DB_NAME),
          maxNumberOfLogs: logParameters.database.maxNumberOfLogs
        },
        level: logParameters.database.level
      });
    }

    if (logParameters.loki.address) {
      try {
        targets.push({
          target: path.join(__dirname, './loki-transport.js'),
          options: {
            username: logParameters.loki.username,
            password: logParameters.loki.password ? await this.encryptionService.decryptText(logParameters.loki.password) : '',
            address: logParameters.loki.address,
            tokenAddress: logParameters.loki.tokenAddress,
            id: oibusId,
            name: oibusName,
            interval: logParameters.loki.interval
          },
          level: logParameters.loki.level
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
    }).child({ scopeType: 'logger-service' });

    this.fileCleanUpService = new FileCleanupService(this.folder, this.logger, LOG_FILE_NAME, logParameters.file.numberOfFiles);
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
