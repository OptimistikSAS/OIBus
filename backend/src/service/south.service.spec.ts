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
import CertificateRepository from '../repository/config/certificate.repository';
import OIAnalyticsRegistrationRepository from '../repository/config/oianalytics-registration.repository';
import OIAnalyticsRegistrationRepositoryMock from '../tests/__mocks__/repository/config/oianalytics-registration-repository.mock';
import CertificateRepositoryMock from '../tests/__mocks__/repository/config/certificate-repository.mock';
import DataStreamEngine from '../engine/data-stream-engine';
import DataStreamEngineMock from '../tests/__mocks__/data-stream-engine.mock';
import fs from 'node:fs/promises';
import SouthConnectorMock from '../tests/__mocks__/south-connector.mock';
import { createBaseFolders, filesExists } from './utils';
import multer from '@koa/multer';
import csv from 'papaparse';

jest.mock('../south/south-opcua/south-opcua');
jest.mock('./metrics/south-connector-metrics.service');
jest.mock('node:fs/promises');
jest.mock('papaparse');
jest.mock('./utils');

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

const mockedSouth1 = new SouthConnectorMock(testData.south.list[0]);
jest.mock(
  '../south/south-ads/south-ads',
  () =>
    function () {
      return mockedSouth1;
    }
);
jest.mock(
  '../south/south-folder-scanner/south-folder-scanner',
  () =>
    function () {
      return mockedSouth1;
    }
);
jest.mock(
  '../south/south-modbus/south-modbus',
  () =>
    function () {
      return mockedSouth1;
    }
);
jest.mock(
  '../south/south-mqtt/south-mqtt',
  () =>
    function () {
      return mockedSouth1;
    }
);
jest.mock(
  '../south/south-mssql/south-mssql',
  () =>
    function () {
      return mockedSouth1;
    }
);
jest.mock(
  '../south/south-mysql/south-mysql',
  () =>
    function () {
      return mockedSouth1;
    }
);
jest.mock(
  '../south/south-odbc/south-odbc',
  () =>
    function () {
      return mockedSouth1;
    }
);
jest.mock(
  '../south/south-oianalytics/south-oianalytics',
  () =>
    function () {
      return mockedSouth1;
    }
);
jest.mock(
  '../south/south-oledb/south-oledb',
  () =>
    function () {
      return mockedSouth1;
    }
);
jest.mock(
  '../south/south-opc/south-opc',
  () =>
    function () {
      return mockedSouth1;
    }
);
jest.mock(
  '../south/south-opcua/south-opcua',
  () =>
    function () {
      return mockedSouth1;
    }
);
jest.mock(
  '../south/south-oracle/south-oracle',
  () =>
    function () {
      return mockedSouth1;
    }
);
jest.mock(
  '../south/south-pi/south-pi',
  () =>
    function () {
      return mockedSouth1;
    }
);
jest.mock(
  '../south/south-postgresql/south-postgresql',
  () =>
    function () {
      return mockedSouth1;
    }
);
jest.mock(
  '../south/south-sftp/south-sftp',
  () =>
    function () {
      return mockedSouth1;
    }
);
jest.mock(
  '../south/south-slims/south-slims',
  () =>
    function () {
      return mockedSouth1;
    }
);
jest.mock(
  '../south/south-sqlite/south-sqlite',
  () =>
    function () {
      return mockedSouth1;
    }
);

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

  it('runSouth() should run ADS South connector', () => {
    const ads = JSON.parse(JSON.stringify(testData.south.list[0]));
    ads.type = 'ads';
    const connector = service.runSouth(ads, jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toEqual(mockedSouth1);
  });

  it('runSouth() should run FolderScanner South connector', () => {
    const folderScanner = JSON.parse(JSON.stringify(testData.south.list[0]));
    folderScanner.type = 'folder-scanner';
    const connector = service.runSouth(folderScanner, jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toEqual(mockedSouth1);
  });

  it('runSouth() should run Modbus South connector', () => {
    const modbus = JSON.parse(JSON.stringify(testData.south.list[0]));
    modbus.type = 'modbus';
    const connector = service.runSouth(modbus, jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toEqual(mockedSouth1);
  });

  it('runSouth() should run MQTT South connector', () => {
    const mqtt = JSON.parse(JSON.stringify(testData.south.list[0]));
    mqtt.type = 'mqtt';
    const connector = service.runSouth(mqtt, jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toEqual(mockedSouth1);
  });

  it('runSouth() should run MSSQL South connector', () => {
    const mssql = JSON.parse(JSON.stringify(testData.south.list[0]));
    mssql.type = 'mssql';
    const connector = service.runSouth(mssql, jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toEqual(mockedSouth1);
  });

  it('runSouth() should run MySQL South connector', () => {
    const mysql = JSON.parse(JSON.stringify(testData.south.list[0]));
    mysql.type = 'mysql';
    const connector = service.runSouth(mysql, jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toEqual(mockedSouth1);
  });

  it('runSouth() should run ODBC South connector', () => {
    const odbc = JSON.parse(JSON.stringify(testData.south.list[0]));
    odbc.type = 'odbc';
    const connector = service.runSouth(odbc, jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toEqual(mockedSouth1);
  });

  it('runSouth() should run OIAnalytics South connector', () => {
    const oianalytics = JSON.parse(JSON.stringify(testData.south.list[0]));
    oianalytics.type = 'oianalytics';
    const connector = service.runSouth(oianalytics, jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toEqual(mockedSouth1);
  });

  it('runSouth() should run OLEDB South connector', () => {
    const oledb = JSON.parse(JSON.stringify(testData.south.list[0]));
    oledb.type = 'oledb';
    const connector = service.runSouth(oledb, jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toEqual(mockedSouth1);
  });

  it('runSouth() should run OPC South connector', () => {
    const opc = JSON.parse(JSON.stringify(testData.south.list[0]));
    opc.type = 'opc';
    const connector = service.runSouth(opc, jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toEqual(mockedSouth1);
  });

  it('runSouth() should run OPCUA South connector', () => {
    const opcua = JSON.parse(JSON.stringify(testData.south.list[0]));
    opcua.type = 'opcua';
    const connector = service.runSouth(opcua, jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toEqual(mockedSouth1);
  });

  it('runSouth() should run Oracle South connector', () => {
    const oracle = JSON.parse(JSON.stringify(testData.south.list[0]));
    oracle.type = 'oracle';
    const connector = service.runSouth(oracle, jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toEqual(mockedSouth1);
  });

  it('runSouth() should run PI South connector', () => {
    const pi = JSON.parse(JSON.stringify(testData.south.list[0]));
    pi.type = 'osisoft-pi';
    const connector = service.runSouth(pi, jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toEqual(mockedSouth1);
  });

  it('runSouth() should run PostgreSQL South connector', () => {
    const postgresql = JSON.parse(JSON.stringify(testData.south.list[0]));
    postgresql.type = 'postgresql';
    const connector = service.runSouth(postgresql, jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toEqual(mockedSouth1);
  });

  it('runSouth() should run SFTP South connector', () => {
    const sftp = JSON.parse(JSON.stringify(testData.south.list[0]));
    sftp.type = 'sftp';
    const connector = service.runSouth(sftp, jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toEqual(mockedSouth1);
  });

  it('runSouth() should run SLIMS South connector', () => {
    const slims = JSON.parse(JSON.stringify(testData.south.list[0]));
    slims.type = 'slims';
    const connector = service.runSouth(slims, jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toEqual(mockedSouth1);
  });

  it('runSouth() should run SQLite South connector', () => {
    const sqlite = JSON.parse(JSON.stringify(testData.south.list[0]));
    sqlite.type = 'sqlite';
    const connector = service.runSouth(sqlite, jest.fn(), logger, mockBaseFolders(testData.south.list[0].id));
    expect(connector).toEqual(mockedSouth1);
  });

  it('runSouth() should not run connector if bad type', () => {
    const bad = JSON.parse(JSON.stringify(testData.south.list[0]));
    bad.type = 'bad';
    expect(() => service.runSouth(bad, jest.fn(), logger, mockBaseFolders(bad.id))).toThrow('South connector of type bad not installed');
  });

  it('runSouth() should not run connector if bad type and no folders', () => {
    const bad = JSON.parse(JSON.stringify(testData.south.list[0]));
    bad.type = 'bad';
    expect(() => service.runSouth(bad, jest.fn(), logger)).toThrow('South connector of type bad not installed');
  });

  it('testSouth() should test South connector in creation mode', async () => {
    service.runSouth = jest.fn().mockReturnValue(mockedSouth1);
    await service.testSouth('create', testData.south.command, logger);
    expect(service.runSouth).toHaveBeenCalled();
    expect(mockedSouth1.testConnection).toHaveBeenCalled();
  });

  it('testSouth() should throw an error if manifest type is bad', async () => {
    service.runSouth = jest.fn();
    const badCommand = JSON.parse(JSON.stringify(testData.south.command));
    badCommand.type = 'bad';
    await expect(service.testSouth('create', badCommand, logger)).rejects.toThrow('South manifest bad not found');
    expect(service.runSouth).not.toHaveBeenCalled();
  });

  it('testSouth() should test South connector in edit mode', async () => {
    service.runSouth = jest.fn().mockReturnValue(mockedSouth1);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    await service.testSouth(testData.south.list[0].id, testData.south.command, logger);
    expect(service.runSouth).toHaveBeenCalled();
    expect(mockedSouth1.testConnection).toHaveBeenCalled();
  });

  it('testSouth() should fail to test South connector in edit mode if south connector not found', async () => {
    service.runSouth = jest.fn().mockReturnValue(mockedSouth1);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.testSouth(testData.south.list[0].id, testData.south.command, logger)).rejects.toThrow(
      `South connector ${testData.south.list[0].id} not found`
    );
    expect(service.runSouth).not.toHaveBeenCalled();
  });

  it('testSouthItem() should test South connector in creation mode', async () => {
    const callback = jest.fn();
    service.runSouth = jest.fn().mockReturnValue(mockedSouth1);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await service.testSouthItem('create', testData.south.command, itemCommand, callback, logger);
    expect(service.runSouth).toHaveBeenCalled();
    expect(mockedSouth1.testItem).toHaveBeenCalled();
  });

  it('testSouthItem() should throw an error if manifest type is bad', async () => {
    const callback = jest.fn();
    service.runSouth = jest.fn();
    const badCommand = JSON.parse(JSON.stringify(testData.south.command));
    badCommand.type = 'bad';
    await expect(service.testSouthItem('create', badCommand, testData.south.itemCommand, callback, logger)).rejects.toThrow(
      'South manifest bad not found'
    );
    expect(service.runSouth).not.toHaveBeenCalled();
  });

  it('testSouthItem() should test South connector in edit mode', async () => {
    const callback = jest.fn();
    service.runSouth = jest.fn().mockReturnValue(mockedSouth1);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await service.testSouthItem(testData.south.list[0].id, testData.south.command, itemCommand, callback, logger);
    expect(service.runSouth).toHaveBeenCalled();
    expect(mockedSouth1.testItem).toHaveBeenCalled();
  });

  it('testSouthItem() should fail to test South connector in edit mode if south connector not found', async () => {
    const callback = jest.fn();
    service.runSouth = jest.fn().mockReturnValue(mockedSouth1);
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);
    await expect(
      service.testSouthItem(testData.south.list[0].id, testData.south.command, testData.south.itemCommand, callback, logger)
    ).rejects.toThrow(`South connector ${testData.south.list[0].id} not found`);
    expect(service.runSouth).not.toHaveBeenCalled();
  });

  it('should retrieve a list of south manifest', () => {
    const list = service.getInstalledSouthManifests();
    expect(list).toBeDefined();
  });

  it('createSouth() should not create South if manifest is not found', async () => {
    service.runSouth = jest.fn();
    const badCommand = JSON.parse(JSON.stringify(testData.south.command));
    badCommand.type = 'bad';
    await expect(service.createSouth(badCommand)).rejects.toThrow('South manifest does not exist for type bad');
    expect(southConnectorRepository.saveSouthConnector).not.toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).not.toHaveBeenCalled();
    expect(dataStreamEngine.createSouth).not.toHaveBeenCalled();
  });

  it('createSouth() should create South connector', async () => {
    service.runSouth = jest.fn().mockReturnValue(mockedSouth1);
    (scanModeRepository.findAll as jest.Mock).mockReturnValue(testData.scanMode.list);
    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.items = [
      {
        id: null,
        enabled: false,
        name: 'item',
        settings: {
          regex: '*',
          preserveFiles: true,
          ignoreModifiedDate: false,
          minAge: 100
        },
        scanModeId: 'scanModeId',
        scanModeName: null
      }
    ];
    await service.createSouth(command);
    expect(southConnectorRepository.saveSouthConnector).toHaveBeenCalled();
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
    expect(createBaseFolders).toHaveBeenCalledTimes(1);
    expect(dataStreamEngine.createSouth).toHaveBeenCalledWith(mockedSouth1);
    expect(dataStreamEngine.startSouth).toHaveBeenCalled();
  });

  it('should get South data stream', () => {
    service.getSouthDataStream(testData.south.list[0].id);
    expect(dataStreamEngine.getSouthDataStream).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('updateSouth() should update South connector', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.items = [
      {
        id: null,
        enabled: false,
        name: 'item',
        settings: {
          regex: '*',
          preserveFiles: true,
          ignoreModifiedDate: false,
          minAge: 100
        },
        scanModeId: 'scanModeId',
        scanModeName: null
      }
    ];
    await service.updateSouth(testData.south.list[0].id, command);

    expect(southConnectorRepository.saveSouthConnector).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(dataStreamEngine.reloadSouth).toHaveBeenCalledTimes(1);
  });

  it('updateSouth() should throw an error if connector not found', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.updateSouth(testData.south.list[0].id, testData.south.command)).rejects.toThrow(
      `South connector ${testData.south.list[0].id} does not exist`
    );
    expect(southConnectorRepository.saveSouthConnector).not.toHaveBeenCalled();
  });

  it('updateSouth() should throw an error if connector not found', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    const command = JSON.parse(JSON.stringify(testData.south.command));
    command.type = 'bad';
    await expect(service.updateSouth(testData.south.list[0].id, command)).rejects.toThrow(`South manifest does not exist for type bad`);
    expect(southConnectorRepository.saveSouthConnector).not.toHaveBeenCalled();
  });

  it('deleteSouth() should delete south', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);

    await service.deleteSouth(testData.south.list[0].id);
    expect(dataStreamEngine.deleteSouth).toHaveBeenCalledWith(testData.south.list[0]);
    expect(southConnectorRepository.deleteSouth).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(logRepository.deleteLogsByScopeId).toHaveBeenCalledWith('south', testData.south.list[0].id);
    expect(southMetricsRepository.removeMetrics).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('deleteSouth() should throw an error if south not found', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteSouth(testData.south.list[0].id)).rejects.toThrow(
      `South connector ${testData.south.list[0].id} does not exist`
    );
    expect(dataStreamEngine.deleteSouth).not.toHaveBeenCalled();
  });

  it('deleteSouth() should delete even if it fails to remove folders', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (filesExists as jest.Mock).mockReturnValue(true);
    (fs.rm as jest.Mock).mockImplementation(() => {
      throw new Error('rm error');
    });
    await service.deleteSouth(testData.south.list[0].id);
    expect(dataStreamEngine.deleteSouth).toHaveBeenCalled();
    expect(dataStreamEngine.logger.error).toHaveBeenCalledWith(
      `Unable to delete South connector "${testData.south.list[0].name}" (${testData.south.list[0].id}) "cache" base folder: rm error`
    );
  });

  it('startSouth() should start south', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);

    await service.startSouth(testData.south.list[0].id);
    expect(southConnectorRepository.start).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(dataStreamEngine.startSouth).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('startSouth() should throw an error if south not found', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.startSouth(testData.south.list[0].id)).rejects.toThrow(
      `South connector ${testData.south.list[0].id} does not exist`
    );
    expect(southConnectorRepository.start).not.toHaveBeenCalled();
  });

  it('stopSouth() should stop south', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);

    await service.stopSouth(testData.south.list[0].id);
    expect(southConnectorRepository.stop).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(dataStreamEngine.stopSouth).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalled();
  });

  it('stopSouth() should throw an error if south not found', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.stopSouth(testData.south.list[0].id)).rejects.toThrow(
      `South connector ${testData.south.list[0].id} does not exist`
    );
    expect(southConnectorRepository.stop).not.toHaveBeenCalled();
  });

  it('searchSouthItems() should search south items', () => {
    service.searchSouthItems(testData.south.list[0].id, {});
    expect(southConnectorRepository.searchItems).toHaveBeenCalledWith(testData.south.list[0].id, {});
  });

  it('findSouthConnectorItemById() should find an item by id', () => {
    service.findSouthConnectorItemById(testData.south.list[0].id, testData.south.list[0].items[0].id);
    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, testData.south.list[0].items[0].id);
  });

  it('createItem() should create an item', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await service.createItem(testData.south.list[0].id, itemCommand);
    expect(southConnectorRepository.findSouthById).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(southConnectorRepository.saveItem).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(dataStreamEngine.reloadItems).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('createItem() should throw an error if connector does not exist', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.createItem(testData.south.list[0].id, itemCommand)).rejects.toThrow(
      `South connector ${testData.south.list[0].id} does not exist`
    );
  });

  it('createItem() should throw an error if manifest is not found', async () => {
    const badSouth = JSON.parse(JSON.stringify(testData.south.list[0]));
    badSouth.type = 'bad';
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(badSouth);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.createItem(testData.south.list[0].id, itemCommand)).rejects.toThrow(`South manifest does not exist for type bad`);
  });

  it('updateItem() should update an item', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(testData.south.list[0].items[0]);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await service.updateItem(testData.south.list[0].id, 'itemId', itemCommand);
    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, 'itemId');
    expect(southConnectorRepository.saveItem).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(dataStreamEngine.reloadItems).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('updateItem() should throw an error if item does not exist', async () => {
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(null);
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.updateItem(testData.south.list[0].id, 'itemId', itemCommand)).rejects.toThrow(
      `South item with ID itemId does not exist`
    );
  });

  it('updateItem() should throw an error if manifest is not found', async () => {
    const badSouth = JSON.parse(JSON.stringify(testData.south.list[0]));
    badSouth.type = 'bad';
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(badSouth);
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(testData.south.list[0].items[0]);

    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    await expect(service.updateItem(testData.south.list[0].id, 'itemId', itemCommand)).rejects.toThrow(
      `South manifest does not exist for type bad`
    );
  });

  it('deleteItem() should delete an item', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(testData.south.list[0].items[0]);
    await service.deleteItem(testData.south.list[0].id, 'itemId');
    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, 'itemId');
    expect(southConnectorRepository.deleteItem).toHaveBeenCalledWith(testData.south.list[0].items[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(dataStreamEngine.reloadItems).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('deleteItem() should throw an error if item does not exist', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteItem(testData.south.list[0].id, 'itemId')).rejects.toThrow(`South item itemId not found`);
  });

  it('deleteItem() should throw an error if connector does not exist', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteItem(testData.south.list[0].id, 'itemId')).rejects.toThrow(
      `South connector ${testData.south.list[0].id} does not exist`
    );
  });

  it('deleteAllItemsForSouthConnector() should delete all items', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);
    await service.deleteAllItemsForSouthConnector(testData.south.list[0].id);
    expect(southConnectorRepository.deleteAllItemsBySouth).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(southCacheRepository.deleteAllBySouthConnector).toHaveBeenCalledWith(testData.south.list[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(dataStreamEngine.reloadItems).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('deleteAllItemsForSouthConnector() should throw an error if connector does not exist', async () => {
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.deleteAllItemsForSouthConnector(testData.south.list[0].id)).rejects.toThrow(
      `South connector ${testData.south.list[0].id} does not exist`
    );
  });

  it('enableItem() should enable an item', async () => {
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(testData.south.list[0].items[0]);
    await service.enableItem(testData.south.list[0].id, 'itemId');
    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, 'itemId');
    expect(southConnectorRepository.enableItem).toHaveBeenCalledWith(testData.south.list[0].items[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(dataStreamEngine.reloadItems).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('enableItem() should throw an error if item is not found', async () => {
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.enableItem(testData.south.list[0].id, 'itemId')).rejects.toThrow('South item itemId not found');
  });

  it('disableItem() should enable an item', async () => {
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(testData.south.list[0].items[0]);
    await service.disableItem(testData.south.list[0].id, 'itemId');
    expect(southConnectorRepository.findItemById).toHaveBeenCalledWith(testData.south.list[0].id, 'itemId');
    expect(southConnectorRepository.disableItem).toHaveBeenCalledWith(testData.south.list[0].items[0].id);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(dataStreamEngine.reloadItems).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('disableItem() should throw an error if item is not found', async () => {
    (southConnectorRepository.findItemById as jest.Mock).mockReturnValueOnce(null);
    await expect(service.disableItem(testData.south.list[0].id, 'itemId')).rejects.toThrow('South item itemId not found');
  });

  it('checkCsvImport() should properly parse csv and check items', async () => {
    const csvData = [
      {
        name: 'item1',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        scanMode: testData.scanMode.list[0].name
      },
      {
        name: 'item2bis',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        scanMode: 'bad scan mode'
      },
      {
        name: 'item3',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        settings_badItem: 100,
        scanMode: testData.scanMode.list[0].name
      },
      {
        name: 'item4',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 12, // bad type
        settings_minAge: 100,
        scanMode: testData.scanMode.list[0].name
      },
      {
        name: 'item5',
        enabled: 'true',
        settings_regex: '*',
        settings_preserveFiles: 'true',
        settings_ignoreModifiedDate: 'false',
        settings_minAge: 100,
        scanMode: testData.scanMode.list[0].name
      }
    ];
    (fs.readFile as jest.Mock).mockReturnValueOnce('file content');
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ',' },
      data: csvData
    });
    const result = await service.checkCsvImport(
      testData.south.list[0].type,
      { path: 'file/path.csv' } as multer.File,
      ',',
      testData.south.list[0].items
    );
    expect(result).toEqual({
      items: [
        {
          id: '',
          name: csvData[4].name,
          enabled: csvData[4].enabled.toLowerCase() === 'true',
          scanModeId: 'scanModeId1',
          scanModeName: null,
          settings: {
            ignoreModifiedDate: 'false',
            minAge: 100,
            preserveFiles: 'true',
            regex: '*'
          }
        }
      ],
      errors: [
        {
          error: 'Item name "item1" already used',
          item: {
            id: '',
            name: csvData[0].name,
            enabled: csvData[0].enabled.toLowerCase() === 'true',
            scanModeId: null,
            scanModeName: null,
            settings: {}
          }
        },
        {
          error: 'Scan mode "bad scan mode" not found for item item2bis',
          item: {
            id: '',
            name: csvData[1].name,
            enabled: csvData[1].enabled.toLowerCase() === 'true',
            scanModeId: null,
            scanModeName: null,
            settings: {}
          }
        },
        {
          error: 'Settings "badItem" not accepted in manifest',
          item: {
            id: '',
            name: csvData[2].name,
            enabled: csvData[2].enabled.toLowerCase() === 'true',
            scanModeId: 'scanModeId1',
            scanModeName: null,
            settings: {}
          }
        },
        {
          error: '"ignoreModifiedDate" must be a boolean',
          item: {
            id: '',
            name: csvData[3].name,
            enabled: csvData[3].enabled.toLowerCase() === 'true',
            scanModeId: 'scanModeId1',
            scanModeName: null,
            settings: {
              ignoreModifiedDate: 12,
              minAge: 100,
              preserveFiles: 'true',
              regex: '*'
            }
          }
        }
      ]
    });
  });

  it('checkCsvImport() should properly parse csv and check items with array or object', async () => {
    const csvData = [
      {
        name: 'item',
        enabled: 'true',
        settings_query: 'SELECT * FROM table',
        settings_dateTimeFields: '[]',
        settings_serialization: JSON.stringify({
          type: 'csv',
          filename: 'filename',
          delimiter: 'SEMI_COLON',
          compression: true,
          outputTimestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
          outputTimezone: 'Europe/Paris'
        }),
        scanMode: testData.scanMode.list[0].name
      }
    ];
    (fs.readFile as jest.Mock).mockReturnValueOnce('file content');
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ',' },
      data: csvData
    });
    const result = await service.checkCsvImport(
      testData.south.list[1].type,
      { path: 'file/path.csv' } as multer.File,
      ',',
      testData.south.list[1].items
    );
    expect(result).toEqual({
      items: [
        {
          id: '',
          name: csvData[0].name,
          enabled: csvData[0].enabled.toLowerCase() === 'true',
          scanModeId: 'scanModeId1',
          scanModeName: null,
          settings: {
            query: 'SELECT * FROM table',
            dateTimeFields: [],
            serialization: {
              type: 'csv',
              filename: 'filename',
              delimiter: 'SEMI_COLON',
              compression: true,
              outputTimestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
              outputTimezone: 'Europe/Paris'
            }
          }
        }
      ],
      errors: []
    });
  });

  it('checkCsvImport() should throw error if manifest not found', async () => {
    await expect(
      service.checkCsvImport('bad', { path: 'file/path.csv' } as multer.File, ',', testData.south.list[0].items)
    ).rejects.toThrow(`South manifest does not exist for type bad`);
  });

  it('checkCsvImport() should throw error if delimiter does not match', async () => {
    (fs.readFile as jest.Mock).mockReturnValueOnce('file content');
    (csv.parse as jest.Mock).mockReturnValueOnce({
      meta: { delimiter: ';' },
      data: []
    });

    await expect(
      service.checkCsvImport(testData.south.list[0].type, { path: 'file/path.csv' } as multer.File, ',', testData.south.list[0].items)
    ).rejects.toThrow(`The entered delimiter "," does not correspond to the file delimiter ";"`);
  });

  it('importItems() should import items', async () => {
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(testData.south.list[0]);

    await service.importItems(testData.south.list[0].id, [itemCommand]);
    expect(southConnectorRepository.saveAllItems).toHaveBeenCalledTimes(1);
    expect(oIAnalyticsMessageService.createFullConfigMessageIfNotPending).toHaveBeenCalledTimes(1);
    expect(dataStreamEngine.reloadItems).toHaveBeenCalledWith(testData.south.list[0].id);
  });

  it('importItems() should import items', async () => {
    const itemCommand = JSON.parse(JSON.stringify(testData.south.itemCommand));
    itemCommand.settings = {
      regex: '*',
      preserveFiles: true,
      ignoreModifiedDate: false,
      minAge: 100
    };
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValueOnce(null);

    await expect(service.importItems(testData.south.list[0].id, [itemCommand])).rejects.toThrow(
      `South connector ${testData.south.list[0].id} does not exist`
    );
  });
});
