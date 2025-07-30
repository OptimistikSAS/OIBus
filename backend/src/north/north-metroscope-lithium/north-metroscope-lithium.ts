import * as path from 'node:path';
import * as fs from 'node:fs/promises';

import NorthConnector from '../north-connector';
import pino from 'pino';
import EncryptionService from '../../service/encryption.service';
import { NorthMetroscopeLithiumSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata, OIBusTimeValue } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import { OIBusError } from '../../model/engine.model';
import { HTTPRequest, ReqProxyOptions, ReqResponse, retryableHttpStatusCodes } from '../../service/http-request.utils';

/**
 * Interface for sensor values in the Metroscope Lithium API
 */
interface SensorValue {
  sensorTag: string;
  mean: number;
  std?: number;
}

/**
 * Interface for snapshot in the Metroscope Lithium API
 */
interface Snapshot {
  date: string;
  acquisitionStartDate: string;
  acquisitionEndDate: string;
  group: string;
  label: string;
  sensorValues: Array<SensorValue>;
}

/**
 * Interface for the Metroscope Lithium API payload
 */
interface MetroscopeLithiumPayload {
  sourceId: string;
  snapshots: Array<Snapshot>;
}

/**
 * Class NorthMetroscopeLithium - send values to Metroscope Lithium API via PATCH request
 */
export default class NorthMetroscopeLithium extends NorthConnector<NorthMetroscopeLithiumSettings> {
  constructor(
    configuration: NorthConnectorEntity<NorthMetroscopeLithiumSettings>,
    encryptionService: EncryptionService,
    northConnectorRepository: NorthConnectorRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(configuration, encryptionService, northConnectorRepository, scanModeRepository, logger, baseFolders);
  }

  async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
    switch (cacheMetadata.contentType) {
      case 'time-values':
        return this.handleValues(JSON.parse(await fs.readFile(cacheMetadata.contentFile, { encoding: 'utf-8' })) as Array<OIBusTimeValue>);

      case 'raw':
        throw new OIBusError('Metroscope Lithium connector only supports time values, not raw files', false);
    }
  }

  /**
   * Handle time values by sending them to Metroscope Lithium API
   */
  async handleValues(values: Array<OIBusTimeValue>): Promise<void> {
    if (values.length === 0) {
      this.logger.warn('No values to send to Metroscope Lithium');
      return;
    }

    // Group values by timestamp to create snapshots
    const snapshotMap = new Map<string, Map<string, number>>();
    
    for (const value of values) {
      const iso8601Timestamp = this.ensureISO8601Format(value.timestamp);
      const pointId = value.pointId;
      const numericValue = this.parseNumericValue(value.data.value);

      if (numericValue === null) {
        this.logger.warn(`Skipping non-numeric value for point ${pointId}: ${value.data.value}`);
        continue;
      }

      if (!snapshotMap.has(iso8601Timestamp)) {
        snapshotMap.set(iso8601Timestamp, new Map());
      }
      
      snapshotMap.get(iso8601Timestamp)!.set(pointId, numericValue);
    }

    // Convert grouped values to snapshots
    const snapshots: Array<Snapshot> = [];
    const snapshotEntries = Array.from(snapshotMap.entries());
    for (let i = 0; i < snapshotEntries.length; i++) {
      const [iso8601Timestamp, sensorValues] = snapshotEntries[i];
      const sensorValuesArray: Array<SensorValue> = [];
      
      const sensorValueEntries = Array.from(sensorValues.entries());
      for (let j = 0; j < sensorValueEntries.length; j++) {
        const [sensorTag, value] = sensorValueEntries[j];
        sensorValuesArray.push({
          sensorTag,
          mean: value
        });
      }

      snapshots.push({
        date: iso8601Timestamp,
        acquisitionStartDate: iso8601Timestamp,
        acquisitionEndDate: iso8601Timestamp,
        group: this.connector.settings.group,
        label: this.connector.settings.label || '',
        sensorValues: sensorValuesArray
      });
    }

    const payload: MetroscopeLithiumPayload = {
      sourceId: this.connector.settings.sourceId,
      snapshots
    };

    await this.sendToMetroscope(payload);
  }

  /**
   * Send payload to Metroscope Lithium API
   */
  private async sendToMetroscope(payload: MetroscopeLithiumPayload): Promise<void> {
    const endpoint = new URL(this.connector.settings.endpoint);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'APIKEY': this.connector.settings.apiKey
    };

    let response: ReqResponse;
    try {
      response = await HTTPRequest(endpoint, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
        proxy: this.getProxyOptions(),
        timeout: this.connector.settings.timeout * 1000
      });
    } catch (error) {
      const message = this.getMessageFromError(error);
      throw new OIBusError(`Failed to reach Metroscope Lithium endpoint ${endpoint}; ${message}`, true);
    }

    if (!response.ok) {
      throw new OIBusError(
        `HTTP request failed with status code ${response.statusCode} and message: ${await response.body.text()}`,
        retryableHttpStatusCodes.includes(response.statusCode)
      );
    }

    this.logger.info(`Successfully sent ${payload.snapshots.length} snapshots to Metroscope Lithium`);
  }

  override async testConnection(): Promise<void> {
    // For testing, we'll send an empty payload to verify the API key and endpoint are valid
    const testPayload: MetroscopeLithiumPayload = {
      sourceId: this.connector.settings.sourceId,
      snapshots: []
    };

    const endpoint = new URL(this.connector.settings.endpoint);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'APIKEY': this.connector.settings.apiKey
    };

    let response: ReqResponse;
    try {
      response = await HTTPRequest(endpoint, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(testPayload),
        proxy: this.getProxyOptions(),
        timeout: this.connector.settings.timeout * 1000
      });
    } catch (error) {
      const message = this.getMessageFromError(error);
      throw new OIBusError(`Failed to reach Metroscope Lithium endpoint ${endpoint}; ${message}`, false);
    }

    if (!response.ok) {
      throw new OIBusError(`HTTP request failed with status code ${response.statusCode} and message: ${await response.body.text()}`, false);
    }
  }

  /**
   * Parse a value to number, returns null if not a valid number
   */
  private parseNumericValue(value: any): number | null {
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }
    
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }
    
    return null;
  }

  /**
   * Ensure timestamp is in ISO 8601 format
   * @param timestamp - The timestamp to validate and format
   * @returns ISO 8601 formatted timestamp
   */
  private ensureISO8601Format(timestamp: string): string {
    try {
      // Try to parse the timestamp as a Date
      const date = new Date(timestamp);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid timestamp: ${timestamp}`);
      }
      
      // Return ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
      return date.toISOString();
    } catch (error) {
      this.logger.error(`Failed to parse timestamp "${timestamp}": ${error}`);
      throw new OIBusError(`Invalid timestamp format: ${timestamp}. Expected ISO 8601 format.`, false);
    }
  }

  /**
   * Get proxy options if proxy is enabled
   * @throws Error if no proxy url is specified in settings
   */
  private getProxyOptions(): ReqProxyOptions | undefined {
    if (!this.connector.settings.useProxy) {
      return;
    }
    if (!this.connector.settings.proxyUrl) {
      throw new Error('Proxy URL not specified');
    }

    const options: ReqProxyOptions = {
      url: this.connector.settings.proxyUrl
    };

    if (this.connector.settings.proxyUsername) {
      options.auth = {
        type: 'basic',
        username: this.connector.settings.proxyUsername,
        password: this.connector.settings.proxyPassword
      };
    }

    return options;
  }

  /**
   * Convert an unknown request error to a readable message
   */
  private getMessageFromError(error: unknown) {
    if (!(error instanceof Error)) {
      return String(JSON.stringify(error));
    }

    const errors: Array<Error> = [error];

    // Handle AggregateError if available (Node.js 15+)
    if ('errors' in error && Array.isArray((error as any).errors)) {
      errors.push(...(error as any).errors);
    }

    const messages: Array<string> = [];

    for (const error of errors) {
      let code: string | number | undefined = undefined;
      let message: string | undefined = undefined;

      if (error.message) {
        message = `message: ${error.message}`;
      }

      if ('code' in error && error.code && (typeof error.code === 'string' || typeof error.code === 'number')) {
        code = `code: ${error.code}`;
      }

      if ([message, code].filter(Boolean).length) {
        messages.push([message, code].filter(Boolean).join(', '));
      }
    }

    return messages.join('; ');
  }
}
