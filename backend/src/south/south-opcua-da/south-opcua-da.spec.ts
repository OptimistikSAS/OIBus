import nodeOPCUAClient from 'node-opcua-client';

import fs from 'node:fs/promises';
import SouthOPCUADA from './south-opcua-da';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { initOpcuaCertificateFolders } from '../../service/opcua.service';
import { randomUUID } from 'crypto';
import path from 'node:path';

import { SouthConnectorItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import {
  SouthOPCUADAItemSettings,
  SouthOPCUADASettings,
  SouthOPCUADASettingsAuthentication
} from '../../../../shared/model/south-settings.model';

// Mock node-opcua-client
jest.mock('node-opcua-client', () => ({
  OPCUAClient: { createSession: jest.fn() },
  MessageSecurityMode: { None: 1 },
  StatusCodes: jest.requireActual('node-opcua-client').StatusCodes,
  SecurityPolicy: jest.requireActual('node-opcua-client').SecurityPolicy,
  UserTokenType: jest.requireActual('node-opcua-client').UserTokenType,
  TimestampsToReturn: jest.requireActual('node-opcua-client').TimestampsToReturn,
  AggregateFunction: jest.requireActual('node-opcua-client').AggregateFunction,
  ReadRawModifiedDetails: jest.fn(() => ({})),
  HistoryReadRequest: jest.requireActual('node-opcua-client').HistoryReadRequest,
  ReadProcessedDetails: jest.fn(() => ({}))
}));
jest.mock('node-opcua-certificate-manager', () => ({ OPCUACertificateManager: jest.fn(() => ({})) }));
jest.mock('node:fs/promises');
jest.mock('../../service/opcua.service');
jest.mock('../../service/utils');
const database = new DatabaseMock();
jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return {
        createSouthCacheScanModeTable: jest.fn(),
        southCacheRepository: {
          database
        }
      };
    }
);

jest.mock(
  '../../service/south-connector-metrics.service',
  () =>
    function () {
      return {
        initMetrics: jest.fn(),
        updateMetrics: jest.fn(),
        get stream() {
          return { stream: 'myStream' };
        },
        metrics: {
          numberOfValuesRetrieved: 1,
          numberOfFilesRetrieved: 1
        }
      };
    }
);

// Mock only the randomUUID function because other functions are used by OPCUA
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn()
}));

const addValues = jest.fn();
const addFile = jest.fn();

const logger: pino.Logger = new PinoLogger();

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const items: Array<SouthConnectorItemDTO<SouthOPCUADAItemSettings>> = [
  {
    id: 'id1',
    name: 'item1',
    connectorId: 'southId',
    settings: {
      nodeId: 'ns=3;s=Random'
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'item2',
    connectorId: 'southId',
    settings: {
      nodeId: 'ns=3;s=Counter'
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id3',
    name: 'item3',
    connectorId: 'southId',
    settings: {
      nodeId: 'ns=3;s=Triangle'
    },
    scanModeId: 'scanModeId2'
  }
];

const nowDateString = '2020-02-02T02:02:02.222Z';
let south: SouthOPCUADA;

describe('SouthOPCUADA', () => {
  const configuration: SouthConnectorDTO<SouthOPCUADASettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
    },
    settings: {
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      readTimeout: 180000,
      authentication: {
        type: 'none'
      } as unknown as SouthOPCUADASettingsAuthentication,
      securityMode: 'None',
      securityPolicy: 'None',
      keepSessionAlive: false
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    south = new SouthOPCUADA(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should be properly initialized', async () => {
    south.connectToOpcuaServer = jest.fn();
    await south.start();
    await south.start();
    expect(initOpcuaCertificateFolders).toHaveBeenCalledTimes(2);
    expect(south.connectToOpcuaServer).toHaveBeenCalledTimes(2);
  });

  it('should properly connect and disconnect to OPCUA server without password', async () => {
    south.internalDisconnect = jest.fn();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const expectedOptions = {
      applicationName: 'OIBus',
      clientName: 'southId',
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 1
      },
      securityMode: nodeOPCUAClient.MessageSecurityMode.None,
      securityPolicy: 'None',
      endpointMustExist: false,
      keepSessionAlive: false,
      keepPendingSessionsOnDisconnect: false,
      clientCertificateManager: { state: 2 }
    };
    const expectedUserIdentity = { type: 0 };

    await south.start();

    expect(nodeOPCUAClient.OPCUAClient.createSession).toHaveBeenCalledWith(
      configuration.settings.url,
      expectedUserIdentity,
      expectedOptions
    );
    expect(logger.info).toHaveBeenCalledWith(`OPCUA DA ${configuration.name} connected`);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should properly manage connection error', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw new Error('connection error');
    });

    await south.start();

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), configuration.settings.retryInterval);
    expect(logger.error).toHaveBeenCalledWith(`Error while connecting to the OPCUA DA server. ${new Error('connection error')}`);
    await south.disconnect();
  });
});

describe('SouthOPCUADA with basic auth', () => {
  const configuration: SouthConnectorDTO<SouthOPCUADASettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
    },
    settings: {
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      readTimeout: 180000,
      authentication: {
        type: 'basic',
        username: 'myUser',
        password: 'pass',
        certFilePath: '',
        keyFilePath: ''
      } as unknown as SouthOPCUADASettingsAuthentication,
      securityMode: 'None',
      securityPolicy: 'None',
      keepSessionAlive: false
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    south = new SouthOPCUADA(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should properly connect to OPCUA server with basic auth', async () => {
    const expectedOptions = {
      applicationName: 'OIBus',
      clientName: 'southId',
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 1
      },
      securityMode: nodeOPCUAClient.MessageSecurityMode.None,
      securityPolicy: 'None',
      endpointMustExist: false,
      keepSessionAlive: false,
      keepPendingSessionsOnDisconnect: false,
      clientCertificateManager: null
    };
    const expectedUserIdentity = {
      type: 1,
      userName: configuration.settings.authentication.username,
      password: configuration.settings.authentication.password
    };

    await south.connectToOpcuaServer();

    expect(nodeOPCUAClient.OPCUAClient.createSession).toHaveBeenCalledWith(
      configuration.settings.url,
      expectedUserIdentity,
      expectedOptions
    );
    expect(logger.info).toHaveBeenCalledWith(`OPCUA DA ${configuration.name} connected`);
  });
});

describe('SouthOPCUADA with certificate', () => {
  const configuration: SouthConnectorDTO<SouthOPCUADASettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
    },
    settings: {
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      readTimeout: 180000,
      authentication: {
        type: 'cert',
        certFilePath: 'myCertPath',
        keyFilePath: 'myKeyPath',
        username: '',
        password: ''
      } as unknown as SouthOPCUADASettingsAuthentication,
      securityMode: 'None',
      securityPolicy: 'None',
      keepSessionAlive: false
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    south = new SouthOPCUADA(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
  });

  it('should properly connect to OPCUA server with basic auth', async () => {
    (fs.readFile as jest.Mock)
      .mockImplementationOnce(() => Buffer.from('cert content'))
      .mockImplementationOnce(() => Buffer.from('key content'));
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    const expectedOptions = {
      applicationName: 'OIBus',
      clientName: 'southId',
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 1
      },
      securityMode: nodeOPCUAClient.MessageSecurityMode.None,
      securityPolicy: 'None',
      endpointMustExist: false,
      keepSessionAlive: false,
      keepPendingSessionsOnDisconnect: false,
      clientCertificateManager: null
    };
    const expectedUserIdentity = {
      type: 2,
      certificateData: Buffer.from('cert content'),
      privateKey: Buffer.from('key content').toString('utf8')
    };

    await south.connectToOpcuaServer();

    expect(nodeOPCUAClient.OPCUAClient.createSession).toHaveBeenCalledWith(
      configuration.settings.url,
      expectedUserIdentity,
      expectedOptions
    );
    expect(logger.info).toHaveBeenCalledWith(`OPCUA DA ${configuration.name} connected`);
    expect(setTimeoutSpy).not.toBeCalled();
  });
});

describe('SouthOPCUADA test connection', () => {
  const configuration: SouthConnectorDTO<SouthOPCUADASettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0
    },
    settings: {
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      readTimeout: 180000,
      authentication: {
        type: 'none'
      } as unknown as SouthOPCUADASettingsAuthentication,
      securityMode: 'None',
      securityPolicy: 'None',
      keepSessionAlive: false
    }
  };

  // Mock UUID
  const uuid = 'test-uuid';
  (randomUUID as jest.Mock).mockReturnValue(uuid);
  const tempCertFolder = `opcua-test-${uuid}`;

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

  const securityPolicies: SouthOPCUADASettings['securityPolicy'][] = [
    'None',
    'Basic128',
    'Basic192',
    'Basic256',
    'Basic128Rsa15',
    'Basic192Rsa15',
    'Basic256Rsa15',
    'Basic256Sha256',
    'Aes128_Sha256_RsaOaep',
    'PubSub_Aes128_CTR',
    'PubSub_Aes256_CTR'
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    south = new SouthOPCUADA(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
  });

  afterEach(async () => {
    expect((logger.trace as jest.Mock).mock.calls).toEqual([
      [`Created OPCUA DA temporary folder for certificates: ${tempCertFolder}`],
      ['OPCUA DA temporary folder deleted']
    ]);
  });

  it('Connection settings are correct', async () => {
    const close = jest.fn();
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockReturnValue({ close });

    await expect(south.testConnection()).resolves.not.toThrow();

    expect(close).toHaveBeenCalled();
    expect((logger.info as jest.Mock).mock.calls).toEqual([
      [`Testing connection on "${configuration.settings.url}"`],
      [`OPCUA DA connected on "${configuration.settings.url}"`]
    ]);
  });

  it('Wrong URL', async () => {
    const error = new Error('BadTcpEndpointUrlInvalid');
    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error('Please check the URL'));

    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Error while connecting to the OPCUA DA server. ${error}`]]);
  });

  it.each(securityPolicies)('Server does not support Security policy: %s', async securityPolicy => {
    configuration.settings.securityPolicy = securityPolicy;
    const error = new Error(`Cannot find an Endpoint matching  security mode. ${securityPolicy}`);

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error(`Security Policy "${securityPolicy}" is not supported on the server`));

    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Error while connecting to the OPCUA DA server. ${error}`]]);
  });

  it.each(securityPolicies.slice(1))('Server did not trust certificate using Security policy: %s', async securityPolicy => {
    configuration.settings.securityPolicy = securityPolicy;
    const error = new Error('The connection may have been rejected by server');

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error('Please check if the OIBus certificate has been trusted by the server'));

    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Error while connecting to the OPCUA DA server. ${error}`]]);
  });

  it('Wrong user credentials', async () => {
    configuration.settings.authentication.type = 'basic';
    const error = new Error('BadIdentityTokenRejected');

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error('Please check username and password'));

    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Error while connecting to the OPCUA DA server. ${error}`]]);
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

    await expect(south.testConnection()).rejects.toThrow(new Error('Please check the certificate and key'));

    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Error while connecting to the OPCUA DA server. ${error}`]]);
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

    await expect(south.testConnection()).rejects.toThrow(new Error(`File "${error.path}" does not exist`));

    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Error while connecting to the OPCUA DA server. ${error}`]]);
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

    await expect(south.testConnection()).rejects.toThrow(new Error(`Could not read private key "${keyPath}"`));

    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Error while connecting to the OPCUA DA server. ${error}`]]);
  });

  it('Unknown error', async () => {
    configuration.settings.authentication = {
      type: 'none',
      certFilePath: 'myCertPath',
      keyFilePath: 'myKeyPath',
      username: '',
      password: ''
    };
    const error = new Error('Unknown error');

    (nodeOPCUAClient.OPCUAClient.createSession as jest.Mock).mockImplementationOnce(() => {
      throw error;
    });

    await expect(south.testConnection()).rejects.toThrow(new Error('Please check logs'));

    expect((logger.error as jest.Mock).mock.calls).toEqual([[`Error while connecting to the OPCUA DA server. ${error}`]]);
  });
});
