import { spawn } from 'node:child_process';

import manifest from './manifest';
import SouthConnector from '../south-connector';
import TcpServer from './tcp-server';
import DeferredPromise from '../../service/deferred-promise';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { DateTime } from 'luxon';

// Time to wait before closing the connection by timeout and killing the HDA Agent process
const DISCONNECTION_TIMEOUT = 10000;

/**
 * Class SouthOPCHDA - Run a HDA agent to connect to an OPCHDA server.
 * This connector communicates with the Agent through a TCP connection thanks to the TCP server created on OIBus
 * and associated to this connector
 */
export default class SouthOPCHDA extends SouthConnector {
  static category = manifest.category;

  // Initialized at connection
  private tcpServer: TcpServer | null = null;
  private transactionId = 0;
  private agentConnected = false;
  private receivedLog = '';
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private historyReadTimeout: NodeJS.Timeout | null = null;
  private disconnectionTimeout: NodeJS.Timeout | null = null;
  private child: ChildProcessWithoutNullStreams | null = null;
  private connection$: DeferredPromise | null = null;
  private historyRead$: DeferredPromise | null = null;
  private disconnection$: DeferredPromise | null = null;

  private itemsByGroups = new Map<
    string,
    {
      aggregate: string;
      resampling: string;
      scanMode: string;
      points: Array<{
        name: string;
        nodeId: string;
      }>;
    }
  >();

  constructor(
    configuration: SouthConnectorDTO,
    items: Array<OibusItemDTO>,
    engineAddValuesCallback: (southId: string, values: Array<any>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string,
    streamMode: boolean
  ) {
    super(
      configuration,
      items,
      engineAddValuesCallback,
      engineAddFileCallback,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      baseFolder,
      streamMode,
      manifest
    );
  }

  async connect(): Promise<void> {
    if (process.platform === 'win32') {
      await this.runTcpServer();
      await this.connection$?.promise;
      await super.connect();
    } else {
      this.logger.error(`OIBus OPCHDA Agent only supported on Windows: ${process.platform}`);
    }
  }

  async runTcpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.tcpServer = new TcpServer(this.configuration.settings.tcpPort, this.handleTcpHdaAgentMessages.bind(this), this.logger);
        this.tcpServer.start(() => {
          this.launchAgent(
            this.configuration.settings.agentFilename,
            this.configuration.settings.tcpPort,
            this.configuration.settings.logLevel
          );
          this.connection$ = new DeferredPromise();
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into the cache and send it to the engine.
   */
  override async historyQuery(items: Array<OibusItemDTO>, startTime: Instant, endTime: Instant): Promise<Instant> {
    this.historyRead$ = new DeferredPromise();

    let maxTimestamp = DateTime.fromISO(startTime).toMillis();

    for (const groupName of this.itemsByGroups.keys()) {
      this.logger.trace(`Reading ${groupName} group item in HDA Agent`);
      await this.sendReadMessage(groupName, startTime, endTime);
    }

    this.historyReadTimeout = setTimeout(() => {
      this.historyRead$?.reject(
        new Error(`History query has not succeeded in the requested readTimeout: ${this.configuration.settings.readTimeout}s`)
      );
    }, this.configuration.settings.readTimeout * 1000);
    const retrievedTimestamp = await this.historyRead$.promise;
    maxTimestamp = retrievedTimestamp > maxTimestamp ? retrievedTimestamp : maxTimestamp;

    clearTimeout(this.historyReadTimeout);
    this.historyReadTimeout = null;
    return DateTime.fromMillis(maxTimestamp).toUTC().toISO();
  }

  /**
   * Close the connection and reinitialize the connector.
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.historyReadTimeout) {
      clearTimeout(this.historyReadTimeout);
    }

    if (this.agentConnected) {
      // TCP connection with the HDA Agent was previously established
      // In this case, we ask the HDA Agent to stop and disconnect gracefully
      await this.sendStopMessage();
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
    }
    this.tcpServer = null;

    this.agentConnected = false;
    await super.disconnect();
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
        host: this.configuration.settings.host,
        serverName: this.configuration.settings.serverName
      }
    };
    await this.sendTCPMessageToHdaAgent(message);
  }

  /**
   * Send a TCP initialization message to the HDA agent to set up the OPCHDA communication
   */
  async sendInitializeMessage(itemsByScanMode: Map<string, Map<string, OibusItemDTO>>): Promise<void> {
    this.itemsByGroups = new Map<
      string,
      {
        aggregate: string;
        resampling: string;
        scanMode: string;
        points: Array<{
          name: string;
          nodeId: string;
        }>;
      }
    >();
    for (const [scanModeId, items] of itemsByScanMode.entries()) {
      for (const item of items.values()) {
        const groupName = `${scanModeId}-${item.settings.aggregate}-${item.settings.resampling}`;
        if (!this.itemsByGroups.get(groupName)) {
          this.itemsByGroups.set(groupName, {
            aggregate: item.settings.aggregate,
            resampling: item.settings.resampling,
            scanMode: item.scanModeId!,
            points: [{ name: item.name, nodeId: item.settings.nodeId }]
          });
        } else {
          const group = this.itemsByGroups.get(groupName)!;
          this.itemsByGroups.set(groupName, {
            aggregate: item.settings.aggregate,
            resampling: item.settings.resampling,
            scanMode: item.scanModeId!,
            points: [...group.points, { name: item.name, nodeId: item.settings.nodeId }]
          });
        }
      }
    }

    const groups = Array.from(this.itemsByGroups || new Map(), ([groupName, item]) => ({
      name: groupName,
      ...item
    }));

    const message = {
      Request: 'Initialize',
      TransactionId: this.generateTransactionId(),
      Content: {
        Groups: groups,
        MaxReturnValues: this.configuration.settings.maxReturnValues,
        MaxReadInterval: this.configuration.settings.maxReadInterval,
        ReadIntervalDelay: this.configuration.settings.readIntervalDelay
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
    const message = {
      Request: 'Stop',
      TransactionId: this.generateTransactionId()
    };
    await this.sendTCPMessageToHdaAgent(message);
    this.disconnection$ = new DeferredPromise();
    this.disconnectionTimeout = setTimeout(() => {
      this.disconnection$?.resolve();
    }, DISCONNECTION_TIMEOUT);
  }

  /**
   * Send a TCP message to the HDA Agent
   */
  async sendTCPMessageToHdaAgent(message: any): Promise<void> {
    if (this.tcpServer && this.agentConnected) {
      const messageString = JSON.stringify(message);
      this.logger.trace(`TCP message sent to the HDA agent: "${messageString}"`);
      this.tcpServer.sendMessage(messageString);
    } else {
      this.logger.error('The message has not been sent. Reinitializing the HDA agent.');
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      await this.disconnect();
      this.reconnectTimeout = setTimeout(this.connect.bind(this), this.configuration.settings.retryInterval);
    }
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
          await this.sendConnectMessage();
          break;
        case 'Connect':
          // The HDA Agent answers on "sendConnectMessage". The Content.Connected variable tells if the HDA Agent is
          // connected to the HDA Server
          this.logger.info(`HDA Agent connected: ${messageObject.Content.Connected}`);
          if (messageObject.Content.Connected) {
            // Now that the HDA Agent is connected, the Agent can be initialized with the scan groups
            await this.sendInitializeMessage(this.itemsByScanModeIds);
          } else {
            this.logger.error(
              `Unable to connect to "${this.configuration.settings.serverName}" on ${this.configuration.settings.host}: ${messageObject.Content.Error}, retrying in ${this.configuration.settings.retryInterval}ms`
            );
            await this.disconnect();
            this.reconnectTimeout = setTimeout(this.connect.bind(this), this.configuration.settings.retryInterval);
          }
          break;
        case 'Initialize': // The HDA Agent is connected and ready to read values
          this.logger.info('HDA Agent initialized');
          // resolve the connection promise to resolve the connect method
          this.connection$?.resolve();
          break;
        case 'Read': // Receive the values for the requested scan group (Content.Group) after a read request from historyQuery
          {
            if (messageObject.Content.Error) {
              if (messageObject.Content.Disconnected) {
                this.logger.error('Agent disconnected from OPC HDA server');
                await this.disconnect();
                this.reconnectTimeout = setTimeout(this.sendConnectMessage.bind(this), this.configuration.settings.retryInterval);
              }
              this.historyRead$?.reject(new Error(messageObject.Content.Error));
              return;
            }

            if (messageObject.Content.Points === undefined) {
              this.historyRead$?.reject(new Error(`Missing points entry in response for group "${messageObject.Content.Group}"`));
              return;
            }

            if (messageObject.Content.Points.length === 0) {
              this.logger.debug(`Empty points response for group "${messageObject.Content.Group}"`);
              this.historyRead$?.resolve(0);
              return;
            }

            this.logger.trace(`Received ${messageObject.Content.Points.length} values for group "${messageObject.Content.Group}"`);

            const associatedGroup = this.itemsByGroups.get(messageObject.Content.Group);

            if (!associatedGroup) {
              this.historyRead$?.reject(new Error(`Group "${messageObject.Content.Group}" not found`));
              return;
            }

            let maxTimestamp = 0;
            const values = messageObject.Content.Points.filter((point: any) => {
              if (point.Timestamp !== undefined && point.Value !== undefined) {
                return true;
              }
              this.logger.error(`Point: "${point.ItemId}" is invalid: ${JSON.stringify(point)}`);
              return false;
            }).map((point: any) => {
              const associatedPointId =
                associatedGroup.points.find(scanGroupPoint => scanGroupPoint.nodeId === point.ItemId)?.name || point.ItemId;
              maxTimestamp =
                DateTime.fromISO(point.Timestamp).toMillis() > maxTimestamp ? DateTime.fromISO(point.Timestamp).toMillis() : maxTimestamp;

              return {
                pointId: associatedPointId,
                timestamp: DateTime.fromISO(point.Timestamp).toUTC().toISO(),
                data: { value: point.Value.toString(), quality: JSON.stringify(point.Quality) }
              };
            });
            await this.addValues(values);

            this.historyRead$?.resolve(maxTimestamp + 1);
          }
          break;
        case 'Stop': // The HDA Agent has received the stop message and the disconnection promise can be resolved
          this.logger.info('HDA Agent stopping...');
          // If the connection with the OPC HDA server could not be established,
          // The promise can be resolved right away since we won't receive the disconnect message
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
