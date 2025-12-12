import SouthConnector from '../south-connector';
import { convertDateTimeToInstant, formatInstant, generateRandomId, sanitizeFilename } from '../../service/utils';
import pino from 'pino';
import { JSONPath } from 'jsonpath-plus';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';
import {
  SouthRestItemSettings,
  SouthRestItemSettingsTrackingInstantDateTimeInput,
  SouthRestSettings
} from '../../../shared/model/south-settings.model';
import { OIBusContent } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity, SouthThrottlingSettings } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { HTTPRequest, ReqAuthOptions, ReqOptions, ReqProxyOptions, ReqResponse } from '../../service/http-request.utils';
import path from 'node:path';
import fs from 'node:fs/promises';
import { encryptionService } from '../../service/encryption.service';

export default class SouthRest extends SouthConnector<SouthRestSettings, SouthRestItemSettings> implements QueriesHistory {
  constructor(
    connector: SouthConnectorEntity<SouthRestSettings, SouthRestItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    logger: pino.Logger,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, logger, cacheFolderPath);
  }

  override async testConnection(): Promise<void> {
    const host = this.connector.settings.host;
    const testEndpoint = this.connector.settings.test.endpoint;
    const testMethod = this.connector.settings.test.method;
    const successCode = this.connector.settings.test.successCode;

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
    } catch (error: unknown) {
      throw new Error(`Fetch error: ${(error as Error).message}`);
    }

    if (response.statusCode !== successCode) {
      throw new Error(
        `HTTP request failed with status code ${response.statusCode}, expected ${successCode}. Message: ${await response.body.text()}`
      );
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthRestItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;
    const { filename, content } = await this.queryData(item, startTime, endTime);
    return { type: 'any', filePath: filename, content };
  }

  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthRestItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Instant | null> {
    let updatedStartTime: Instant | null = null;

    for (const item of items) {
      const startRequest = DateTime.now().toMillis();
      const { filename, content, maxInstant } = await this.queryData(item, startTime, endTime);
      const requestDuration = DateTime.now().toMillis() - startRequest;

      const filePath = path.resolve(this.tmpFolder, filename);
      await fs.writeFile(filePath, content);
      const stats = await fs.stat(filePath);
      if (stats.size > 0) {
        this.logger.info(`Downloaded file for item ${item.name} (${stats.size} bytes) in ${requestDuration} ms`);
        await this.addContent({ type: 'any', filePath });
      } else {
        this.logger.debug(`Empty file downloaded for item ${item.name}. Request done in ${requestDuration} ms`);
      }
      if (!updatedStartTime || (maxInstant && maxInstant > updatedStartTime)) {
        updatedStartTime = maxInstant || updatedStartTime;
      }
    }
    return updatedStartTime;
  }

  getThrottlingSettings(settings: SouthRestSettings): SouthThrottlingSettings {
    return {
      maxReadInterval: settings.throttling.maxReadInterval,
      readDelay: settings.throttling.readDelay
    };
  }

  getMaxInstantPerItem(_settings: SouthRestSettings): boolean {
    return true;
  }

  getOverlap(settings: SouthRestSettings): number {
    return settings.throttling.overlap;
  }

  async queryData(
    item: SouthConnectorItemEntity<SouthRestItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ filename: string; content: string; maxInstant: Instant | null }> {
    const host = this.connector.settings.host;
    const requestUrl = new URL(item.settings.endpoint, host);

    const query: Record<string, string | number> = {};

    for (const queryParam of item.settings.queryParams) {
      let value = queryParam.value;
      if (value.includes('@StartTime')) {
        const formattedStartTime = formatInstant(startTime, {
          type: queryParam.dateTimeInput!.type!,
          timezone: queryParam.dateTimeInput!.timezone || undefined,
          format: queryParam.dateTimeInput!.format || undefined,
          locale: 'en-En'
        });
        value = value.replace(/@StartTime/g, String(formattedStartTime));
      }
      if (value.includes('@EndTime')) {
        const formattedEndTime = formatInstant(endTime, {
          type: queryParam.dateTimeInput!.type!,
          timezone: queryParam.dateTimeInput!.timezone || undefined,
          format: queryParam.dateTimeInput!.format || undefined,
          locale: 'en-En'
        });
        value = value.replace(/@EndTime/g, String(formattedEndTime));
      }
      query[queryParam.key] = value;
    }

    let body: string | undefined;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(item.settings.method) && item.settings.body!.content) {
      if (item.settings.body!.dateTimeInput) {
        const startInstant = formatInstant(startTime, {
          type: item.settings.body!.dateTimeInput.type!,
          timezone: item.settings.body!.dateTimeInput.timezone || undefined,
          format: item.settings.body!.dateTimeInput.format || undefined
        });
        const endInstant = formatInstant(endTime, {
          type: item.settings.body!.dateTimeInput.type!,
          timezone: item.settings.body!.dateTimeInput.timezone || undefined,
          format: item.settings.body!.dateTimeInput.format || undefined
        });
        body = item.settings.body!.content.replace(/@StartTime/g, `${startInstant}`).replace(/@EndTime/g, `${endInstant}`);
      } else {
        body = item.settings.body!.content;
      }
    }

    const headers: Record<string, string> = {};

    for (const header of item.settings.headers) {
      let headerValue = header.value;
      if (headerValue.includes('@StartTime')) {
        const formattedStartTime = formatInstant(startTime, {
          type: header.dateTimeType!,
          timezone: header.dateTimeTimezone || undefined,
          format: header.dateTimeFormat || undefined,
          locale: 'en-En'
        });
        headerValue = headerValue.replace(/@StartTime/g, String(formattedStartTime));
      }
      if (headerValue.includes('@EndTime')) {
        const formattedEndTime = formatInstant(endTime, {
          type: header.dateTimeType!,
          timezone: header.dateTimeTimezone || undefined,
          format: header.dateTimeFormat || undefined,
          locale: 'en-En'
        });
        headerValue = headerValue.replace(/@EndTime/g, String(formattedEndTime));
      }
      headers[header.key] = headerValue;
    }

    if (body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    this.logger.info(
      `Requesting data from URL "${requestUrl}" with method "${item.settings.method}" and query params "${JSON.stringify(query)}"`
    );

    const { proxy, acceptUnauthorized } = this.getProxyOptions();
    const fetchOptions: ReqOptions = {
      method: item.settings.method,
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
    let filename = sanitizeFilename(`${this.connector.name}-${item.name}-${generateRandomId(10)}`);
    if (item.settings.returnType === 'file') {
      const contentDisposition = response.headers['content-disposition'] as string | undefined;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = sanitizeFilename(filenameMatch[1]);
        }
      }
      const content = Buffer.from(await response.body.arrayBuffer()).toString();
      return { filename, content, maxInstant: null };
    }

    const contentType = ((response.headers['content-type'] as string) || '').toLowerCase();
    if (contentType.includes('json')) {
      const jsonResult = (await response.body.json()) as Record<string, unknown> | Array<Record<string, unknown>>;
      let maxInstant: Instant | null = null;
      if (item.settings.trackingInstant!.trackInstant) {
        maxInstant = this.trackMaxInstant(
          item.settings.trackingInstant!.dateTimeInput!,
          item.settings.trackingInstant!.jsonPath!,
          jsonResult
        );
      }
      return { filename: `${filename}.json`, content: JSON.stringify(jsonResult), maxInstant };
    } else if (contentType.includes('xml')) {
      const content = await response.body.text();
      return { filename: `${filename}.xml`, content, maxInstant: null };
    } else {
      const content = await response.body.text();
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) || (parsed !== null && typeof parsed === 'object')) {
          let maxInstant: Instant | null = null;
          if (item.settings.trackingInstant!.trackInstant) {
            maxInstant = this.trackMaxInstant(
              item.settings.trackingInstant!.dateTimeInput!,
              item.settings.trackingInstant!.jsonPath!,
              parsed as Record<string, unknown> | Array<Record<string, unknown>>
            );
          }
          return { filename: `${filename}.json`, content: parsed, maxInstant };
        } else {
          return { filename: `${filename}.json`, content, maxInstant: null };
        }
      } catch {
        return { filename, content, maxInstant: null };
      }
    }
  }

  trackMaxInstant(
    dateTimeInput: SouthRestItemSettingsTrackingInstantDateTimeInput,
    jsonPath: string,
    httpResult: Record<string, unknown> | Array<Record<string, unknown>>
  ): Instant | null {
    // 1. Extract ALL raw values at once using the library
    // This returns an array of found values (e.g., ["2023-01-01", "2023-01-02"])
    const rawValues = JSONPath({ json: httpResult, path: jsonPath });

    // 2. Early exit if nothing was found
    if (!rawValues || rawValues.length === 0) {
      return null;
    }

    // 3. Map to Instants and Reduce to find the Max
    return (rawValues as Array<unknown>)
      .map(value => {
        // Ensure we don't pass null/undefined to the converter
        if (!value) return null;

        return convertDateTimeToInstant(value as string | number | Date, {
          type: dateTimeInput!.type!,
          timezone: dateTimeInput!.timezone,
          format: dateTimeInput!.format,
          locale: dateTimeInput!.locale
        });
      })
      .filter((instant): instant is Instant => instant !== null) // Remove failed conversions
      .reduce((max: Instant | null, current: Instant) => {
        if (!max || current > max) {
          return current;
        }
        return max;
      }, null);
  }

  private getProxyOptions(): { proxy: ReqProxyOptions | undefined; acceptUnauthorized: boolean } {
    const settings = this.connector.settings;

    if (!settings.proxy.useProxy) {
      return { proxy: undefined, acceptUnauthorized: settings.acceptUnauthorized };
    }
    if (!settings.proxy.proxyUrl) {
      throw new Error('Proxy URL not specified');
    }

    const options: ReqProxyOptions = {
      url: settings.proxy.proxyUrl
    };

    if (settings.proxy.proxyUsername) {
      options.auth = {
        type: 'url',
        username: settings.proxy.proxyUsername,
        password: settings.proxy.proxyPassword
      };
    }

    return { proxy: options, acceptUnauthorized: settings.acceptUnauthorized };
  }

  private async getAuthorizationOptions(): Promise<ReqAuthOptions | undefined> {
    const settings = this.connector.settings;

    switch (settings.authentication.type) {
      case 'basic': {
        if (!settings.authentication.username) return;

        return {
          type: 'basic',
          username: settings.authentication.username,
          password: settings.authentication.password
        };
      }

      case 'bearer': {
        if (!settings.authentication.token) return;

        return {
          type: 'bearer',
          token: settings.authentication.token
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

    if (settings.authentication.type === 'api-key' && settings.authentication.apiKey && settings.authentication.apiValue) {
      const apiValue = await encryptionService.decryptText(settings.authentication.apiValue);

      if (settings.authentication.addTo === 'header') {
        if (!options.headers) options.headers = {};
        (options.headers as Record<string, string>)[settings.authentication.apiKey] = apiValue;
      } else {
        url.searchParams.append(settings.authentication.apiKey, apiValue);
      }
    }
  }
}
