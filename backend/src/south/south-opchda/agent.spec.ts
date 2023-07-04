import child from 'node:child_process';
import pino from 'pino';
import Agent from './agent';
import { HandlesAgent } from './agent-handler-interface';
import tcpServer from './tcp-server';
import deferredPromise from '../../service/deferred-promise';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import { SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import Stream from 'node:stream';

jest.mock('node:child_process');
jest.mock('node:fs/promises');
jest.mock('./tcp-server');
jest.mock('../../service/deferred-promise');

const stop = jest.fn();
const sendMessage = jest.fn();
const handleConnectMessage = jest.fn();
const handleInitializeMessage = jest.fn();
const handleReadMessage = jest.fn();

class AgentHandler implements HandlesAgent {
  handleConnectMessage = handleConnectMessage;
  handleInitializeMessage = handleInitializeMessage;
  handleReadMessage = handleReadMessage;
}

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

const logger: pino.Logger = new PinoLogger();
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
const agentHandler = new AgentHandler();

let agent: Agent;

describe('Agent', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
    jest.useFakeTimers();

    (child.spawn as jest.Mock).mockImplementation(() => mockSpawnChild);

    (tcpServer as jest.Mock).mockImplementation(() => ({
      start: jest.fn(callback => {
        callback();
      }),
      stop: stop,
      sendMessage: sendMessage
    }));

    (deferredPromise as jest.Mock).mockImplementation(() => ({
      promise: {
        resolve: jest.fn(),
        reject: jest.fn(() => {
          throw new Error('promise error');
        })
      }
    }));

    agent = new Agent(agentHandler, settings, logger);
  });

  it('should properly connect', async () => {
    agent.runTcpServer = jest.fn();
    await agent.connect();
    expect(agent.runTcpServer).toHaveBeenCalledTimes(1);
  });

  it('should properly disconnect when already disconnected', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    await agent.runTcpServer();
    await agent.handleTcpHdaAgentMessages('{"Reply": "Alive"}');
    agent.sendStopMessage = jest.fn();

    await agent.disconnect();

    expect(clearTimeoutSpy).not.toHaveBeenCalled();
    expect(agent.sendStopMessage).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });

  it('should reject on launch Agent error', async () => {
    agent.launchAgent = jest.fn(() => {
      throw new Error('launch agent error');
    });
    try {
      await agent.runTcpServer();
    } catch (err) {
      expect(err).toEqual(new Error('launch agent error'));
    }
  });

  it('should properly run tcp server', async () => {
    agent.launchAgent = jest.fn();
    await agent.runTcpServer();

    expect(agent.launchAgent).toHaveBeenCalledWith(settings.agentFilename, settings.tcpPort, settings.logLevel);
  });

  it('should properly launch agent', async () => {
    agent.launchAgent('hdaPath', 1234, 'debug');
    expect(logger.info).toHaveBeenCalledWith('Launching hdaPath with the arguments: listen -p 1234 -l debug -x none');

    mockSpawnChild.emit('close', 'closeCode');
    expect(logger.info).toHaveBeenCalledWith('HDA agent exited with code closeCode');

    mockSpawnChild.emit('error', { message: 'errorMessage' });
    expect(logger.error).toHaveBeenCalledWith('Failed to start HDA agent: "errorMessage"');

    mockSpawnChild.stderr.emit('data', 'stderrErrorMessage');
    expect(logger.error).toHaveBeenCalledWith('HDA agent stderr: "stderrErrorMessage"');

    agent.handleHdaAgentLog = jest.fn();
    mockSpawnChild.stdout.emit('data', 'stdOutMessage');
    expect(agent.handleHdaAgentLog).toHaveBeenCalledWith('stdOutMessage');
  });

  it('should properly handle HDA Agent logs', () => {
    agent.logMessage = jest.fn();

    agent.handleHdaAgentLog(Buffer.from('myMessage'));
    agent.handleHdaAgentLog(Buffer.from(' and mySecondMessage\r\n in several\r\n\r\npart'));
    // 'part' is not logged since it will be part of the next (and for now incomplete) message
    // it should also ignore empty lines
    expect(agent.logMessage).toHaveBeenCalledTimes(2);
    expect(agent.logMessage).toHaveBeenCalledWith('myMessage and mySecondMessage');
    expect(agent.logMessage).toHaveBeenCalledWith('in several');
  });

  it('should properly log HDA Agent messages', () => {
    agent.logMessage('{ "Message": "my error message", "Level": "error" }');
    expect(logger.error).toHaveBeenCalledWith('HDA Agent stdout: my error message');

    agent.logMessage('{ "Message": "my warn message", "Level": "warn" }');
    expect(logger.warn).toHaveBeenCalledWith('HDA Agent stdout: my warn message');

    agent.logMessage('{ "Message": "my info message", "Level": "info" }');
    expect(logger.info).toHaveBeenCalledWith('HDA Agent stdout: my info message');

    agent.logMessage('{ "Message": "my debug message", "Level": "debug" }');
    expect(logger.debug).toHaveBeenCalledWith('HDA Agent stdout: my debug message');

    agent.logMessage('{ "Message": "my trace message", "Level": "trace" }');
    expect(logger.trace).toHaveBeenCalledWith('HDA Agent stdout: my trace message');

    agent.logMessage('{ "Message": "my wrongLevel message", "Level": "wrongLevel" }');
    expect(logger.debug).toHaveBeenCalledWith('HDA Agent stdout: my wrongLevel message');

    agent.logMessage('not a json');
    expect(logger.error).toHaveBeenCalledWith(
      'The error "SyntaxError: Unexpected token o in JSON at position 1" ' + 'occurred when parsing HDA Agent log "not a json"'
    );
  });

  it('should generate a transaction id', () => {
    expect(agent.generateTransactionId()).toEqual('1');
  });

  it('should send connect message', async () => {
    agent.sendTCPMessageToHdaAgent = jest.fn();
    agent.generateTransactionId = jest.fn(() => '1234');

    await agent.sendConnectMessage();

    expect(agent.sendTCPMessageToHdaAgent).toHaveBeenCalledWith({
      Request: 'Connect',
      TransactionId: '1234',
      Content: {
        host: settings.host,
        serverName: settings.serverName
      }
    });
  });

  it('should send initialize message', async () => {
    agent.sendTCPMessageToHdaAgent = jest.fn();
    agent.generateTransactionId = jest.fn(() => '1234');

    await agent.sendInitializeMessage([], 1000, 2000);

    expect(agent.sendTCPMessageToHdaAgent).toHaveBeenCalledWith({
      Request: 'Initialize',
      TransactionId: '1234',
      Content: {
        Groups: [],
        MaxReturnValues: settings.maxReturnValues,
        MaxReadInterval: 1000,
        ReadIntervalDelay: 2000
      }
    });
  });

  it('should send read message', async () => {
    agent.sendTCPMessageToHdaAgent = jest.fn();
    agent.generateTransactionId = jest.fn(() => '1234');

    const startTime = new Date('2020-01-01T00:00:00.000Z');
    const endTime = new Date('2021-01-01T00:00:00.000Z');

    await agent.sendReadMessage('myScanMode', startTime.toISOString(), endTime.toISOString());

    expect(agent.sendTCPMessageToHdaAgent).toHaveBeenCalledWith({
      Request: 'Read',
      TransactionId: '1234',
      Content: {
        Group: 'myScanMode',
        StartTime: startTime.getTime(),
        EndTime: endTime.getTime()
      }
    });
  });

  it('should send stop message', async () => {
    agent.sendTCPMessageToHdaAgent = jest.fn();
    agent.generateTransactionId = jest.fn(() => '1234');

    await agent.sendStopMessage();

    expect(agent.sendTCPMessageToHdaAgent).toHaveBeenCalledWith({
      Request: 'Stop',
      TransactionId: '1234'
    });
  });

  it('should send throw error on sendTCPMessageToHdaAgent if tcp server not running', async () => {
    (tcpServer as jest.Mock).mockImplementationOnce(() => null);

    await expect(agent.sendTCPMessageToHdaAgent('')).rejects.toThrowError(
      new Error('The message has not been sent. TCP server is not running.')
    );
    expect(logger.error).toHaveBeenCalledWith('The message has not been sent. TCP server is not running.');
  });

  it('should send throw error on sendTCPMessageToHdaAgent if agent is not connected', async () => {
    await agent.runTcpServer();
    // agent.agentConnected = false;
    await expect(agent.sendTCPMessageToHdaAgent('')).rejects.toThrowError(
      new Error('The message has not been sent. Agent is not connected.')
    );
    expect(logger.error).toHaveBeenCalledWith('The message has not been sent. Agent is not connected.');
  });

  it('should send send message to agent', async () => {
    await agent.runTcpServer();
    await agent.handleTcpHdaAgentMessages('{"Reply": "Alive"}');

    await agent.sendTCPMessageToHdaAgent('message');

    expect(sendMessage).toHaveBeenCalledWith(JSON.stringify('message'));
  });

  it('should handle bad message', async () => {
    const receivedMessage = 'not a json message';
    agent.sendConnectMessage = jest.fn();
    await agent.handleTcpHdaAgentMessages(receivedMessage);
    expect(logger.error).toHaveBeenCalledWith('Can\'t handle message "not a json message"');
  });

  it('should handle Alive message', async () => {
    const receivedMessage = { Reply: 'Alive' };
    agent.sendConnectMessage = jest.fn();
    await agent.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage));
    expect(agent.sendConnectMessage).toHaveBeenCalledTimes(1);
  });

  it('should handle Connect message when the connection succeeds', async () => {
    const receivedMessage = { Reply: 'Connect', Content: { Connected: true } };
    agent.sendInitializeMessage = jest.fn();
    await agent.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage));
    expect(handleConnectMessage).toHaveBeenCalledWith(true, undefined);
  });

  it('should handle Connect message when the connection fails', async () => {
    const receivedMessage = { Reply: 'Connect', Content: { Connected: false, Error: 'connection error' } };
    await agent.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage));
    expect(handleConnectMessage).toHaveBeenCalledWith(false, 'connection error');
  });

  it('should handle Initialize message', async () => {
    const receivedMessage = { Reply: 'Initialize' };
    await agent.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage));
    expect(handleInitializeMessage).toHaveBeenCalledTimes(1);
  });

  it('should handle Initialize message', async () => {
    const receivedMessage = { Reply: 'Read', Content: { Values: [] } };
    await agent.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage));
    expect(handleReadMessage).toHaveBeenCalledWith(receivedMessage);
  });

  it('should handle Stop message', async () => {
    const receivedMessage = { Reply: 'Stop' };
    await agent.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage));
    expect(logger.info).toHaveBeenCalledWith('HDA Agent stopping...');
  });

  it('should handle Disconnect message', async () => {
    const receivedMessage = { Reply: 'Disconnect' };
    await agent.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage));
    expect(logger.info).toHaveBeenCalledWith('HDA Agent disconnected');
  });

  it('should handle BadReply message', async () => {
    const receivedMessage = { Reply: 'BadReply' };
    await agent.handleTcpHdaAgentMessages(JSON.stringify(receivedMessage));
    expect(logger.error).toHaveBeenCalledWith('Unknown HDA Agent reply: "BadReply"');
  });
});
