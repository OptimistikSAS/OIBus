import child from 'node:child_process';
import Stream from 'node:stream';
import SouthOPCHDA from './south-opchda';
import tcpServer from './tcp-server';
import deferredPromise from '../../service/deferred-promise';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import ProxyService from '../../service/proxy.service';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';

class CustomStream extends Stream {
  public stdout = new Stream();
  public stderr = new Stream();
  constructor() {
    super();
  }
  kill() {}
}
const mockSpawnChild = new CustomStream();
mockSpawnChild.kill = jest.fn();

jest.mock('./tcp-server');
jest.mock('../../service/deferred-promise');
jest.mock('node:child_process');
jest.mock('node:fs/promises');
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
      nodeId: 'ns=3;s=Random',
      aggregate: 'raw',
      resampling: 'none'
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'item2',
    connectorId: 'southId',
    settings: {
      nodeId: 'ns=3;s=Counter',
      aggregate: 'raw',
      resampling: 'none'
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id3',
    name: 'item3',
    connectorId: 'southId',
    settings: {
      nodeId: 'ns=3;s=Triangle',
      aggregate: 'raw',
      resampling: 'none'
    },
    scanModeId: 'scanModeId2'
  }
];

const configuration: SouthConnectorDTO = {
  id: 'southId',
  name: 'south',
  type: 'test',
  description: 'my test connector',
  enabled: true,
  settings: {
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
  }
};
let south: SouthOPCHDA;

const originalPlatform = process.platform;

describe('South OPCHDA', () => {
  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    (child.spawn as jest.Mock).mockImplementation(() => mockSpawnChild);
    (tcpServer as jest.Mock).mockImplementation(() => ({
      start: jest.fn(callback => {
        callback();
      }),
      stop: jest.fn(),
      sendMessage: jest.fn()
    }));

    (deferredPromise as jest.Mock).mockImplementation(() => ({
      promise: {
        resolve: jest.fn(),
        reject: jest.fn(() => {
          throw new Error('promise error');
        })
      }
    }));

    south = new SouthOPCHDA(
      configuration,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolde',
      true
    );
  });

  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should log error if the connector is run on the wrong platform', async () => {
    Object.defineProperty(process, 'platform', { value: 'notWin32' });
    await south.start();

    expect(logger.error).toHaveBeenCalledWith('OIBus OPCHDA Agent only supported on Windows: notWin32');
    Object.defineProperty(process, 'platform', { value: 'win32' });
  });

  it('should properly connect', async () => {
    south.runTcpServer = jest.fn();
    await south.connect();
    expect(south.runTcpServer).toHaveBeenCalledTimes(1);
  });

  it('should properly run tcp server', async () => {
    south.launchAgent = jest.fn();
    await south.runTcpServer();

    expect(south.launchAgent).toHaveBeenCalledWith(
      configuration.settings.agentFilename,
      configuration.settings.tcpPort,
      configuration.settings.logLevel
    );
  });

  it('should reject on launch Agent error', async () => {
    south.launchAgent = jest.fn(() => {
      throw new Error('launch agent error');
    });
    try {
      await south.runTcpServer();
    } catch (err) {
      expect(err).toEqual(new Error('launch agent error'));
    }
  });

  it('should properly launch agent', async () => {
    south.launchAgent('hdaPath', 1234, 'debug');

    mockSpawnChild.emit('close', 'closeCode');
    expect(logger.info).toHaveBeenCalledWith('HDA agent exited with code closeCode');

    mockSpawnChild.emit('error', { message: 'errorMessage' });
    expect(logger.error).toHaveBeenCalledWith('Failed to start HDA agent: "errorMessage"');

    mockSpawnChild.stderr.emit('data', 'stderrErrorMessage');
    expect(logger.error).toHaveBeenCalledWith('HDA agent stderr: "stderrErrorMessage"');

    south.handleHdaAgentLog = jest.fn();
    mockSpawnChild.stdout.emit('data', 'stdOutMessage');
    expect(south.handleHdaAgentLog).toHaveBeenCalledWith('stdOutMessage');
  });

  it('should properly handle HDA Agent logs', () => {
    south.logMessage = jest.fn();

    south.handleHdaAgentLog(Buffer.from('myMessage'));
    south.handleHdaAgentLog(Buffer.from(' and mySecondMessage\r\n in several\r\n\r\npart'));
    // 'part' is not logged since it will be part of the next (and for now incomplete) message
    // it should also ignore empty lines
    expect(south.logMessage).toHaveBeenCalledTimes(2);
    expect(south.logMessage).toHaveBeenCalledWith('myMessage and mySecondMessage');
    expect(south.logMessage).toHaveBeenCalledWith('in several');
  });

  it('should properly log HDA Agent messages', () => {
    south.logMessage('{ "Message": "my error message", "Level": "error" }');
    expect(logger.error).toHaveBeenCalledWith('HDA Agent stdout: my error message');

    south.logMessage('{ "Message": "my warn message", "Level": "warn" }');
    expect(logger.warn).toHaveBeenCalledWith('HDA Agent stdout: my warn message');

    south.logMessage('{ "Message": "my info message", "Level": "info" }');
    expect(logger.info).toHaveBeenCalledWith('HDA Agent stdout: my info message');

    south.logMessage('{ "Message": "my debug message", "Level": "debug" }');
    expect(logger.debug).toHaveBeenCalledWith('HDA Agent stdout: my debug message');

    south.logMessage('{ "Message": "my trace message", "Level": "trace" }');
    expect(logger.trace).toHaveBeenCalledWith('HDA Agent stdout: my trace message');

    south.logMessage('{ "Message": "my wrongLevel message", "Level": "wrongLevel" }');
    expect(logger.debug).toHaveBeenCalledWith('HDA Agent stdout: my wrongLevel message');

    south.logMessage('not a json');
    expect(logger.error).toHaveBeenCalledWith(
      'The error "SyntaxError: Unexpected token o in JSON at position 1" ' + 'occurred when parsing HDA Agent log "not a json"'
    );
  });

  it('should generate a transaction id', () => {
    expect(south.generateTransactionId()).toEqual('1');
  });

  it('should send connect message', async () => {
    south.sendTCPMessageToHdaAgent = jest.fn();
    south.generateTransactionId = jest.fn(() => '1234');

    await south.sendConnectMessage();

    expect(south.sendTCPMessageToHdaAgent).toHaveBeenCalledWith({
      Request: 'Connect',
      TransactionId: '1234',
      Content: {
        host: configuration.settings.host,
        serverName: configuration.settings.serverName
      }
    });
  });

  it('should properly disconnect when already disconnected', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    await south.disconnect();
    expect(clearTimeoutSpy).not.toHaveBeenCalled();
  });

  it('should send read message', async () => {
    await south.start();
    south.sendTCPMessageToHdaAgent = jest.fn();
    south.generateTransactionId = jest.fn(() => '1234');

    const startTime = new Date('2020-01-01T00:00:00.000Z');
    const endTime = new Date('2021-01-01T00:00:00.000Z');

    await south.sendReadMessage('myScanMode', startTime.toISOString(), endTime.toISOString());

    expect(south.sendTCPMessageToHdaAgent).toHaveBeenCalledWith({
      Request: 'Read',
      TransactionId: '1234',
      Content: {
        Group: 'myScanMode',
        StartTime: startTime.getTime(),
        EndTime: endTime.getTime()
      }
    });
  });

  it('should handle bad message', async () => {
    const receivedMessage = 'not a json message';
    south.sendConnectMessage = jest.fn();
    await south.handleTcpHdaAgentMessages(receivedMessage);
    expect(logger.error).toHaveBeenCalledWith('Can\'t handle message "not a json message"');
  });

  it('should handle Alive message', async () => {
    const receivedMessage = { Reply: 'Alive' };
    south.sendConnectMessage = jest.fn();
    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage));
    expect(south.sendConnectMessage).toHaveBeenCalledTimes(1);
  });

  it('should handle Connect message when the connection succeeds', async () => {
    const receivedMessage = { Reply: 'Connect', Content: { Connected: true } };
    south.sendInitializeMessage = jest.fn();
    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage));
    expect(south.sendInitializeMessage).toHaveBeenCalledTimes(1);
  });

  it('should handle Connect message when the connection fails', async () => {
    const receivedMessage = { Reply: 'Connect', Content: { Connected: false, Error: 'connection error' } };
    south.disconnect = jest.fn();
    south.connect = jest.fn();
    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage));
    expect(logger.error).toHaveBeenCalledWith(
      `Unable to connect to "${configuration.settings.serverName}" on ` +
        `${configuration.settings.host}: ${receivedMessage.Content.Error}, retrying in ${configuration.settings.retryInterval}ms`
    );

    expect(south.disconnect).toHaveBeenCalledTimes(1);
    expect(south.connect).not.toHaveBeenCalled();
    jest.advanceTimersToNextTimer(configuration.settings.retryInterval);
    expect(south.connect).toHaveBeenCalledTimes(1);
  });

  it('should handle Initialize message', async () => {
    const receivedMessage = { Reply: 'Initialize' };
    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage));
    expect(logger.info).toHaveBeenCalledWith('HDA Agent initialized');
  });

  it('should handle Disconnect message', async () => {
    const receivedMessage = { Reply: 'Disconnect' };
    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage));
    expect(logger.info).toHaveBeenCalledWith('HDA Agent disconnected');
  });

  it('should handle BadReply message', async () => {
    const receivedMessage = { Reply: 'BadReply' };
    await south.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage));
    expect(logger.error).toHaveBeenCalledWith('Unknown HDA Agent reply: "BadReply"');
  });
});
