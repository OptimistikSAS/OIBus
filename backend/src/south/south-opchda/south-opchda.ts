import manifest from './manifest';
import SouthConnector from '../south-connector';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Aggregate, Instant, Resampling } from '../../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';
import { SouthOPCHDAItemSettings, SouthOPCHDASettings } from '../../../../shared/model/south-settings.model';
import fetch from 'node-fetch';
import { OIBusContent, OIBusTimeValue } from '../../../../shared/model/engine.model';

/**
 * Class SouthOPCHDA - Run a HDA agent to connect to an OPCHDA server.
 * This connector communicates with the Agent through a HTTP connection
 */
export default class SouthOPCHDA extends SouthConnector implements QueriesHistory {
  static type = manifest.id;

  private connected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    connector: SouthConnectorDTO<SouthOPCHDASettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, engineAddContentCallback, encryptionService, repositoryService, logger, baseFolder);
  }

  async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      const headers: Record<string, string> = {};
      headers['Content-Type'] = 'application/json';
      const fetchOptions = {
        method: 'PUT',
        body: JSON.stringify({
          host: this.connector.settings.host,
          serverName: this.connector.settings.serverName
        }),
        headers
      };

      await fetch(`${this.connector.settings.agentUrl}/api/opc/${this.connector.id}/connect`, fetchOptions);
      this.connected = true;
      await super.connect();
    } catch (error) {
      this.logger.error(
        `Error while sending connection HTTP request into agent. Reconnecting in ${this.connector.settings.retryInterval} ms. ${error}`
      );
      if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
        await this.disconnect();
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    }
  }

  async testConnection(): Promise<void> {
    const headers: Record<string, string> = {};
    headers['Content-Type'] = 'application/json';
    const fetchOptions = {
      method: 'PUT',
      body: JSON.stringify({
        host: this.connector.settings.host,
        serverName: this.connector.settings.serverName
      }),
      headers
    };
    const response = await fetch(`${this.connector.settings.agentUrl!}/api/opc/${this.connector.id}/connect`, fetchOptions);
    if (response.status === 204) {
      await fetch(`${this.connector.settings.agentUrl}/api/opc/${this.connector.id}/disconnect`, { method: 'DELETE' });
    } else if (response.status === 400) {
      const errorMessage = await response.text();
      throw new Error(`Error occurred when sending connect command to remote agent with status ${response.status}. ${errorMessage}`);
    } else {
      throw new Error(`Error occurred when sending connect command to remote agent with status ${response.status}`);
    }
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into the cache and send it to the engine.
   */
  async historyQuery(items: Array<SouthConnectorItemDTO<SouthOPCHDAItemSettings>>, startTime: Instant, endTime: Instant): Promise<Instant> {
    try {
      let updatedStartTime = startTime;
      const itemsByAggregates = new Map<
        Aggregate,
        Map<
          Resampling | undefined,
          Array<{
            nodeId: string;
            name: string;
          }>
        >
      >();
      items.forEach(item => {
        if (!itemsByAggregates.has(item.settings.aggregate)) {
          itemsByAggregates.set(
            item.settings.aggregate,
            new Map<
              Resampling,
              Array<{
                nodeId: string;
                name: string;
              }>
            >()
          );
        }
        const resampling = item.settings.resampling ? item.settings.resampling : 'none';
        if (!itemsByAggregates.get(item.settings.aggregate!)!.has(resampling)) {
          itemsByAggregates.get(item.settings.aggregate)!.set(resampling, [
            {
              name: item.name,
              nodeId: item.settings.nodeId
            }
          ]);
        } else {
          const currentList = itemsByAggregates.get(item.settings.aggregate)!.get(resampling)!;
          currentList.push({ name: item.name, nodeId: item.settings.nodeId });
          itemsByAggregates.get(item.settings.aggregate)!.set(resampling, currentList);
        }
      });

      for (const [aggregate, aggregatedItems] of itemsByAggregates.entries()) {
        for (const [resampling, resampledItems] of aggregatedItems.entries()) {
          this.logger.debug(`Requesting ${resampledItems.length} items with aggregate ${aggregate} and resampling ${resampling}`);
          const startRequest = DateTime.now().toMillis();
          const headers: Record<string, string> = {};
          headers['Content-Type'] = 'application/json';
          const fetchOptions = {
            method: 'PUT',
            body: JSON.stringify({
              host: this.connector.settings.host,
              serverName: this.connector.settings.serverName,
              aggregate,
              resampling,
              startTime,
              endTime,
              items: resampledItems
            }),
            headers
          };
          const response = await fetch(`${this.connector.settings.agentUrl}/api/opc/${this.connector.id}/read`, fetchOptions);
          if (response.status === 200) {
            const result: {
              recordCount: number;
              content: Array<OIBusTimeValue>;
              maxInstantRetrieved: Instant;
            } = (await response.json()) as {
              recordCount: number;
              content: OIBusTimeValue[];
              maxInstantRetrieved: string;
            };
            const requestDuration = DateTime.now().toMillis() - startRequest;

            if (result.content.length > 0) {
              this.logger.debug(`Found ${result.recordCount} results for ${resampledItems.length} items in ${requestDuration} ms`);
              await this.addContent({ type: 'time-values', content: result.content });
              if (result.maxInstantRetrieved > updatedStartTime) {
                updatedStartTime = result.maxInstantRetrieved;
              }
            } else {
              this.logger.debug(`No result found. Request done in ${requestDuration} ms`);
            }
          } else if (response.status === 400) {
            const errorMessage = await response.text();
            this.logger.error(`Error occurred when querying remote agent with status ${response.status}: ${errorMessage}`);
          } else {
            this.logger.error(`Error occurred when querying remote agent with status ${response.status}`);
          }
        }
      }
      return updatedStartTime;
    } catch (error) {
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        await this.connect();
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.connected) {
      try {
        const fetchOptions = { method: 'DELETE' };
        await fetch(`${this.connector.settings.agentUrl}/api/opc/${this.connector.id}/disconnect`, fetchOptions);
      } catch (error) {
        this.logger.error(`Error while sending disconnection HTTP request into agent. ${error}`);
      }
    }
    this.connected = false;
    await super.disconnect();
    this.disconnecting = false;
  }
}
