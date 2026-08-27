import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import ConfigTransferBuilderService from './config-transfer-builder.service';
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
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import { StandardTransformer } from '../../model/transformer.model';
import IsoTransformer from '../../transformers/iso-transformer';
import EncryptionService from '../encryption.service';

const standardTransformer: StandardTransformer = {
  id: IsoTransformer.transformerName,
  type: 'standard',
  functionName: IsoTransformer.transformerName,
  inputType: 'any',
  outputType: 'any'
};

describe('Config Transfer Builder Service', () => {
  let engineRepository: EngineRepositoryMock;
  let scanModeRepository: ScanModeRepositoryMock;
  let ipFilterRepository: IpFilterRepositoryMock;
  let certificateRepository: CertificateRepositoryMock;
  let userRepository: UserRepositoryMock;
  let southRepository: SouthConnectorRepositoryMock;
  let northRepository: NorthConnectorRepositoryMock;
  let historyQueryRepository: HistoryQueryRepositoryMock;
  let transformerRepository: TransformerRepositoryMock;
  let encryptionService: EncryptionServiceMock;
  let service: ConfigTransferBuilderService;

  beforeEach(() => {
    engineRepository = new EngineRepositoryMock();
    scanModeRepository = new ScanModeRepositoryMock();
    ipFilterRepository = new IpFilterRepositoryMock();
    certificateRepository = new CertificateRepositoryMock();
    userRepository = new UserRepositoryMock();
    southRepository = new SouthConnectorRepositoryMock();
    northRepository = new NorthConnectorRepositoryMock();
    historyQueryRepository = new HistoryQueryRepositoryMock();
    transformerRepository = new TransformerRepositoryMock();
    encryptionService = new EncryptionServiceMock('', '');

    engineRepository.get = () => testData.engine.settings;
    scanModeRepository.findAll = () => testData.scanMode.list;
    ipFilterRepository.list = () => testData.ipFilters.list;
    certificateRepository.list = () => testData.certificates.list;
    userRepository.list = () => testData.users.list;
    southRepository.findAllSouth = () => testData.south.list;
    southRepository.findSouthById = (id: string) => testData.south.list.find(element => element.id === id) ?? null;
    southRepository.findAllSouthFull = () => testData.south.list;
    northRepository.findAllNorth = () => testData.north.list;
    northRepository.findNorthById = (id: string) => testData.north.list.find(element => element.id === id) ?? null;
    northRepository.findAllNorthFull = () => testData.north.list;
    historyQueryRepository.findAllHistoriesFull = () => testData.historyQueries.list;
    transformerRepository.list = () => [...testData.transformers.list, standardTransformer];

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
      encryptionService as unknown as EncryptionService,
      false,
      false
    );
  });

  it('should build the engine command, stripping proxy and loki passwords', () => {
    const configuration = service.buildFullConfiguration(testData.oIAnalytics.registration.completed);
    assert.strictEqual(configuration.engine.oIBusInternalId, testData.engine.settings.id);
    assert.strictEqual(configuration.engine.settings.proxyServer.password, null);
    assert.strictEqual(configuration.engine.settings.proxyServer.forward.password, null);
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
    scanModeRepository.findAll = () => [intervalScanMode];

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
      const settings = user.settings as Record<string, unknown>;
      assert.strictEqual(settings['password'], undefined);
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
    encryptionService.filterSecrets.mock.mockImplementation(<T>(secrets: T) => secrets);
    const configuration = service.buildFullConfiguration(testData.oIAnalytics.registration.completed);
    assert.strictEqual(configuration.southConnectors.length, testData.south.list.length);
    assert.strictEqual(encryptionService.filterSecrets.mock.calls.length > 0, true);
  });

  it('should build south connector groups, item scanMode/group ids and north transformer south group id', () => {
    const customSouth = {
      ...testData.south.list[0],
      items: [
        {
          ...testData.south.list[0].items[0],
          scanMode: null,
          group: { id: 'groupId1' }
        }
      ],
      groups: [
        {
          id: 'groupId1',
          name: 'My Group',
          scanMode: testData.scanMode.list[0],
          startTimeOffset: 1,
          endTimeOffset: 2,
          maxReadInterval: 3,
          readDelay: 4,
          recoveryStrategy: 'oldest'
        }
      ]
    };
    southRepository.findAllSouth = () => [customSouth] as unknown as typeof testData.south.list;
    southRepository.findSouthById = () => customSouth as unknown as (typeof testData.south.list)[0];
    southRepository.findAllSouthFull = () => [customSouth] as unknown as typeof testData.south.list;

    const originalNorthSource = testData.north.list[0].transformers[0].source as { south: unknown };
    const customNorth = {
      ...testData.north.list[0],
      transformers: [
        {
          ...testData.north.list[0].transformers[0],
          source: {
            type: 'south',
            south: originalNorthSource.south,
            group: { id: 'northGroupId1' },
            items: []
          }
        }
      ]
    };
    northRepository.findAllNorth = () => [customNorth] as unknown as typeof testData.north.list;
    northRepository.findNorthById = () => customNorth as unknown as (typeof testData.north.list)[0];
    northRepository.findAllNorthFull = () => [customNorth] as unknown as typeof testData.north.list;

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
        recoveryStrategy: 'oldest'
      }
    });

    const northTransformer = configuration.northConnectors[0].settings.transformers[0];
    assert.strictEqual(northTransformer.source.groupId, 'northGroupId1');
  });

  it('should build the north connectors command', () => {
    const configuration = service.buildFullConfiguration(testData.oIAnalytics.registration.completed);
    assert.strictEqual(configuration.northConnectors.length, testData.north.list.length);
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
      assert.strictEqual((historyQuery.settings as unknown as Record<string, unknown>)['name'] !== undefined, true);
    }
  });
});
