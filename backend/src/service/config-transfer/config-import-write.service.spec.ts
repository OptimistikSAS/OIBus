import { before, after, beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'better-sqlite3';
import { createAuditServiceMock, emptyDatabase, initDatabase } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import ConfigImportService from './config-import.service';
import ConfigTransferService from './config-transfer.service';
import ConfigTransferBuilderService from './config-transfer-builder.service';
import JoiValidator from '../../web-server/controllers/validators/joi.validator';
import EncryptionService from '../encryption.service';
import EngineRepository from '../../repository/config/engine.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import IpFilterRepository from '../../repository/config/ip-filter.repository';
import CertificateRepository from '../../repository/config/certificate.repository';
import UserRepository from '../../repository/config/user.repository';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import HistoryQueryRepository from '../../repository/config/history-query.repository';
import TransformerRepository from '../../repository/config/transformer.repository';
import OIAnalyticsRegistrationServiceMock from '../../tests/__mocks__/service/oia/oianalytics-registration-service.mock';
import AuditService from '../../service/audit.service';
import { ConfigExportEnvelopeDTO } from '../../../shared/model/config-transfer.model';

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
  let service: ConfigImportService;
  let baselineEnvelope: ConfigExportEnvelopeDTO;

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
      encryptionService,
      false,
      false
    );
    const oIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();
    oIAnalyticsRegistrationService.getRegistrationSettings = () => testData.oIAnalytics.registration.completed;
    const transferService = new ConfigTransferService(builderService, engineRepository, oIAnalyticsRegistrationService as never);

    baselineEnvelope = transferService.exportConfiguration();
    // The shared fixture's item settings are test-only placeholders that don't satisfy the real
    // item manifests (see config-import.service.spec.ts's isolateToSingleSouth) — clear them so the
    // envelope passes the same manifest validation the import pipeline runs before ever writing.
    // A south-sourced transformer link's item/group references are cleared alongside, since they'd
    // otherwise point at south items this fixture-sanitizing step just removed.
    for (const south of baselineEnvelope.fullConfiguration.southConnectors) {
      south.settings.items = [];
    }
    for (const historyQuery of baselineEnvelope.historyQueries.historyQueries) {
      historyQuery.settings.items = [];
      for (const transformer of historyQuery.settings.northTransformers) {
        transformer.items = [];
      }
    }
    for (const north of baselineEnvelope.fullConfiguration.northConnectors) {
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
      userRepository
    );
  });

  afterEach(() => {
    mock.restoreAll();
  });

  const cloneEnvelope = (): ConfigExportEnvelopeDTO => structuredClone(baselineEnvelope);

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

    const result = await service.importConfiguration(envelope, 'importUser');

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
    const customEntry = envelope.fullConfiguration.transformers.find(transformer => transformer.type === 'custom');
    assert.ok(customEntry, 'expected the fixture to include a custom transformer');

    await service.importConfiguration(envelope, 'importUser');

    const recreated = transformerRepository.findById(customEntry.oIBusInternalId);
    assert.ok(recreated, 'expected the custom transformer to be recreated under its original id');
    assert.strictEqual(recreated.type, 'custom');
  });

  it('imports a certificate under its original id but with an empty private key, and warns about it', async () => {
    const envelope = cloneEnvelope();
    assert.ok(envelope.fullConfiguration.certificates.length > 0, 'expected the fixture to include a certificate');
    const certificateEntry = envelope.fullConfiguration.certificates[0];

    const result = await service.importConfiguration(envelope, 'importUser');

    const recreated = certificateRepository.findById(certificateEntry.oIBusInternalId);
    assert.ok(recreated);
    assert.strictEqual(recreated.privateKey, '');
    assert.ok(
      result.warnings.some(warning => warning.includes(certificateEntry.settings.name) && /private key/i.test(warning)),
      `expected a private-key warning for certificate "${certificateEntry.settings.name}", got ${JSON.stringify(result.warnings)}`
    );
  });

  it('does not touch the engine settings or the OIAnalytics registration', async () => {
    const beforeEngine = engineRepository.get();
    await service.importConfiguration(cloneEnvelope(), 'importUser');
    assert.deepStrictEqual(engineRepository.get(), beforeEngine);
  });

  it('rejects an unsupported/malformed import without writing anything', async () => {
    const beforeScanModeIds = scanModeRepository
      .findAll()
      .map(scanMode => scanMode.id)
      .sort();

    await assert.rejects(() => service.importConfiguration({ formatVersion: 1 }, 'importUser'));

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
    assert.ok(envelope.fullConfiguration.northConnectors.length > 0, 'expected the fixture to include a north connector');

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

    await assert.rejects(() => service.importConfiguration(envelope, 'importUser'), /injected config import fault/);

    assert.deepStrictEqual(scanModeRepository.findAll(), beforeScanModes);
    assert.deepStrictEqual(ipFilterRepository.list(), beforeIpFilters);
    assert.deepStrictEqual(certificateRepository.list(), beforeCertificates);
    assert.deepStrictEqual(southConnectorRepository.findAllSouth(), beforeSouths);
    assert.deepStrictEqual(northConnectorRepository.findAllNorth(), beforeNorths);
    assert.deepStrictEqual(userRepository.list(), beforeUsers);
    assert.deepStrictEqual(transformerRepository.list(), beforeTransformers);
  });
});
