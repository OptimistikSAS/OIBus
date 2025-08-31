import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import { encryptionService } from '../../service/encryption.service';
import NorthOPCUA from './north-opcua';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import csv from 'papaparse';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthOPCUASettings } from '../../../shared/model/north-settings.model';
import testData from '../../tests/utils/test-data';
import { flushPromises } from '../../tests/utils/test-utils';
import CacheService from '../../service/cache/cache.service';
import { createTransformer } from '../../service/transformer.service';
import OIBusTransformer from '../../service/transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import nodeOPCUAClient, { AttributeIds, DataType, OPCUACertificateManager, OPCUAClient, resolveNodeId } from 'node-opcua';
import { SouthOPCUASettings } from '../../../shared/model/south-settings.model';
import { randomUUID } from 'crypto';
import fs from 'node:fs/promises';
import { OIBusOPCUAValue } from '../../service/transformers/connector-types.model';

// Mock node-opcua-client
jest.mock('node-opcua', () => ({
  OPCUAClient: { createSession: jest.fn(() => ({ close: jest.fn() })) },
  ClientSubscription: { create: jest.fn() },
  ClientMonitoredItem: { create: jest.fn() },
  DataType: jest.requireActual('node-opcua').DataType,
  StatusCodes: jest.requireActual('node-opcua').StatusCodes,
  SecurityPolicy: jest.requireActual('node-opcua').SecurityPolicy,
  AttributeIds: jest.requireActual('node-opcua').AttributeIds,
  UserTokenType: jest.requireActual('node-opcua').UserTokenType,
  TimestampsToReturn: jest.requireActual('node-opcua').TimestampsToReturn,
  AggregateFunction: jest.requireActual('node-opcua').AggregateFunction,
  ReadRawModifiedDetails: jest.fn(() => ({})),
  HistoryReadRequest: jest.requireActual('node-opcua').HistoryReadRequest,
  ReadProcessedDetails: jest.fn(() => ({})),
  OPCUACertificateManager: jest.fn(() => ({})),
  resolveNodeId: jest.fn(nodeId => nodeId)
}));
// Mock only the randomUUID function because other functions are used by OPCUA
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn()
}));
jest.mock('node:fs/promises');
jest.mock('../../service/utils');
jest.mock('../../service/encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const logger: pino.Logger = new PinoLogger();
const cacheService: CacheService = new CacheServiceMock();
const oiBusTransformer: OIBusTransformer = new OIBusTransformerMock() as unknown as OIBusTransformer;

jest.mock(
  '../../service/cache/cache.service',
  () =>
    function () {
      return cacheService;
    }
);
jest.mock('../../service/utils');
jest.mock('../../service/transformer.service');
jest.mock('papaparse');

describe('NorthOPCUA', () => {
  let configuration: NorthConnectorEntity<NorthOPCUASettings>;
  let north: NorthOPCUA;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      authentication: {
        type: 'none',
        password: null
      },
      securityMode: 'none',
      securityPolicy: 'none',
      keepSessionAlive: false
    };
    (csv.unparse as jest.Mock).mockReturnValue('csv content');
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);

    north = new NorthOPCUA(configuration, logger, 'cacheFolder', cacheService);
    north.createCronJob = jest.fn();
  });

  it('should properly connect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await north.start();
    expect(OPCUAClient.createSession).toHaveBeenCalledTimes(1);
    expect(OPCUAClient.createSession).toHaveBeenCalledWith(
      configuration.settings.url,
      { type: 0 },
      {
        applicationName: 'OIBus',
        clientCertificateManager: { state: 2 },
        clientName: 'northId1',
        connectionStrategy: { initialDelay: 1000, maxRetry: 1 },
        endpointMustExist: false,
        keepPendingSessionsOnDisconnect: false,
        keepSessionAlive: false,
        securityMode: 1,
        securityPolicy: 'none'
      }
    );
    expect(logger.info).toHaveBeenCalledWith(`OPCUA ${configuration.name} connected`);
    (OPCUAClient.createSession as jest.Mock)
      .mockImplementationOnce(() => {
        throw new Error('create session error');
      })
      .mockImplementationOnce(() => {
        throw new Error('create session error');
      });

    await north.start();
    expect(OPCUAClient.createSession).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(`Error while connecting to the OPCUA server. ${new Error('create session error')}`);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(configuration.settings.retryInterval);

    await flushPromises();
    expect(OPCUAClient.createSession).toHaveBeenCalledTimes(3);

    await north.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
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

  const securityPolicies: Array<SouthOPCUASettings['securityPolicy']> = [
    'none',
    'basic128',
    'basic192',
    'basic192-rsa15',
    'basic256-rsa15',
    'basic256-sha256',
    'aes128-sha256-rsa-oaep',
    'pub-sub-aes-128-ctr',
    'pub-sub-aes-256-ctr'
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime();

    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      authentication: {
        type: 'none',
        password: null
      },
      securityMode: 'sign-and-encrypt',
      securityPolicy: 'none',
      keepSessionAlive: false
    };

    north = new NorthOPCUA(configuration, logger, 'cacheFolder', cacheService);
  });

  it('Connection settings are correct', async () => {
    const close = jest.fn();
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ close });

    await expect(north.testConnection()).resolves.not.toThrow();

    expect(close).toHaveBeenCalled();
  });

  it.each(securityPolicies)('Server does not support Security policy: %s', async securityPolicy => {
    configuration.settings.securityPolicy = securityPolicy;
    const error = new Error(`Cannot find an Endpoint matching security mode: ${securityPolicy}`);

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(error);
  });

  it.each(securityPolicies.slice(1))('Server did not trust certificate using Security policy: %s', async securityPolicy => {
    configuration.settings.securityPolicy = securityPolicy;
    const error = new Error('The connection may have been rejected by server');

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(error);
  });

  it('Wrong user credentials', async () => {
    configuration.settings.authentication.type = 'basic';
    const error = new Error('BadIdentityTokenRejected');

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(error);
  });

  it('Wrong certificate', async () => {
    configuration.settings.authentication = {
      type: 'cert',
      certFilePath: 'myCertPath',
      keyFilePath: 'myKeyPath',
      username: '',
      password: ''
    };
    const error = new Error('BadIdentityTokenRejected');

    (fs.readFile as jest.Mock)
      .mockImplementationOnce(() => Buffer.from('cert content'))
      .mockImplementationOnce(() => Buffer.from('key content'));
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(error);
  });

  it('Certificate file does not exist', async () => {
    configuration.settings.authentication = {
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
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(new Error(`Wrong file`));
  });

  it('Failed to read private key', async () => {
    configuration.settings.authentication = {
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
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(new Error(`Failed to read private key`));
  });

  it('Unknown error', async () => {
    configuration.settings.authentication = {
      type: 'none',
      certFilePath: '',
      keyFilePath: '',
      username: '',
      password: ''
    };

    const error = new Error('Unknown error');
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementation(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(new Error('Unknown error'));
  });

  it('should properly manage all connection options', async () => {
    const result1 = await north.createSessionConfigs(configuration.settings, {} as OPCUACertificateManager, encryptionService, 'oibus');
    expect(result1).toEqual({
      options: {
        applicationName: 'OIBus',
        clientCertificateManager: {},
        clientName: 'oibus',
        connectionStrategy: { initialDelay: 1000, maxRetry: 1 },
        endpointMustExist: false,
        keepPendingSessionsOnDisconnect: false,
        keepSessionAlive: false,
        securityMode: 3,
        securityPolicy: 'none'
      },
      userIdentity: { type: 0 }
    });

    const result2 = await north.createSessionConfigs(
      { ...configuration.settings, securityMode: 'sign', securityPolicy: undefined },
      {} as OPCUACertificateManager,
      encryptionService,
      'oibus'
    );
    expect(result2).toEqual({
      options: {
        applicationName: 'OIBus',
        clientCertificateManager: {},
        clientName: 'oibus',
        connectionStrategy: { initialDelay: 1000, maxRetry: 1 },
        endpointMustExist: false,
        keepPendingSessionsOnDisconnect: false,
        keepSessionAlive: false,
        securityMode: 2
      },
      userIdentity: { type: 0 }
    });
  });
});
