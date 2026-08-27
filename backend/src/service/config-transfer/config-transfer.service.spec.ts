import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import ConfigTransferService, { CONFIG_EXPORT_FORMAT_VERSION } from './config-transfer.service';
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
import OIAnalyticsRegistrationServiceMock from '../../tests/__mocks__/service/oia/oianalytics-registration-service.mock';
import EncryptionService from '../encryption.service';
import { southManifestList } from '../south-manifests';
import { northManifestList } from '../north-manifests';
import { OIBusObjectAttribute } from '../../../shared/model/form.model';

describe('Config Transfer Service', () => {
  let engineRepository: EngineRepositoryMock;
  let scanModeRepository: ScanModeRepositoryMock;
  let ipFilterRepository: IpFilterRepositoryMock;
  let certificateRepository: CertificateRepositoryMock;
  let userRepository: UserRepositoryMock;
  let southRepository: SouthConnectorRepositoryMock;
  let northRepository: NorthConnectorRepositoryMock;
  let historyQueryRepository: HistoryQueryRepositoryMock;
  let transformerRepository: TransformerRepositoryMock;
  let oIAnalyticsRegistrationService: OIAnalyticsRegistrationServiceMock;
  let builderService: ConfigTransferBuilderService;
  let service: ConfigTransferService;

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
    oIAnalyticsRegistrationService = new OIAnalyticsRegistrationServiceMock();

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
    historyQueryRepository.findAllHistoriesFull = () => testData.historyQueries.list;
    transformerRepository.list = () => testData.transformers.list;
    oIAnalyticsRegistrationService.getRegistrationSettings = () => testData.oIAnalytics.registration.completed;

    // Use the real EncryptionService (filterSecrets is a pure, synchronous, manifest-driven
    // function that needs no init) so the secret-stripping is exercised for real, not mocked away.
    const encryptionService = new EncryptionService();

    builderService = new ConfigTransferBuilderService(
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

    service = new ConfigTransferService(builderService, engineRepository, oIAnalyticsRegistrationService as never);
  });

  it('should build an envelope with the expected top-level shape', () => {
    const envelope = service.exportConfiguration();
    assert.deepStrictEqual(Object.keys(envelope).sort(), [
      'exportedAt',
      'formatVersion',
      'fullConfiguration',
      'historyQueries',
      'oibusVersion'
    ]);
    assert.strictEqual(envelope.formatVersion, CONFIG_EXPORT_FORMAT_VERSION);
    assert.strictEqual(envelope.oibusVersion, testData.engine.settings.version);
    assert.ok(typeof envelope.exportedAt === 'string' && envelope.exportedAt.length > 0);
    assert.strictEqual(envelope.fullConfiguration.southConnectors.length, testData.south.list.length);
    assert.strictEqual(envelope.historyQueries.historyQueries.length, testData.historyQueries.list.length);
  });

  it('should never leak a secret-shaped value anywhere in the serialized envelope', () => {
    // testData.south includes a south connector ('South 2', type 'mssql') whose settings carry a
    // real value ('pass') in a field the mssql manifest marks as `type: 'secret'`.
    const mssqlSouth = testData.south.list.find(south => south.type === 'mssql')!;
    assert.strictEqual((mssqlSouth.settings as { password: string }).password, 'pass');

    const envelope = service.exportConfiguration();
    const serialized = JSON.stringify(envelope);

    assert.strictEqual(serialized.includes('"pass"'), false);

    // Recursively collect every attribute key marked `type: 'secret'` across every south and north
    // manifest, then walk the serialized settings of each exported connector of that type and
    // assert the corresponding value was stripped to an empty string.
    const collectSecretKeys = (attribute: OIBusObjectAttribute): Array<string> => {
      const keys: Array<string> = [];
      for (const child of attribute.attributes) {
        if (child.type === 'secret') {
          keys.push(child.key);
        } else if (child.type === 'object') {
          keys.push(...collectSecretKeys(child));
        }
      }
      return keys;
    };

    for (const southConnector of envelope.fullConfiguration.southConnectors) {
      const manifest = southManifestList.find(manifest => manifest.id === southConnector.type)!;
      const secretKeys = collectSecretKeys(manifest.settings);
      const settings = southConnector.settings.settings as Record<string, unknown>;
      for (const key of secretKeys) {
        if (key in settings) {
          assert.strictEqual(settings[key], '', `expected south connector settings.${key} to be stripped`);
        }
      }
    }

    for (const northConnector of envelope.fullConfiguration.northConnectors) {
      const manifest = northManifestList.find(manifest => manifest.id === northConnector.type)!;
      const secretKeys = collectSecretKeys(manifest.settings);
      const settings = northConnector.settings.settings as Record<string, unknown>;
      for (const key of secretKeys) {
        if (key in settings) {
          assert.strictEqual(settings[key], '', `expected north connector settings.${key} to be stripped`);
        }
      }
    }
  });
});
