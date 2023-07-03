import { spawn } from 'node:child_process';

import TcpServer from './tcp-server';
import { SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { DateTime } from 'luxon';
import { HandlesAgent } from './agent-handler-interface';
import DeferredPromise from '../../service/deferred-promise';

// Time to wait before closing the connection by timeout and killing the HDA Agent process
const TIMEOUT = 10000;

/**
 * Class SouthOPCHDA - Run a HDA agent to connect to an OPCHDA server.
 * This connector communicates with the Agent through a TCP connection thanks to the TCP server created on OIBus
 * and associated to this connector
 */
export default class Agent {
  private readonly agentHandler: HandlesAgent;
  private readonly settings: SouthConnectorDTO['settings'];
  private readonly logger: pino.Logger;

  private tcpServer: TcpServer | null = null;
  private transactionId = 0;
  private agentConnected = false;
  private receivedLog = '';
  private child: ChildProcessWithoutNullStreams | null = null;

  private connection$: DeferredPromise | null = null;
  private connectTimeout: NodeJS.Timeout | null = null;
  private disconnection$: DeferredPromise | null = null;
  private disconnectionTimeout: NodeJS.Timeout | null = null;

  constructor(agentHandler: HandlesAgent, settings: SouthConnectorDTO['settings'], logger: pino.Logger) {
    this.agentHandler = agentHandler;
    this.settings = settings;
    this.logger = logger;
  }

  async connect(): Promise<void> {
    this.connectTimeout = setTimeout(() => {
      this.connection$?.reject(new Error('Timeout during connection to HDA server'));
    }, TIMEOUT);

    this.connection$ = new DeferredPromise();
    await this.runTcpServer();
    await this.connection$?.promise;
  }

  /**
   * Close the connection and reinitialize the connector.
   */
  async disconnect(): Promise<void> {
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
    }

    if (this.agentConnected) {
      // TCP connection with the HDA Agent was previously established
      // In this case, we ask the HDA Agent to stop and disconnect gracefully
      try {
        await this.sendStopMessage();
      } catch (error) {
        this.logger.error(error);
      }
      await this.disconnection$?.promise;
    }

    if (this.disconnectionTimeout) {
      clearTimeout(this.disconnectionTimeout);
    }

    if (this.child) {
      // Child process HDA Agent is now ready to be killed
      this.child.kill();
      this.child = null;
    }

    if (this.tcpServer) {
      this.tcpServer.stop();
      this.tcpServer = null;
    }

    this.agentConnected = false;
  }

  async runTcpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.tcpServer = new TcpServer(this.settings.tcpPort, this.handleTcpHdaAgentMessages.bind(this), this.logger);
        this.tcpServer.start(() => {
          this.launchAgent(this.settings.agentFilename, this.settings.tcpPort, this.settings.logLevel);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Launch HDA agent application.
   */
  launchAgent(path: string, port: number, logLevel: string): void {
    this.logger.info(`Launching ${path} with the arguments: listen -p ${port} -l ${logLevel} -x none`);
    this.child = spawn(path, ['listen', `-p ${port}`, `-l ${logLevel}`, '-x none']);

    this.child.stdout.on('data', data => {
      this.handleHdaAgentLog(data);
    });

    this.child.stderr.on('data', data => {
      this.logger.error(`HDA agent stderr: "${data}"`);
    });

    this.child.on('close', code => {
      this.logger.info(`HDA agent exited with code ${code}`);
    });

    this.child.on('error', error => {
      this.logger.error(`Failed to start HDA agent: "${error.message}"`);
    });
  }

  /**
   * Parse messages received from the HDA agent and send them to the logger
   */
  handleHdaAgentLog(data: Buffer): void {
    const content = data.toString();
    const logs: Array<string> = [];

    if (content.includes('\n')) {
      const messageParts = content.split('\r\n');

      messageParts.forEach((messagePart: string, index: number) => {
        if (index === 0) {
          this.receivedLog += messagePart;
          logs.push(this.receivedLog);
          this.receivedLog = '';
        } else if (index === messageParts.length - 1) {
          this.receivedLog = messagePart;
        } else {
          logs.push(messagePart);
        }
      });
    } else {
      this.receivedLog += content;
    }

    logs.forEach(log => {
      if (log.length > 0) {
        this.logMessage(log.trim());
      }
    });
  }

  /**
   * Send a HDA agent log to the logger
   */
  logMessage(agentLog: string): void {
    try {
      const parsedLog = JSON.parse(agentLog);
      const message = `HDA Agent stdout: ${parsedLog.Message}`;
      switch (parsedLog.Level) {
        case 'error':
          this.logger.error(message);
          break;
        case 'warn':
          this.logger.warn(message);
          break;
        case 'info':
          this.logger.info(message);
          break;
        case 'debug':
          this.logger.debug(message);
          break;
        case 'trace':
          this.logger.trace(message);
          break;
        default:
          this.logger.debug(message);
          break;
      }
    } catch (error) {
      this.logger.error(`The error "${error}" occurred when parsing HDA Agent log "${agentLog}"`);
    }
  }

  /**
   * Generate a transaction ID for each TCP message sent to the TCP Server
   */
  generateTransactionId(): string {
    this.transactionId += 1;
    return `${this.transactionId}`;
  }

  /**
   * Send a TCP connection message to the HDA Agent to connect to the OPCHDA server
   */
  async sendConnectMessage(): Promise<void> {
    const message = {
      Request: 'Connect',
      TransactionId: this.generateTransactionId(),
      Content: {
        host: this.settings.host,
        serverName: this.settings.serverName
      }
    };
    await this.sendTCPMessageToHdaAgent(message);
  }

  /**
   * Send a TCP initialization message to the HDA agent to set up the OPCHDA communication
   */
  async sendInitializeMessage(groups: any[], maxReadInterval: number, readDelay: number): Promise<void> {
    const message = {
      Request: 'Initialize',
      TransactionId: this.generateTransactionId(),
      Content: {
        Groups: groups,
        MaxReturnValues: this.settings.maxReturnValues,
        MaxReadInterval: maxReadInterval,
        ReadIntervalDelay: readDelay
      }
    };
    await this.sendTCPMessageToHdaAgent(message);
  }

  /**
   * Send a TCP read message to the HDA agent to retrieve from the OPCHDA Server data associated to a scan group
   * previously set up in the initialization phase
   */
  async sendReadMessage(group: string, startTime: Instant, endTime: Instant): Promise<void> {
    const message = {
      Request: 'Read',
      TransactionId: this.generateTransactionId(),
      Content: {
        Group: group,
        StartTime: DateTime.fromISO(startTime).toMillis(),
        EndTime: DateTime.fromISO(endTime).toMillis()
      }
    };
    await this.sendTCPMessageToHdaAgent(message);
  }

  /**
   * Send a TCP stop message to the HDA agent to stop the HDA agent
   */
  async sendStopMessage(): Promise<void> {
    this.disconnection$ = new DeferredPromise();
    this.disconnectionTimeout = setTimeout(() => {
      this.disconnection$?.resolve();
    }, TIMEOUT);

    const message = {
      Request: 'Stop',
      TransactionId: this.generateTransactionId()
    };
    await this.sendTCPMessageToHdaAgent(message);
  }

  /**
   * Send a TCP message to the HDA Agent
   */
  async sendTCPMessageToHdaAgent(message: any): Promise<void> {
    if (!this.tcpServer) {
      const errorMessage = 'The message has not been sent. TCP server is not running.';
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (!this.agentConnected) {
      const errorMessage = 'The message has not been sent. Agent is not connected.';
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    const messageString = JSON.stringify(message);
    this.logger.trace(`TCP message sent to the HDA agent: "${messageString}"`);
    this.tcpServer.sendMessage(messageString);
  }

  /**
   * Handle a message received from the HDA Agent
   * Message can be one of the following Alive, Connect, Initialize, Read, Disconnect, Stop
   * Others will be disregarded
   */
  async handleTcpHdaAgentMessages(message: string): Promise<void> {
    try {
      this.logger.trace(`Received message from HDA Agent: "${message}"`);
      const messageObject = JSON.parse(message);

      switch (messageObject.Reply) {
        case 'Alive': // The HDA Agent is running
          this.agentConnected = true;
          try {
            await this.sendConnectMessage();
          } catch (error) {
            this.connection$?.reject(error);
          }
          break;
        case 'Connect':
          if (messageObject.Content.Connected) {
            this.connection$?.resolve();
          } else {
            this.connection$?.reject(new Error(messageObject.Content.Error));
          }
          await this.agentHandler.handleConnectMessage(messageObject.Content.Connected, messageObject.Content.Error);
          break;
        case 'Initialize': // The HDA Agent is connected and ready to read values
          await this.agentHandler.handleInitializeMessage();
          break;
        case 'Read': // Receive the values for the requested scan group (Content.Group) after a read request from historyQuery
          await this.agentHandler.handleReadMessage(messageObject);
          break;
        case 'Stop': // The HDA Agent has received the stop message and the disconnection promise can be resolved
          this.logger.info('HDA Agent stopping...');
          this.disconnection$?.resolve();
          break;
        case 'Disconnect': // The HDA Agent is disconnected from the server
          this.logger.info('HDA Agent disconnected');
          this.disconnection$?.resolve();
          break;
        default:
          this.logger.error(`Unknown HDA Agent reply: "${messageObject.Reply}"`);
      }
    } catch (error) {
      this.logger.error(`Can't handle message "${message}"`);
    }
  }
}
