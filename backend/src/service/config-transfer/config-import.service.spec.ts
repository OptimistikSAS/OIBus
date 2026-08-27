import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import ConfigImportService, { ConfigImportError, SUPPORTED_FORMAT_VERSION } from './config-import.service';
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
});
