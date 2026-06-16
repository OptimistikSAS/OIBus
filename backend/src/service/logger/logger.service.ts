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
 * Wraps a root pino logger and a fixed set of child bindings. The underlying pino
 * child is re-created on demand whenever the LoggerService restarts (i.e. rootLogger
 * reference changes). This means every ILogger handed out by LoggerService stays
 * valid across logger restarts without any manual setLogger() wiring.
 *
 * Log calls made while LoggerService is stopped (rootLogger === null) are silently
 * dropped — acceptable for the sub-second restart window.
 */
class LoggerProxy implements ILogger {
  private _rootRef: ILogger | null = null;
  private _pinoChild: ILogger | null = null;

  constructor(
    private readonly service: LoggerService,
    private readonly bindings: Record<string, unknown>
  ) {}

  private get current(): ILogger | null {
    const root = this.service.rootLogger;
    if (this._rootRef !== root) {
      this._rootRef = root;
      this._pinoChild = root ? root.child(this.bindings) : null;
    }
    return this._pinoChild;
  }

  trace(obj: unknown, msg?: string, ...args: Array<unknown>): void {
    this.current?.trace(obj, msg, ...args);
  }
  debug(obj: unknown, msg?: string, ...args: Array<unknown>): void {
    this.current?.debug(obj, msg, ...args);
  }
  info(obj: unknown, msg?: string, ...args: Array<unknown>): void {
    this.current?.info(obj, msg, ...args);
  }
  warn(obj: unknown, msg?: string, ...args: Array<unknown>): void {
    this.current?.warn(obj, msg, ...args);
  }
  error(obj: unknown, msg?: string, ...args: Array<unknown>): void {
    this.current?.error(obj, msg, ...args);
  }
  fatal(obj: unknown, msg?: string, ...args: Array<unknown>): void {
    this.current?.fatal(obj, msg, ...args);
  }
  isLevelEnabled(level: string): boolean {
    return this.current?.isLevelEnabled(level) ?? false;
  }

  child(bindings: Record<string, unknown>, _options?: Record<string, unknown>): ILogger {
    // options (custom serializers etc.) are intentionally not forwarded — no callers use them in this codebase.
    return new LoggerProxy(this.service, { ...this.bindings, ...bindings });
  }
}

/**
 * Singleton service that manages the pino logger lifecycle.
 *
 * Five transports are supported:
 *  - Console
 *  - File
 *  - SQLite
 *  - Loki
 *  - Syslog (RFC 5424 over UDP/TCP via pino-syslog + pino-socket)
 *
 * All ILogger instances returned by createChildLogger() are LoggerProxy objects
 * that automatically reconnect to the new pino root after a restart.
 */
class LoggerService {
  private static instance: LoggerService | null = null;

  private _folder = '';
  private _rawLogger: pino.Logger | null = null;
  private _transport: ReturnType<typeof pino.transport> | null = null;
  private _stopInFlight: Promise<void> | null = null;
  fileCleanUpService: FileCleanupService | null = null;

  // Stable proxy for the default 'internal' scope. Non-null from construction;
  // drops logs silently until start() is called.
  readonly logger: ILogger;

  constructor() {
    this.logger = new LoggerProxy(this, { scopeType: 'internal' });
  }

  static getInstance(): LoggerService {
    if (!this.instance) {
      this.instance = new LoggerService();
    }
    return this.instance;
  }

  /** Called once at application startup to set the log folder before start(). */
  init(folder: string): void {
    this._folder = folder;
  }

  /** The bare pino root instance. Read by LoggerProxy to (re-)create child loggers. */
  get rootLogger(): ILogger | null {
    return this._rawLogger;
  }

  /**
   * Run the appropriate pino log transports according to the configuration.
   * May be called multiple times (e.g. on settings change); callers must
   * await stop() before calling start() again to avoid duplicate transport workers.
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
        file: path.resolve(this._folder, LOG_FILE_NAME),
        size: engineSettings.logParameters.file.maxFileSize
      },
      level: engineSettings.logParameters.file.level
    });

    if (engineSettings.logParameters.database.maxNumberOfLogs > 0) {
      targets.push({
        target: path.join(__dirname, 'sqlite-transport.js'),
        options: {
          filename: path.resolve(this._folder, LOG_DB_NAME),
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

    // Separate transport reference so stop() can flush and end the workers cleanly.
    const transport = pino.transport({ targets });
    this._transport = transport;
    this._rawLogger = pino(
      {
        base: undefined,
        // Most-verbose level across enabled transports. Cheap calls above this
        // level are short-circuited inside pino. See computeParentLevel jsdoc.
        level: computeParentLevel(targets),
        timestamp: pino.stdTimeFunctions.isoTime
      },
      transport
    );

    this.redirectNodeOpcuaLogs();

    this.fileCleanUpService = new FileCleanupService(
      this._folder,
      this.logger,
      LOG_FILE_NAME,
      engineSettings.logParameters.file.numberOfFiles
    );
    await this.fileCleanUpService.start();
  }

  /**
   * Create a child logger from the main logger already set up, with the appropriate scope (South, North, Engine...)
   *
   * Returns a LoggerProxy that auto-updates when the logger is restarted.
   */
  createChildLogger(scopeType: ScopeType, scopeId?: string, scopeName?: string): ILogger {
    return new LoggerProxy(this, { scopeType, scopeId, scopeName });
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
    const opcuaLogger = this.logger.child({ scopeName: 'node-opcua' });
    // node-opcua passes printf-style arguments — util.format mirrors what console.* does.
    setDebugLogger((...args: Array<unknown>) => opcuaLogger.trace(util.format(...args)));
    setTraceLogger((...args: Array<unknown>) => opcuaLogger.trace(util.format(...args)));
    setWarningLogger((...args: Array<unknown>) => opcuaLogger.trace(util.format(...args)));
    setErrorLogger((...args: Array<unknown>) => opcuaLogger.trace(util.format(...args)));
    // Let pino do the level filtering. node-opcua's gate is set wide so we don't drop
    // events before pino sees them.
    setLogLevel(LogLevel.Debug);
  }

  /**
   * Flush pending log entries and end the transport worker threads, then release
   * all references so the old pino instance can be garbage-collected.
   *
   * Safe to call concurrently — a second call while a stop is in flight returns
   * the same promise rather than ending the transport twice.
   */
  stop(): Promise<void> {
    if (this._stopInFlight) return this._stopInFlight;
    this._stopInFlight = this._doStop().finally(() => {
      this._stopInFlight = null;
    });
    return this._stopInFlight;
  }

  private async _doStop(): Promise<void> {
    this.fileCleanUpService?.stop();
    this.fileCleanUpService = null;
    if (this._transport) {
      await new Promise<void>(resolve => {
        this._transport!.flush(_err => resolve());
      });
      this._transport.end();
    }
    this._rawLogger = null;
    this._transport = null;
  }
}

export const loggerService = LoggerService.getInstance();
export default LoggerService;
