import path from 'node:path';

import pino from 'pino';

import { LogSettings } from '../../../../shared/model/engine.model';

import FileCleanupService from './file-cleanup.service';
import { createFolder } from '../utils';
import EncryptionService from '../encryption.service';

const LOG_FOLDER_NAME = 'logs';
const LOG_FILE_NAME = 'journal.log';
const LOG_DB_NAME = 'journal.db';

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
  private encryptionService: EncryptionService;
  fileCleanUpService: FileCleanupService | null = null;

  constructor(encryptionService: EncryptionService) {
    this.encryptionService = encryptionService;
  }

  /**
   * Run the appropriate pino log transports according to the configuration
   */
  async start(oibusId: string, logParameters: LogSettings): Promise<void> {
    await createFolder(LOG_FOLDER_NAME);

    const targets = [];
    targets.push({ target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: logParameters.console.level });

    const filePath = path.resolve(LOG_FOLDER_NAME, LOG_FILE_NAME);

    targets.push({
      target: 'pino-roll',
      options: {
        file: filePath,
        size: logParameters.file.maxFileSize
      },
      level: logParameters.file.level
    });

    if (logParameters.database.maxNumberOfLogs > 0) {
      const sqlDatabaseName = path.resolve(LOG_FOLDER_NAME, LOG_DB_NAME);

      targets.push({
        target: path.join(__dirname, 'sqlite-transport.js'),
        options: {
          filename: sqlDatabaseName,
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
    });

    this.fileCleanUpService = new FileCleanupService(
      path.parse(filePath).dir,
      this.createChildLogger('logger-service'),
      path.parse(filePath).base,
      logParameters.file.numberOfFiles
    );
    await this.fileCleanUpService.start();
  }

  /**
   * Create a child logger from the main logger already set up, with the appropriate scope (South, North, Engine...)
   */
  createChildLogger(scope: string): pino.Logger {
    return this.logger!.child({ scope });
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
