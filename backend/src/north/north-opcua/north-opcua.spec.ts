import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import ConnectionServiceMock from '../../tests/__mocks__/service/connection-service.mock';
import nodeOPCUAMock from '../../tests/__mocks__/node-opcua.mock';
import fs from 'node:fs/promises';
import NorthOPCUA from './north-opcua';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import csv from 'papaparse';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthOPCUASettings } from '../../../shared/model/north-settings.model';
import { createSessionConfigs, initOPCUACertificateFolders, toOPCUASecurityMode, toOPCUASecurityPolicy } from '../../service/utils-opcua';
import { AttributeIds, ClientSession, DataType, OPCUAClient, resolveNodeId } from 'node-opcua';
import CacheService from '../../service/cache/cache.service';
import TransformerService, { createTransformer } from '../../service/transformer.service';
import TransformerServiceMock from '../../tests/__mocks__/service/transformer-service.mock';
import OIBusTransformer from '../../service/transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import testData from '../../tests/utils/test-data';
import { mockBaseFolders } from '../../tests/utils/test-utils';
import { randomUUID } from 'crypto';
import { OIBusOPCUAValue } from '../../service/transformers/connector-types.model';
import { connectionService } from '../../service/connection.service';

// Mock node-opcua-client
jest.mock('node-opcua', () => ({
  ...nodeOPCUAMock,
  DataType: jest.requireActual('node-opcua').DataType
}));
// Mock only the randomUUID function because other functions are used by OPCUA
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn()
}));
jest.mock('node:fs/promises');
jest.mock('../../service/encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));
jest.mock('../../service/connection.service', () => ({
  connectionService: new ConnectionServiceMock('', '')
}));

const logger: pino.Logger = new PinoLogger();
const northConnectorRepository: NorthConnectorRepository = new NorthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const cacheService: CacheService = new CacheServiceMock();
const transformerService: TransformerService = new TransformerServiceMock();
const oiBusTransformer: OIBusTransformer = new OIBusTransformerMock() as unknown as OIBusTransformer;

jest.mock(
  '../../service/cache/cache.service',
  () =>
    function () {
      return cacheService;
    }
);
jest.mock('../../service/utils');
jest.mock('../../service/utils-opcua');
jest.mock('../../service/transformer.service');
jest.mock('papaparse');

const opcuaOptions = {
  applicationName: 'OIBus',
  clientName: 'connectorName-connectorId',
  connectionStrategy: {
    initialDelay: 1000,
    maxRetry: 1
  },
  securityMode: 1,
  securityPolicy: 'none',
  endpointMustExist: false,
  keepSessionAlive: false,
  keepPendingSessionsOnDisconnect: false,
  requestedSessionTimeout: 15000,
  clientCertificateManager: { state: 2 }
};
const opcuaUserIdentity = { type: 0 };

describe('NorthOPCUA', () => {
  let configuration: NorthConnectorEntity<NorthOPCUASettings>;
  let north: NorthOPCUA;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      sharedConnection: null,
      retryInterval: 10_000,
      connectionSettings: {
        url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
        keepSessionAlive: false,
        authentication: {
          type: 'none',
          password: null
        },
        securityMode: 'none',
        securityPolicy: 'none'
      }
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
    (csv.unparse as jest.Mock).mockReturnValue('csv content');
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    (toOPCUASecurityPolicy as jest.Mock).mockReturnValue('none');
    (toOPCUASecurityMode as jest.Mock).mockReturnValue(1);
    (createSessionConfigs as jest.Mock).mockReturnValue({ options: opcuaOptions, userIdentity: opcuaUserIdentity });

    north = new NorthOPCUA(
      configuration,
      transformerService,
      northConnectorRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(testData.north.list[0].id)
    );
    north.createCronJob = jest.fn();
  });

  it('should properly connect', async () => {
    await north.start();
    await north.start();
    expect(initOPCUACertificateFolders).toHaveBeenCalledTimes(2);
    expect(initOPCUACertificateFolders).toHaveBeenCalledWith(north['baseFolders'].cache);
    expect(OPCUAClient.createSession).toHaveBeenCalledTimes(1);
    expect(OPCUAClient.createSession).toHaveBeenCalledWith(
      configuration.settings.connectionSettings!.url,
      { type: 0 },
      {
        applicationName: 'OIBus',
        clientName: 'connectorName-connectorId',
        clientCertificateManager: { state: 2 },
        connectionStrategy: { initialDelay: 1000, maxRetry: 1 },
        endpointMustExist: false,
        keepPendingSessionsOnDisconnect: false,
        keepSessionAlive: false,
        requestedSessionTimeout: 15000,
        securityMode: 1,
        securityPolicy: 'none'
      }
    );
  });

  it('should reconnect if disconnecting', async () => {
    north.getSession = jest.fn().mockImplementation(() => {
      throw new Error('get session error');
    });
    north.disconnect = jest.fn();
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    north['disconnecting'] = false;
    await north.connect();
    expect(logger.error).toHaveBeenCalledWith('Error while connecting to the OPCUA server: get session error');
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), configuration.settings.retryInterval);
    expect(clearTimeoutSpy).not.toHaveBeenCalled();
    expect(north.disconnect).toHaveBeenCalled();
  });

  it('should not reconnect if disconnecting', async () => {
    north['reconnectTimeout'] = setTimeout(() => null);
    north.getSession = jest.fn().mockImplementation(() => {
      throw new Error('get session error');
    });
    north.disconnect = jest.fn();
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    north['disconnecting'] = true;
    await north.connect();
    expect(logger.error).toHaveBeenCalledWith('Error while connecting to the OPCUA server: get session error');
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(north.disconnect).toHaveBeenCalled();
  });

  it('should close session', async () => {
    await north.closeSession();
    const client = { close: jest.fn() } as unknown as ClientSession;
    north['client'] = client;
    await north.closeSession();
    expect(client.close).toHaveBeenCalledTimes(1);
  });

  it('should handle content', async () => {
    const values: Array<OIBusOPCUAValue> = [
      {
        nodeId: 'nodeId1',
        value: 123
      },
      {
        nodeId: 'nodeId2',
        value: 456
      },
      {
        nodeId: 'nodeId3',
        value: 789
      },
      {
        nodeId: 'nodeId4',
        value: 321
      }
    ];
    (fs.readFile as jest.Mock).mockReturnValueOnce(JSON.stringify(values));

    (resolveNodeId as jest.Mock)
      .mockImplementationOnce(node => node)
      .mockImplementationOnce(node => node)
      .mockImplementationOnce(node => node)
      .mockImplementationOnce(() => {
        throw new Error('bad node id');
      });

    const readFn = jest
      .fn()
      .mockReturnValueOnce({ value: { value: { value: DataType.Int32 } } })
      .mockReturnValueOnce({ value: { value: { value: DataType.Int32 } } })
      .mockReturnValueOnce({ value: { value: { value: 'bad data type' } } });
    const writeFn = jest
      .fn()
      .mockReturnValueOnce({ isGood: jest.fn().mockReturnValueOnce(true) })
      .mockReturnValueOnce({ isGood: jest.fn().mockReturnValueOnce(false), name: 'error' });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    north['client'] = {
      write: writeFn,
      read: readFn
    };

    await north.handleContent({
      contentFile: 'path/to/file/example-123456789.json',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'opcua',
      source: 'south',
      options: {}
    });

    expect(resolveNodeId).toHaveBeenCalledTimes(4);
    expect(logger.error).toHaveBeenCalledWith(`Error when parsing node ID nodeId4: bad node id`);

    expect(readFn).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenCalledWith(`Invalid data type for node ID nodeId3`);
    expect(readFn).toHaveBeenCalledWith({
      nodeId: 'nodeId1',
      attributeId: AttributeIds.DataType
    });

    expect(writeFn).toHaveBeenCalledTimes(2);
    expect(writeFn).toHaveBeenCalledWith({
      nodeId: values[0].nodeId,
      attributeId: AttributeIds.Value,
      value: {
        value: {
          dataType: DataType.Int32,
          value: values[0].value
        }
      }
    });
    expect(writeFn).toHaveBeenCalledWith({
      nodeId: values[1].nodeId,
      attributeId: AttributeIds.Value,
      value: {
        value: {
          dataType: DataType.Int32,
          value: values[1].value
        }
      }
    });

    expect(logger.trace).toHaveBeenCalledWith(`Value ${values[0].value} written successfully on nodeId ${values[0].nodeId}`);
    expect(logger.error).toHaveBeenCalledWith(`Failed to write value ${values[1].value} on nodeId ${values[1].nodeId}: error`);
  });

  it('should manage handle content errors', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const values: Array<OIBusOPCUAValue> = [
      {
        nodeId: 'nodeId1',
        value: 123
      },
      {
        nodeId: 'nodeId2',
        value: 456
      }
    ];
    (fs.readFile as jest.Mock).mockReturnValueOnce(JSON.stringify(values)).mockReturnValueOnce(JSON.stringify([values[0]]));

    (resolveNodeId as jest.Mock)
      .mockImplementationOnce(node => node)
      .mockImplementationOnce(node => node)
      .mockImplementationOnce(node => node);

    const readFn = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('BadAttributeIdInvalid');
      })
      .mockImplementationOnce(() => {
        throw new Error('another error1');
      })
      .mockImplementationOnce(() => {
        throw new Error('another error2');
      });
    const writeFn = jest.fn();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    north['client'] = {
      write: writeFn,
      read: readFn
    };
    north.disconnect = jest.fn();

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example-123456789.json',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'opcua',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new Error('another error1'));

    expect(logger.error).toHaveBeenCalledWith(`Write error on nodeId nodeId1: BadAttributeIdInvalid`);

    expect(north.disconnect).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(`Unexpected error on nodeId nodeId2: another error1`);

    north['connector'].enabled = false;

    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example-123456789.json',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'opcua',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(new Error('another error2'));
    expect(logger.error).toHaveBeenCalledWith(`Unexpected error on nodeId nodeId1: another error2`);
    expect(north.disconnect).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should throw error if client is not set when handling content', async () => {
    (fs.readFile as jest.Mock).mockReturnValueOnce('[{}]');
    await north.handleContent({
      contentFile: 'path/to/file/example-123456789.json',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'opcua',
      source: 'south',
      options: {}
    });
    expect(logger.error).toHaveBeenCalledWith(`OPCUA session not set. The connector cannot write values`);
  });

  it('should ignore data if bad content type', async () => {
    await expect(
      north.handleContent({
        contentFile: 'path/to/file/example-123456789.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'any',
        source: 'south',
        options: {}
      })
    ).rejects.toThrow(`Unsupported data type: any (file path/to/file/example-123456789.file)`);
  });
});

describe('NorthOPCUA test connection', () => {
  let north: NorthOPCUA;
  let configuration: NorthConnectorEntity<NorthOPCUASettings>;

  // Mock UUID
  const uuid = 'test-uuid';
  (randomUUID as jest.Mock).mockReturnValue(uuid);

  class FileError extends Error {
    public code: string;
    public path: string;

    constructor(message: string, code = '', path = '') {
      super();
      this.name = 'FileError';
      this.message = message;
      this.code = code;
      this.path = path;
    }
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime();

    (toOPCUASecurityPolicy as jest.Mock).mockReturnValue('none');
    (toOPCUASecurityMode as jest.Mock).mockReturnValue(1);
    (createSessionConfigs as jest.Mock).mockReturnValue({ options: opcuaOptions, userIdentity: opcuaUserIdentity });

    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      sharedConnection: null,
      retryInterval: 10_000,
      connectionSettings: {
        url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
        authentication: {
          type: 'none',
          password: null
        },
        securityMode: 'sign-and-encrypt',
        securityPolicy: 'none',
        keepSessionAlive: false
      }
    };

    north = new NorthOPCUA(
      configuration,
      transformerService,
      northConnectorRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(testData.north.list[0].id)
    );
  });

  it('Connection settings are correct', async () => {
    const close = jest.fn();
    (OPCUAClient.createSession as jest.Mock).mockReturnValue({ close });

    await expect(north.testConnection()).resolves.not.toThrow();

    expect(initOPCUACertificateFolders).toHaveBeenCalledTimes(1);
    expect(initOPCUACertificateFolders).toHaveBeenCalledWith('opcua-test-test-uuid');
    expect(close).toHaveBeenCalled();
  });

  it('Certificate file does not exist', async () => {
    configuration.settings.connectionSettings!.authentication = {
      type: 'cert',
      certFilePath: 'myCertPath',
      keyFilePath: 'myKeyPath',
      username: '',
      password: ''
    };
    const error = new FileError('Wrong file', 'ENOENT', './foo/bar');
    (fs.readFile as jest.Mock)
      .mockImplementationOnce(() => Buffer.from('cert content'))
      .mockImplementationOnce(() => Buffer.from('key content'));
    (OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(new Error(`Wrong file`));
  });

  it('Failed to read private key', async () => {
    configuration.settings.connectionSettings!.authentication = {
      type: 'cert',
      certFilePath: 'myCertPath',
      keyFilePath: 'myKeyPath',
      username: '',
      password: ''
    };
    const error = new Error('Failed to read private key');
    (fs.readFile as jest.Mock)
      .mockImplementationOnce(() => Buffer.from('cert content'))
      .mockImplementationOnce(() => Buffer.from('key content'));
    (OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(new Error(`Failed to read private key`));
  });

  it('Unknown error', async () => {
    configuration.settings.connectionSettings!.authentication = {
      type: 'none',
      certFilePath: '',
      keyFilePath: '',
      username: '',
      password: ''
    };

    const error = new Error('Unknown error');
    (OPCUAClient.createSession as jest.Mock).mockImplementation(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(new Error('Unknown error'));
  });
});

describe('NorthOPCUA with shared connection', () => {
  let north: NorthOPCUA;
  const configuration: NorthConnectorEntity<NorthOPCUASettings> = {
    id: 'southId',
    name: 'south',
    type: 'opcua',
    description: 'my test connector',
    enabled: true,
    settings: {
      sharedConnection: {
        connectorId: 'nordId',
        connectorType: 'north'
      },
      retryInterval: 10000
    },
    caching: testData.north.list[0].caching,
    subscriptions: [],
    transformers: []
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime();

    north = new NorthOPCUA(
      configuration,
      transformerService,
      northConnectorRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(testData.north.list[0].id)
    );
  });

  it('should getSession from shared connection', async () => {
    const client = {};
    (connectionService.getConnection as jest.Mock).mockReturnValueOnce(client);
    expect(await north.getSession()).toBe(client);
    expect(connectionService.getConnection).toHaveBeenCalledWith(
      configuration.settings.sharedConnection!.connectorType,
      configuration.settings.sharedConnection!.connectorId
    );
  });

  it('should getSession from shared connection and throw error if not found', async () => {
    (connectionService.getConnection as jest.Mock).mockReturnValueOnce(null);
    await expect(north.getSession()).rejects.toThrow(new Error('Could not connect client'));
    expect(connectionService.getConnection).toHaveBeenCalledWith(
      configuration.settings.sharedConnection!.connectorType,
      configuration.settings.sharedConnection!.connectorId
    );
  });

  it('getSharedConnectionSettings should retrieve shared connection settings', () => {
    expect(north.getSharedConnectionSettings()).toEqual({
      connectorType: configuration.settings.sharedConnection!.connectorType,
      connectorId: configuration.settings.sharedConnection!.connectorId
    });
  });

  it('should properly disconnect with reconnectTimeout', async () => {
    north['reconnectTimeout'] = setTimeout(() => null);
    north['client'] = {} as ClientSession;
    (connectionService.isConnectionUsed as jest.Mock).mockReturnValueOnce(false).mockReturnValueOnce(true);
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await north.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(connectionService.closeSession).toHaveBeenCalledWith(
      configuration.settings.sharedConnection!.connectorType,
      configuration.settings.sharedConnection!.connectorId,
      configuration.id,
      false
    );
    expect(connectionService.isConnectionUsed).toHaveBeenCalledWith('north', configuration.id, configuration.id);
    expect(north['client']).toBeNull();

    north['client'] = {} as ClientSession;
    await north.disconnect(new Error('error'));
    expect(connectionService.closeSession).toHaveBeenCalledWith(
      configuration.settings.sharedConnection!.connectorType,
      configuration.settings.sharedConnection!.connectorId,
      configuration.id,
      true
    );
  });
});
