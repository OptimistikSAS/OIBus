import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import { SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import SouthOPCHDATest from './south-opchda-test';

const connect = jest.fn();
const disconnect = jest.fn();

jest.mock(
  './agent',
  () =>
    function () {
      return {
        connect: connect,
        disconnect: disconnect
      };
    }
);
const logger: pino.Logger = new PinoLogger();
const originalPlatform = process.platform;

const settings: SouthConnectorDTO['settings'] = {
  tcpPort: '2224',
  retryInterval: 10000,
  maxReadInterval: 3600,
  readIntervalDelay: 200,
  maxReturnValues: 0,
  readTimeout: 60,
  agentFilename: './HdaAgent/HdaAgent.exe',
  logLevel: 'trace',
  host: '1.2.3.4',
  serverName: 'MyOPCServer'
};

const opchdaTest = new SouthOPCHDATest(settings, logger);

describe('SouthOPCHDATest', () => {
  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('testConnection should throw error on non Windows platform', async () => {
    Object.defineProperty(process, 'platform', { value: 'notWin32' });

    await expect(opchdaTest.testConnection()).rejects.toThrowError(new Error('OIBus OPCHDA Agent only supported on Windows: notWin32'));
    expect(connect).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('testConnection should call agent connect on Windows platform', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    await opchdaTest.testConnection();

    expect(connect).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });

  it('testConnection should throw error if agent is unable to connect', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    connect.mockReturnValueOnce(Promise.reject(new Error('connect error')));

    await expect(opchdaTest.testConnection()).rejects.toThrowError(
      new Error('Unable to connect to "MyOPCServer" on 1.2.3.4: Error: connect error')
    );

    expect(connect).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });

  it('handleConnectMessage log connected when connected', async () => {
    await opchdaTest.handleConnectMessage(true, '');

    expect(logger.info).toHaveBeenCalledWith('Connected to "MyOPCServer" on 1.2.3.4');
  });

  it('handleConnectMessage log error when not connected', async () => {
    await opchdaTest.handleConnectMessage(false, 'error');

    expect(logger.error).toHaveBeenCalledWith('Unable to connect to "MyOPCServer" on 1.2.3.4: error');
  });

  it('handleInitializeMessage should throw error', async () => {
    await expect(opchdaTest.handleInitializeMessage()).rejects.toThrowError(new Error('Method not implemented.'));
  });

  it('handleReadMessage should throw error', async () => {
    await expect(opchdaTest.handleReadMessage([])).rejects.toThrowError(new Error('Method not implemented.'));
  });
});
