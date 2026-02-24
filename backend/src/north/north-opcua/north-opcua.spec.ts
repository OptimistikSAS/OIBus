import nodeOPCUAMock from '../../tests/__mocks__/node-opcua.mock';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import NorthOPCUA from './north-opcua';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { NorthOPCUASettings } from '../../../shared/model/north-settings.model';
import testData from '../../tests/utils/test-data';
import CacheService from '../../service/cache/cache.service';
import { createTransformer } from '../../service/transformer.service';
import OIBusTransformer from '../../transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import { AttributeIds, ClientSession, DataType, OPCUACertificateManager, OPCUAClient, resolveNodeId } from 'node-opcua';
import { randomUUID } from 'crypto';
import fs from 'node:fs/promises';
import { OIBusOPCUAValue } from '../../transformers/connector-types.model';
import { createSessionConfigs, initOPCUACertificateFolders } from '../../service/utils-opcua';
import { ReadStream } from 'node:fs';
import { streamToString } from '../../service/utils';
import { buildNorthConfiguration } from '../../tests/utils/test-utils';

// Mocks
jest.mock('node-opcua', () => ({
  ...nodeOPCUAMock,
  // Keep actual enums/classes for logic that relies on them
  DataType: jest.requireActual('node-opcua').DataType,
  StatusCodes: jest.requireActual('node-opcua').StatusCodes,
  SecurityPolicy: jest.requireActual('node-opcua').SecurityPolicy,
  AttributeIds: jest.requireActual('node-opcua').AttributeIds,
  resolveNodeId: jest.fn()
}));

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn()
}));
jest.mock('node:fs/promises');
jest.mock('../../service/utils');
jest.mock('../../service/utils-opcua');
jest.mock('../../service/transformer.service');

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

const opcuaOptions = {
  applicationName: 'OIBus',
  clientName: 'connectorName-connectorId',
  connectionStrategy: { initialDelay: 1000, maxRetry: 1 },
  securityMode: 1,
  securityPolicy: 'none',
  endpointMustExist: false,
  keepSessionAlive: false
};
const opcuaUserIdentity = { type: 0 };

describe('NorthOPCUA', () => {
  let configuration: NorthConnectorEntity<NorthOPCUASettings>;
  let north: NorthOPCUA;
  let mockSession: ClientSession;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    configuration = buildNorthConfiguration<NorthOPCUASettings>('opcua', {
      url: 'opc.tcp://localhost:666/OPCUA/SimulationServer',
      retryInterval: 10000,
      authentication: { type: 'none', password: null },
      securityMode: 'none',
      securityPolicy: 'none',
      keepSessionAlive: false
    });

    mockSession = {
      close: jest.fn(),
      read: jest.fn(),
      write: jest.fn()
    } as unknown as ClientSession;

    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    (createSessionConfigs as jest.Mock).mockReturnValue({ options: opcuaOptions, userIdentity: opcuaUserIdentity });
    (randomUUID as jest.Mock).mockReturnValue('randomUUID');
    (OPCUAClient.createSession as jest.Mock).mockResolvedValue(mockSession);
    (resolveNodeId as jest.Mock).mockImplementation(id => id); // Identity mock by default

    north = new NorthOPCUA(configuration, logger, cacheService);
  });

  afterEach(async () => {
    jest.useRealTimers();
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should return correct types', () => {
    expect(north.supportedTypes()).toEqual(['opcua']);
  });

  it('should be properly initialized', async () => {
    await north.start();
    expect(initOPCUACertificateFolders).toHaveBeenCalledWith('cache');
  });

  it('should be properly initialized without initialising opcua certificate', async () => {
    north['clientCertificateManager'] = {} as unknown as OPCUACertificateManager;
    await north.start();
    expect(initOPCUACertificateFolders).toHaveBeenCalledWith('cache');
    expect(OPCUACertificateManager).not.toHaveBeenCalled();
  });

  it('should properly connect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    north.disconnect = jest.fn();
    north['reconnectTimeout'] = setTimeout(() => null);

    await north.connect();

    expect(createSessionConfigs).toHaveBeenCalledTimes(1);
    expect(OPCUAClient.createSession).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('connected'));
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(north.disconnect).not.toHaveBeenCalled();
  });

  it('should handle connection error and trigger reconnect', async () => {
    const error = new Error('Session creation failed');
    (OPCUAClient.createSession as jest.Mock).mockRejectedValueOnce(error);
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    north.disconnect = jest.fn();

    await north.connect();

    expect(logger.error).toHaveBeenCalledWith('Error while connecting to the OPCUA server: Session creation failed');
    expect(north.disconnect).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should not reconnect if disconnecting', async () => {
    (OPCUAClient.createSession as jest.Mock).mockRejectedValueOnce(new Error('Fail'));
    north['disconnecting'] = true;
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    north.disconnect = jest.fn();

    await north.connect();

    expect(north.disconnect).toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should properly disconnect', async () => {
    north['client'] = mockSession;
    north['reconnectTimeout'] = setTimeout(() => null);
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    await north.disconnect();

    expect(mockSession.close).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(north['client']).toBeNull();
  });

  it('should throw error if connector is in reconnecting state', async () => {
    north['reconnectTimeout'] = setTimeout(() => null);
    const readStream = {} as unknown as ReadStream;

    await expect(
      north.handleContent(readStream, {
        contentFile: 'file.json',
        contentSize: 100,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'opcua'
      })
    ).rejects.toThrow('Connector is reconnecting...');
  });

  it('should throw error if client is not set', async () => {
    const values: Array<OIBusOPCUAValue> = [
      { nodeId: 'ns=1;s=Tag1', value: 123 },
      { nodeId: 'ns=1;s=Tag2', value: 456 }
    ];
    (streamToString as jest.Mock).mockResolvedValue(JSON.stringify(values));
    const readStream = {} as unknown as ReadStream;
    await expect(
      north.handleContent(readStream, {
        contentFile: 'file.json',
        contentSize: 100,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'opcua'
      })
    ).rejects.toThrow('OPCUA client not set');
  });

  it('should handle content success', async () => {
    const values: Array<OIBusOPCUAValue> = [
      { nodeId: 'ns=1;s=Tag1', value: 123 },
      { nodeId: 'ns=1;s=Tag2', value: 456 },
      { nodeId: 'ns=1;s=Tag3', value: 789 },
      { nodeId: 'ns=1;s=Tag4', value: 111 }
    ];
    (streamToString as jest.Mock).mockResolvedValue(JSON.stringify(values));

    // Setup client behavior
    (mockSession.read as jest.Mock)
      .mockResolvedValueOnce({ value: 'bad' }) // Tag1
      .mockResolvedValueOnce({ value: { value: { value: 'Bad' } } }) // Tag2
      .mockResolvedValueOnce({ value: { value: { value: DataType.Double } } }) // Tag3
      .mockResolvedValueOnce({ value: { value: { value: DataType.Double } } }); // Tag4

    (mockSession.write as jest.Mock)
      .mockResolvedValueOnce({ isGood: () => false, name: 'Bad' })
      .mockResolvedValueOnce({ isGood: () => true, name: 'Good' });

    north['client'] = mockSession;
    const readStream = {} as ReadStream;

    await north.handleContent(readStream, {
      contentFile: 'file.json',
      contentSize: 100,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'opcua'
    });

    // Tag 1 Verification
    expect(mockSession.read).toHaveBeenCalledWith({ nodeId: 'ns=1;s=Tag1', attributeId: AttributeIds.DataType });
    expect(mockSession.write).toHaveBeenCalledWith({
      nodeId: 'ns=1;s=Tag4',
      attributeId: AttributeIds.Value,
      value: { value: { dataType: DataType.Double, value: 111 } }
    });

    // Tag 2 Verification (Failed Write Log)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Could not read DataType for node ID "ns=1;s=Tag1"'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid data type for node ID "ns=1;s=Tag2"'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to write value "789" for node ID "ns=1;s=Tag3"'));
    expect(logger.trace).toHaveBeenCalledWith(expect.stringContaining('Value "111" written successfully on node ID "ns=1;s=Tag4"'));
  });

  it('should handle bad node IDs without disconnecting', async () => {
    const values = [{ nodeId: 'bad-node', value: 123 }];
    (streamToString as jest.Mock).mockResolvedValue(JSON.stringify(values));

    (resolveNodeId as jest.Mock).mockImplementationOnce(() => {
      throw new Error('BadNodeId');
    });

    north['client'] = mockSession;
    north.disconnect = jest.fn();

    await north.handleContent({} as ReadStream, {
      contentFile: 'f',
      contentSize: 0,
      numberOfElement: 0,
      createdAt: '',
      contentType: 'opcua'
    });

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error when parsing node ID'));
    expect(north.disconnect).not.toHaveBeenCalled();
  });

  it('should handle write error without disconnecting', async () => {
    const values = [{ nodeId: 'bad-node', value: 123 }];
    (streamToString as jest.Mock).mockResolvedValue(JSON.stringify(values));

    (mockSession.read as jest.Mock).mockRejectedValueOnce(new Error('BadNodeId'));
    north['client'] = mockSession;
    north.disconnect = jest.fn();

    await north.handleContent({} as ReadStream, {
      contentFile: 'f',
      contentSize: 0,
      numberOfElement: 0,
      createdAt: '',
      contentType: 'opcua'
    });

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Write error on node ID "bad-node": BadNodeId'));
    expect(north.disconnect).not.toHaveBeenCalled();
  });

  it('should handle critical errors and trigger reconnect', async () => {
    const values = [{ nodeId: 'tag1', value: 123 }];
    (streamToString as jest.Mock).mockResolvedValue(JSON.stringify(values));

    (mockSession.read as jest.Mock).mockRejectedValue(new Error('Connection Lost'));

    north['client'] = mockSession;
    north.disconnect = jest.fn();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    await expect(
      north.handleContent({} as ReadStream, { contentFile: 'f', contentSize: 0, numberOfElement: 0, createdAt: '', contentType: 'opcua' })
    ).rejects.toThrow('Connection Lost');

    expect(logger.error).toHaveBeenCalledWith('Unexpected OPCUA error: Connection Lost');
    expect(north.disconnect).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalled();
  });

  it('should properly test connection', async () => {
    const mockSessionClose = jest.fn();
    (OPCUAClient.createSession as jest.Mock).mockResolvedValue({ close: mockSessionClose });

    await north.testConnection();

    expect(initOPCUACertificateFolders).toHaveBeenCalledWith(expect.stringContaining('opcua-test-'));
    expect(OPCUAClient.createSession).toHaveBeenCalled();
    expect(mockSessionClose).toHaveBeenCalled();
    expect(fs.rm).toHaveBeenCalled();
  });

  it('should throw error if test fails', async () => {
    (OPCUAClient.createSession as jest.Mock).mockRejectedValue(new Error('Auth failed'));
    await expect(north.testConnection()).rejects.toThrow('Auth failed');
    expect(fs.rm).toHaveBeenCalled(); // cleanup even on error
  });
});
