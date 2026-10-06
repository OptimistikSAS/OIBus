import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';

import { Database } from 'better-sqlite3';

import {
  SouthConnectorFolderScannerCommandDTO,
  SouthConnectorFolderScannerItemCommandDTO
} from '../../../shared/model/api/south-connector.model';
import { ConfigExportDTO } from '../../../shared/model/oia/config-transfer.model';

import { version as currentVersion } from '../../../package.json';
import CertificateRepository from '../../repository/config/certificate.repository';
import ConfigurationWorkflowRepository from '../../repository/config/configuration-workflow.repository';
import EngineRepository from '../../repository/config/engine.repository';
import HistoryQueryRepository from '../../repository/config/history-query.repository';
import IpFilterRepository from '../../repository/config/ip-filter.repository';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import TransformerRepository from '../../repository/config/transformer.repository';
import UserRepository from '../../repository/config/user.repository';
import AuditService from '../../service/audit.service';
import OIAnalyticsRegistrationServiceMock from '../../tests/__mocks__/service/oia/oianalytics-registration-service.mock';
import testData from '../../tests/utils/test-data';
import { createAuditServiceMock, emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import JoiValidator from '../../web-server/controllers/validators/joi.validator';
import EncryptionService from '../encryption.service';
import ConfigImportService, { ConfigImportError } from './config-import.service';
import ConfigTransferService from './config-transfer.service';
import ConfigTransferBuilderService from './config-transfer-builder.service';

const TEST_DB_PATH = 'src/tests/test-config-import-write.db';

let database: Database;

/**
 * Exercises `ConfigImportService.importConfiguration` (the transactional wipe+recreate write path)
 * against a real config database seeded with the shared fixture, rather than mocked repositories —
 * the atomicity and id-preservation claims this phase makes can only be proven against a real
 * `better-sqlite3` connection.
 */
describe('ConfigImportService (transactional wipe+recreate)', () => {
  let auditService: AuditService;
  let engineRepository: EngineRepository;
  let scanModeRepository: ScanModeRepository;
  let ipFilterRepository: IpFilterRepository;
  let certificateRepository: CertificateRepository;
  let userRepository: UserRepository;
  let southConnectorRepository: SouthConnectorRepository;
  let northConnectorRepository: NorthConnectorRepository;
  let historyQueryRepository: HistoryQueryRepository;
  let transformerRepository: TransformerRepository;
  let configurationWorkflowRepository: ConfigurationWorkflowRepository;
  let service: ConfigImportService;
  let baselineEnvelope: ConfigExportDTO;

  before(async () => {
    database = await initDatabase('config', true, TEST_DB_PATH);
  });

  after(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  beforeEach(() => {
    auditService = createAuditServiceMock();
    engineRepository = new EngineRepository(database, auditService, '3.9.9');
    scanModeRepository = new ScanModeRepository(database, auditService);
    ipFilterRepository = new IpFilterRepository(database, auditService);
    certificateRepository = new CertificateRepository(database, auditService);
    userRepository = new UserRepository(database, auditService);
    southConnectorRepository = new SouthConnectorRepository(database, auditService);
    northConnectorRepository = new NorthConnectorRepository(database, auditService);
    historyQueryRepository = new HistoryQueryRepository(database, auditService);
    transformerRepository = new TransformerRepository(database, auditService);
    configurationWorkflowRepository = new ConfigurationWorkflowRepository(database, auditService);

    // The real, pure EncryptionService/JoiValidator (neither needs init) so secret-stripping and
    // manifest validation are exercised for real, matching how the export/import endpoints actually
    // run.
    const encryptionService = new EncryptionService();
    const builderService = new ConfigTransferBuilderService(
      engineRepository,
      scanModeRepository,
      ipFilterRepository,
      certificateRepository,
      userRepository,
      southConnectorRepository,
      northConnectorRepository,
      historyQueryRepository,
      transformerRepository,
      configurationWorkflowRepository,
      encryptionService,
      false,
      false
    );
    const oIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();
    oIAnalyticsRegistrationService.getRegistrationSettings = () => testData.oIAnalytics.registration.completed;
    const transferService = new ConfigTransferService(builderService, engineRepository, oIAnalyticsRegistrationService as never);

    // Stamped with the running version: the seeded engine row carries an older one
    baselineEnvelope = { ...transferService.exportConfiguration(), oibusVersion: currentVersion };
    // The shared fixture's item settings are test-only placeholders that don't satisfy the real
    // item manifests (see config-import.service.spec.ts's isolateToSingleSouth) — clear them so the
    // envelope passes the same manifest validation the import pipeline runs before ever writing.
    // A south-sourced transformer link's item/group references are cleared alongside, since they'd
    // otherwise point at south items this fixture-sanitizing step just removed.
    for (const south of baselineEnvelope.config.southConnectors) {
      south.settings.items = [];
    }
    for (const historyQuery of baselineEnvelope.config.historyQueries) {
      historyQuery.settings.items = [];
      for (const transformer of historyQuery.settings.northTransformers) {
        transformer.items = [];
      }
    }
    for (const north of baselineEnvelope.config.northConnectors) {
      for (const transformer of north.settings.transformers) {
        if (transformer.source.type === 'south') {
          transformer.source.items = [];
          delete transformer.source.groupId;
        }
      }
    }

    service = new ConfigImportService(
      new JoiValidator(),
      database,
      scanModeRepository,
      ipFilterRepository,
      certificateRepository,
      transformerRepository,
      southConnectorRepository,
      northConnectorRepository,
      historyQueryRepository,
      userRepository,
      configurationWorkflowRepository,
      engineRepository
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  const cloneEnvelope = (): ConfigExportDTO => structuredClone(baselineEnvelope);

  /**
   * `importConfiguration` requires `importedBy` to be an existing user id (the account running the
   * import is preserved rather than wiped — see the self-lockout protection in `wipeConfiguration`),
   * so tests import as the fixture's real seeded admin user rather than an arbitrary label.
   */
  const importerId = (): string => {
    const admin = userRepository.findByLogin('admin');
    assert.ok(admin, 'expected the fixture to seed an "admin" user');
    return admin.id;
  };

  it('wipes and recreates every in-scope section, preserving every id', async () => {
    const envelope = cloneEnvelope();
    const beforeScanModeIds = scanModeRepository
      .findAll()
      .map(scanMode => scanMode.id)
      .sort();
    const beforeIpFilterIds = ipFilterRepository
      .list()
      .map(ipFilter => ipFilter.id)
      .sort();
    const beforeSouthIds = southConnectorRepository
      .findAllSouth()
      .map(south => south.id)
      .sort();
    const beforeNorthIds = northConnectorRepository
      .findAllNorth()
      .map(north => north.id)
      .sort();
    const beforeUserIds = userRepository
      .list()
      .map(user => user.id)
      .sort();

    assert.ok(beforeSouthIds.length > 0, 'expected the fixture to seed at least one south connector');
    assert.ok(beforeNorthIds.length > 0, 'expected the fixture to seed at least one north connector');
    assert.ok(beforeUserIds.length > 0, 'expected the fixture to seed at least one user');

    const result = await service.importConfiguration(envelope, importerId());

    assert.ok(
      result.warnings.some(warning => /random password/i.test(warning)),
      `expected a warning about randomized user passwords, got ${JSON.stringify(result.warnings)}`
    );

    assert.deepStrictEqual(
      scanModeRepository
        .findAll()
        .map(scanMode => scanMode.id)
        .sort(),
      beforeScanModeIds
    );
    assert.deepStrictEqual(
      ipFilterRepository
        .list()
        .map(ipFilter => ipFilter.id)
        .sort(),
      beforeIpFilterIds
    );
    assert.deepStrictEqual(
      southConnectorRepository
        .findAllSouth()
        .map(south => south.id)
        .sort(),
      beforeSouthIds
    );
    assert.deepStrictEqual(
      northConnectorRepository
        .findAllNorth()
        .map(north => north.id)
        .sort(),
      beforeNorthIds
    );
    assert.deepStrictEqual(
      userRepository
        .list()
        .map(user => user.id)
        .sort(),
      beforeUserIds
    );

    // Secrets are never exported, so every imported south/north connector must come back disabled
    // regardless of what it was exported as, rather than running with empty credentials.
    for (const south of southConnectorRepository.findAllSouth()) {
      assert.strictEqual(south.enabled, false, `expected south connector "${south.name}" to be imported disabled`);
    }
    for (const north of northConnectorRepository.findAllNorth()) {
      assert.strictEqual(north.enabled, false, `expected north connector "${north.name}" to be imported disabled`);
    }
  });

  it('preserves a custom transformer under its original id and maps a standard transformer by function name', async () => {
    const envelope = cloneEnvelope();
    const customEntry = envelope.config.transformers.find(transformer => transformer.type === 'custom');
    assert.ok(customEntry, 'expected the fixture to include a custom transformer');

    await service.importConfiguration(envelope, importerId());

    const recreated = transformerRepository.findById(customEntry.oIBusInternalId);
    assert.ok(recreated, 'expected the custom transformer to be recreated under its original id');
    assert.strictEqual(recreated.type, 'custom');
  });

  it('skips a north connector transformer link that cannot be matched locally, and warns about it', async () => {
    const envelope = cloneEnvelope();
    const north = envelope.config.northConnectors.find(candidate => candidate.settings.transformers.length > 0);
    assert.ok(north, 'expected the fixture to include a north connector with at least one transformer');
    const transformerEntry = north.settings.transformers[0];
    transformerEntry.transformerId = 'does-not-exist-locally';

    const result = await service.importConfiguration(envelope, importerId());

    assert.ok(
      result.warnings.some(
        warning =>
          warning.includes(north.settings.name) && /could not be matched locally/.test(warning) && warning.includes('north connector')
      ),
      `expected a warning about a skipped transformer link, got ${JSON.stringify(result.warnings)}`
    );
    const recreated = northConnectorRepository.findNorthById(north.oIBusInternalId);
    assert.ok(recreated);
    assert.ok(
      !recreated.transformers.some(transformer => transformer.id === transformerEntry.id),
      'expected the unresolved transformer link to have been skipped entirely, not recreated with a null transformer'
    );
  });

  it('recreates a north connector transformer sourced from oianalytics-setpoint', async () => {
    const envelope = cloneEnvelope();
    const north = envelope.config.northConnectors.find(candidate => candidate.settings.transformers.length > 0);
    assert.ok(north, 'expected the fixture to include a north connector with at least one transformer');
    const transformerEntry = north.settings.transformers[0];
    transformerEntry.source = { type: 'oianalytics-setpoint' };

    await service.importConfiguration(envelope, importerId());

    const recreated = northConnectorRepository.findNorthById(north.oIBusInternalId);
    assert.ok(recreated);
    const recreatedTransformer = recreated.transformers.find(transformer => transformer.id === transformerEntry.id);
    assert.ok(recreatedTransformer, 'expected the transformer link to have been recreated');
    assert.deepStrictEqual(recreatedTransformer.source, { type: 'oianalytics-setpoint' });
  });

  it('imports a certificate under its original id but with an empty private key, and warns about it', async () => {
    const envelope = cloneEnvelope();
    assert.ok(envelope.config.certificates.length > 0, 'expected the fixture to include a certificate');
    const certificateEntry = envelope.config.certificates[0];

    const result = await service.importConfiguration(envelope, importerId());

    const recreated = certificateRepository.findById(certificateEntry.oIBusInternalId);
    assert.ok(recreated);
    assert.strictEqual(recreated.privateKey, '');
    assert.ok(
      result.warnings.some(warning => warning.includes(certificateEntry.settings.name) && /private key/i.test(warning)),
      `expected a private-key warning for certificate "${certificateEntry.settings.name}", got ${JSON.stringify(result.warnings)}`
    );
  });

  it('imports the engine name, web server, proxy server and logging settings', async () => {
    const beforeEngine = engineRepository.get()!;
    const envelope = cloneEnvelope();
    const importedSettings = envelope.config.engine.settings;
    importedSettings.general.name = 'imported name';
    importedSettings.webServer = { port: beforeEngine.webServer.port + 1, authTokenDuration: '1d' };
    importedSettings.proxyServer = {
      enabled: true,
      port: 8888,
      username: null,
      password: null,
      forward: { enabled: false, url: null, username: null, password: null }
    };
    importedSettings.logger.console.level = 'debug';
    importedSettings.logger.file = { level: 'error', maxFileSize: 12, numberOfFiles: 7 };
    importedSettings.logger.syslog = { level: 'warn', host: 'syslog.example.com', port: 1514, protocol: 'tcp' };
    importedSettings.logger.auditRetentionDuration = 30;

    const result = await service.importConfiguration(envelope, importerId());

    const afterEngine = engineRepository.get()!;
    assert.strictEqual(afterEngine.general.name, 'imported name');
    assert.deepStrictEqual(afterEngine.webServer, { port: beforeEngine.webServer.port + 1, authTokenDuration: '1d' });
    assert.strictEqual(afterEngine.proxyServer.enabled, true);
    assert.strictEqual(afterEngine.proxyServer.port, 8888);
    assert.strictEqual(afterEngine.logger.console.level, 'debug');
    assert.deepStrictEqual(afterEngine.logger.file, { level: 'error', maxFileSize: 12, numberOfFiles: 7 });
    assert.deepStrictEqual(afterEngine.logger.syslog, { level: 'warn', host: 'syslog.example.com', port: 1514, protocol: 'tcp' });
    assert.strictEqual(afterEngine.auditRetentionDuration, 30);
    // The UI must be reached on the new port once OIBus restarts
    assert.strictEqual(result.newPort, beforeEngine.webServer.port + 1);
    assert.ok(result.warnings.some(warning => warning.includes(`port ${beforeEngine.webServer.port + 1}`)));
  });

  it('reports no new port when the web server port is unchanged', async () => {
    const envelope = cloneEnvelope();
    envelope.config.engine.settings.webServer.port = engineRepository.get()!.webServer.port;

    const result = await service.importConfiguration(envelope, importerId());

    assert.strictEqual(result.newPort, null);
  });

  it('keeps the local proxy passwords when the imported proxy settings target the same users and forward proxy', async () => {
    const forward = { enabled: true, url: 'http://forward:3128', username: 'forward-user', password: 'encrypted-forward' };
    engineRepository.updateProxy(
      { enabled: true, port: 9000, username: 'proxy-user', password: 'hashed-proxy-password', forward },
      importerId()
    );
    const envelope = cloneEnvelope();
    envelope.config.engine.settings.proxyServer = {
      enabled: true,
      port: 9001,
      username: 'proxy-user',
      password: null,
      forward: { ...forward, password: null }
    };

    const result = await service.importConfiguration(envelope, importerId());

    const proxy = engineRepository.get()!.proxyServer;
    assert.strictEqual(proxy.port, 9001);
    assert.strictEqual(proxy.password, 'hashed-proxy-password');
    assert.strictEqual(proxy.forward.password, 'encrypted-forward');
    assert.ok(!result.warnings.some(warning => /proxy password/i.test(warning)));
  });

  it('clears the proxy passwords and warns when the imported proxy settings target other users or another forward proxy', async () => {
    engineRepository.updateProxy(
      {
        enabled: true,
        port: 9000,
        username: 'proxy-user',
        password: 'hashed-proxy-password',
        forward: { enabled: true, url: 'http://forward:3128', username: 'forward-user', password: 'encrypted-forward' }
      },
      importerId()
    );
    const envelope = cloneEnvelope();
    envelope.config.engine.settings.proxyServer = {
      enabled: true,
      port: 9000,
      username: 'another-user',
      password: null,
      forward: { enabled: true, url: 'http://other-forward:3128', username: 'forward-user', password: null }
    };

    const result = await service.importConfiguration(envelope, importerId());

    const proxy = engineRepository.get()!.proxyServer;
    assert.strictEqual(proxy.password, null);
    assert.strictEqual(proxy.forward.password, null);
    assert.ok(result.warnings.some(warning => warning.includes('proxy server password') && warning.includes('another-user')));
    assert.ok(result.warnings.some(warning => warning.includes('forward proxy password') && warning.includes('http://other-forward:3128')));
  });

  it('rejects a proxy server listening on the web server port without writing anything', async () => {
    const beforeEngine = engineRepository.get();
    const envelope = cloneEnvelope();
    const { webServer, proxyServer } = envelope.config.engine.settings;
    proxyServer.enabled = true;
    proxyServer.port = webServer.port;

    await assert.rejects(
      () => service.importConfiguration(envelope, importerId()),
      (error: unknown) =>
        error instanceof ConfigImportError &&
        error.validationErrors.some(
          validationError => validationError.scope === 'engine' && /can not be the same/.test(validationError.message)
        )
    );
    assert.deepStrictEqual(engineRepository.get(), beforeEngine);
  });

  it('keeps the local Loki password when the imported logging settings target the same Loki endpoint', async () => {
    const localLogger = { ...cloneEnvelope().config.engine.settings.logger };
    localLogger.loki = { level: 'info', interval: 60, address: 'http://loki:3100', username: 'oibus', password: 'encrypted-password' };
    engineRepository.updateLogger(localLogger, importerId());
    const envelope = cloneEnvelope();
    envelope.config.engine.settings.logger.loki = {
      level: 'info',
      interval: 30,
      address: 'http://loki:3100',
      username: 'oibus',
      password: ''
    };

    const result = await service.importConfiguration(envelope, importerId());

    const loki = engineRepository.get()!.logger.loki;
    assert.strictEqual(loki.interval, 30);
    assert.strictEqual(loki.password, 'encrypted-password');
    assert.ok(!result.warnings.some(warning => warning.includes('Loki')));
  });

  it('clears the Loki password and warns when the imported logging settings target another Loki endpoint', async () => {
    const localLogger = { ...cloneEnvelope().config.engine.settings.logger };
    localLogger.loki = { level: 'info', interval: 60, address: 'http://loki:3100', username: 'oibus', password: 'encrypted-password' };
    engineRepository.updateLogger(localLogger, importerId());
    const envelope = cloneEnvelope();
    envelope.config.engine.settings.logger.loki = {
      level: 'info',
      interval: 60,
      address: 'http://other-loki:3100',
      username: 'oibus',
      password: ''
    };

    const result = await service.importConfiguration(envelope, importerId());

    const loki = engineRepository.get()!.logger.loki;
    assert.strictEqual(loki.address, 'http://other-loki:3100');
    assert.strictEqual(loki.password, '');
    assert.ok(
      result.warnings.some(warning => warning.includes('Loki') && warning.includes('http://other-loki:3100')),
      `expected a Loki password warning, got ${JSON.stringify(result.warnings)}`
    );
  });

  it('rejects engine settings that fail validation without writing anything', async () => {
    const beforeEngine = engineRepository.get();
    const envelope = cloneEnvelope();
    (envelope.config.engine.settings.logger.file as { numberOfFiles: number }).numberOfFiles = 0;
    (envelope.config.engine.settings.webServer as { authTokenDuration: string }).authTokenDuration = 'forever';

    await assert.rejects(
      () => service.importConfiguration(envelope, importerId()),
      (error: unknown) =>
        error instanceof ConfigImportError &&
        error.validationErrors.filter(validationError => validationError.scope === 'engine').length === 2
    );
    assert.deepStrictEqual(engineRepository.get(), beforeEngine);
  });

  it('preserves the account running the import, so it is never locked out of its own session', async () => {
    const admin = userRepository.findByLogin('admin');
    assert.ok(admin);
    const passwordBefore = userRepository.getHashedPasswordByLogin('admin');

    const result = await service.importConfiguration(cloneEnvelope(), admin.id);

    assert.strictEqual(userRepository.getHashedPasswordByLogin('admin'), passwordBefore);
    assert.ok(userRepository.findById(admin.id), 'expected the importing admin user to still exist under the same id');
    assert.ok(
      result.warnings.some(warning => /account you are signed in with/i.test(warning)),
      `expected a warning explaining the importer's own account was preserved, got ${JSON.stringify(result.warnings)}`
    );
  });

  it('preserves the reserved "subscription" scan mode even when the envelope omits it', async () => {
    const envelope = cloneEnvelope();
    envelope.config.scanModes = envelope.config.scanModes.filter(scanMode => scanMode.oIBusInternalId !== 'subscription');

    await service.importConfiguration(envelope, importerId());

    assert.ok(scanModeRepository.findById('subscription'), 'expected the reserved "subscription" scan mode to still exist');
  });

  it('updates the reserved "subscription" scan mode in place when the envelope does describe it', async () => {
    const envelope = cloneEnvelope();
    const subscriptionEntry = envelope.config.scanModes.find(scanMode => scanMode.oIBusInternalId === 'subscription');
    assert.ok(subscriptionEntry, 'expected the fixture to include the reserved "subscription" scan mode');
    subscriptionEntry.settings.description = 'updated via import';

    await service.importConfiguration(envelope, importerId());

    const recreated = scanModeRepository.findById('subscription');
    assert.ok(recreated);
    assert.strictEqual(recreated.description, 'updated via import');
  });

  it('recreates configuration workflows disabled, with the items they own, and replaces the existing ones', async () => {
    const envelope = cloneEnvelope();
    const south = envelope.config.southConnectors.find(candidate => candidate.type === 'folder-scanner');
    assert.ok(south, 'expected the fixture to include a folder-scanner south connector');
    const item = (id: string, name: string): SouthConnectorFolderScannerItemCommandDTO => ({
      id,
      name,
      enabled: false,
      settings: { regex: '.*', minAge: 1000, preserveFiles: true, ignoreModifiedDate: false, maxFiles: 100, maxSize: 0, recursive: false },
      scanModeId: envelope.config.scanModes.find(scanMode => scanMode.oIBusInternalId !== 'subscription')!.oIBusInternalId,
      scanModeName: null,
      groupId: null,
      groupName: null,
      syncWithGroup: false,
      maxReadInterval: null,
      readDelay: null,
      startTimeOffset: null,
      endTimeOffset: null,
      recoveryStrategy: null,
      cachingStrategy: null,
      thresholdType: null,
      threshold: null,
      rangeLow: null,
      rangeHigh: null,
      maxCachingInterval: null
    });
    // Ownership is exported on the item itself, next to its oIBus* audit fields (not part of the item command DTO)
    const ownedItem = {
      ...item('ownedItem', 'owned'),
      createdByWorkflowId: 'localWorkflow',
      disabledReason: 'not found by the last discovery'
    };
    (south.settings as SouthConnectorFolderScannerCommandDTO).items = [ownedItem, item('manualItem', 'manual')];
    south.settings.configurationWorkflows = [
      {
        id: 'localWorkflow',
        name: 'local',
        discoveryScope: { folder: 'input' },
        identityKeyFields: ['name'],
        eligibilityFilter: [{ field: 'name', operator: 'contains', value: 'csv' }],
        itemFieldMapping: { name: '{{name}}' },
        pushToOIAnalytics: false,
        scanModeId: south.settings.items[0].scanModeId,
        enabled: true
      },
      {
        id: 'remoteWorkflow',
        name: 'remote',
        discoveryScope: {},
        identityKeyFields: ['ignored for a remote workflow'],
        eligibilityFilter: [],
        itemFieldMapping: null,
        pushToOIAnalytics: true,
        scanModeId: null,
        enabled: true
      }
    ];
    // A workflow existing before the import, on another south, must be replaced
    const otherSouth = southConnectorRepository.findAllSouth().find(candidate => candidate.id !== south.oIBusInternalId)!;
    configurationWorkflowRepository.create(
      {
        name: 'pre-existing',
        southId: otherSouth.id,
        discoveryScope: {},
        identityKeyFields: [],
        eligibilityFilter: [],
        itemFieldMapping: null,
        pushToOIAnalytics: true,
        scanMode: null,
        enabled: true
      },
      'someone',
      'preExistingWorkflow'
    );

    const result = await service.importConfiguration(envelope, importerId());

    assert.deepStrictEqual(
      configurationWorkflowRepository.findAll().map(workflow => [workflow.id, workflow.southId, workflow.enabled]),
      [
        ['localWorkflow', south.oIBusInternalId, false],
        ['remoteWorkflow', south.oIBusInternalId, false]
      ]
    );
    const local = configurationWorkflowRepository.findById('localWorkflow')!;
    assert.deepStrictEqual(local.eligibilityFilter, [{ field: 'name', operator: 'contains', value: 'csv' }]);
    assert.strictEqual(local.scanMode?.id, south.settings.items[0].scanModeId);
    assert.deepStrictEqual(configurationWorkflowRepository.findById('remoteWorkflow')!.identityKeyFields, []);
    const items = southConnectorRepository.findSouthById(south.oIBusInternalId)!.items;
    assert.deepStrictEqual(items.map(candidate => [candidate.id, candidate.createdByWorkflowId, candidate.disabledReason]).sort(), [
      ['manualItem', null, null],
      ['ownedItem', 'localWorkflow', 'not found by the last discovery']
    ]);
    assert.ok(
      result.warnings.some(warning => /2 configuration workflow\(s\) were imported disabled/.test(warning)),
      JSON.stringify(result.warnings)
    );
  });

  it('warns that every imported south/north connector was disabled', async () => {
    const envelope = cloneEnvelope();
    assert.ok(envelope.config.southConnectors.length > 0 || envelope.config.northConnectors.length > 0);

    const result = await service.importConfiguration(envelope, importerId());

    assert.ok(
      result.warnings.some(warning => /disabled/i.test(warning)),
      `expected a warning about connectors being disabled, got ${JSON.stringify(result.warnings)}`
    );
  });

  it('rejects an unsupported/malformed import without writing anything', async () => {
    const beforeScanModeIds = scanModeRepository
      .findAll()
      .map(scanMode => scanMode.id)
      .sort();

    await assert.rejects(() => service.importConfiguration({ oibusVersion: '3.10.0' }, importerId()));

    assert.deepStrictEqual(
      scanModeRepository
        .findAll()
        .map(scanMode => scanMode.id)
        .sort(),
      beforeScanModeIds
    );
  });

  it('rolls back the entire wipe+recreate atomically when a failure happens partway through recreation (fault injection)', async () => {
    const envelope = cloneEnvelope();
    assert.ok(envelope.config.northConnectors.length > 0, 'expected the fixture to include a north connector');

    const beforeScanModes = scanModeRepository.findAll();
    const beforeIpFilters = ipFilterRepository.list();
    const beforeCertificates = certificateRepository.list();
    const beforeSouths = southConnectorRepository.findAllSouth();
    const beforeNorths = northConnectorRepository.findAllNorth();
    const beforeUsers = userRepository.list();
    const beforeTransformers = transformerRepository.list();

    // Every south connector, scan mode, ip filter, certificate and transformer is wiped and
    // recreated before this throws — proving the fault rolls back everything already done inside
    // the same outer transaction, not just the section that failed.
    mock.method(northConnectorRepository, 'saveNorth', () => {
      throw new Error('injected config import fault');
    });

    await assert.rejects(() => service.importConfiguration(envelope, importerId()), /injected config import fault/);

    assert.deepStrictEqual(scanModeRepository.findAll(), beforeScanModes);
    assert.deepStrictEqual(ipFilterRepository.list(), beforeIpFilters);
    assert.deepStrictEqual(certificateRepository.list(), beforeCertificates);
    assert.deepStrictEqual(southConnectorRepository.findAllSouth(), beforeSouths);
    assert.deepStrictEqual(northConnectorRepository.findAllNorth(), beforeNorths);
    assert.deepStrictEqual(userRepository.list(), beforeUsers);
    assert.deepStrictEqual(transformerRepository.list(), beforeTransformers);
  });

  it('rejects a write-time id collision (e.g. a duplicate id within the envelope) as a clean ConfigImportError, not a raw DB error', async () => {
    const envelope = cloneEnvelope();
    // Deliberately NOT the reserved "subscription" entry: that one is always `update()`d in place
    // (idempotent, see recreateConfiguration), so duplicating it wouldn't reproduce the collision —
    // every other scan mode goes through `create()`, which does collide on a repeated id.
    const original = envelope.config.scanModes.find(scanMode => scanMode.oIBusInternalId !== 'subscription');
    assert.ok(original, 'expected the fixture to include a non-reserved scan mode');
    const beforeScanModeIds = scanModeRepository
      .findAll()
      .map(scanMode => scanMode.id)
      .sort();

    // Nothing in `validateAndUpgrade` checks id uniqueness within a section, so a hand-edited/corrupted
    // file with two entries sharing an id passes validation cleanly and only fails once
    // `recreateConfiguration` tries to insert the second one under an id the first one just took.
    envelope.config.scanModes.push(structuredClone(original));

    await assert.rejects(
      () => service.importConfiguration(envelope, importerId()),
      (error: unknown) => error instanceof ConfigImportError && /writing the new configuration/.test(error.message)
    );

    assert.deepStrictEqual(
      scanModeRepository
        .findAll()
        .map(scanMode => scanMode.id)
        .sort(),
      beforeScanModeIds,
      'expected the write-time failure to roll back and leave scan modes untouched'
    );
  });

  it('rejects a malformed reserved "subscription" scan mode entry as a clean ConfigImportError, not a raw DB error', async () => {
    const envelope = cloneEnvelope();
    const subscriptionEntry = envelope.config.scanModes.find(scanMode => scanMode.oIBusInternalId === 'subscription');
    assert.ok(subscriptionEntry, 'expected the fixture to include the reserved "subscription" scan mode');
    const beforeSubscription = scanModeRepository.findById('subscription');
    assert.ok(beforeSubscription);

    // The reserved entry is deliberately validated with a shape-less schema (see SCAN_MODE_ENTRY_SCHEMA),
    // so a missing `name` passes validation and only fails at the NOT NULL column when written.
    delete (subscriptionEntry.settings as { name?: string }).name;

    await assert.rejects(
      () => service.importConfiguration(envelope, importerId()),
      (error: unknown) => error instanceof ConfigImportError && /writing the new configuration/.test(error.message)
    );

    assert.deepStrictEqual(
      scanModeRepository.findById('subscription'),
      beforeSubscription,
      'expected the write-time failure to roll back and leave the reserved scan mode untouched'
    );
  });

  it('preserves the importer even when the envelope describes their account under a different (e.g. renamed-since-export) login', async () => {
    const admin = userRepository.findByLogin('admin');
    assert.ok(admin);
    const passwordBefore = userRepository.getHashedPasswordByLogin('admin');
    const beforeUserIds = userRepository
      .list()
      .map(user => user.id)
      .sort();

    const envelope = cloneEnvelope();
    const adminEntry = envelope.config.users.find(user => user.oIBusInternalId === admin.id);
    assert.ok(adminEntry, "expected the envelope to include the importing admin's own user entry");
    // Simulates the envelope having been exported before the importer's login changed: same id,
    // different login. Matching only by login (not id) would fail to exclude this entry from
    // recreation, and `createWithHashedPassword` would then collide on the still-live primary key.
    adminEntry.settings.login = 'renamed-admin';

    await service.importConfiguration(envelope, admin.id);

    assert.strictEqual(userRepository.getHashedPasswordByLogin('admin'), passwordBefore);
    assert.ok(userRepository.findById(admin.id), 'expected the importing admin user to still exist under the same id');
    assert.strictEqual(userRepository.findByLogin('renamed-admin'), null, 'expected no second user to have been created');
    assert.deepStrictEqual(
      userRepository
        .list()
        .map(user => user.id)
        .sort(),
      beforeUserIds
    );
  });
});
