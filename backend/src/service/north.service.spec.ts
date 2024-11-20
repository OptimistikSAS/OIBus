import EncryptionServiceMock from '../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from './encryption.service';
import NorthService from './north.service';
import pino from 'pino';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../tests/__mocks__/repository/config/south-connector-repository.mock';
import LogRepository from '../repository/logs/log.repository';
import LogRepositoryMock from '../tests/__mocks__/repository/log/log-repository.mock';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../tests/__mocks__/repository/config/scan-mode-repository.mock';
import OIAnalyticsMessageService from './oia/oianalytics-message.service';
import OIAnalyticsMessageServiceMock from '../tests/__mocks__/service/oia/oianalytics-message-service.mock';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../tests/__mocks__/repository/config/north-connector-repository.mock';
import NorthConnectorMetricsRepository from '../repository/logs/north-connector-metrics.repository';
import NorthMetricsRepositoryMock from '../tests/__mocks__/repository/log/north-metrics-repository.mock';
import testData from '../tests/utils/test-data';
import { mockBaseFolders } from '../tests/utils/test-utils';
import CertificateRepository from '../repository/config/certificate.repository';
import CertificateRepositoryMock from '../tests/__mocks__/repository/config/certificate-repository.mock';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import OianalyticsRegistrationRepositoryMock from '../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import DataStreamEngine from '../engine/data-stream-engine';
import DataStreamEngineMock from '../tests/__mocks__/data-stream-engine.mock';
import NorthConnectorMock from '../tests/__mocks__/north-connector.mock';
import { createBaseFolders, filesExists } from './utils';
import fs from 'node:fs/promises';

jest.mock('./encryption.service');
jest.mock('./utils');
jest.mock('./metrics/north-connector-metrics.service');
jest.mock('node:fs/promises');

const validator = new JoiValidator();
const logger: pino.Logger = new PinoLogger();
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const northMetricsRepository: NorthConnectorMetricsRepository = new NorthMetricsRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const logRepository: LogRepository = new LogRepositoryMock();
const certificateRepository: CertificateRepository = new CertificateRepositoryMock();
const oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository = new OianalyticsRegistrationRepositoryMock();
const oIAnalyticsMessageService: OIAnalyticsMessageService = new OIAnalyticsMessageServiceMock();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const dataStreamEngine: DataStreamEngine = new DataStreamEngineMock(logger);

const mockedNorth1 = new NorthConnectorMock(testData.north.list[0]);

jest.mock(
  '../north/north-amazon-s3/north-amazon-s3',
  () =>
    function () {
      return mockedNorth1;
    }
);
jest.mock(
  '../north/north-azure-blob/north-azure-blob',
  () =>
    function () {
      return mockedNorth1;
    }
);
jest.mock(
  '../north/north-console/north-console',
  () =>
    function () {
      return mockedNorth1;
    }
);
jest.mock(
  '../north/north-file-writer/north-file-writer',
  () =>
    function () {
      return mockedNorth1;
    }
);
jest.mock(
  '../north/north-oianalytics/north-oianalytics',
  () =>
    function () {
      return mockedNorth1;
    }
);
jest.mock(
  '../north/north-sftp/north-sftp',
  () =>
    function () {
      return mockedNorth1;
    }
);

let service: NorthService;
describe('north service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new NorthService(
      validator,
      northConnectorRepository,
      southConnectorRepository,
      northMetricsRepository,
      scanModeRepository,
      logRepository,
      certificateRepository,
      oIAnalyticsRegistrationRepository,
      oIAnalyticsMessageService,
      encryptionService,
      dataStreamEngine
    );
  });

  it('should get a North connector settings', () => {
    service.findById('northId');
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledTimes(1);
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith('northId');
  });

  it('should get all North connector settings', () => {
    service.findAll();
    expect(northConnectorRepository.findAllNorth).toHaveBeenCalledTimes(1);
  });

  it('runNorth() should run NorthAmazonS3', () => {
    const aws3 = JSON.parse(JSON.stringify(testData.north.list[0]));
    aws3.type = 'aws-s3';
    const connector = service.runNorth(aws3, logger, mockBaseFolders(aws3.id));
    expect(connector).toEqual(mockedNorth1);
  });

  it('runNorth() should run NorthAzureBlob', () => {
    const azureBlob = JSON.parse(JSON.stringify(testData.north.list[0]));
    azureBlob.type = 'azure-blob';
    const connector = service.runNorth(azureBlob, logger, mockBaseFolders(azureBlob.id));
    expect(connector).toEqual(mockedNorth1);
  });

  it('runNorth() should run NorthConsole', () => {
    const consoleConnector = JSON.parse(JSON.stringify(testData.north.list[0]));
    consoleConnector.type = 'console';
    const connector = service.runNorth(consoleConnector, logger, mockBaseFolders(consoleConnector.id));
    expect(connector).toEqual(mockedNorth1);
  });

  it('runNorth() should run NorthFileWriter', () => {
    const fileWriter = JSON.parse(JSON.stringify(testData.north.list[0]));
    fileWriter.type = 'file-writer';
    const connector = service.runNorth(fileWriter, logger, mockBaseFolders(fileWriter.id));
    expect(connector).toEqual(mockedNorth1);
  });

  it('runNorth() should run NorthOIAnalytics', () => {
    const oianalytics = JSON.parse(JSON.stringify(testData.north.list[0]));
    oianalytics.type = 'oianalytics';
    const connector = service.runNorth(oianalytics, logger, mockBaseFolders(oianalytics.id));
    expect(connector).toEqual(mockedNorth1);
  });

  it('runNorth() should run NorthSFTP', () => {
    const sftp = JSON.parse(JSON.stringify(testData.north.list[0]));
    sftp.type = 'sftp';
    const connector = service.runNorth(sftp, logger, mockBaseFolders(sftp.id));
    expect(connector).toEqual(mockedNorth1);
  });

  it('runNorth() should not run connector if bad type', () => {
    const bad = JSON.parse(JSON.stringify(testData.north.list[0]));
    bad.type = 'bad';
    expect(() => service.runNorth(bad, logger, mockBaseFolders(bad.id))).toThrow('North connector of type bad not installed');
  });

  it('runNorth() should not run connector if bad type and no folders', () => {
    const bad = JSON.parse(JSON.stringify(testData.north.list[0]));
    bad.type = 'bad';
    expect(() => service.runNorth(bad, logger)).toThrow('North connector of type bad not installed');
  });

  it('testNorth() should test North connector in creation mode', async () => {
    service.runNorth = jest.fn().mockReturnValue(mockedNorth1);
    await service.testNorth('create', testData.north.command, logger);
    expect(service.runNorth).toHaveBeenCalled();
    expect(mockedNorth1.testConnection).toHaveBeenCalled();
  });

  it('testNorth() should throw an error if manifest type is bad', async () => {
    service.runNorth = jest.fn();
    const badCommand = JSON.parse(JSON.stringify(testData.north.command));
    badCommand.type = 'bad';
    await expect(service.testNorth('create', badCommand, logger)).rejects.toThrow('North manifest bad not found');
    expect(service.runNorth).not.toHaveBeenCalled();
  });

  it('testNorth() should test North connector in edit mode', async () => {
    service.runNorth = jest.fn().mockReturnValue(mockedNorth1);
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    await service.testNorth(testData.north.list[0].id, testData.north.command, logger);
    expect(service.runNorth).toHaveBeenCalled();
    expect(mockedNorth1.testConnection).toHaveBeenCalled();
  });

  it('testNorth() should fail to test North connector in edit mode if north connector not found', async () => {
    service.runNorth = jest.fn().mockReturnValue(mockedNorth1);
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.testNorth(testData.north.list[0].id, testData.north.command, logger)).rejects.toThrow(
      `North connector ${testData.north.list[0].id} not found`
    );
    expect(service.runNorth).not.toHaveBeenCalled();
  });

  it('createNorth() should not create North if manifest is not found', async () => {
    service.runNorth = jest.fn();
    const badCommand = JSON.parse(JSON.stringify(testData.north.command));
    badCommand.type = 'bad';
    await expect(service.createNorth(badCommand, null)).rejects.toThrow('North manifest does not exist for type bad');
    expect(northConnectorRepository.saveNorthConnector).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
    expect(dataStreamEngine.createNorth).not.toHaveBeenCalled();
  });

  it('createNorth() should create North connector', async () => {
    service.runNorth = jest.fn().mockReturnValue(mockedNorth1);
    (scanModeRepository.findAll as jest.Mock).mockReturnValue(testData.scanMode.list);
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValue(
      testData.south.list.map(element => ({
        id: element.id,
        name: element.name,
        type: element.type,
        description: element.description,
        enabled: element.enabled
      }))
    );
    await service.createNorth(testData.north.command, null);
    expect(northConnectorRepository.saveNorthConnector).toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
    expect(createBaseFolders).toHaveBeenCalledTimes(1);
    expect(dataStreamEngine.createNorth).toHaveBeenCalledWith(mockedNorth1);
    expect(dataStreamEngine.startNorth).toHaveBeenCalled();
  });

  it('createNorth() should not create North connector if subscription not found', async () => {
    service.runNorth = jest.fn().mockReturnValue(mockedNorth1);
    (scanModeRepository.findAll as jest.Mock).mockReturnValue(testData.scanMode.list);
    (southConnectorRepository.findAllSouth as jest.Mock).mockReturnValue(
      testData.south.list.map(element => ({
        id: element.id,
        name: element.name,
        type: element.type,
        description: element.description,
        enabled: element.enabled
      }))
    );
    const command = JSON.parse(JSON.stringify(testData.north.command));
    command.subscriptions = [testData.south.list[0].id, 'bad'];
    await expect(service.createNorth(command, null)).rejects.toThrow(`Could not find South Connector bad`);
  });

  it('should get North data stream', () => {
    service.getNorthDataStream(testData.north.list[0].id);
    expect(dataStreamEngine.getNorthDataStream).toHaveBeenCalledWith(testData.north.list[0].id);
  });

  it('should get error files', async () => {
    await service.getErrorFiles(testData.north.list[0].id, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'filename');
    expect(dataStreamEngine.getErrorFiles).toHaveBeenCalledWith(
      testData.north.list[0].id,
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      'filename'
    );
  });

  it('should get error file content', async () => {
    await service.getErrorFileContent(testData.north.list[0].id, 'filename');
    expect(dataStreamEngine.getErrorFileContent).toHaveBeenCalledWith(testData.north.list[0].id, 'filename');
  });

  it('should remove error files', async () => {
    await service.removeErrorFiles(testData.north.list[0].id, ['filename']);
    expect(dataStreamEngine.removeErrorFiles).toHaveBeenCalledWith(testData.north.list[0].id, ['filename']);
  });

  it('should retry error files', async () => {
    await service.retryErrorFiles(testData.north.list[0].id, ['filename']);
    expect(dataStreamEngine.retryErrorFiles).toHaveBeenCalledWith(testData.north.list[0].id, ['filename']);
  });

  it('should remove all error files', async () => {
    await service.removeAllErrorFiles(testData.north.list[0].id);
    expect(dataStreamEngine.removeAllErrorFiles).toHaveBeenCalledWith(testData.north.list[0].id);
  });

  it('should retry all error files', async () => {
    await service.retryAllErrorFiles(testData.north.list[0].id);
    expect(dataStreamEngine.retryAllErrorFiles).toHaveBeenCalledWith(testData.north.list[0].id);
  });

  it('should get cache files', async () => {
    await service.getCacheFiles(testData.north.list[0].id, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'filename');
    expect(dataStreamEngine.getCacheFiles).toHaveBeenCalledWith(
      testData.north.list[0].id,
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      'filename'
    );
  });

  it('should get cache file content', async () => {
    await service.getCacheFileContent(testData.north.list[0].id, 'filename');
    expect(dataStreamEngine.getCacheFileContent).toHaveBeenCalledWith(testData.north.list[0].id, 'filename');
  });

  it('should remove cache files', async () => {
    await service.removeCacheFiles(testData.north.list[0].id, ['filename']);
    expect(dataStreamEngine.removeCacheFiles).toHaveBeenCalledWith(testData.north.list[0].id, ['filename']);
  });

  it('should archive cache files', async () => {
    await service.archiveCacheFiles(testData.north.list[0].id, ['filename']);
    expect(dataStreamEngine.archiveCacheFiles).toHaveBeenCalledWith(testData.north.list[0].id, ['filename']);
  });

  it('should remove all cache files', async () => {
    await service.removeAllCacheFiles(testData.north.list[0].id);
    expect(dataStreamEngine.removeAllCacheFiles).toHaveBeenCalledWith(testData.north.list[0].id);
  });

  it('should get archive files', async () => {
    await service.getArchiveFiles(testData.north.list[0].id, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'filename');
    expect(dataStreamEngine.getArchiveFiles).toHaveBeenCalledWith(
      testData.north.list[0].id,
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      'filename'
    );
  });

  it('should get archive file content', async () => {
    await service.getArchiveFileContent(testData.north.list[0].id, 'filename');
    expect(dataStreamEngine.getArchiveFileContent).toHaveBeenCalledWith(testData.north.list[0].id, 'filename');
  });

  it('should remove archive files', async () => {
    await service.removeArchiveFiles(testData.north.list[0].id, ['filename']);
    expect(dataStreamEngine.removeArchiveFiles).toHaveBeenCalledWith(testData.north.list[0].id, ['filename']);
  });

  it('should retry archive files', async () => {
    await service.retryArchiveFiles(testData.north.list[0].id, ['filename']);
    expect(dataStreamEngine.retryArchiveFiles).toHaveBeenCalledWith(testData.north.list[0].id, ['filename']);
  });

  it('should remove all archive files', async () => {
    await service.removeAllArchiveFiles(testData.north.list[0].id);
    expect(dataStreamEngine.removeAllArchiveFiles).toHaveBeenCalledWith(testData.north.list[0].id);
  });

  it('should retry all error files', async () => {
    await service.retryAllArchiveFiles(testData.north.list[0].id);
    expect(dataStreamEngine.retryAllArchiveFiles).toHaveBeenCalledWith(testData.north.list[0].id);
  });

  it('should get cache values', async () => {
    await service.getCacheValues(testData.north.list[0].id, 'filename');
    expect(dataStreamEngine.getCacheValues).toHaveBeenCalledWith(testData.north.list[0].id, 'filename');
  });

  it('should remove cache values', async () => {
    await service.removeCacheValues(testData.north.list[0].id, ['filename']);
    expect(dataStreamEngine.removeCacheValues).toHaveBeenCalledWith(testData.north.list[0].id, ['filename']);
  });

  it('should remove all cache values', async () => {
    await service.removeAllCacheValues(testData.north.list[0].id);
    expect(dataStreamEngine.removeAllCacheValues).toHaveBeenCalledWith(testData.north.list[0].id);
  });

  it('should get error values', async () => {
    await service.getErrorValues(testData.north.list[0].id, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2, 'filename');
    expect(dataStreamEngine.getErrorValues).toHaveBeenCalledWith(
      testData.north.list[0].id,
      testData.constants.dates.DATE_1,
      testData.constants.dates.DATE_2,
      'filename'
    );
  });

  it('should remove error values', async () => {
    await service.removeErrorValues(testData.north.list[0].id, ['filename']);
    expect(dataStreamEngine.removeErrorValues).toHaveBeenCalledWith(testData.north.list[0].id, ['filename']);
  });

  it('should retry error values', async () => {
    await service.retryErrorValues(testData.north.list[0].id, ['filename']);
    expect(dataStreamEngine.retryErrorValues).toHaveBeenCalledWith(testData.north.list[0].id, ['filename']);
  });

  it('should remove all error values', async () => {
    await service.removeAllErrorValues(testData.north.list[0].id);
    expect(dataStreamEngine.removeAllErrorValues).toHaveBeenCalledWith(testData.north.list[0].id);
  });

  it('should retry all error values', async () => {
    await service.retryAllErrorValues(testData.north.list[0].id);
    expect(dataStreamEngine.retryAllErrorValues).toHaveBeenCalledWith(testData.north.list[0].id);
  });

  it('should retrieve a list of north manifest', () => {
    const list = service.getInstalledNorthManifests();
    expect(list).toBeDefined();
  });

  it('updateNorth() should update North connector', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    await service.updateNorth(testData.north.list[0].id, testData.north.command);

    expect(northConnectorRepository.saveNorthConnector).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(dataStreamEngine.reloadNorth).toHaveBeenCalledTimes(1);
  });

  it('updateNorth() should throw an error if connector not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.updateNorth(testData.north.list[0].id, testData.north.command)).rejects.toThrow(
      `North connector ${testData.north.list[0].id} does not exist`
    );
    expect(northConnectorRepository.saveNorthConnector).not.toHaveBeenCalled();
  });

  it('updateNorth() should throw an error if connector not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    const command = JSON.parse(JSON.stringify(testData.north.command));
    command.type = 'bad';
    await expect(service.updateNorth(testData.north.list[0].id, command)).rejects.toThrow(`North manifest does not exist for type bad`);
    expect(northConnectorRepository.saveNorthConnector).not.toHaveBeenCalled();
  });

  it('deleteNorth() should delete north', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);

    await service.deleteNorth(testData.north.list[0].id);
    expect(dataStreamEngine.deleteNorth).toHaveBeenCalledWith(testData.north.list[0]);
    expect(northConnectorRepository.deleteNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(logRepository.deleteLogsByScopeId).toHaveBeenCalledWith('north', testData.north.list[0].id);
    expect(northMetricsRepository.removeMetrics).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('deleteNorth() should throw an error if north not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteNorth(testData.north.list[0].id)).rejects.toThrow(
      `North connector ${testData.north.list[0].id} does not exist`
    );
    expect(dataStreamEngine.deleteNorth).not.toHaveBeenCalled();
  });

  it('deleteNorth() should delete even if it fails to remove folders', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (filesExists as jest.Mock).mockReturnValue(true);
    (fs.rm as jest.Mock).mockImplementation(() => {
      throw new Error('rm error');
    });
    await service.deleteNorth(testData.north.list[0].id);
    expect(dataStreamEngine.deleteNorth).toHaveBeenCalled();
    expect(dataStreamEngine.logger.error).toHaveBeenCalledWith(
      `Unable to delete North connector "${testData.north.list[0].name}" (${testData.north.list[0].id}) "cache" base folder: rm error`
    );
  });

  it('startNorth() should start north', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);

    await service.startNorth(testData.north.list[0].id);
    expect(northConnectorRepository.startNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(dataStreamEngine.startNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('startNorth() should throw an error if north not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.startNorth(testData.north.list[0].id)).rejects.toThrow(
      `North connector ${testData.north.list[0].id} does not exist`
    );
    expect(northConnectorRepository.startNorth).not.toHaveBeenCalled();
  });

  it('stopNorth() should stop north', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);

    await service.stopNorth(testData.north.list[0].id);
    expect(northConnectorRepository.stopNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(dataStreamEngine.stopNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('stopNorth() should throw an error if north not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.stopNorth(testData.north.list[0].id)).rejects.toThrow(
      `North connector ${testData.north.list[0].id} does not exist`
    );
    expect(northConnectorRepository.stopNorth).not.toHaveBeenCalled();
  });

  it('findByNorth() should list Subscription by North', async () => {
    (northConnectorRepository.listNorthSubscriptions as jest.Mock).mockReturnValueOnce(testData.north.list[0].subscriptions);
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);

    const result = await service.findSubscriptionsByNorth(testData.north.list[0].id);

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(northConnectorRepository.listNorthSubscriptions).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(result).toEqual(testData.north.list[0].subscriptions);
  });

  it('findByNorth() should throw an error if North not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.findSubscriptionsByNorth(testData.north.list[0].id)).rejects.toThrow('North connector not found');
    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(northConnectorRepository.listNorthSubscriptions).not.toHaveBeenCalled();
  });

  it('checkSubscription() should check if subscription is set', () => {
    (northConnectorRepository.checkSubscription as jest.Mock).mockReturnValueOnce(true);

    expect(service.checkSubscription(testData.north.list[0].id, testData.south.list[0].id)).toEqual(true);

    expect(northConnectorRepository.checkSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
  });

  it('create() should create a subscription', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (northConnectorRepository.checkSubscription as jest.Mock).mockReturnValueOnce(false);

    await service.createSubscription(testData.north.list[0].id, testData.south.list[0].id);

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(northConnectorRepository.checkSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
    expect(northConnectorRepository.createSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('create() should throw if subscription already exists', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (northConnectorRepository.checkSubscription as jest.Mock).mockReturnValueOnce(true);

    await expect(service.createSubscription(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow(
      'Subscription already exists'
    );

    expect(northConnectorRepository.createSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('create() should throw if South not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.createSubscription(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow(
      'South connector not found'
    );

    expect(northConnectorRepository.checkSubscription).not.toHaveBeenCalled();
    expect(northConnectorRepository.createSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('create() should throw if North not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.createSubscription(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow(
      'North connector not found'
    );

    expect(southConnectorRepository.findSouthById).not.toHaveBeenCalled();
    expect(northConnectorRepository.checkSubscription).not.toHaveBeenCalled();
    expect(northConnectorRepository.createSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('delete() should delete a subscription', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);

    await service.deleteSubscription(testData.north.list[0].id, testData.south.list[0].id);

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(northConnectorRepository.deleteSubscription).toHaveBeenCalledWith(testData.north.list[0].id, testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('delete() should throw if South not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteSubscription(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow(
      'South connector not found'
    );

    expect(northConnectorRepository.deleteSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('delete() should throw if North not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteSubscription(testData.north.list[0].id, testData.south.list[0].id)).rejects.toThrow(
      'North connector not found'
    );

    expect(southConnectorRepository.findSouthById).not.toHaveBeenCalled();
    expect(northConnectorRepository.deleteSubscription).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('deleteAllByNorth() should delete all subscriptions by North', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);

    await service.deleteAllSubscriptionsByNorth(testData.north.list[0].id);

    expect(northConnectorRepository.findNorthById).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(northConnectorRepository.deleteAllSubscriptionsByNorth).toHaveBeenCalledWith(testData.north.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('deleteAllByNorth() should throw if North not found', async () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteAllSubscriptionsByNorth(testData.north.list[0].id)).rejects.toThrow('North connector not found');

    expect(northConnectorRepository.deleteAllSubscriptionsByNorth).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
  });

  it('should retrieve secrets from north', () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    const manifest = JSON.parse(JSON.stringify(testData.north.manifest));
    manifest.id = testData.north.list[0].type;
    expect(service.retrieveSecretsFromNorth('northId', manifest)).toEqual(testData.north.list[0]);
  });

  it('should throw error if connector not found when retrieving secrets from north', () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(null);
    expect(() => service.retrieveSecretsFromNorth('northId', testData.north.manifest)).toThrow(
      `Could not find north connector northId to retrieve secrets from`
    );
  });

  it('should throw error if connector not found when retrieving secrets from north', () => {
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValueOnce(testData.north.list[0]);
    expect(() => service.retrieveSecretsFromNorth('northId', testData.north.manifest)).toThrow(
      `North connector northId (type ${testData.north.list[0].type}) must be of the type ${testData.north.manifest.id}`
    );
  });
});
