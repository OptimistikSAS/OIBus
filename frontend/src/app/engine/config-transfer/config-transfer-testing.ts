import { CustomTransformerCommandDTO } from '@oibus/shared/api/transformer.model';
import { ConfigImportPreviewDTO, OIBusConfigurationDTO } from '@oibus/shared/oia/config-transfer.model';

import { buildSouthItemGroupCommand, buildWorkflowCommand } from '../../../test/builders';
import testData from '../../../test/test-data';

type TransformerEntry = OIBusConfigurationDTO['transformers'][number];

const audit = {
  oIBusCreatedBy: 'admin',
  oIBusUpdatedBy: 'admin',
  oIBusCreatedAt: '2026-01-01T00:00:00.000Z',
  oIBusUpdatedAt: '2026-01-01T00:00:00.000Z'
};

/** A standard transformer of an export, identified by its function name */
export function standardTransformerEntry(oIBusInternalId: string, functionName: string): TransformerEntry {
  // the settings of a standard transformer are not those of a custom one: build them apart, so that they are not
  // checked against the common properties only
  const settings = { functionName, inputType: 'any', outputType: 'any' };
  return { oIBusInternalId, type: 'standard', settings, manifest: testData.transformers.command.customManifest };
}

const customTransformerSettings: Omit<CustomTransformerCommandDTO, 'type'> = {
  ...testData.transformers.command,
  name: 'My transformer',
  description: '',
  inputType: 'time-values',
  outputType: 'any'
};

const southItems = Array.from({ length: 25 }, (_, index) => ({
  ...testData.south.itemCommand,
  id: `item${index + 1}`,
  enabled: index !== 1,
  name: `Item ${index + 1}`,
  settings: { ...testData.south.itemCommand.settings, regex: `item${index + 1}.csv` },
  scanModeId: 'scanMode1',
  scanModeName: 'every second',
  groupId: index === 0 ? 'group1' : null
}));

/**
 * The preview of a configuration import: one entity of each kind, a south connector with 25 items, and engine settings
 * whose passwords must never be displayed.
 */
export const configImportPreview: ConfigImportPreviewDTO = {
  fromVersion: '3.9.0',
  toVersion: '3.10.0',
  appliedUpgrades: [{ version: '3.10.0', description: 'an upgrade' }],
  config: {
    engine: {
      ...audit,
      oIBusInternalId: 'engine',
      name: 'OIBus',
      softwareVersion: '3.10.0',
      launcherVersion: '3.10.0',
      architecture: 'x64',
      operatingSystem: 'linux',
      dataFolder: 'data-folder',
      binaryFolder: 'binary-folder',
      ignoreIpFilters: false,
      ignoreRemoteUpdate: false,
      settings: {
        general: { name: 'OIBus' },
        auditRetentionDuration: 90,
        webServer: { port: 2224, authTokenDuration: '7d' },
        proxyServer: {
          enabled: true,
          port: 9000,
          username: 'proxy-user',
          password: 'should-never-be-displayed',
          forward: { enabled: true, url: 'http://forward:3128', username: 'forward-user', password: 'should-never-be-displayed' }
        },
        logger: {
          auditRetentionDuration: 90,
          console: { level: 'info' },
          file: { level: 'debug', maxFileSize: 50, numberOfFiles: 5 },
          database: { level: 'info', maxNumberOfLogs: 100_000 },
          loki: { level: 'silent', interval: 60, address: 'http://loki:3100', username: 'oibus', password: '' },
          oia: { level: 'silent', interval: 10 },
          syslog: { level: 'warn', host: 'syslog.example.com', port: 514, protocol: 'udp4' }
        }
      }
    },
    registration: {
      ...audit,
      oIBusInternalId: 'registration',
      publicKey: 'public key',
      settings: {
        commandRefreshInterval: 10,
        commandRetryInterval: 5,
        messageRetryInterval: 5,
        commandPermissions: testData.oIAnalytics.registration.completed.commandPermissions
      }
    },
    scanModes: [
      {
        ...audit,
        oIBusInternalId: 'scanMode1',
        settings: { name: 'every second', description: 'fast', type: 'cron', cron: '* * * * * *', interval: null, activationWindow: null }
      }
    ],
    ipFilters: [{ ...audit, oIBusInternalId: 'ipFilter1', settings: { address: '192.168.1.1', description: 'local' } }],
    certificates: [],
    users: [
      {
        ...audit,
        oIBusInternalId: 'user1',
        settings: { login: 'jdoe', firstName: 'John', lastName: 'Doe', email: 'jdoe@example.com', language: 'en', timezone: 'Europe/Paris' }
      }
    ],
    transformers: [
      // listed by every export but linked to by nothing: never counted nor reported as missing
      standardTransformerEntry('unlinked-standard', 'json-to-csv'),
      standardTransformerEntry('standard1', 'iso'),
      {
        oIBusInternalId: 'custom1',
        type: 'custom',
        settings: customTransformerSettings,
        manifest: testData.transformers.command.customManifest
      }
    ],
    southConnectors: [
      {
        ...audit,
        oIBusInternalId: 'south1',
        type: 'folder-scanner',
        settings: {
          ...testData.south.command,
          name: 'My folder scanner',
          description: 'line A',
          settings: { ...testData.south.command.settings, inputFolder: '/data/input' },
          items: southItems,
          groups: [buildSouthItemGroupCommand('group1', 'Group 1', 'scanMode1')],
          configurationWorkflows: [buildWorkflowCommand('workflow1', 'Discover nodes')]
        }
      }
    ],
    northConnectors: [
      {
        ...audit,
        oIBusInternalId: 'north1',
        type: 'file-writer',
        settings: {
          ...testData.north.command,
          name: 'My file writer',
          description: '',
          transformers: [
            { id: 't1', source: { type: 'south', southId: 'south1', items: [] }, transformerId: 'custom1', options: { precision: 2 } },
            { id: 't2', source: { type: 'oianalytics-setpoint' }, transformerId: 'standard1', options: {} }
          ]
        }
      }
    ],
    historyQueries: [
      {
        ...audit,
        oIBusInternalId: 'history1',
        settings: {
          ...testData.historyQueries.command,
          name: 'Backfill',
          description: '',
          queryTimeRange: { startTime: '2026-01-01T00:00:00.000Z', endTime: '2026-01-02T00:00:00.000Z', maxReadInterval: 0, readDelay: 0 },
          items: [{ ...testData.historyQueries.command.items[0], id: 'hItem1', name: 'History item', enabled: true }],
          northTransformers: [{ id: 'ht1', items: [], transformerId: 'standard1', options: {} }]
        }
      }
    ]
  }
};
