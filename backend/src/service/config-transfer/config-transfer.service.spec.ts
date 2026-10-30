import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { OIBusObjectAttribute } from '../../../shared/model/connector/form.model';

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
import EncryptionService from '../encryption.service';
import { northManifestList } from '../north-manifests';
import type OIAnalyticsRegistrationService from '../oia/oianalytics-registration.service';
import { southManifestList } from '../south-manifests';
import ConfigTransferService from './config-transfer.service';
import ConfigTransferBuilderService from './config-transfer-builder.service';

describe('Config Transfer Service', () => {
  let engineRepository: Mocked<EngineRepository>;
  let scanModeRepository: Mocked<ScanModeRepository>;
  let ipFilterRepository: Mocked<IpFilterRepository>;
  let certificateRepository: Mocked<CertificateRepository>;
  let userRepository: Mocked<UserRepository>;
  let southRepository: Mocked<SouthConnectorRepository>;
  let northRepository: Mocked<NorthConnectorRepository>;
  let historyQueryRepository: Mocked<HistoryQueryRepository>;
  let transformerRepository: Mocked<TransformerRepository>;
  let oIAnalyticsRegistrationService: Mocked<OIAnalyticsRegistrationService>;
  let builderService: ConfigTransferBuilderService;
  let service: ConfigTransferService;

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
    oIAnalyticsRegistrationService = createMock<OIAnalyticsRegistrationService>();

    engineRepository.get.mock.mockImplementation(() => testData.engine.settings);
    scanModeRepository.findAll.mock.mockImplementation(() => testData.scanMode.list);
    ipFilterRepository.list.mock.mockImplementation(() => testData.ipFilters.list);
    certificateRepository.list.mock.mockImplementation(() => testData.certificates.list);
    userRepository.list.mock.mockImplementation(() => testData.users.list);
    southRepository.findAllSouth.mock.mockImplementation(() => testData.south.list);
    southRepository.findSouthById.mock.mockImplementation((id: string) => testData.south.list.find(element => element.id === id) ?? null);
    southRepository.findAllSouthFull.mock.mockImplementation(() => testData.south.list);
    northRepository.findAllNorth.mock.mockImplementation(() => testData.north.list);
    northRepository.findAllNorthFull.mock.mockImplementation(() => testData.north.list);
    northRepository.findNorthById.mock.mockImplementation((id: string) => testData.north.list.find(element => element.id === id) ?? null);
    historyQueryRepository.findAllHistoriesFull.mock.mockImplementation(() => testData.historyQueries.list);
    transformerRepository.list.mock.mockImplementation(() => testData.transformers.list);
    oIAnalyticsRegistrationService.getRegistrationSettings.mock.mockImplementation(() => testData.oIAnalytics.registration.completed);

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
      createMock<ConfigurationWorkflowRepository>({ findAll: () => [] }),
      encryptionService,
      false,
      false
    );

    service = new ConfigTransferService(builderService, engineRepository, oIAnalyticsRegistrationService as never);
  });

  it('should build an envelope with the expected top-level shape', () => {
    const envelope = service.exportConfiguration();
    assert.deepStrictEqual(Object.keys(envelope).sort(), ['config', 'exportedAt', 'oibusVersion']);
    assert.strictEqual(envelope.oibusVersion, testData.engine.settings.version);
    assert.ok(typeof envelope.exportedAt === 'string' && envelope.exportedAt.length > 0);
    assert.deepStrictEqual(Object.keys(envelope.config).sort(), [
      'certificates',
      'engine',
      'historyQueries',
      'ipFilters',
      'northConnectors',
      'registration',
      'scanModes',
      'southConnectors',
      'transformers',
      'users'
    ]);
    assert.strictEqual(envelope.config.southConnectors.length, testData.south.list.length);
    assert.strictEqual(envelope.config.historyQueries.length, testData.historyQueries.list.length);
  });

  it('should never leak a secret-shaped value anywhere in the serialized envelope', () => {
    // testData.south includes a south connector ('South 2', type 'mssql') whose settings carry a
    // real value ('pass') in a field the mssql manifest marks as `type: 'secret'`.
    const mssqlSouth = testData.south.list.find(south => south.type === 'mssql')!;
    assert.strictEqual((mssqlSouth.settings as { connectionSettings: { password: string } }).connectionSettings.password, 'pass');

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

    for (const southConnector of envelope.config.southConnectors) {
      const manifest = southManifestList.find(manifest => manifest.id === southConnector.type)!;
      const secretKeys = collectSecretKeys(manifest.settings);
      const settings = Object.fromEntries(Object.entries(southConnector.settings.settings));
      for (const key of secretKeys) {
        if (key in settings) {
          assert.strictEqual(settings[key], '', `expected south connector settings.${key} to be stripped`);
        }
      }
    }

    for (const northConnector of envelope.config.northConnectors) {
      const manifest = northManifestList.find(manifest => manifest.id === northConnector.type)!;
      const secretKeys = collectSecretKeys(manifest.settings);
      const settings = Object.fromEntries(Object.entries(northConnector.settings.settings));
      for (const key of secretKeys) {
        if (key in settings) {
          assert.strictEqual(settings[key], '', `expected north connector settings.${key} to be stripped`);
        }
      }
    }
  });
});
