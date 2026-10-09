import { ConfigurationWorkflowCommandDTO, ConfigurationWorkflowDTO } from '@oibus/shared/api/configuration-workflow.model';
import { EngineSettingsDTO } from '@oibus/shared/api/engine.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { SouthItemGroupCommandDTO, SouthItemGroupDTO } from '@oibus/shared/api/south-connector.model';

import testData from './test-data';

/**
 * Builders for fixtures that tests need in several variants. Each one returns a new object, so tests can mutate it.
 * Static fixtures live in test-data.ts.
 */

export function buildSouthItemGroup(
  id: string,
  name: string,
  scanMode: ScanModeDTO = testData.scanMode.list[0],
  overrides: Partial<SouthItemGroupDTO> = {}
): SouthItemGroupDTO {
  return {
    id,
    createdAt: '',
    updatedAt: '',
    createdBy: { id: '', friendlyName: '' },
    updatedBy: { id: '', friendlyName: '' },
    standardSettings: { name, scanMode },
    historySettings: {
      startTimeOffset: 0,
      endTimeOffset: 0,
      maxReadInterval: 3600,
      readDelay: 200,
      recoveryStrategy: 'oldest',
      cachingStrategy: null
    },
    ...overrides
  };
}

export function buildSouthItemGroupCommand(
  id: string | null,
  name: string,
  scanModeId: string = testData.scanMode.list[0].id,
  overrides: Partial<SouthItemGroupCommandDTO> = {}
): SouthItemGroupCommandDTO {
  return {
    id,
    standardSettings: { name, scanModeId },
    historySettings: {
      startTimeOffset: 0,
      endTimeOffset: 0,
      maxReadInterval: 3600,
      readDelay: 200,
      recoveryStrategy: 'oldest',
      cachingStrategy: null
    },
    ...overrides
  };
}

export function buildWorkflow(id: string, name: string, overrides: Partial<ConfigurationWorkflowDTO> = {}): ConfigurationWorkflowDTO {
  return {
    id,
    name,
    southId: testData.south.list[0].id,
    discoveryScope: {},
    identityKeyFields: ['nodeId'],
    eligibilityFilter: [],
    itemFieldMapping: { name: '{{name}}' },
    pushToOIAnalytics: false,
    scanMode: null,
    enabled: true,
    createdAt: '',
    updatedAt: '',
    createdBy: { id: '', friendlyName: '' },
    updatedBy: { id: '', friendlyName: '' },
    ...overrides
  };
}

export function buildWorkflowCommand(
  id: string | null,
  name: string,
  overrides: Partial<ConfigurationWorkflowCommandDTO> = {}
): ConfigurationWorkflowCommandDTO {
  return {
    id,
    name,
    discoveryScope: {},
    identityKeyFields: ['nodeId'],
    eligibilityFilter: [],
    itemFieldMapping: { name: '{{name}}' },
    pushToOIAnalytics: false,
    scanModeId: null,
    enabled: true,
    ...overrides
  };
}

/**
 * Engine settings, as returned by the API. Returns a new object each time, so tests can mutate it.
 */
export function buildEngineSettings(overrides: Partial<EngineSettingsDTO> = {}): EngineSettingsDTO {
  return {
    id: 'engineId1',
    version: '3.7.0',
    launcherVersion: '3.7.0',
    auditRetentionDuration: 90,
    general: { name: 'OIBus Test' },
    webServer: { port: 2223, authTokenDuration: '7d' },
    proxyServer: {
      enabled: true,
      port: 8888,
      username: null,
      password: null,
      forward: { enabled: false, url: null, username: null, password: null }
    },
    logger: {
      console: { level: 'silent' },
      file: { level: 'trace', maxFileSize: 50, numberOfFiles: 5 },
      database: { level: 'silent', maxNumberOfLogs: 100_000 },
      loki: { level: 'error', interval: 60, address: 'http://loki:3100', username: 'loki-user', password: 'loki-password' },
      oia: { level: 'silent', interval: 10 },
      syslog: { level: 'silent', host: '', port: 514, protocol: 'udp4' }
    },
    createdBy: { id: '', friendlyName: '' },
    updatedBy: { id: '', friendlyName: '' },
    createdAt: '',
    updatedAt: '',
    ...overrides
  };
}
