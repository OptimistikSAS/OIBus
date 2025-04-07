import NorthOPCUA from './north-opcua';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import csv from 'papaparse';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import NorthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/north-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthOPCUASettings } from '../../../shared/model/north-settings.model';
import testData from '../../tests/utils/test-data';
import { flushPromises, mockBaseFolders } from '../../tests/utils/test-utils';
import CacheService from '../../service/cache/cache.service';
import TransformerService, { createTransformer } from '../../service/transformer.service';
import TransformerServiceMock from '../../tests/__mocks__/service/transformer-service.mock';
import OIBusTransformer from '../../service/transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import nodeOPCUAClient, { AttributeIds, OPCUACertificateManager, OPCUAClient } from 'node-opcua';
import { SouthOPCUASettings } from '../../../shared/model/south-settings.model';
import { randomUUID } from 'crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

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
  OPCUACertificateManager: jest.fn(() => ({}))
}));
// Mock only the randomUUID function because other functions are used by OPCUA
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn()
}));
jest.mock('node:fs/promises');
jest.mock('../../service/utils');

const logger: pino.Logger = new PinoLogger();
const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
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
      readTimeout: 15000,
      authentication: {
        type: 'none',
        password: null,
        keyFilePath: null
      },
      securityMode: 'none',
      securityPolicy: 'none',
      keepSessionAlive: false
    };
    (northConnectorRepository.findNorthById as jest.Mock).mockReturnValue(configuration);
    (scanModeRepository.findById as jest.Mock).mockImplementation(id => testData.scanMode.list.find(element => element.id === id));
    (csv.unparse as jest.Mock).mockReturnValue('csv content');
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);

    north = new NorthOPCUA(
      configuration,
      encryptionService,
      transformerService,
      northConnectorRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(testData.north.list[0].id)
    );
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
        requestedSessionTimeout: 15000,
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
    const values = [
      {
        nodeId: 'nodeId1',
        value: 123
      },
      {
        nodeId: 'nodeId2',
        value: 456
      }
    ];
    (fs.readFile as jest.Mock).mockReturnValueOnce(JSON.stringify(values));

    const writeFn = jest
      .fn()
      .mockReturnValueOnce({ isGood: jest.fn().mockReturnValueOnce(true) })
      .mockReturnValueOnce({ isGood: jest.fn().mockReturnValueOnce(false), name: 'error' });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    north['client'] = {
      write: writeFn
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

    expect(writeFn).toHaveBeenCalledTimes(2);
    expect(writeFn).toHaveBeenCalledWith({
      nodeId: values[0].nodeId,
      attributeId: AttributeIds.Value,
      value: {
        value: {
          dataType: 6, // DataType.Int32
          value: values[0].value
        }
      }
    });
    expect(writeFn).toHaveBeenCalledWith({
      nodeId: values[1].nodeId,
      attributeId: AttributeIds.Value,
      value: {
        value: {
          dataType: 6, // DataType.Int32
          value: values[1].value
        }
      }
    });

    expect(logger.trace).toHaveBeenCalledWith(`Value ${values[0].value} written successfully on nodeId ${values[0].nodeId}`);
    expect(logger.error).toHaveBeenCalledWith(`Failed to write value ${values[1].value} on nodeId ${values[1].nodeId}: error`);
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
    await north.handleContent({
      contentFile: 'path/to/file/example-123456789.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'raw',
      source: 'south',
      options: {}
    });
    expect(logger.debug).toHaveBeenCalledWith(`File "path/to/file/example-123456789.file" of type raw ignored`);
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
      readTimeout: 15000,
      authentication: {
        type: 'none',
        password: null,
        keyFilePath: null
      },
      securityMode: 'sign-and-encrypt',
      securityPolicy: 'none',
      keepSessionAlive: false
    };

    north = new NorthOPCUA(
      configuration,
      encryptionService,
      transformerService,
      northConnectorRepository,
      scanModeRepository,
      logger,
      mockBaseFolders(testData.north.list[0].id)
    );
  });

  it('Connection settings are correct', async () => {
    const close = jest.fn();
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ close });

    await expect(north.testConnection()).resolves.not.toThrow();

    expect(close).toHaveBeenCalled();
  });

  it('Wrong URL', async () => {
    const error = new Error('BadTcpEndpointUrlInvalid');
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(new Error('Please check the URL'));
  });

  it.each(securityPolicies)('Server does not support Security policy: %s', async securityPolicy => {
    configuration.settings.securityPolicy = securityPolicy;
    const error = new Error(`Cannot find an Endpoint matching  security mode: ${securityPolicy}`);

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(new Error(`Security Policy "${securityPolicy}" is not supported on the server`));
  });

  it.each(securityPolicies.slice(1))('Server did not trust certificate using Security policy: %s', async securityPolicy => {
    configuration.settings.securityPolicy = securityPolicy;
    const error = new Error('The connection may have been rejected by server');

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(new Error('Please check if the OIBus certificate has been trusted by the server'));
  });

  it('Wrong user credentials', async () => {
    configuration.settings.authentication.type = 'basic';
    const error = new Error('BadIdentityTokenRejected');

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(new Error('Please check username and password'));
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

    await expect(north.testConnection()).rejects.toThrow(new Error('Please check the certificate and key'));
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
    const keyPath = path.resolve(configuration.settings.authentication.keyFilePath!);
    (fs.readFile as jest.Mock)
      .mockImplementationOnce(() => Buffer.from('cert content'))
      .mockImplementationOnce(() => Buffer.from('key content'));
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(north.testConnection()).rejects.toThrow(new Error(`Could not read private key "${keyPath}"`));
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
        requestedSessionTimeout: 15000,
        securityMode: 3,
        securityPolicy: 'none'
      },
      userIdentity: { type: 0 }
    });

    const result2 = await north.createSessionConfigs(
      { ...configuration.settings, securityMode: 'sign', securityPolicy: null },
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
        requestedSessionTimeout: 15000,
        securityMode: 2,
        securityPolicy: undefined
      },
      userIdentity: { type: 0 }
    });
  });
});
