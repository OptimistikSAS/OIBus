import nodeOPCUAMock from '../../tests/__mocks__/node-opcua.mock';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import NorthOPCUA from './north-opcua';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import csv from 'papaparse';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthOPCUASettings } from '../../../shared/model/north-settings.model';
import testData from '../../tests/utils/test-data';
import CacheService from '../../service/cache/cache.service';
import { createTransformer } from '../../service/transformer.service';
import OIBusTransformer from '../../service/transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import { AttributeIds, ClientSession, DataType, OPCUAClient, resolveNodeId } from 'node-opcua';
import { randomUUID } from 'crypto';
import fs from 'node:fs/promises';
import { OIBusOPCUAValue } from '../../service/transformers/connector-types.model';
import { createSessionConfigs, initOPCUACertificateFolders } from '../../service/utils-opcua';
import path from 'node:path';

// Mock node-opcua-client
jest.mock('node-opcua', () => ({
  ...nodeOPCUAMock,
  DataType: jest.requireActual('node-opcua').DataType,
  StatusCodes: jest.requireActual('node-opcua').StatusCodes,
  SecurityPolicy: jest.requireActual('node-opcua').SecurityPolicy,
  AttributeIds: jest.requireActual('node-opcua').AttributeIds,
  UserTokenType: jest.requireActual('node-opcua').UserTokenType
}));
// Mock only the randomUUID function because other functions are used by OPCUA
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn()
}));
jest.mock('node:fs/promises');
jest.mock('../../service/utils');
jest.mock('../../service/utils-opcua');

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
    (createSessionConfigs as jest.Mock).mockReturnValue({ options: opcuaOptions, userIdentity: opcuaUserIdentity });
    (randomUUID as jest.Mock).mockReturnValue('randomUUID');

    north = new NorthOPCUA(configuration, logger, 'cacheFolder', cacheService);
    north.createCronJob = jest.fn();
  });

  afterEach(async () => {
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should be properly initialized', async () => {
    north.connect = jest.fn();
    north.createSession = jest.fn();
    await north.start();
    await north.start();
    expect(initOPCUACertificateFolders).toHaveBeenCalledTimes(2);
    expect(initOPCUACertificateFolders).toHaveBeenCalledWith('cacheFolder');
    // createSession should not be called right after starting, because
    // it will be eventually called when the first session is needed
    expect(north.createSession).not.toHaveBeenCalled();
    expect(north.connect).toHaveBeenCalledTimes(2);
  });

  it('should properly connect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    north.createSession = jest.fn();
    north.disconnect = jest.fn();
    north['reconnectTimeout'] = setTimeout(() => null);
    await north.connect();
    expect(north.createSession).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(north.disconnect).not.toHaveBeenCalled();
  });

  it('should create session', async () => {
    await north.createSession();
    expect(createSessionConfigs).toHaveBeenCalledTimes(1);
    expect(OPCUAClient.createSession).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(`OPCUA connector "${configuration.name}" connected`);
  });

  it('should not reconnect if disconnecting', async () => {
    north.createSession = jest.fn().mockImplementation(() => {
      throw new Error('get session error');
    });
    north.disconnect = jest.fn();
    north['disconnecting'] = true;
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    await north.connect();
    expect(logger.error).toHaveBeenCalledWith('Error while connecting to the OPCUA server: get session error');
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(north.disconnect).toHaveBeenCalled();
  });

  it('should properly reconnect if not disconnecting', async () => {
    north.createSession = jest.fn().mockImplementation(() => {
      throw new Error('get session error');
    });
    north.disconnect = jest.fn();
    north['disconnecting'] = false;
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    await north.connect();
    expect(logger.error).toHaveBeenCalledWith('Error while connecting to the OPCUA server: get session error');
    expect(north.disconnect).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should properly disconnect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await north.disconnect();
    expect(clearTimeoutSpy).not.toHaveBeenCalled();

    const close = jest.fn();
    north['client'] = { close } as unknown as ClientSession;
    north['reconnectTimeout'] = setTimeout(() => null);

    await north.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
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

    north['client'] = {
      write: writeFn,
      read: readFn
    } as unknown as ClientSession;
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
    expect(logger.error).toHaveBeenCalledWith(`Unexpected error: another error1`);

    north['connector'].enabled = false;
    north['reconnectTimeout'] = null;

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
    expect(logger.error).toHaveBeenCalledWith(`Unexpected error: another error2`);
    expect(north.disconnect).toHaveBeenCalledTimes(2);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should throw error if client is reconnecting', async () => {
    north['client'] = {} as unknown as ClientSession;
    north['reconnectTimeout'] = setTimeout(() => null);
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
    ).rejects.toThrow('Connector is reconnecting...');
  });

  it('should throw error if client is not set when handling content', async () => {
    (fs.readFile as jest.Mock).mockReturnValueOnce('[{}]');
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
    ).rejects.toThrow('OPCUA client not set');
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

  it('should properly test connection', async () => {
    const mockedClient = { close: jest.fn() };
    north.createSession = jest.fn().mockReturnValueOnce(mockedClient);
    await north.testConnection();
    expect(initOPCUACertificateFolders).toHaveBeenCalledWith('opcua-test-randomUUID');
    expect(north.createSession).toHaveBeenCalledTimes(1);
    expect(mockedClient.close).toHaveBeenCalledTimes(1);
    expect(fs.rm).toHaveBeenCalledWith(path.resolve('opcua-test-randomUUID'), { recursive: true, force: true });
  });

  it('should properly throw error if test fails', async () => {
    north.createSession = jest.fn().mockImplementationOnce(() => {
      throw new Error('get session error');
    });
    await expect(north.testConnection()).rejects.toThrow('get session error');
    expect(initOPCUACertificateFolders).toHaveBeenCalledWith('opcua-test-randomUUID');
    expect(fs.rm).toHaveBeenCalledWith(path.resolve('opcua-test-randomUUID'), { recursive: true, force: true });
    expect(north.createSession).toHaveBeenCalledTimes(1);
  });
});
