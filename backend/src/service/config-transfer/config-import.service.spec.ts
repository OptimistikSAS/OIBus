import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import ConfigImportService, { AppliedUpgrade, ConfigImportError, SUPPORTED_FORMAT_VERSION } from './config-import.service';
import ConfigTransferService from './config-transfer.service';
import ConfigTransferBuilderService from './config-transfer-builder.service';
import JoiValidator from '../../web-server/controllers/validators/joi.validator';
import testData from '../../tests/utils/test-data';
import EngineRepositoryMock from '../../tests/__mocks__/repository/config/engine-repository.mock';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/south-connector-repository.mock';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import IpFilterRepositoryMock from '../../tests/__mocks__/repository/config/ip-filter-repository.mock';
import CertificateRepositoryMock from '../../tests/__mocks__/repository/config/certificate-repository.mock';
import UserRepositoryMock from '../../tests/__mocks__/repository/config/user-repository.mock';
import HistoryQueryRepositoryMock from '../../tests/__mocks__/repository/config/history-query-repository.mock';
import TransformerRepositoryMock from '../../tests/__mocks__/repository/config/transformer-repository.mock';
import OIAnalyticsRegistrationServiceMock from '../../tests/__mocks__/service/oia/oianalytics-registration-service.mock';
import EncryptionService from '../encryption.service';
import { ConfigExportEnvelopeDTO } from '../../../shared/model/config-transfer.model';
import { OIAnalyticsSouthCommandDTO } from '../oia/oianalytics.model';
import { SettingsUpgradeEntry } from './settings-upgrades/registry';

describe('Config Import Service', () => {
  let service: ConfigImportService;
  let realEnvelope: ConfigExportEnvelopeDTO;

  beforeEach(() => {
    const engineRepository = new EngineRepositoryMock();
    const scanModeRepository = new ScanModeRepositoryMock();
    const ipFilterRepository = new IpFilterRepositoryMock();
    const certificateRepository = new CertificateRepositoryMock();
    const userRepository = new UserRepositoryMock();
    const southRepository = new SouthConnectorRepositoryMock();
    const northRepository = new NorthConnectorRepositoryMock();
    const historyQueryRepository = new HistoryQueryRepositoryMock();
    const transformerRepository = new TransformerRepositoryMock();
    const oIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();

    engineRepository.get = () => testData.engine.settings;
    scanModeRepository.findAll = () => testData.scanMode.list;
    ipFilterRepository.list = () => testData.ipFilters.list;
    certificateRepository.list = () => testData.certificates.list;
    userRepository.list = () => testData.users.list;
    southRepository.findAllSouth = () => testData.south.list;
    southRepository.findSouthById = (id: string) => testData.south.list.find(element => element.id === id) ?? null;
    southRepository.findAllSouthFull = () => testData.south.list;
    northRepository.findAllNorth = () => testData.north.list;
    northRepository.findAllNorthFull = () => testData.north.list;
    northRepository.findNorthById = (id: string) => testData.north.list.find(element => element.id === id) ?? null;
    historyQueryRepository.findAllHistoriesFull = () => testData.historyQueries.list;
    transformerRepository.list = () => testData.transformers.list;
    oIAnalyticsRegistrationService.getRegistrationSettings = () => testData.oIAnalytics.registration.completed;

    // Use the real, pure EncryptionService and JoiValidator (both need no init) so the pipeline is
    // exercised end to end against the same manifests/validation the create/update endpoints use.
    const encryptionService = new EncryptionService();
    const builderService = new ConfigTransferBuilderService(
      engineRepository,
      scanModeRepository,
      ipFilterRepository,
      certificateRepository,
      userRepository,
      southRepository,
      northRepository,
      historyQueryRepository,
      transformerRepository,
      encryptionService,
      false,
      false
    );
    const transferService = new ConfigTransferService(builderService, engineRepository, oIAnalyticsRegistrationService as never);

    realEnvelope = transferService.exportConfiguration();
    service = new ConfigImportService(new JoiValidator());
  });

  const cloneEnvelope = (): ConfigExportEnvelopeDTO => structuredClone(realEnvelope);

  const findOpcuaSouth = (envelope: ConfigExportEnvelopeDTO): OIAnalyticsSouthCommandDTO => {
    const south = envelope.fullConfiguration.southConnectors.find(candidate => candidate.type === 'opcua');
    assert.ok(south, 'expected fixture to contain an opcua south connector');
    return south;
  };

  /**
   * Trims a cloned envelope down to just one south connector (with its items dropped, since the
   * fixture's item settings are test-only placeholders that don't satisfy real item manifests) and
   * no north connectors/history queries, so a test can assert on upgrade/validation behavior for
   * that one connector without also having to make the rest of the (unrelated) fixture manifest-valid.
   */
  const isolateToSingleSouth = (envelope: ConfigExportEnvelopeDTO, south: OIAnalyticsSouthCommandDTO): void => {
    south.settings.items = [];
    envelope.fullConfiguration.southConnectors = [south];
    envelope.fullConfiguration.northConnectors = [];
    envelope.historyQueries.historyQueries = [];
  };

  /**
   * Same idea as `isolateToSingleSouth`, but keeps only one north connector and drops every other
   * section, so a test can assert on north-only validation/upgrade behavior without also having to
   * make the rest of the (unrelated) fixture manifest-valid.
   */
  const isolateToSingleNorth = (
    envelope: ConfigExportEnvelopeDTO,
    north: ConfigExportEnvelopeDTO['fullConfiguration']['northConnectors'][number]
  ): void => {
    envelope.fullConfiguration.southConnectors = [];
    envelope.fullConfiguration.northConnectors = [north];
    envelope.historyQueries.historyQueries = [];
  };

  /**
   * Same idea as `isolateToSingleSouth`, but keeps only one history query (with its items dropped,
   * for the same reason `isolateToSingleSouth` drops a south connector's items) and no south/north
   * connectors.
   */
  const isolateToSingleHistoryQuery = (
    envelope: ConfigExportEnvelopeDTO,
    historyQuery: ConfigExportEnvelopeDTO['historyQueries']['historyQueries'][number]
  ): void => {
    historyQuery.settings.items = [];
    envelope.fullConfiguration.southConnectors = [];
    envelope.fullConfiguration.northConnectors = [];
    envelope.historyQueries.historyQueries = [historyQuery];
  };

  /**
   * Reaches into the private `applyUpgrades` method directly. The shared `SETTINGS_UPGRADE_REGISTRY`
   * only contains `south:opcua`/`historyQuerySouth:opcua` entries today, so exercising every other
   * `parseScope`/`applyUpgrades` switch branch (envelope, engine, north, historyQueryNorth,
   * transformer, and an unrecognized scope prefix) requires crafting upgrade entries by hand rather
   * than going through the registry.
   */
  const applyUpgradesDirect = (envelope: ConfigExportEnvelopeDTO, upgrades: Array<SettingsUpgradeEntry>): Array<AppliedUpgrade> =>
    (
      service as unknown as {
        applyUpgrades: (e: ConfigExportEnvelopeDTO, u: Array<SettingsUpgradeEntry>) => Array<AppliedUpgrade>;
      }
    ).applyUpgrades(envelope, upgrades);

  it('accepts a well-formed, up-to-date envelope with no upgrades needed', async () => {
    const envelope = cloneEnvelope();
    envelope.oibusVersion = '99.0.0';
    isolateToSingleSouth(envelope, findOpcuaSouth(envelope));

    const result = await service.validateAndUpgrade(envelope);

    assert.deepStrictEqual(result.appliedUpgrades, []);
    assert.strictEqual(result.envelope, envelope);
  });

  it('applies a matching settings upgrade and reports it in appliedUpgrades', async () => {
    const envelope = cloneEnvelope();
    envelope.oibusVersion = '3.8.0';
    const opcuaSouth = findOpcuaSouth(envelope);
    delete (opcuaSouth.settings.settings as { maxParallelRun?: number }).maxParallelRun;
    isolateToSingleSouth(envelope, opcuaSouth);

    const result = await service.validateAndUpgrade(envelope);

    assert.deepStrictEqual(result.appliedUpgrades, [{ scope: 'south:opcua', version: '3.9.0', entityId: opcuaSouth.oIBusInternalId }]);
    const upgradedSouth = findOpcuaSouth(result.envelope);
    assert.strictEqual((upgradedSouth.settings.settings as { maxParallelRun: number }).maxParallelRun, 1);
  });

  it('rejects an envelope whose formatVersion is newer than this build supports, without attempting anything else', async () => {
    const envelope = cloneEnvelope();
    envelope.formatVersion = SUPPORTED_FORMAT_VERSION + 1;

    await assert.rejects(
      () => service.validateAndUpgrade(envelope),
      (error: unknown) => {
        assert.ok(error instanceof ConfigImportError);
        assert.match(error.message, /format version/i);
        assert.deepStrictEqual(error.validationErrors, []);
        return true;
      }
    );
  });

  it('rejects malformed input with a clear error before touching any section', async () => {
    await assert.rejects(
      () => service.validateAndUpgrade({ formatVersion: 1 }),
      (error: unknown) => {
        assert.ok(error instanceof ConfigImportError);
        assert.match(error.message, /malformed/i);
        return true;
      }
    );
  });

  it('rejects settings that are still invalid after every matching upgrade has been applied, without changing appliedUpgrades semantics', async () => {
    const envelope = cloneEnvelope();
    envelope.oibusVersion = '99.0.0'; // no upgrade could possibly fix a missing required field
    const opcuaSouth = findOpcuaSouth(envelope);
    delete (opcuaSouth.settings.settings as { url?: string }).url;

    await assert.rejects(
      () => service.validateAndUpgrade(envelope),
      (error: unknown) => {
        assert.ok(error instanceof ConfigImportError);
        assert.ok(error.validationErrors.length > 0);
        assert.ok(
          error.validationErrors.some(entry => entry.scope === 'south:opcua' && entry.entityId === opcuaSouth.oIBusInternalId),
          `expected a validation error for south:opcua, got ${JSON.stringify(error.validationErrors)}`
        );
        return true;
      }
    );
  });

  it('rejects an old export whose version gap the registry has no entry for, collecting every failure rather than stopping at the first', async () => {
    const envelope = cloneEnvelope();
    envelope.oibusVersion = '1.0.0'; // far older than anything the registry actually covers
    const opcuaSouth = findOpcuaSouth(envelope);
    delete (opcuaSouth.settings.settings as { url?: string }).url;
    const folderScannerSouth = envelope.fullConfiguration.southConnectors.find(candidate => candidate.type === 'folder-scanner');
    assert.ok(folderScannerSouth, 'expected fixture to contain a folder-scanner south connector');
    delete (folderScannerSouth.settings.settings as { inputFolder?: string }).inputFolder;

    await assert.rejects(
      () => service.validateAndUpgrade(envelope),
      (error: unknown) => {
        assert.ok(error instanceof ConfigImportError);
        assert.ok(
          error.validationErrors.length >= 2,
          `expected at least 2 collected failures, got ${JSON.stringify(error.validationErrors)}`
        );
        return true;
      }
    );
  });

  it('reports an unknown south connector type as a validation error', async () => {
    const envelope = cloneEnvelope();
    envelope.oibusVersion = '99.0.0';
    const opcuaSouth = findOpcuaSouth(envelope);
    opcuaSouth.type = 'not-a-real-south-type';
    isolateToSingleSouth(envelope, opcuaSouth);

    await assert.rejects(
      () => service.validateAndUpgrade(envelope),
      (error: unknown) => {
        assert.ok(error instanceof ConfigImportError);
        assert.ok(
          error.validationErrors.some(
            entry => entry.scope === 'south:not-a-real-south-type' && /Unknown south connector type/.test(entry.message)
          ),
          `expected an "unknown south connector type" validation error, got ${JSON.stringify(error.validationErrors)}`
        );
        return true;
      }
    );
  });

  it('reports an unknown north connector type as a validation error', async () => {
    const envelope = cloneEnvelope();
    envelope.oibusVersion = '99.0.0';
    const north = envelope.fullConfiguration.northConnectors[0];
    assert.ok(north, 'expected the fixture to include at least one north connector');
    north.type = 'not-a-real-north-type';
    isolateToSingleNorth(envelope, north);

    await assert.rejects(
      () => service.validateAndUpgrade(envelope),
      (error: unknown) => {
        assert.ok(error instanceof ConfigImportError);
        assert.ok(
          error.validationErrors.some(
            entry => entry.scope === 'north:not-a-real-north-type' && /Unknown north connector type/.test(entry.message)
          ),
          `expected an "unknown north connector type" validation error, got ${JSON.stringify(error.validationErrors)}`
        );
        return true;
      }
    );
  });

  it('reports an unknown south connector type on a history query as a validation error', async () => {
    const envelope = cloneEnvelope();
    envelope.oibusVersion = '99.0.0';
    const historyQuery = envelope.historyQueries.historyQueries[0];
    assert.ok(historyQuery, 'expected the fixture to include at least one history query');
    historyQuery.settings.southType = 'not-a-real-south-type' as unknown as typeof historyQuery.settings.southType;
    isolateToSingleHistoryQuery(envelope, historyQuery);

    await assert.rejects(
      () => service.validateAndUpgrade(envelope),
      (error: unknown) => {
        assert.ok(error instanceof ConfigImportError);
        assert.ok(
          error.validationErrors.some(
            entry => entry.scope === 'historyQuerySouth:not-a-real-south-type' && /Unknown south connector type/.test(entry.message)
          ),
          `expected an "unknown south connector type" validation error on the history query, got ${JSON.stringify(error.validationErrors)}`
        );
        return true;
      }
    );
  });

  it('reports an unknown north connector type on a history query as a validation error', async () => {
    const envelope = cloneEnvelope();
    envelope.oibusVersion = '99.0.0';
    const historyQuery = envelope.historyQueries.historyQueries[0];
    assert.ok(historyQuery, 'expected the fixture to include at least one history query');
    historyQuery.settings.northType = 'not-a-real-north-type' as unknown as typeof historyQuery.settings.northType;
    isolateToSingleHistoryQuery(envelope, historyQuery);

    await assert.rejects(
      () => service.validateAndUpgrade(envelope),
      (error: unknown) => {
        assert.ok(error instanceof ConfigImportError);
        assert.ok(
          error.validationErrors.some(
            entry => entry.scope === 'historyQueryNorth:not-a-real-north-type' && /Unknown north connector type/.test(entry.message)
          ),
          `expected an "unknown north connector type" validation error on the history query, got ${JSON.stringify(error.validationErrors)}`
        );
        return true;
      }
    );
  });

  it('throws when importConfiguration is invoked on a service constructed without the write-path repositories', async () => {
    const envelope = cloneEnvelope();
    envelope.oibusVersion = '99.0.0';
    isolateToSingleSouth(envelope, findOpcuaSouth(envelope));

    await assert.rejects(
      () => service.importConfiguration(envelope, 'some-user-id'),
      /constructed without the repositories required to write an import/
    );
  });

  describe('applyUpgrades scope handling (direct, since the shared registry only covers south:opcua today)', () => {
    it('applies an envelope-scope upgrade by merging its result onto the whole envelope', () => {
      const envelope = cloneEnvelope();
      const upgrade: SettingsUpgradeEntry = {
        version: '99.0.0',
        scope: 'envelope',
        apply: section => ({ ...section, oibusVersion: 'patched-by-upgrade' })
      };

      const applied = applyUpgradesDirect(envelope, [upgrade]);

      assert.strictEqual(envelope.oibusVersion, 'patched-by-upgrade');
      assert.deepStrictEqual(applied, [{ scope: 'envelope', version: '99.0.0' }]);
    });

    it('applies an engine-scope upgrade to the engine settings and records the engine entity id', () => {
      const envelope = cloneEnvelope();
      const upgrade: SettingsUpgradeEntry = {
        version: '99.0.0',
        scope: 'engine',
        apply: settings => ({ ...settings, patchedByUpgrade: true })
      };

      const applied = applyUpgradesDirect(envelope, [upgrade]);

      assert.strictEqual((envelope.fullConfiguration.engine.settings as unknown as { patchedByUpgrade: boolean }).patchedByUpgrade, true);
      assert.deepStrictEqual(applied, [
        { scope: 'engine', version: '99.0.0', entityId: envelope.fullConfiguration.engine.oIBusInternalId }
      ]);
    });

    it('applies a north-scope upgrade only to north connectors of the matching type', () => {
      const envelope = cloneEnvelope();
      const northType = envelope.fullConfiguration.northConnectors[0].type;
      const matching = envelope.fullConfiguration.northConnectors.filter(north => north.type === northType);
      assert.ok(matching.length > 0);
      const nonMatchingCountBefore = envelope.fullConfiguration.northConnectors.length - matching.length;

      const upgrade: SettingsUpgradeEntry = {
        version: '99.0.0',
        scope: `north:${northType}`,
        apply: settings => ({ ...settings, patchedByUpgrade: true })
      };

      const applied = applyUpgradesDirect(envelope, [upgrade]);

      assert.strictEqual(applied.length, matching.length);
      for (const north of matching) {
        assert.strictEqual((north.settings.settings as unknown as { patchedByUpgrade: boolean }).patchedByUpgrade, true);
      }
      const nonMatchingAfter = envelope.fullConfiguration.northConnectors.filter(north => north.type !== northType);
      assert.strictEqual(nonMatchingAfter.length, nonMatchingCountBefore);
      for (const north of nonMatchingAfter) {
        assert.strictEqual((north.settings.settings as unknown as { patchedByUpgrade?: boolean }).patchedByUpgrade, undefined);
      }
    });

    it('applies a historyQuerySouth-scope upgrade only to history queries whose southType matches', () => {
      const envelope = cloneEnvelope();
      const historyQuery = envelope.historyQueries.historyQueries[0];
      assert.ok(historyQuery, 'expected the fixture to include at least one history query');
      const matchingSouthType = historyQuery.settings.southType;
      const matching = envelope.historyQueries.historyQueries.filter(candidate => candidate.settings.southType === matchingSouthType);
      const upgrade: SettingsUpgradeEntry = {
        version: '99.0.0',
        scope: `historyQuerySouth:${matchingSouthType}`,
        apply: settings => ({ ...settings, patchedByUpgrade: true })
      };

      const applied = applyUpgradesDirect(envelope, [upgrade]);

      assert.deepStrictEqual(
        applied,
        matching.map(entry => ({ scope: upgrade.scope, version: '99.0.0', entityId: entry.oIBusInternalId }))
      );
      for (const entry of matching) {
        assert.strictEqual((entry.settings.southSettings as unknown as { patchedByUpgrade: boolean }).patchedByUpgrade, true);
      }
      for (const entry of envelope.historyQueries.historyQueries.filter(candidate => candidate.settings.southType !== matchingSouthType)) {
        assert.strictEqual((entry.settings.southSettings as unknown as { patchedByUpgrade?: boolean }).patchedByUpgrade, undefined);
      }
    });

    it('applies a historyQueryNorth-scope upgrade only to history queries whose northType matches', () => {
      const envelope = cloneEnvelope();
      const historyQuery = envelope.historyQueries.historyQueries[0];
      assert.ok(historyQuery, 'expected the fixture to include at least one history query');
      const upgrade: SettingsUpgradeEntry = {
        version: '99.0.0',
        scope: `historyQueryNorth:${historyQuery.settings.northType}`,
        apply: settings => ({ ...settings, patchedByUpgrade: true })
      };

      const applied = applyUpgradesDirect(envelope, [upgrade]);

      assert.deepStrictEqual(applied, [{ scope: upgrade.scope, version: '99.0.0', entityId: historyQuery.oIBusInternalId }]);
      assert.strictEqual((historyQuery.settings.northSettings as unknown as { patchedByUpgrade: boolean }).patchedByUpgrade, true);
    });

    it('applies a transformer-scope upgrade only to standard transformers with the matching functionName', () => {
      const envelope = cloneEnvelope();
      envelope.fullConfiguration.transformers = [
        {
          oIBusInternalId: 'standard-transformer-1',
          type: 'standard',
          settings: { functionName: 'target-function' },
          manifest: { type: 'object', key: '', translationKey: '', attributes: [], enablingConditions: [], validators: [] }
        } as unknown as ConfigExportEnvelopeDTO['fullConfiguration']['transformers'][number],
        {
          oIBusInternalId: 'standard-transformer-2',
          type: 'standard',
          settings: { functionName: 'other-function' },
          manifest: { type: 'object', key: '', translationKey: '', attributes: [], enablingConditions: [], validators: [] }
        } as unknown as ConfigExportEnvelopeDTO['fullConfiguration']['transformers'][number]
      ];

      const upgrade: SettingsUpgradeEntry = {
        version: '99.0.0',
        scope: 'transformer:target-function',
        apply: settings => ({ ...settings, patchedByUpgrade: true })
      };

      const applied = applyUpgradesDirect(envelope, [upgrade]);

      assert.deepStrictEqual(applied, [{ scope: 'transformer:target-function', version: '99.0.0', entityId: 'standard-transformer-1' }]);
      const [matched, unmatched] = envelope.fullConfiguration.transformers;
      assert.strictEqual((matched.settings as unknown as { patchedByUpgrade: boolean }).patchedByUpgrade, true);
      assert.strictEqual((unmatched.settings as unknown as { patchedByUpgrade?: boolean }).patchedByUpgrade, undefined);
    });

    it('wraps an unrecognized upgrade scope prefix in a ConfigImportError instead of silently mis-applying it', () => {
      const envelope = cloneEnvelope();
      const upgrade = {
        version: '99.0.0',
        scope: 'not-a-real-scope-prefix:foo',
        apply: (settings: Record<string, unknown>) => settings
      } as unknown as SettingsUpgradeEntry;

      assert.throws(
        () => applyUpgradesDirect(envelope, [upgrade]),
        (error: unknown) => {
          assert.ok(error instanceof ConfigImportError);
          assert.match(error.message, /Invalid settings-upgrade registry entry "not-a-real-scope-prefix:foo@99\.0\.0"/);
          assert.match(error.message, /Unknown settings-upgrade scope/);
          return true;
        }
      );
    });
  });
});
