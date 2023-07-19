import manifest from './manifest';
import SouthConnector from '../south-connector';
import DeferredPromise from '../../service/deferred-promise';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory, TestsConnection } from '../south-interface';
import { HandlesAgent } from './agent-handler-interface';
import Agent from './agent';
import { SouthOPCHDAItemSettings, SouthOPCHDASettings } from '../../../../shared/model/south-settings.model';

interface AgentPoint {
  ItemId: string;
  Timestamp: Instant;
  Value: number;
  Quality: string;
}

/**
 * Class SouthOPCHDA - Run a HDA agent to connect to an OPCHDA server.
 * This connector communicates with the Agent through a TCP connection thanks to the TCP server created on OIBus
 * and associated to this connector
 */
export default class SouthOPCHDA extends SouthConnector implements HandlesAgent, QueriesHistory, TestsConnection {
  static type = manifest.id;

  private agent: Agent;

  // Initialized at connection
  private connection$: DeferredPromise | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private historyRead$: DeferredPromise | null = null;
  private historyReadTimeout: NodeJS.Timeout | null = null;

  private readonly itemsByGroups: Map<
    string,
    {
      aggregate: string;
      resampling: string;
      scanMode: string;
      points: string[];
    }
  >;

  constructor(
    connector: SouthConnectorDTO<SouthOPCHDASettings>,
    items: Array<SouthConnectorItemDTO<SouthOPCHDAItemSettings>>,
    engineAddValuesCallback: (southId: string, values: Array<any>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, items, engineAddValuesCallback, engineAddFileCallback, encryptionService, repositoryService, logger, baseFolder);

    this.itemsByGroups = new Map<
      string,
      {
        aggregate: string;
        resampling: string;
        scanMode: string;
        points: string[];
      }
    >();

    for (const item of items) {
      const groupName = `${item.scanModeId}-${item.settings.aggregate}-${item.settings.resampling}`;
      if (!this.itemsByGroups.get(groupName)) {
        this.itemsByGroups.set(groupName, {
          aggregate: item.settings.aggregate,
          resampling: item.settings.resampling,
          scanMode: item.scanModeId!,
          points: [item.settings.nodeId]
        });
      } else {
        const group = this.itemsByGroups.get(groupName)!;
        this.itemsByGroups.set(groupName, {
          aggregate: item.settings.aggregate,
          resampling: item.settings.resampling,
          scanMode: item.scanModeId!,
          points: [...group.points, item.settings.nodeId]
        });
      }
    }

    this.agent = new Agent(this, connector.settings, logger);
  }

  async connect(): Promise<void> {
    if (process.platform !== 'win32') {
      this.logger.error(`OIBus OPCHDA Agent only supported on Windows: ${process.platform}`);
      return;
    }

    this.connection$ = new DeferredPromise();
    await this.agent.connect();
    await this.connection$?.promise;
    await super.connect();
  }

  override async testConnection(): Promise<void> {
    if (process.platform !== 'win32') {
      throw new Error(`OIBus OPCHDA Agent only supported on Windows: ${process.platform}`);
    }

    this.logger.info(`Testing connection with Agent on "${this.connector.settings.host}"`);
    const agent = new Agent(this, this.connector.settings, this.logger);

    try {
      await agent.connect();
    } catch (error) {
      throw new Error(`Unable to connect to "${this.connector.settings.serverName}" on ${this.connector.settings.host}: ${error}`);
    } finally {
      await agent.disconnect();
    }

    this.logger.info(`Connection test to OPCHDA server "${this.connector.settings.serverName}" through agent successful`);
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into the cache and send it to the engine.
   */
  async historyQuery(items: Array<SouthConnectorItemDTO<SouthOPCHDAItemSettings>>, startTime: Instant, endTime: Instant): Promise<Instant> {
    this.historyRead$ = new DeferredPromise();

    let maxTimestamp = DateTime.fromISO(startTime).toMillis();

    const groupList: Set<string> = new Set();
    for (const item of items) {
      groupList.add(`${item.scanModeId}-${item.settings.aggregate}-${item.settings.resampling}`);
    }
    for (const groupName of groupList) {
      this.logger.trace(`Reading ${groupName} group item in HDA Agent`);
      await this.agent.sendReadMessage(groupName, startTime, endTime);
    }

    this.historyReadTimeout = setTimeout(() => {
      this.historyRead$?.reject(
        new Error(`History query has not succeeded in the requested readTimeout: ${this.connector.settings.readTimeout}s`)
      );
    }, this.connector.settings.readTimeout * 1000);
    const retrievedTimestamp = await this.historyRead$.promise;
    maxTimestamp = retrievedTimestamp > maxTimestamp ? retrievedTimestamp : maxTimestamp;

    clearTimeout(this.historyReadTimeout);
    this.historyReadTimeout = null;
    return DateTime.fromMillis(maxTimestamp).toUTC().toISO() as Instant;
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

    await this.agent.disconnect();
    await super.disconnect();
  }

  async handleConnectMessage(connected: boolean, error: string): Promise<void> {
    if (!connected) {
      this.logger.error(
        `Unable to connect to "${this.connector.settings.serverName}" on ${this.connector.settings.host}: ${error}, retrying in ${this.connector.settings.retryInterval}ms`
      );

      await this.agent.disconnect();
      this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      return;
    }

    // Now that the HDA Agent is connected, the Agent can be initialized with the scan groups
    try {
      const groups = Array.from(this.itemsByGroups || new Map(), ([groupName, item]) => ({
        name: groupName,
        ...item
      }));

      await this.agent.sendInitializeMessage(groups, this.connector.history.maxReadInterval, this.connector.history.readDelay);
    } catch (error) {
      this.logger.error('The message has not been sent. Reinitializing the HDA agent.');

      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }

      await this.disconnect();
      this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
    }
  }

  async handleInitializeMessage(): Promise<void> {
    this.connection$?.resolve();
  }

  async handleReadMessage(messageObject: any): Promise<void> {
    if (messageObject.Content.Error) {
      if (messageObject.Content.Disconnected) {
        this.logger.error('Agent disconnected from OPC HDA server');
        await this.disconnect();
        this.reconnectTimeout = setTimeout(this.agent.sendConnectMessage, this.connector.settings.retryInterval);
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
    const values = messageObject.Content.Points.filter((point: AgentPoint) => {
      if (point.Timestamp !== undefined && point.Value !== undefined) {
        return true;
      }
      this.logger.error(`Point: "${point.ItemId}" is invalid: ${JSON.stringify(point)}`);
      return false;
    }).map((point: AgentPoint) => {
      maxTimestamp =
        DateTime.fromISO(point.Timestamp).toMillis() > maxTimestamp ? DateTime.fromISO(point.Timestamp).toMillis() : maxTimestamp;

      return {
        pointId: point.ItemId,
        timestamp: DateTime.fromISO(point.Timestamp).toUTC().toISO(),
        data: { value: point.Value.toString(), quality: JSON.stringify(point.Quality) }
      };
    });
    await this.addValues(values);

    this.historyRead$?.resolve(maxTimestamp + 1);
  }
}
