import path from 'node:path';

import SouthConnector from '../south-connector';
import { createFolder, formatQueryParams, persistResults } from '../../service/utils';
import EncryptionService from '../../service/encryption.service';
import pino from 'pino';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';
import { SouthOIAnalyticsItemSettings, SouthOIAnalyticsSettings } from '../../../shared/model/south-settings.model';
import { OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { ClientCertificateCredential, ClientSecretCredential } from '@azure/identity';
import { SouthConnectorEntity, SouthConnectorItemEntity, SouthThrottlingSettings } from '../../model/south-connector.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import CertificateRepository from '../../repository/config/certificate.repository';
import { BaseFolders } from '../../model/types';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { HTTPRequest, ReqAuthOptions, ReqOptions, ReqProxyOptions, ReqResponse } from '../../service/http-request.utils';

interface OIATimeValues {
  type: string;
  data?: {
    id: string;
    dataType: string;
    reference: string;
    description: string;
  };
  unit?: {
    id: string;
    label: string;
  };
  values: Array<string | number>;
  timestamps: Array<Instant>;
}

/**
 * Class SouthOIAnalytics - Retrieve data from OIAnalytics REST API
 */
export default class SouthOIAnalytics
  extends SouthConnector<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings>
  implements QueriesHistory
{
  private readonly tmpFolder: string;

  constructor(
    connector: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    encryptionService: EncryptionService,
    southConnectorRepository: SouthConnectorRepository,
    southCacheRepository: SouthCacheRepository,
    scanModeRepository: ScanModeRepository,
    private readonly oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository,
    private readonly certificateRepository: CertificateRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(
      connector,
      engineAddContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      baseFolders
    );
    this.tmpFolder = path.resolve(this.baseFolders.cache, 'tmp');
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(dataStream = true): Promise<void> {
    if (this.connector.id !== 'test') {
      await createFolder(this.tmpFolder);
    }
    await super.start(dataStream);
  }

  override async testConnection(): Promise<void> {
    const host = this.getHost();
    const requestUrl = new URL('/api/optimistik/oibus/status', host);

    let response: ReqResponse;
    try {
      const { proxy, acceptUnauthorized } = this.getProxyOptions();
      const fetchOptions: ReqOptions = {
        method: 'GET',
        auth: await this.getAuthorizationOptions(),
        proxy,
        timeout: this.connector.settings.timeout * 1000,
        acceptUnauthorized
      };
      response = await HTTPRequest(requestUrl, fetchOptions);
    } catch (error) {
      throw new Error(`Fetch error ${error}`);
    }
    if (!response.ok) {
      throw new Error(`HTTP request failed with status code ${response.statusCode} and message: ${await response.body.text()}`);
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthOIAnalyticsItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings,
    callback: (data: OIBusContent) => void
  ): Promise<void> {
    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;
    const result: Array<OIATimeValues> = await this.queryData(item, startTime, endTime);
    const { formattedResult } = this.parseData(result);
    callback({ type: 'time-values', content: formattedResult });
  }

  /**
   * Retrieve result from a REST API write them into a CSV file and send it to the Engine.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthOIAnalyticsItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Instant | null> {
    let updatedStartTime: Instant | null = null;

    for (const item of items) {
      const startRequest = DateTime.now().toMillis();
      const result: Array<OIATimeValues> = await this.queryData(item, startTime, endTime);
      const requestDuration = DateTime.now().toMillis() - startRequest;

      const { formattedResult, maxInstant } = this.parseData(result);

      if (!updatedStartTime || maxInstant > updatedStartTime) {
        updatedStartTime = maxInstant;
      }
      if (formattedResult.length > 0) {
        this.logger.info(`Found ${formattedResult.length} results for item ${item.name} in ${requestDuration} ms`);

        await persistResults(
          formattedResult,
          item.settings.serialization,
          this.connector.name,
          item.name,
          this.tmpFolder,
          this.addContent.bind(this),
          this.logger
        );
      } else {
        this.logger.debug(`No result found for item ${item.name}. Request done in ${requestDuration} ms`);
      }
    }
    return updatedStartTime;
  }

  getThrottlingSettings(settings: SouthOIAnalyticsSettings): SouthThrottlingSettings {
    return {
      maxReadInterval: settings.throttling.maxReadInterval,
      readDelay: settings.throttling.readDelay
    };
  }

  getMaxInstantPerItem(_settings: SouthOIAnalyticsSettings): boolean {
    return true;
  }

  getOverlap(settings: SouthOIAnalyticsSettings): number {
    return settings.throttling.overlap;
  }

  async queryData(
    item: SouthConnectorItemEntity<SouthOIAnalyticsItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<OIATimeValues>> {
    const host = this.getHost();
    const requestUrl = new URL(item.settings.endpoint, host);
    const query = formatQueryParams(startTime, endTime, item.settings.queryParams || []);
    this.logger.info(`Requesting data from URL "${requestUrl}" and query params "${JSON.stringify(query)}"`);

    const { proxy, acceptUnauthorized } = this.getProxyOptions();
    const fetchOptions: ReqOptions = {
      method: 'GET',
      query,
      auth: await this.getAuthorizationOptions(),
      proxy,
      timeout: this.connector.settings.timeout * 1000,
      acceptUnauthorized
    };
    const response = await HTTPRequest(requestUrl, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP request failed with status code ${response.statusCode} and message: ${await response.body.text()}`);
    }
    return response.body.json() as unknown as Array<OIATimeValues>;
  }

  /**
   * Get proxy options if proxy is enabled
   * @throws Error if no proxy url is specified in settings
   */
  private getProxyOptions(): { proxy: ReqProxyOptions | undefined; acceptUnauthorized: boolean } {
    let settings: {
      useProxy: boolean;
      proxyUrl?: string | null;
      proxyUsername?: string | null;
      proxyPassword?: string | null;
      acceptUnauthorized: boolean;
    };
    let scope: string;

    // OIAnalytics module
    if (this.connector.settings.useOiaModule) {
      const registrationSettings = this.oIAnalyticsRegistrationRepository.get();
      if (!registrationSettings || registrationSettings.status !== 'REGISTERED') {
        throw new Error('OIBus not registered in OIAnalytics');
      }

      settings = registrationSettings;
      scope = 'registered OIAnalytics module';
    }
    // Specific settings
    else {
      settings = this.connector.settings.specificSettings!;
      scope = 'specific settings';
    }

    if (!settings.useProxy) {
      return { proxy: undefined, acceptUnauthorized: settings.acceptUnauthorized };
    }
    if (!settings.proxyUrl) {
      throw new Error(`Proxy URL not specified using ${scope}`);
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

  /**
   * Get authorization options from settings
   */
  private async getAuthorizationOptions(): Promise<ReqAuthOptions | undefined> {
    // OIAnalytics module
    if (this.connector.settings.useOiaModule) {
      const registrationSettings = this.oIAnalyticsRegistrationRepository.get();
      if (!registrationSettings || registrationSettings.status !== 'REGISTERED') {
        throw new Error('OIBus not registered in OIAnalytics');
      }

      return {
        type: 'bearer',
        token: registrationSettings.token!
      };
    }

    // Specific settings
    const specificSettings = this.connector.settings.specificSettings!;

    switch (specificSettings.authentication) {
      case 'basic': {
        if (!specificSettings.accessKey) return;

        return {
          type: 'basic',
          username: specificSettings.accessKey,
          password: specificSettings.secretKey
        };
      }

      case 'aad-client-secret': {
        const clientSecretCredential = new ClientSecretCredential(
          specificSettings.tenantId!,
          specificSettings.clientId!,
          await this.encryptionService.decryptText(specificSettings.clientSecret!)
        );
        const result = await clientSecretCredential.getToken(specificSettings.scope!);
        // Note: token needs to be encrypted when adding it to proxy options
        const token = await this.encryptionService.encryptText(`Bearer ${Buffer.from(result.token)}`);
        return {
          type: 'bearer',
          token
        };
      }

      case 'aad-certificate': {
        const certificate = this.certificateRepository.findById(specificSettings.certificateId!);
        if (certificate === null) return;

        const decryptedPrivateKey = await this.encryptionService.decryptText(certificate.privateKey);
        const clientCertificateCredential = new ClientCertificateCredential(specificSettings.tenantId!, specificSettings.clientId!, {
          certificate: `${certificate.certificate}\n${decryptedPrivateKey}`
        });
        const result = await clientCertificateCredential.getToken(specificSettings.scope!);
        // Note: token needs to be encrypted when adding it to proxy options
        const token = await this.encryptionService.encryptText(`Bearer ${Buffer.from(result.token)}`);
        return {
          type: 'bearer',
          token
        };
      }
    }
  }

  private getHost() {
    let host: string;

    if (this.connector.settings.useOiaModule) {
      const registrationSettings = this.oIAnalyticsRegistrationRepository.get();
      if (!registrationSettings || registrationSettings.status !== 'REGISTERED') {
        throw new Error('OIBus not registered in OIAnalytics');
      }
      host = registrationSettings.host;
    } else {
      const specificSettings = this.connector.settings.specificSettings!;
      host = specificSettings.host;
    }

    return host;
  }

  /**
   * Parse data from OIAnalytics time values API
   * check data from OIAnalytics API for result of
   * For now, only 'time-values' type is accepted
   * Expected data are : [
   *   {
   *     type: 'time-values',
   *     unit: { id: '2', label: '%' },
   *     data: {
   *       dataType: 'RAW_TIME_DATA',
   *       id: 'D4',
   *       reference: 'DCS_CONC_O2_MCT',
   *       description: 'Concentration O2 fermentation'
   *     },
   *     timestamps: ['2022-01-01T00:00:00Z', '2022-01-01T00:10:00Z'],
   *     values: [63.6414804414747,  87.2277880675425]
   *   },
   *   {
   *     type: 'time-values',
   *     unit: { id: '180', label: 'pH' },
   *     data: {
   *       dataType: 'RAW_TIME_DATA',
   *       id: 'D5',
   *       reference: 'DCS_PH_MCT',
   *       description: 'pH fermentation'
   *     },
   *     timestamps: ['2022-01-01T00:00:00Z', '2022-01-01T00:10:00Z'],
   *     values: [7.51604342731906,  7.5292481205665]
   *   }
   * ]
   * Return the formatted results flattened for easier access
   * (into csv files for example) and the latestDateRetrieved in ISO String format
   */
  parseData(httpResult: Array<OIATimeValues>): { formattedResult: Array<OIBusTimeValue>; maxInstant: Instant } {
    const formattedData: Array<OIBusTimeValue> = [];
    let maxInstant = DateTime.fromMillis(0).toUTC().toISO()!;
    for (const element of httpResult) {
      element.values.forEach((currentValue: string | number, index: number) => {
        const resultInstant = DateTime.fromISO(element.timestamps[index]).toUTC().toISO()!;

        formattedData.push({
          pointId: element.data!.reference,
          timestamp: resultInstant,
          data: { value: currentValue, unit: element.unit!.label }
        });
        if (resultInstant > maxInstant) {
          maxInstant = resultInstant;
        }
      });
    }
    return { formattedResult: formattedData, maxInstant };
  }
}
