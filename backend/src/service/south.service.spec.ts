import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from './encryption.service';
import pino from 'pino';
import SouthService from './south.service';
import ConnectionService from './connection.service';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import LogRepository from '../repository/logs/log.repository';
import LogRepositoryMock from '../tests/__mocks__/repository/log/log-repository.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OIAnalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import SouthConnectorMetricsRepository from '../repository/logs/south-connector-metrics.repository';
import SouthMetricsRepositoryMock from '../tests/__mocks__/repository/log/south-metrics-repository.mock';
import SouthCacheRepository from '../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../tests/__mocks__/repository/cache/south-cache-repository.mock';
import ConnectionServiceMock from '../tests/__mocks__/service/connection-service.mock';
import testData from '../tests/utils/test-data';
import { mockBaseFolders } from '../tests/utils/test-utils';
import { SouthConnectorEntity } from '../model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import OIAnalyticsRegistrationRepositoryMock from '../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import CertificateRepositoryMock from '../tests/__mocks__/repository/config/certificate-repository.mock';
import DataStreamEngine from '../engine/data-stream-engine';
import DataStreamEngineMock from '../tests/__mocks__/data-stream-engine.mock';
import { BaseFolders } from '../model/types';
import fs from 'node:fs/promises';

jest.mock('../south/south-opcua/south-opcua');
jest.mock('./metrics/south-connector-metrics.service');
jest.mock('node:fs/promises');

const validator = new JoiValidator();
const logger: pino.Logger = new PinoLogger();
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const logRepository: LogRepository = new LogRepositoryMock();
const southMetricsRepository: SouthConnectorMetricsRepository = new SouthMetricsRepositoryMock();
const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository = new OIAnalyticsRegistrationRepositoryMock();
const certificateRepository: CertificateRepository = new CertificateRepositoryMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OIAnalyticsMessageServiceMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const connectionService: ConnectionService = new ConnectionServiceMock();
const dataStreamEngine: DataStreamEngine = new DataStreamEngineMock(logger);

let service: SouthService;
describe('south service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new SouthService(
      validator,
      southConnectorRepository,
      logRepository,
      southMetricsRepository,
      southCacheRepository,
      scanModeRepository,
      oIAnalyticsRegistrationRepository,
      certificateRepository,
      oIAnalyticsMessageService,
      encryptionService,
      connectionService,
      dataStreamEngine
    );
  });

  it('should get a South connector settings', () => {
    service.findById('southId');
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledTimes(1);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith('southId');
  });

  it('should get a South connector items', () => {
    service.getSouthItems('southId');
    expect(southConnectorRepository.findAllItemsForSouth).toHaveBeenCalledTimes(1);
    expect(southConnectorRepository.findAllItemsForSouth).toHaveBeenCalledWith('southId');
  });

  it('should get all South connector settings', () => {
    service.findAll();
    expect(southConnectorRepository.findAllSouth).toHaveBeenCalledTimes(1);
  });

  it('should create South connector', () => {
    const connector = service.runSouth(testData.south.list[0], jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toBeDefined();
  });

  it('should create South connector with default base folders', () => {
    const connector = service.runSouth(testData.south.list[0], jest.fn(), logger);
    expect(connector).toBeDefined();
    expect(connector['baseFolders']).toEqual(mockBaseFolders(`south-${testData.south.list[0].id}`));
  });

  it('should not create South connector not installed', () => {
    let connector;
    let error;
    try {
      connector = service.runSouth(
        {
          id: 'southId',
          name: 'mySouth',
          description: 'my test connector',
          type: 'another'
        } as SouthConnectorEntity<SouthSettings, SouthItemSettings>,
        jest.fn(),
        logger,
        mockBaseFolders(testData.south.list[0].id)
      );
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(new Error('South connector of type another not installed'));
    expect(connector).not.toBeDefined();
  });

  it('should retrieve a list of south manifest', () => {
    const list = service.getInstalledSouthManifests();
    expect(list).toBeDefined();
  });

  it('should delete base folders', async () => {
    const connector = service.runSouth(testData.south.list[0], jest.fn(), logger);
    expect(connector).toBeDefined();

    (fs.stat as jest.Mock).mockImplementation(() => ({}));

    const baseFolders = structuredClone(service['getDefaultBaseFolders'](testData.south.list[0].id));
    await service['deleteBaseFolders'](testData.south.list[0]);

    for (const type of Object.keys(baseFolders) as Array<keyof BaseFolders>) {
      expect(fs.stat).toHaveBeenCalledWith(baseFolders[type]);
      expect(fs.rm).toHaveBeenCalledWith(baseFolders[type], { recursive: true });
    }
  });

  it('should delete base folders if exists', async () => {
    const connector = service.runSouth(testData.south.list[0], jest.fn(), logger);
    expect(connector).toBeDefined();

    (fs.stat as jest.Mock).mockImplementation(() => {
      throw new Error('stat error');
    });

    const baseFolders = structuredClone(service['getDefaultBaseFolders'](testData.south.list[0].id));
    await service['deleteBaseFolders'](testData.south.list[0]);

    for (const type of Object.keys(baseFolders) as Array<keyof BaseFolders>) {
      expect(fs.stat).toHaveBeenCalledWith(baseFolders[type]);
      expect(fs.rm).not.toHaveBeenCalled();
    }
  });

  it('should delete base folders and handle errors', async () => {
    const connector = service.runSouth(testData.south.list[0], jest.fn(), logger);
    expect(connector).toBeDefined();

    const error = new Error('rm error');
    (fs.stat as jest.Mock).mockImplementation(() => ({}));
    (fs.rm as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const baseFolders = structuredClone(service['getDefaultBaseFolders'](testData.south.list[0].id));
    await service['deleteBaseFolders'](testData.south.list[0]);

    for (const type of Object.keys(baseFolders) as Array<keyof BaseFolders>) {
      expect(fs.stat).toHaveBeenCalledWith(baseFolders[type]);
      expect(fs.rm).toHaveBeenCalledWith(baseFolders[type], { recursive: true });
      expect(dataStreamEngine.logger.error).toHaveBeenCalledWith(
        `Unable to delete South connector "${connector.settings.name}" (${connector.settings.id}) "${type}" base folder: ${error}`
      );
    }
  });
});
