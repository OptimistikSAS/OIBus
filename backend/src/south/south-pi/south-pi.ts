import manifest from './manifest';
import SouthConnector from '../south-connector';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';
import { SouthPIItemSettings, SouthPISettings } from '../../../../shared/model/south-settings.model';
import fetch from 'node-fetch';
import { OIBusTimeValue } from '../../../../shared/model/engine.model';

/**
 * Class SouthPI - Run a PI Agent to connect to a PI server.
 * This connector communicates with the Agent through a HTTP connection
 */
export default class SouthPI extends SouthConnector implements QueriesHistory {
  static type = manifest.id;

  private connected = false;
  private disconnecting = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    connector: SouthConnectorDTO<SouthPISettings>,
    items: Array<SouthConnectorItemDTO<SouthPIItemSettings>>,
    engineAddValuesCallback: (southId: string, values: Array<OIBusTimeValue>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, items, engineAddValuesCallback, engineAddFileCallback, encryptionService, repositoryService, logger, baseFolder);
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
        headers
      };

      await fetch(`${this.connector.settings.agentUrl}/api/pi/${this.connector.id}/connect`, fetchOptions);
      this.connected = true;
      await super.connect();
    } catch (error) {
      this.logger.error(
        `Error while sending connection HTTP request into agent. Reconnecting in ${this.connector.settings.retryInterval} ms. ${error}`
      );
      this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
    }
  }

  async testConnection(): Promise<void> {
    const headers: Record<string, string> = {};
    headers['Content-Type'] = 'application/json';
    const fetchOptions = {
      method: 'PUT',
      headers
    };
    const response = await fetch(`${this.connector.settings.agentUrl!}/api/pi/${this.connector.id}/connect`, fetchOptions);
    if (response.status === 204) {
      await fetch(`${this.connector.settings.agentUrl}/api/pi/${this.connector.id}/disconnect`, { method: 'DELETE' });
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
  async historyQuery(items: Array<SouthConnectorItemDTO<SouthPIItemSettings>>, startTime: Instant, endTime: Instant): Promise<Instant> {
    let updatedStartTime = startTime;
    this.logger.debug(`Requesting ${items.length} items`);
    const startRequest = DateTime.now().toMillis();
    const headers: Record<string, string> = {};
    headers['Content-Type'] = 'application/json';
    const fetchOptions = {
      method: 'PUT',
      body: JSON.stringify({
        startTime,
        endTime,
        items: items.map(item => ({
          name: item.name,
          type: item.settings.type,
          piPoint: item.settings.piPoint,
          piQuery: item.settings.piQuery
        }))
      }),
      headers
    };
    const response = await fetch(`${this.connector.settings.agentUrl}/api/pi/${this.connector.id}/read`, fetchOptions);
    if (response.status === 200) {
      const result: { recordCount: number; content: Array<OIBusTimeValue>; logs: Array<string>; maxInstantRetrieved: Instant } =
        (await response.json()) as {
          recordCount: number;
          content: OIBusTimeValue[];
          logs: string[];
          maxInstantRetrieved: string;
        };
      const requestDuration = DateTime.now().toMillis() - startRequest;

      if (result.logs.length > 0) {
        for (const log of result.logs) {
          this.logger.warn(log);
        }
      }
      if (result.content.length > 0) {
        this.logger.debug(`Found ${result.recordCount} results for ${items.length} items in ${requestDuration} ms`);
        await this.addValues(result.content);
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
      if (!this.disconnecting) {
        await this.disconnect();
        await this.connect();
      }
    }

    return updatedStartTime;
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
        await fetch(`${this.connector.settings.agentUrl}/api/pi/${this.connector.id}/disconnect`, fetchOptions);
      } catch (error) {
        this.logger.error(`Error while sending disconnection HTTP request into agent. ${error}`);
      }
    }
    this.connected = false;
    await super.disconnect();
    this.disconnecting = false;
  }
}
