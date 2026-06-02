import path from 'node:path';
import util from 'node:util';

import pino from 'pino';
import { setDebugLogger, setErrorLogger, setTraceLogger, setWarningLogger, LogLevel, setLogLevel } from 'node-opcua-debug';

import FileCleanupService from './file-cleanup.service';
import { encryptionService } from '../encryption.service';
import { EngineSettings } from '../../model/engine.model';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import { ScopeType } from '../../../shared/model/logs.model';
import type { ILogger } from '../../model/logger.model';

const LOG_DB_NAME = 'logs.db';
const LOG_FILE_NAME = 'journal.log';

/**
 * Compute the most-verbose (lowest-numeric) level across the enabled transports.
 *
 * Why this matters: pino's parent-level filter runs BEFORE dispatch to transports.
 * If the parent is at `'trace'`, every `logger.trace(...)` and
 * `logger.debug(...)` call goes through pino's internal formatting + transport
 * dispatch — even when no transport actually accepts those levels. By setting the
 * parent to the most-verbose level any transport requests, pino can short-circuit
 * calls above that level cheaply.
 *
 * Note: JavaScript still evaluates template-literal args at the call site before
 * pino sees them, so very hot call sites should ALSO use `logger.isLevelEnabled(...)`
 * guards. This change only eliminates pino's internal cost, not arg evaluation.
 */
// Mirrors pino.levels.values. Hardcoded so this helper stays pure (no runtime
// dependency on pino's internals) and trivially testable.
const PINO_LEVEL_VALUES: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
};

const computeParentLevel = (targets: ReadonlyArray<{ level: string }>): pino.LevelWithSilent => {
  let minValue = Number.POSITIVE_INFINITY;
  let minLevel: pino.LevelWithSilent = 'silent';
  for (const t of targets) {
    if (t.level === 'silent') continue;
    const v = PINO_LEVEL_VALUES[t.level];
    if (v !== undefined && v < minValue) {
      minValue = v;
      minLevel = t.level as pino.Level;
    }
  }
  return minLevel;
};

/**
 * Manage pino loggers
 * Five transports are supported:
 *  - Console
 *  - File
 *  - SQLite
 *  - Loki
 *  - Syslog (RFC 5424 over UDP/TCP via pino-syslog + pino-socket)
 * @class LoggerService
 */
class LoggerService {
  logger: ILogger | null = null;
  fileCleanUpService: FileCleanupService | null = null;

  constructor(private readonly folder: string) {}

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

    if (registration && registration.status === 'REGISTERED' && engineSettings.logParameters.oia.level !== 'silent') {
      targets.push({
        target: path.join(__dirname, './oianalytics-transport.js'),
        options: {
          interval: engineSettings.logParameters.oia.interval,
          registrationSettings: registration,
          cryptoSettings: encryptionService.cryptoSettings,
          certsFolder: encryptionService.certsFolder
        },
        level: engineSettings.logParameters.oia.level
      });
    }

    if (engineSettings.logParameters.syslog.host && engineSettings.logParameters.syslog.level !== 'silent') {
      targets.push({
        target: path.join(__dirname, 'syslog-transport.js'),
        options: {
          host: engineSettings.logParameters.syslog.host,
          port: engineSettings.logParameters.syslog.port,
          protocol: engineSettings.logParameters.syslog.protocol,
          appName: engineSettings.name
        },
        level: engineSettings.logParameters.syslog.level
      });
    }

    if (engineSettings.logParameters.loki.address && engineSettings.logParameters.loki.level !== 'silent') {
      try {
        const lokiPassword = engineSettings.logParameters.loki.password
          ? await encryptionService.decryptText(engineSettings.logParameters.loki.password)
          : '';
        targets.push({
          target: 'pino-loki',
          options: {
            batching: { interval: engineSettings.logParameters.loki.interval, maxBufferSize: 50000 },
            host: engineSettings.logParameters.loki.address,
            basicAuth: { username: engineSettings.logParameters.loki.username, password: lokiPassword },
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

    this.logger = pino({
      base: undefined,
      // Most-verbose level across enabled transports. Cheap calls above this
      // level are short-circuited inside pino. See computeParentLevel jsdoc.
      level: computeParentLevel(targets),
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: { targets }
    }).child({ scopeType: 'internal' });

    this.redirectNodeOpcuaLogs();

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
  createChildLogger(scopeType: ScopeType, scopeId?: string, scopeName?: string): ILogger {
    return this.logger!.child({ scopeType, scopeId, scopeName });
  }

  /**
   * Route node-opcua's internal logs (anything that goes through node-opcua-debug —
   * `make_debugLog`, `make_warningLog`, `make_errorLog`, `make_traceLog`) into our pino
   * logger. These hooks are global to the process; we reinstall them every time the
   * OIBus logger is (re)started so they always point at the current pino instance.
   */
  private redirectNodeOpcuaLogs(): void {
    // scopeType stays 'internal' (matches the existing ScopeType union) and the
    // 'node-opcua' marker lives in scopeName so downstream filters can pick it out.
    const opcuaLogger = this.logger!.child({ scopeName: 'node-opcua' });
    // node-opcua passes printf-style arguments — util.format mirrors what console.* does.
    setDebugLogger((...args: Array<unknown>) => opcuaLogger.debug(util.format(...args)));
    setTraceLogger((...args: Array<unknown>) => opcuaLogger.trace(util.format(...args)));
    setWarningLogger((...args: Array<unknown>) => opcuaLogger.warn(util.format(...args)));
    setErrorLogger((...args: Array<unknown>) => opcuaLogger.error(util.format(...args)));
    // Let pino do the level filtering. node-opcua's gate is set wide so we don't drop
    // events before pino sees them.
    setLogLevel(LogLevel.Debug);
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
