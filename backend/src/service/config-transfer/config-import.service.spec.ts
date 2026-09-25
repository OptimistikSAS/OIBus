import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import ConfigImportService, { ConfigImportError } from './config-import.service';
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
import ConfigurationWorkflowRepositoryMock from '../../tests/__mocks__/repository/config/configuration-workflow-repository.mock';
import OIAnalyticsRegistrationServiceMock from '../../tests/__mocks__/service/oia/oianalytics-registration-service.mock';
import EncryptionService from '../encryption.service';
import { ConfigExportDTO, OIBusConfigurationDTO } from '../../../shared/model/config-transfer.model';
import { OIAnalyticsConfigurationWorkflowCommandDTO, OIAnalyticsSouthCommandDTO } from '../oia/oianalytics.model';
import { CONFIG_UPGRADES } from './config-upgrades/registry';
import { ConfigUpgrade, forEachSouth, JsonObject } from './config-upgrades/config-upgrade';

/** Version of the importing OIBus the tests pin, independently of `package.json`. */
const CURRENT_VERSION = '3.11.0';

describe('Config Import Service', () => {
  let service: ConfigImportService;
  let exportedFile: ConfigExportDTO;

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
      new ConfigurationWorkflowRepositoryMock(),
      encryptionService,
      false,
      false
    );
    const transferService = new ConfigTransferService(builderService, engineRepository, oIAnalyticsRegistrationService as never);

    exportedFile = { ...transferService.exportConfiguration(), oibusVersion: CURRENT_VERSION };
    service = new ConfigImportService(new JoiValidator());
  });

  const cloneFile = (): ConfigExportDTO => structuredClone(exportedFile);

  const findSouth = (config: OIBusConfigurationDTO, type: string): OIAnalyticsSouthCommandDTO => {
    const south = config.southConnectors.find(candidate => candidate.type === type);
    assert.ok(south, `expected fixture to contain a ${type} south connector`);
    return south;
  };

  /**
   * Trims a cloned file down to just one south connector (with its items dropped, since the fixture's
   * item settings are test-only placeholders that don't satisfy real item manifests) and no north
   * connectors/history queries, so a test can assert on upgrade/validation behavior for that one
   * connector without also having to make the rest of the (unrelated) fixture manifest-valid.
   */
  const isolateToSingleSouth = (file: ConfigExportDTO, south: OIAnalyticsSouthCommandDTO): void => {
    south.settings.items = [];
    file.config.southConnectors = [south];
    file.config.northConnectors = [];
    file.config.historyQueries = [];
  };

  /** Same idea as `isolateToSingleSouth`, keeping only one north connector. */
  const isolateToSingleNorth = (file: ConfigExportDTO, north: OIBusConfigurationDTO['northConnectors'][number]): void => {
    file.config.southConnectors = [];
    file.config.northConnectors = [north];
    file.config.historyQueries = [];
  };

  /** Same idea as `isolateToSingleSouth`, keeping only one history query (without its items). */
  const isolateToSingleHistoryQuery = (file: ConfigExportDTO, historyQuery: OIBusConfigurationDTO['historyQueries'][number]): void => {
    historyQuery.settings.items = [];
    file.config.southConnectors = [];
    file.config.northConnectors = [];
    file.config.historyQueries = [historyQuery];
  };

  /** An opcua-only file that passes every validation. */
  const validFile = (): ConfigExportDTO => {
    const file = cloneFile();
    isolateToSingleSouth(file, findSouth(file.config, 'opcua'));
    return file;
  };

  const localWorkflow = (): OIAnalyticsConfigurationWorkflowCommandDTO => ({
    oIBusInternalId: 'workflow1',
    oIBusCreatedBy: '',
    oIBusUpdatedBy: '',
    oIBusCreatedAt: '',
    oIBusUpdatedAt: '',
    settings: {
      name: 'workflow',
      discoveryScope: { rootNodeId: 'ns=1;s=Root' },
      identityKeyFields: ['nodeId'],
      eligibilityFilter: [],
      itemFieldMapping: { name: '{{name}}' },
      pushToOIAnalytics: false,
      scanModeId: null,
      enabled: true
    },
    ownedItems: []
  });

  const rejection = async (file: unknown, currentVersion = CURRENT_VERSION): Promise<ConfigImportError> => {
    try {
      await service.validateAndUpgrade(file, currentVersion);
    } catch (error: unknown) {
      assert.ok(error instanceof ConfigImportError, `expected a ConfigImportError, got ${error}`);
      return error;
    }
    assert.fail('expected the import to be rejected');
  };

  describe('versions', () => {
    it('accepts a well-formed export of the current version, without upgrades nor mutating the file', async () => {
      const file = validFile();
      const original = structuredClone(file);

      const result = await service.validateAndUpgrade(file, CURRENT_VERSION);

      assert.strictEqual(result.fromVersion, CURRENT_VERSION);
      assert.strictEqual(result.toVersion, CURRENT_VERSION);
      assert.deepStrictEqual(result.appliedUpgrades, []);
      assert.deepStrictEqual(result.config, file.config);
      assert.deepStrictEqual(file, original);
    });

    it('accepts an export from a pre-release of the current version', async () => {
      const file = { ...validFile(), oibusVersion: '3.11.0-beta-6' };

      const result = await service.validateAndUpgrade(file, CURRENT_VERSION);

      assert.strictEqual(result.fromVersion, '3.11.0-beta-6');
    });

    it('rejects an export produced by a newer OIBus', async () => {
      const error = await rejection({ ...validFile(), oibusVersion: '3.11.1' });

      assert.match(error.message, /newer than this OIBus instance/);
      assert.deepStrictEqual(error.validationErrors, []);
    });

    it('rejects an export from a release when running one of its pre-releases', async () => {
      const error = await rejection({ ...validFile(), oibusVersion: '3.11.0' }, '3.11.0-beta-6');

      assert.match(error.message, /newer than this OIBus instance/);
    });

    it('rejects a configuration older than 3.9.0, including a 3.9.0 pre-release', async () => {
      for (const oibusVersion of ['3.8.8', '3.9.0-beta-6']) {
        const error = await rejection({ ...validFile(), oibusVersion });
        assert.match(error.message, /only supported from OIBus 3\.9\.0/);
      }
    });

    it('accepts a configuration from 3.9.0, applying the upgrades of every version since', async () => {
      const result = await service.validateAndUpgrade({ ...validFile(), oibusVersion: '3.9.0' }, CURRENT_VERSION);

      assert.strictEqual(result.fromVersion, '3.9.0');
      assert.deepStrictEqual(
        result.appliedUpgrades.map(upgrade => upgrade.version),
        ['3.9.2', '3.10.0']
      );
    });

    it('rejects a malformed file before anything else', async () => {
      assert.match((await rejection({ oibusVersion: CURRENT_VERSION })).message, /Malformed configuration export file/);
      assert.match((await rejection({ config: {} })).message, /Malformed configuration export file/);
      assert.match((await rejection('not an object')).message, /Malformed configuration export file/);
    });
  });

  describe('upgrade chain', () => {
    const upgrades: Array<ConfigUpgrade> = [];
    const register = (upgrade: ConfigUpgrade): void => {
      upgrades.push(upgrade);
      CONFIG_UPGRADES.push(upgrade);
    };

    afterEach(() => {
      for (const upgrade of upgrades.splice(0)) {
        CONFIG_UPGRADES.splice(CONFIG_UPGRADES.indexOf(upgrade), 1);
      }
    });

    it('applies, oldest first, every step newer than the export and not newer than this OIBus, and reports them', async () => {
      const calls: Array<string> = [];
      const step =
        (version: string) =>
        (config: JsonObject): JsonObject => {
          calls.push(version);
          forEachSouth(config, 'opcua', south => {
            (south.settings as JsonObject).description = `upgraded to ${version}`;
          });
          return config;
        };
      register({ version: '3.11.0', description: 'second', apply: step('3.11.0') });
      register({ version: '3.10.1', description: 'first', apply: step('3.10.1') });
      register({ version: '3.10.0', description: 'already in the export', apply: step('3.10.0') });
      register({ version: '3.11.1', description: 'newer than this OIBus', apply: step('3.11.1') });

      const result = await service.validateAndUpgrade({ ...validFile(), oibusVersion: '3.10.0' }, CURRENT_VERSION);

      assert.deepStrictEqual(calls, ['3.10.1', '3.11.0']);
      assert.deepStrictEqual(
        result.appliedUpgrades.map(upgrade => [upgrade.version, upgrade.description]),
        [
          ['3.10.1', 'first'],
          ['3.11.0', 'second']
        ]
      );
      assert.strictEqual(findSouth(result.config, 'opcua').settings.description, 'upgraded to 3.11.0');
    });

    it('validates the upgraded configuration, not the exported one', async () => {
      // The export lacks a field the current shape requires, and the step adds it back.
      const file = { ...validFile(), oibusVersion: '3.10.0' };
      delete (findSouth(file.config, 'opcua').settings as Partial<OIAnalyticsSouthCommandDTO['settings']>).configurationWorkflows;
      register({
        version: '3.11.0',
        description: 'add configuration workflows',
        apply: config => {
          forEachSouth(config, null, south => ((south.settings as JsonObject).configurationWorkflows ??= []));
          return config;
        }
      });

      const result = await service.validateAndUpgrade(file, CURRENT_VERSION);

      assert.deepStrictEqual(findSouth(result.config, 'opcua').settings.configurationWorkflows, []);
    });

    it('rejects the import when a step throws, naming the step', async () => {
      register({
        version: '3.11.0',
        description: 'broken step',
        apply: () => {
          throw new Error('boom');
        }
      });

      const error = await rejection({ ...validFile(), oibusVersion: '3.10.0' });

      assert.match(error.message, /Could not upgrade the configuration to OIBus 3\.11\.0 \(broken step\): boom/);
    });
  });

  describe('structural validation', () => {
    it('rejects an entity missing a required field, attributing every error to its entity', async () => {
      const file = validFile();
      const opcua = findSouth(file.config, 'opcua');
      delete (opcua.settings as Partial<OIAnalyticsSouthCommandDTO['settings']>).groups;
      delete (opcua.settings as Partial<OIAnalyticsSouthCommandDTO['settings']>).configurationWorkflows;
      delete (file.config.scanModes[1].settings as { name?: string }).name;

      const error = await rejection(file);

      assert.match(error.message, /failed validation/);
      const southErrors = error.validationErrors.filter(entry => entry.scope === 'south:opcua');
      assert.deepStrictEqual(
        southErrors.map(entry => [entry.entityId, entry.entityName]),
        [
          [opcua.oIBusInternalId, opcua.settings.name],
          [opcua.oIBusInternalId, opcua.settings.name]
        ]
      );
      assert.ok(southErrors.some(entry => /groups/.test(entry.message)));
      assert.ok(southErrors.some(entry => /configurationWorkflows/.test(entry.message)));
      assert.ok(
        error.validationErrors.some(entry => entry.scope === 'scanMode' && entry.entityId === file.config.scanModes[1].oIBusInternalId)
      );
    });

    it('reports a missing section at configuration level', async () => {
      const file = validFile();
      delete (file.config as Partial<OIBusConfigurationDTO>).historyQueries;

      const error = await rejection(file);

      assert.deepStrictEqual(
        error.validationErrors.map(entry => entry.scope),
        ['config']
      );
      assert.match(error.validationErrors[0].message, /historyQueries/);
    });

    it('accepts keys it does not know, such as metadata added by OIAnalytics', async () => {
      const file = validFile() as ConfigExportDTO & { source: string };
      file.source = 'oianalytics';
      (findSouth(file.config, 'opcua') as unknown as JsonObject).oIAnalyticsId = 'abc';

      await service.validateAndUpgrade(file, CURRENT_VERSION);
    });

    it('accepts local and remote configuration workflows', async () => {
      const file = validFile();
      findSouth(file.config, 'opcua').settings.configurationWorkflows = [
        localWorkflow(),
        {
          ...localWorkflow(),
          oIBusInternalId: 'workflow2',
          settings: { ...localWorkflow().settings, name: 'remote', itemFieldMapping: null, pushToOIAnalytics: true, identityKeyFields: [] }
        }
      ];

      await service.validateAndUpgrade(file, CURRENT_VERSION);
    });

    it('rejects a configuration workflow that is neither local nor remote, or local without identity key fields', async () => {
      const file = validFile();
      findSouth(file.config, 'opcua').settings.configurationWorkflows = [
        { ...localWorkflow(), settings: { ...localWorkflow().settings, pushToOIAnalytics: true } },
        { ...localWorkflow(), settings: { ...localWorkflow().settings, itemFieldMapping: null } },
        { ...localWorkflow(), settings: { ...localWorkflow().settings, identityKeyFields: [] } }
      ];

      const error = await rejection(file);

      assert.deepStrictEqual(
        error.validationErrors.map(entry => entry.message),
        [
          'A configuration workflow cannot both create/update items and push to OIAnalytics',
          'A configuration workflow must either create/update items or push to OIAnalytics',
          'A configuration workflow creating/updating items requires at least one identity key field'
        ]
      );
    });
  });

  describe('settings validation', () => {
    it('rejects settings that do not match their manifest', async () => {
      const file = validFile();
      const opcua = findSouth(file.config, 'opcua');
      delete (opcua.settings.settings as { url?: string }).url;

      const error = await rejection(file);

      assert.ok(
        error.validationErrors.some(entry => entry.scope === 'south:opcua' && entry.entityId === opcua.oIBusInternalId),
        `expected a validation error for south:opcua, got ${JSON.stringify(error.validationErrors)}`
      );
    });

    it('collects every failure rather than stopping at the first', async () => {
      const file = cloneFile();
      const opcua = findSouth(file.config, 'opcua');
      const folderScanner = findSouth(file.config, 'folder-scanner');
      opcua.settings.items = [];
      folderScanner.settings.items = [];
      file.config.southConnectors = [opcua, folderScanner];
      file.config.northConnectors = [];
      file.config.historyQueries = [];
      delete (opcua.settings.settings as { url?: string }).url;
      delete (folderScanner.settings.settings as { inputFolder?: string }).inputFolder;

      const error = await rejection(file);

      assert.deepStrictEqual(error.validationErrors.map(entry => entry.scope).sort(), ['south:folder-scanner', 'south:opcua']);
    });

    it('reports an unknown south connector type', async () => {
      const file = validFile();
      file.config.southConnectors[0].type = 'not-a-real-south-type';

      const error = await rejection(file);

      assert.ok(
        error.validationErrors.some(
          entry => entry.scope === 'south:not-a-real-south-type' && /Unknown south connector type/.test(entry.message)
        ),
        JSON.stringify(error.validationErrors)
      );
    });

    it('reports an unknown north connector type', async () => {
      const file = cloneFile();
      const north = file.config.northConnectors[0];
      north.type = 'not-a-real-north-type';
      isolateToSingleNorth(file, north);

      const error = await rejection(file);

      assert.ok(
        error.validationErrors.some(
          entry => entry.scope === 'north:not-a-real-north-type' && /Unknown north connector type/.test(entry.message)
        ),
        JSON.stringify(error.validationErrors)
      );
    });

    it('reports unknown south and north connector types on a history query', async () => {
      const file = cloneFile();
      const historyQuery = file.config.historyQueries[0];
      historyQuery.settings.southType = 'not-a-real-south-type' as unknown as typeof historyQuery.settings.southType;
      historyQuery.settings.northType = 'not-a-real-north-type' as unknown as typeof historyQuery.settings.northType;
      isolateToSingleHistoryQuery(file, historyQuery);

      const error = await rejection(file);

      assert.deepStrictEqual(
        error.validationErrors.map(entry => entry.scope),
        ['historyQuerySouth:not-a-real-south-type', 'historyQueryNorth:not-a-real-north-type']
      );
    });
  });

  it('throws when importConfiguration is invoked on a service constructed without the write-path repositories', async () => {
    await assert.rejects(
      () => service.importConfiguration({ ...validFile(), oibusVersion: '3.10.0' }, 'some-user-id'),
      /constructed without the repositories required to write an import/
    );
  });
});
