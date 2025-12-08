import SouthConnector from '../south-connector';
import { formatInstant, convertDateTimeToInstant } from '../../service/utils';
import pino from 'pino';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';
import {
  SouthRestAPISettings,
  SouthRestAPIItemSettings,
  SouthRestAPIItemSettingsDateTimeFields
} from '../../../shared/model/south-settings.model';
import { DateTimeType } from '../../../shared/model/types';
import { OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity, SouthThrottlingSettings } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { HTTPRequest, ReqAuthOptions, ReqOptions, ReqProxyOptions, ReqResponse } from '../../service/http-request.utils';
import path from 'node:path';
import fs from 'node:fs/promises';
import { replaceVariablesInJsonBody } from './utils';
import { parseJsonPath } from './jsonpath-utils';
import { encryptionService } from '../../service/encryption.service';

const extractFieldNameFromJsonPath = (jsonPath: string): string => {
  const segments = jsonPath.split('.');
  return segments[segments.length - 1]!;
};

export default class SouthRestAPI extends SouthConnector<SouthRestAPISettings, SouthRestAPIItemSettings> implements QueriesHistory {
  constructor(
    connector: SouthConnectorEntity<SouthRestAPISettings, SouthRestAPIItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    logger: pino.Logger,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, logger, cacheFolderPath);
  }

  override async testConnection(): Promise<void> {
    const host = this.connector.settings.host;
    const testEndpoint = this.connector.settings.test.endpoint || '/';
    const testMethod = this.connector.settings.test.method || 'GET';
    const successCode = this.connector.settings.test.successCode || 200;

    const requestUrl = new URL(testEndpoint, host);

    let response: ReqResponse;
    try {
      const { proxy, acceptUnauthorized } = this.getProxyOptions();
      const fetchOptions: ReqOptions = {
        method: testMethod,
        auth: await this.getAuthorizationOptions(),
        proxy,
        timeout: this.connector.settings.timeout * 1000,
        acceptUnauthorized,
        body: this.connector.settings.test.body && ['POST', 'PUT'].includes(testMethod) ? this.connector.settings.test.body : undefined
      };

      await this.handleApiKeyAuth(fetchOptions, requestUrl);

      response = await HTTPRequest(requestUrl, fetchOptions);
    } catch (error) {
      throw new Error(`Fetch error ${error}`);
    }

    if (response.statusCode !== successCode) {
      throw new Error(
        `HTTP request failed with status code ${response.statusCode}, expected ${successCode}. Message: ${await response.body.text()}`
      );
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthRestAPIItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;
    const result = await this.queryData(item, startTime, endTime);

    if (item.settings.returnType === 'file') {
      return { type: 'any', filePath: result as string };
    } else {
      // For body return type, result is JSON data - convert to time-values format
      const jsonResult = result as Array<Record<string, unknown>>;
      const { formattedResult } = this.parseData(item, jsonResult);
      return { type: 'time-values', content: formattedResult };
    }
  }

  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthRestAPIItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Instant | null> {
    let updatedStartTime: Instant | null = null;

    for (const item of items) {
      const startRequest = DateTime.now().toMillis();
      const result = await this.queryData(item, startTime, endTime);
      const requestDuration = DateTime.now().toMillis() - startRequest;

      if (item.settings.returnType === 'file') {
        const filePath = result as string;
        const stats = await fs.stat(filePath);
        if (stats.size > 0) {
          this.logger.info(`Downloaded file for item ${item.name} (${stats.size} bytes) in ${requestDuration} ms`);
          await this.addContent({ type: 'any', filePath });
        } else {
          this.logger.debug(`Empty file downloaded for item ${item.name}. Request done in ${requestDuration} ms`);
        }
      } else {
        const jsonResult = result as Array<Record<string, unknown>>;
        const { formattedResult, maxInstant } = this.parseData(item, jsonResult);

        if (!updatedStartTime || (maxInstant && maxInstant > updatedStartTime)) {
          updatedStartTime = maxInstant || updatedStartTime;
        }

        if (formattedResult.length > 0) {
          this.logger.info(`Found ${formattedResult.length} results for item ${item.name} in ${requestDuration} ms`);

          await this.addContent({ type: 'time-values', content: formattedResult });
        } else {
          this.logger.debug(`No result found for item ${item.name}. Request done in ${requestDuration} ms`);
        }
      }
    }
    return updatedStartTime;
  }

  getThrottlingSettings(settings: SouthRestAPISettings): SouthThrottlingSettings {
    return {
      maxReadInterval: settings.throttling.maxReadInterval,
      readDelay: settings.throttling.readDelay
    };
  }

  getMaxInstantPerItem(_settings: SouthRestAPISettings): boolean {
    return true;
  }

  getOverlap(settings: SouthRestAPISettings): number {
    return settings.throttling.overlap;
  }

  async queryData(
    item: SouthConnectorItemEntity<SouthRestAPIItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<Record<string, unknown>> | string> {
    const host = this.connector.settings.host;
    const requestUrl = new URL(item.settings.endpoint, host);

    const query: Record<string, string | number> = {};
    if (item.settings.queryParams) {
      for (const queryParam of item.settings.queryParams) {
        let value = queryParam.value;
        if (value.includes('@StartTime')) {
          const formattedStartTime = queryParam.dateTimeType
            ? formatInstant(startTime, {
                type: queryParam.dateTimeType,
                timezone: queryParam.dateTimeTimezone || undefined,
                format: queryParam.dateTimeFormat || undefined,
                locale: 'en-En'
              })
            : startTime;
          value = value.replace(/@StartTime/g, String(formattedStartTime));
        }
        if (value.includes('@EndTime')) {
          const formattedEndTime = queryParam.dateTimeType
            ? formatInstant(endTime, {
                type: queryParam.dateTimeType,
                timezone: queryParam.dateTimeTimezone || undefined,
                format: queryParam.dateTimeFormat || undefined,
                locale: 'en-En'
              })
            : endTime;
          value = value.replace(/@EndTime/g, String(formattedEndTime));
        }
        query[queryParam.key] = value;
      }
    }

    let body: string | undefined;
    if (item.settings.body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(item.settings.method || 'GET')) {
      const bodyDateTimeConfig = item.settings.bodyDateTimeType
        ? {
            type: item.settings.bodyDateTimeType,
            timezone: item.settings.bodyDateTimeTimezone || undefined,
            format: item.settings.bodyDateTimeFormat || undefined
          }
        : undefined;
      body = replaceVariablesInJsonBody(item.settings.body, startTime, endTime, item.settings.dateTimeFields || [], bodyDateTimeConfig);
    }

    const headers: Record<string, string> = {};
    if (item.settings.headers) {
      for (const header of item.settings.headers) {
        let headerValue = header.value;
        if (headerValue.includes('@StartTime')) {
          const formattedStartTime = header.dateTimeType
            ? formatInstant(startTime, {
                type: header.dateTimeType,
                timezone: header.dateTimeTimezone || undefined,
                format: header.dateTimeFormat || undefined,
                locale: 'en-En'
              })
            : startTime;
          headerValue = headerValue.replace(/@StartTime/g, String(formattedStartTime));
        }
        if (headerValue.includes('@EndTime')) {
          const formattedEndTime = header.dateTimeType
            ? formatInstant(endTime, {
                type: header.dateTimeType,
                timezone: header.dateTimeTimezone || undefined,
                format: header.dateTimeFormat || undefined,
                locale: 'en-En'
              })
            : endTime;
          headerValue = headerValue.replace(/@EndTime/g, String(formattedEndTime));
        }
        headers[header.key] = headerValue;
      }
    }

    if (body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    this.logger.info(
      `Requesting data from URL "${requestUrl}" with method "${item.settings.method || 'GET'}" and query params "${JSON.stringify(query)}"`
    );

    const { proxy, acceptUnauthorized } = this.getProxyOptions();
    const fetchOptions: ReqOptions = {
      method: (item.settings.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
      query,
      body,
      headers,
      auth: await this.getAuthorizationOptions(),
      proxy,
      timeout: this.connector.settings.timeout * 1000,
      acceptUnauthorized
    };

    await this.handleApiKeyAuth(fetchOptions, requestUrl);

    const response = await HTTPRequest(requestUrl, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP request failed with status code ${response.statusCode} and message: ${await response.body.text()}`);
    }

    if (item.settings.returnType === 'file') {
      const contentDisposition = response.headers['content-disposition'] as string | undefined;
      let filename = `rest-api-${item.id}-${Date.now()}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }

      const filePath = path.resolve(this.tmpFolder, filename);
      const buffer = Buffer.from(await response.body.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      return filePath;
    }

    const contentType = ((response.headers['content-type'] as string) || '').toLowerCase();
    if (contentType.includes('json')) {
      const jsonResult = (await response.body.json()) as unknown;
      if (Array.isArray(jsonResult)) {
        return jsonResult as Array<Record<string, unknown>>;
      } else if (jsonResult !== null && typeof jsonResult === 'object') {
        return [jsonResult as Record<string, unknown>];
      }
      return [{ value: jsonResult }] as Array<Record<string, unknown>>;
    } else if (contentType.includes('xml')) {
      const xmlText = await response.body.text();
      return [{ xml: xmlText }] as Array<Record<string, unknown>>;
    } else {
      try {
        const text = await response.body.text();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          return parsed as Array<Record<string, unknown>>;
        } else if (parsed !== null && typeof parsed === 'object') {
          return [parsed as Record<string, unknown>];
        } else {
          return [{ value: parsed }] as Array<Record<string, unknown>>;
        }
      } catch {
        const text = await response.body.text();
        return [{ text }] as Array<Record<string, unknown>>;
      }
    }
  }

  parseData(
    item: SouthConnectorItemEntity<SouthRestAPIItemSettings>,
    httpResult: Array<Record<string, unknown>>
  ): { formattedResult: Array<OIBusTimeValue>; maxInstant: Instant | null } {
    const formattedData: Array<OIBusTimeValue> = [];
    let maxInstant: Instant | null = null;

    if (!item.settings.dateTimeFields || item.settings.dateTimeFields.length === 0) {
      for (let i = 0; i < httpResult.length; i++) {
        const entry = httpResult[i];
        const entryKeys = Object.keys(entry);
        const pointId = entryKeys.length > 0 ? String(entry[entryKeys[0]]) : `${item.name}-${i}`;
        const timestamp = DateTime.now().toUTC().toISO()!;

        const data: { value: string | number; [key: string]: string | number } = { value: 0 };
        Object.entries(entry).forEach(([key, value]) => {
          data[key] = value as string | number;
          if (data.value === 0 && typeof value === 'number') {
            data.value = value;
          } else if (data.value === 0 && typeof value === 'string') {
            data.value = value;
          }
        });

        formattedData.push({
          pointId,
          timestamp,
          data
        });
      }
      return { formattedResult: formattedData, maxInstant: null };
    }

    const dateTimeFields: Array<SouthRestAPIItemSettingsDateTimeFields> = item.settings.dateTimeFields!;

    for (const entry of httpResult) {
      const data: { value: string | number; [key: string]: string | number } = { value: 0 };
      const processedJsonPaths = new Set<string>();
      let timestamp: Instant = DateTime.now().toUTC().toISO()!;
      let pointId: string = item.name;

      for (const dateTimeField of dateTimeFields) {
        const value = parseJsonPath(entry, dateTimeField.jsonPath);
        if (value !== undefined && value !== null) {
          const entryDate = convertDateTimeToInstant(value as string | number | Date, {
            type: dateTimeField.type as DateTimeType,
            timezone: dateTimeField.timezone,
            format: dateTimeField.format,
            locale: dateTimeField.locale
          });
          processedJsonPaths.add(dateTimeField.jsonPath);

          if (dateTimeField.useAsReference) {
            if (!maxInstant) {
              maxInstant = entryDate;
            } else if (entryDate > maxInstant) {
              maxInstant = entryDate;
            }
            timestamp = entryDate;
          }

          const outputFieldName = dateTimeField.fieldName || extractFieldNameFromJsonPath(dateTimeField.jsonPath);
          data[outputFieldName] = formatInstant(entryDate, {
            type: 'string',
            format: 'yyyy-MM-dd HH:mm:ss.SSS',
            timezone: 'UTC',
            locale: 'en-En'
          });
        }
      }

      pointId = this.copyNonDateFields(entry, processedJsonPaths, data, pointId, item.name);

      formattedData.push({
        pointId,
        timestamp,
        data
      });
    }

    return { formattedResult: formattedData, maxInstant };
  }

  private getProxyOptions(): { proxy: ReqProxyOptions | undefined; acceptUnauthorized: boolean } {
    const settings = this.connector.settings;

    if (!settings.useProxy) {
      return { proxy: undefined, acceptUnauthorized: settings.acceptUnauthorized };
    }
    if (!settings.proxyUrl) {
      throw new Error('Proxy URL not specified');
    }

    const options: ReqProxyOptions = {
      url: settings.proxyUrl
    };

    if (settings.proxyUsername) {
      options.auth = {
        type: 'url',
        username: settings.proxyUsername,
        password: settings.proxyPassword
      };
    }

    return { proxy: options, acceptUnauthorized: settings.acceptUnauthorized };
  }

  private async getAuthorizationOptions(): Promise<ReqAuthOptions | undefined> {
    const settings = this.connector.settings;

    switch (settings.authentication) {
      case 'basic': {
        if (!settings.username) return;

        return {
          type: 'basic',
          username: settings.username,
          password: settings.password
        };
      }

      case 'bearer': {
        if (!settings.token) return;

        return {
          type: 'bearer',
          token: settings.token
        };
      }

      case 'api-key': {
        // API Key auth is handled separately in handleApiKeyAuth()
        return undefined;
      }

      case 'none':
      default:
        return undefined;
    }
  }

  private async handleApiKeyAuth(options: ReqOptions, url: URL): Promise<void> {
    const settings = this.connector.settings;

    if (settings.authentication === 'api-key' && settings.apiKey && settings.apiValue) {
      const apiValue = await encryptionService.decryptText(settings.apiValue);

      if (settings.addTo === 'header') {
        if (!options.headers) options.headers = {};
        (options.headers as Record<string, string>)[settings.apiKey] = apiValue;
      } else if (settings.addTo === 'query-params') {
        url.searchParams.append(settings.apiKey, apiValue);
      }
    }
  }

  private copyNonDateFields(
    entry: Record<string, unknown>,
    processedJsonPaths: Set<string>,
    data: { value: string | number; [key: string]: string | number },
    currentPointId: string,
    itemName: string
  ): string {
    const stack: Array<{ obj: Record<string, unknown>; prefix: string }> = [{ obj: entry, prefix: '' }];

    while (stack.length > 0) {
      const { obj, prefix } = stack.pop()!;

      for (const [key, value] of Object.entries(obj)) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        if (processedJsonPaths.has(fullPath)) continue;

        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          stack.push({ obj: value as Record<string, unknown>, prefix: fullPath });
          continue;
        }

        const fieldKey = fullPath.includes('.') ? fullPath.split('.').pop()! : fullPath;
        if (fieldKey in data) continue;

        data[fieldKey] = value as string | number;

        if (currentPointId === itemName && fieldKey !== 'pointId' && fieldKey !== 'id') {
          currentPointId = String(value);
        }

        if (data.value === 0 && typeof value === 'number') {
          data.value = value;
        } else if (data.value === 0 && typeof value === 'string') {
          data.value = value;
        }
      }
    }

    return currentPointId;
  }
}
