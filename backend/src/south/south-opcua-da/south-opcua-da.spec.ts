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
import ProxyService from '../../service/proxy.service';
import { initOpcuaCertificateFolders } from '../../service/opcua.service';

import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';

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
        createCacheHistoryTable: jest.fn(),
        southCacheRepository: {
          database
        }
      };
    }
);

const addValues = jest.fn();
const addFile = jest.fn();

const logger: pino.Logger = new PinoLogger();

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const proxyService: ProxyService = new ProxyService(repositoryService.proxyRepository, encryptionService);
const items: Array<OibusItemDTO> = [
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
const configuration: SouthConnectorDTO = {
  id: 'southId',
  name: 'south',
  type: 'test',
  description: 'my test connector',
  enabled: true,
  settings: {
    url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
    retryInterval: 10000,
    maxReadInterval: 3600,
    readIntervalDelay: 200,
    maxReturnValues: 1000,
    readTimeout: 180000,
    authentication: {
      type: 'none'
    },
    securityMode: 'None',
    securityPolicy: 'None',
    keepSessionAlive: false
  }
};

describe('SouthOPCUADA', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

    south = new SouthOPCUADA(
      configuration,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolder',
      true
    );
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
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    configuration.settings.authentication = { type: 'basic', username: 'myUser', password: 'pass' };
    south = new SouthOPCUADA(
      configuration,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolder',
      true
    );
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
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    configuration.settings.authentication = { type: 'cert', certPath: 'myCertPath', keyPath: 'myKeyPath' };
    south = new SouthOPCUADA(
      configuration,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolder',
      true
    );
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
