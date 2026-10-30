import {
  EngineLoggerCommandDTO,
  EngineProxyCommandDTO,
  EngineSettingsCommandDTO,
  EngineWebServerCommandDTO
} from '../../shared/model/api/engine.model';

import { EngineLoggerCommand, EngineProxyCommand, EngineSettingsCommand, EngineWebServerCommand } from '../model/engine.model';

/*
 * Maps the engine settings API commands to what the engine repository persists. Secrets are never taken from the
 * API command: each caller resolves them (encrypt/hash a new one, keep the current one, clear it, ...) and passes
 * the value to store.
 */

const DISABLED_FORWARD: EngineProxyCommand['forward'] = { enabled: false, url: null, username: null, password: null };

export interface EngineSecrets {
  proxyPassword: string | null;
  forwardProxyPassword: string | null;
  lokiPassword: string | null;
}

/**
 * The HTTPS and content endpoint settings are optional in the API command (callers predating them, like OIAnalytics, don't
 * send them): the current ones are then kept.
 */
export const toEngineWebServerCommand = (command: EngineWebServerCommandDTO, current: EngineWebServerCommand): EngineWebServerCommand => ({
  port: command.port,
  authTokenDuration: command.authTokenDuration,
  https: command.https
    ? {
        enabled: command.https.enabled,
        certificateSource: command.https.certificateSource,
        certificateId: command.https.certificateId || null,
        certificatePath: command.https.certificatePath || null,
        privateKeyPath: command.https.privateKeyPath || null
      }
    : current.https,
  enableContentEndpoint: command.enableContentEndpoint ?? current.enableContentEndpoint
});

export const toEngineProxyCommand = (
  command: EngineProxyCommandDTO,
  secrets: Pick<EngineSecrets, 'proxyPassword' | 'forwardProxyPassword'>
): EngineProxyCommand => ({
  enabled: command.enabled,
  port: command.port ?? null,
  username: command.username ?? null,
  password: secrets.proxyPassword,
  forward: command.forward
    ? {
        enabled: command.forward.enabled,
        url: command.forward.url ?? null,
        username: command.forward.username ?? null,
        password: secrets.forwardProxyPassword
      }
    : DISABLED_FORWARD
});

export const toEngineLoggerCommand = (
  command: EngineLoggerCommandDTO,
  secrets: Pick<EngineSecrets, 'lokiPassword'>
): EngineLoggerCommand => ({
  auditRetentionDuration: command.auditRetentionDuration,
  console: { level: command.console.level },
  file: { level: command.file.level, maxFileSize: command.file.maxFileSize, numberOfFiles: command.file.numberOfFiles },
  database: { level: command.database.level, maxNumberOfLogs: command.database.maxNumberOfLogs },
  loki: {
    level: command.loki.level,
    interval: command.loki.interval,
    address: command.loki.address ?? null,
    username: command.loki.username ?? null,
    password: secrets.lokiPassword
  },
  oia: { level: command.oia.level, interval: command.oia.interval },
  syslog: { level: command.syslog.level, host: command.syslog.host ?? null, port: command.syslog.port, protocol: command.syslog.protocol }
});

export const toEngineSettingsCommand = (
  command: EngineSettingsCommandDTO,
  secrets: EngineSecrets,
  currentWebServer: EngineWebServerCommand
): EngineSettingsCommand => {
  const { auditRetentionDuration: _, ...logger } = toEngineLoggerCommand(command.logger, secrets);
  return {
    auditRetentionDuration: command.auditRetentionDuration,
    general: { name: command.general.name },
    webServer: toEngineWebServerCommand(command.webServer, currentWebServer),
    proxyServer: toEngineProxyCommand(command.proxyServer, secrets),
    logger
  };
};
