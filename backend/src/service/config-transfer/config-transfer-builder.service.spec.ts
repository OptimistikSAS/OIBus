import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { ConfigurationWorkflowEntity } from '../../model/configuration-workflow.model';
import type { SouthItemGroupEntity } from '../../model/south-connector.model';
import { StandardTransformer } from '../../model/transformer.model';
import type CertificateRepository from '../../repository/config/certificate.repository';
import type ConfigurationWorkflowRepository from '../../repository/config/configuration-workflow.repository';
import type EngineRepository from '../../repository/config/engine.repository';
import type HistoryQueryRepository from '../../repository/config/history-query.repository';
import type IpFilterRepository from '../../repository/config/ip-filter.repository';
import type NorthConnectorRepository from '../../repository/config/north-connector.repository';
import type ScanModeRepository from '../../repository/config/scan-mode.repository';
import type SouthConnectorRepository from '../../repository/config/south-connector.repository';
import type TransformerRepository from '../../repository/config/transformer.repository';
import type UserRepository from '../../repository/config/user.repository';
import testData from '../../tests/utils/test-data';
import { createMock, Mocked } from '../../tests/utils/test-utils';
import FileToFileTransformer from '../../transformers/file/file-to-file/file-to-file-transformer';
import EncryptionService from '../encryption.service';
import ConfigTransferBuilderService from './config-transfer-builder.service';

const standardTransformer: StandardTransformer = {
  id: FileToFileTransformer.transformerName,
  type: 'standard',
  functionName: FileToFileTransformer.transformerName,
  inputType: 'file',
  outputType: 'file'
};

describe('Config Transfer Builder Service', () => {
  let engineRepository: Mocked<EngineRepository>;
  let scanModeRepository: Mocked<ScanModeRepository>;
  let ipFilterRepository: Mocked<IpFilterRepository>;
  let certificateRepository: Mocked<CertificateRepository>;
  let userRepository: Mocked<UserRepository>;
  let southRepository: Mocked<SouthConnectorRepository>;
  let northRepository: Mocked<NorthConnectorRepository>;
  let historyQueryRepository: Mocked<HistoryQueryRepository>;
  let transformerRepository: Mocked<TransformerRepository>;
  let configurationWorkflowRepository: Mocked<ConfigurationWorkflowRepository>;
  let encryptionService: Mocked<EncryptionService>;
  let service: ConfigTransferBuilderService;

  beforeEach(() => {
    engineRepository = createMock<EngineRepository>();
    scanModeRepository = createMock<ScanModeRepository>();
    ipFilterRepository = createMock<IpFilterRepository>();
    certificateRepository = createMock<CertificateRepository>();
    userRepository = createMock<UserRepository>();
    southRepository = createMock<SouthConnectorRepository>();
    northRepository = createMock<NorthConnectorRepository>();
    historyQueryRepository = createMock<HistoryQueryRepository>();
    transformerRepository = createMock<TransformerRepository>();
    configurationWorkflowRepository = createMock<ConfigurationWorkflowRepository>({ findAll: () => [] });
    encryptionService = createMock<EncryptionService>({ filterSecrets: secrets => secrets });

    engineRepository.get.mock.mockImplementation(() => testData.engine.settings);
    scanModeRepository.findAll.mock.mockImplementation(() => testData.scanMode.list);
    ipFilterRepository.list.mock.mockImplementation(() => testData.ipFilters.list);
    certificateRepository.list.mock.mockImplementation(() => testData.certificates.list);
    userRepository.list.mock.mockImplementation(() => testData.users.list);
    southRepository.findAllSouth.mock.mockImplementation(() => testData.south.list);
    southRepository.findSouthById.mock.mockImplementation((id: string) => testData.south.list.find(element => element.id === id) ?? null);
    southRepository.findAllSouthFull.mock.mockImplementation(() => testData.south.list);
    northRepository.findAllNorth.mock.mockImplementation(() => testData.north.list);
    northRepository.findNorthById.mock.mockImplementation((id: string) => testData.north.list.find(element => element.id === id) ?? null);
    northRepository.findAllNorthFull.mock.mockImplementation(() => testData.north.list);
    historyQueryRepository.findAllHistoriesFull.mock.mockImplementation(() => testData.historyQueries.list);
    transformerRepository.list.mock.mockImplementation(() => [...testData.transformers.list, standardTransformer]);

    service = new ConfigTransferBuilderService(
      engineRepository,
      scanModeRepository,
      ipFilterRepository,
      certificateRepository,
      userRepository,
      southRepository,
      northRepository,
      historyQueryRepository,
      transformerRepository,
      configurationWorkflowRepository,
      encryptionService,
      false,
      false
    );
  });

  it('should attach each south connector its configuration workflows, and each item the workflow owning it', () => {
    const south = testData.south.list[0];
    const [ownedItem, otherItem] = south.items;
    southRepository.findAllSouthFull.mock.mockImplementation(() => [
      {
        ...south,
        items: [
          { ...ownedItem, createdByWorkflowId: 'workflow1', disabledReason: 'not found anymore' },
          { ...otherItem, createdByWorkflowId: null, disabledReason: null }
        ]
      }
    ]);
    const baseWorkflow: ConfigurationWorkflowEntity = {
      id: 'workflow1',
      name: 'local workflow',
      southId: south.id,
      discoveryScope: { rootNodeId: 'ns=1;s=Root' },
      identityKeyFields: ['nodeId'],
      eligibilityFilter: [{ field: 'type', operator: 'equals', value: 'Variable' }],
      itemFieldMapping: { name: '{{name}}' },
      pushToOIAnalytics: false,
      scanMode: testData.scanMode.list[0],
      enabled: true,
      createdBy: 'creator',
      updatedBy: 'updater',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    };
    configurationWorkflowRepository.findAll.mock.mockImplementation(() => [
      baseWorkflow,
      { ...baseWorkflow, id: 'workflow2', name: 'remote workflow', itemFieldMapping: null, pushToOIAnalytics: true, scanMode: null },
      { ...baseWorkflow, id: 'workflow3', southId: 'another south' }
    ]);

    const configuration = service.buildFullConfiguration(testData.oIAnalytics.registration.completed);

    assert.deepStrictEqual(configuration.southConnectors[0].settings.configurationWorkflows, [
      {
        id: 'workflow1',
        name: 'local workflow',
        discoveryScope: { rootNodeId: 'ns=1;s=Root' },
        identityKeyFields: ['nodeId'],
        eligibilityFilter: [{ field: 'type', operator: 'equals', value: 'Variable' }],
        itemFieldMapping: { name: '{{name}}' },
        pushToOIAnalytics: false,
        scanModeId: testData.scanMode.list[0].id,
        enabled: true
      },
      {
        id: 'workflow2',
        name: 'remote workflow',
        discoveryScope: { rootNodeId: 'ns=1;s=Root' },
        identityKeyFields: ['nodeId'],
        eligibilityFilter: [{ field: 'type', operator: 'equals', value: 'Variable' }],
        itemFieldMapping: null,
        pushToOIAnalytics: true,
        scanModeId: null,
        enabled: true
      }
    ]);
    // the exported items also carry the workflow owning them, which the item command does not declare
    const exportedItems = configuration.southConnectors[0].settings.items as unknown as Array<{
      id: string | null;
      createdByWorkflowId: string | null;
      disabledReason: string | null;
    }>;
    assert.deepStrictEqual(
      exportedItems.map(item => ({ id: item.id, createdByWorkflowId: item.createdByWorkflowId, disabledReason: item.disabledReason })),
      [
        { id: ownedItem.id, createdByWorkflowId: 'workflow1', disabledReason: 'not found anymore' },
        { id: otherItem.id, createdByWorkflowId: null, disabledReason: null }
      ]
    );
  });

  it('should build the engine command, stripping proxy and loki passwords', () => {
    const configuration = service.buildFullConfiguration(testData.oIAnalytics.registration.completed);
    assert.strictEqual(configuration.engine.oIBusInternalId, testData.engine.settings.id);
    assert.strictEqual(configuration.engine.settings.proxyServer.password, null);
    assert.strictEqual(configuration.engine.settings.proxyServer.forward?.password, null);
    assert.strictEqual(configuration.engine.settings.logger.loki.password, '');
  });

  it('should build the registration command without any secret-shaped field', () => {
    const configuration = service.buildFullConfiguration(testData.oIAnalytics.registration.completed);
    const settings = configuration.registration.settings as Record<string, unknown>;
    assert.strictEqual(settings['token'], undefined);
    assert.strictEqual(settings['proxyPassword'], undefined);
    assert.strictEqual(settings['privateKey'], undefined);
    assert.strictEqual(configuration.registration.publicKey, testData.oIAnalytics.registration.completed.publicCipherKey);
  });

  it('should build the scan modes command', () => {
    const configuration = service.buildFullConfiguration(testData.oIAnalytics.registration.completed);
    assert.deepStrictEqual(
      configuration.scanModes.map(scanMode => scanMode.settings),
      testData.scanMode.list.map(scanMode => ({
        name: scanMode.name,
        description: scanMode.description,
        type: scanMode.type,
        cron: scanMode.cron,
        interval: scanMode.interval,
        activationWindow: scanMode.activationWindow
      }))
    );
  });

  it('should build the scan modes command for an interval scan mode, including activationWindow', () => {
    // `testData.scanMode.list` (used by the test above) is exclusively cron-type scan modes
    // (interval/activationWindow both null), so it never exercises the interval-type shape — this
    // restores the dedicated coverage that existed before scan-mode command building was extracted
    // out of oianalytics-message.service.ts into this service.
    const intervalScanMode = {
      id: 'scanModeIdInterval',
      name: 'interval scan mode',
      description: 'my interval scanMode',
      type: 'interval' as const,
      cron: '',
      interval: { value: 30, unit: 's' as const },
      activationWindow: {
        dateRange: { start: '2026-08-01T00:00:00.000Z', end: '2026-08-31T00:00:00.000Z' },
        recurring: { timezone: 'Europe/Paris', daysOfWeek: [6, 0], timeOfDay: { start: '22:00', end: '02:00' } }
      },
      createdBy: 'admin',
      updatedBy: 'admin',
      createdAt: testData.constants.dates.DATE_1,
      updatedAt: testData.constants.dates.DATE_2
    };
    scanModeRepository.findAll.mock.mockImplementation(() => [intervalScanMode]);

    const configuration = service.buildFullConfiguration(testData.oIAnalytics.registration.completed);

    assert.strictEqual(configuration.scanModes.length, 1);
    assert.deepStrictEqual(configuration.scanModes[0].settings, {
      name: intervalScanMode.name,
      description: intervalScanMode.description,
      type: 'interval',
      cron: intervalScanMode.cron,
      interval: intervalScanMode.interval,
      activationWindow: intervalScanMode.activationWindow
    });
  });

  it('should build the ip filters command', () => {
    const configuration = service.buildFullConfiguration(testData.oIAnalytics.registration.completed);
    assert.deepStrictEqual(
      configuration.ipFilters.map(ipFilter => ipFilter.settings),
      testData.ipFilters.list.map(ipFilter => ({ description: ipFilter.description, address: ipFilter.address }))
    );
  });

  it('should build the certificates command without any private-key field', () => {
    const configuration = service.buildFullConfiguration(testData.oIAnalytics.registration.completed);
    for (const certificate of configuration.certificates) {
      const settings = certificate.settings as Record<string, unknown>;
      assert.strictEqual(settings['privateKey'], undefined);
    }
    assert.deepStrictEqual(
      configuration.certificates.map(certificate => certificate.settings),
      testData.certificates.list.map(certificate => ({
        name: certificate.name,
        description: certificate.description,
        publicKey: certificate.publicKey,
        certificate: certificate.certificate,
        certificateChain: certificate.certificateChain,
        expiry: certificate.expiry
      }))
    );
  });

  it('should build the users command without any password field', () => {
    const configuration = service.buildFullConfiguration(testData.oIAnalytics.registration.completed);
    for (const user of configuration.users) {
      assert.ok(!('password' in user.settings));
    }
    assert.deepStrictEqual(
      configuration.users.map(user => user.settings),
      testData.users.list.map(user => ({
        login: user.login,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        language: user.language,
        timezone: user.timezone
      }))
    );
  });

  it('should build the south connectors command and filter secrets from settings', () => {
    const configuration = service.buildFullConfiguration(testData.oIAnalytics.registration.completed);
    assert.strictEqual(configuration.southConnectors.length, testData.south.list.length);
    assert.strictEqual(encryptionService.filterSecrets.mock.calls.length > 0, true);
  });

  it('should build south connector groups, item scanMode/group ids and north transformer south group id', () => {
    const group: SouthItemGroupEntity = {
      id: 'groupId1',
      name: 'My Group',
      southId: testData.south.list[0].id,
      scanMode: testData.scanMode.list[0],
      startTimeOffset: 1,
      endTimeOffset: 2,
      maxReadInterval: 3,
      readDelay: 4,
      recoveryStrategy: 'oldest',
      cachingStrategy: 'onChange',
      items: [],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };
    const customSouth = {
      ...testData.south.list[0],
      items: [{ ...testData.south.list[0].items[0], scanMode: null, group }],
      groups: [group]
    };
    southRepository.findAllSouth.mock.mockImplementation(() => [customSouth]);
    southRepository.findSouthById.mock.mockImplementation(() => customSouth);
    southRepository.findAllSouthFull.mock.mockImplementation(() => [customSouth]);

    const [northTransformer] = testData.north.list[0].transformers;
    assert.ok(northTransformer.source.type === 'south');
    const customNorth = {
      ...testData.north.list[0],
      transformers: [{ ...northTransformer, source: { ...northTransformer.source, group: { ...group, id: 'northGroupId1' }, items: [] } }]
    };
    northRepository.findAllNorth.mock.mockImplementation(() => [customNorth]);
    northRepository.findNorthById.mock.mockImplementation(() => customNorth);
    northRepository.findAllNorthFull.mock.mockImplementation(() => [customNorth]);

    const configuration = service.buildFullConfiguration(testData.oIAnalytics.registration.completed);

    const southSettings = configuration.southConnectors[0].settings;
    assert.strictEqual(southSettings.items[0].scanModeId, null);
    assert.strictEqual(southSettings.items[0].groupId, 'groupId1');
    assert.deepStrictEqual(southSettings.groups[0], {
      id: 'groupId1',
      standardSettings: {
        name: 'My Group',
        scanModeId: testData.scanMode.list[0].id
      },
      historySettings: {
        startTimeOffset: 1,
        endTimeOffset: 2,
        maxReadInterval: 3,
        readDelay: 4,
        recoveryStrategy: 'oldest',
        cachingStrategy: 'onChange'
      }
    });

    const { source } = configuration.northConnectors[0].settings.transformers[0];
    assert.ok(source.type === 'south');
    assert.strictEqual(source.groupId, 'northGroupId1');
  });

  it('should build the north connectors command', () => {
    const configuration = service.buildFullConfiguration(testData.oIAnalytics.registration.completed);
    assert.strictEqual(configuration.northConnectors.length, testData.north.list.length);
  });

  it('should only export the items left out of a transformer when there are some', () => {
    const configuration = service.buildFullConfiguration(testData.oIAnalytics.registration.completed);

    const [withoutExclusion, , withExclusion] = configuration.northConnectors[0].settings.transformers.map(
      transformer => transformer.source
    );
    assert.ok(withoutExclusion.type === 'south' && withExclusion.type === 'south');
    assert.strictEqual(withoutExclusion.excludedItems, undefined);
    const excludedItem = testData.south.list[1].items[0];
    assert.deepStrictEqual(withExclusion.excludedItems, [{ id: excludedItem.id, name: excludedItem.name, enabled: excludedItem.enabled }]);
  });

  it('should build the transformers command for both standard and custom transformers', () => {
    const configuration = service.buildFullConfiguration(testData.oIAnalytics.registration.completed);
    assert.strictEqual(configuration.transformers.length, testData.transformers.list.length + 1);
    const standard = configuration.transformers.find(transformer => transformer.type === 'standard');
    assert.ok(standard);
  });

  it('should build the full configuration by assembling every section', () => {
    const configuration = service.buildFullConfiguration(testData.oIAnalytics.registration.completed);
    assert.deepStrictEqual(Object.keys(configuration).sort(), [
      'certificates',
      'engine',
      'ipFilters',
      'northConnectors',
      'registration',
      'scanModes',
      'southConnectors',
      'transformers',
      'users'
    ]);
  });

  it('should build the history queries configuration', () => {
    const configuration = service.buildHistoryQueriesConfiguration();
    assert.strictEqual(configuration.historyQueries.length, testData.historyQueries.list.length);
    for (const historyQuery of configuration.historyQueries) {
      assert.notStrictEqual(historyQuery.settings.name, undefined);
    }
  });
});
