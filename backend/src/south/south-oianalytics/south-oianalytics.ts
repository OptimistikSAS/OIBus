import SouthConnector from '../south-connector';
import { formatQueryParams, persistResults } from '../../service/utils';
import pino from 'pino';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { SouthHistoryQuery } from '../south-interface';
import { SouthItemSettings, SouthOIAnalyticsItemSettings, SouthOIAnalyticsSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import CertificateRepository from '../../repository/config/certificate.repository';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { HTTPRequest } from '../../service/http-request.utils';
import { buildHttpOptions, getHost, getUrl, OIATimeValues, parseData, testOIAnalyticsConnection } from '../../service/utils-oianalytics';

/**
 * Class SouthOIAnalytics - Retrieve data from OIAnalytics REST API
 */
export default class SouthOIAnalytics
  extends SouthConnector<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings>
  implements SouthHistoryQuery
{
  constructor(
    connector: SouthConnectorEntity<SouthOIAnalyticsSettings, SouthOIAnalyticsItemSettings>,
    engineAddContentCallback: (
      southId: string,
      data: OIBusContent,
      queryTime: Instant,
      items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    logger: pino.Logger,
    cacheFolderPath: string,
    private readonly certificateRepository: CertificateRepository,
    private readonly oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, logger, cacheFolderPath);
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    await testOIAnalyticsConnection(
      this.connector.settings.useOiaModule,
      registrationSettings,
      this.connector.settings.specificSettings,
      this.connector.settings.timeout * 1000,
      this.certificateRepository,
      false
    );
    return { items: [] };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthOIAnalyticsItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;
    const result: Array<OIATimeValues> = await this.queryData(item, startTime, endTime);
    const { formattedResult } = parseData(result);
    return { type: 'time-values', content: formattedResult };
  }

  /**
   * Retrieve result from a REST API write them into a CSV file and send it to the Engine.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthOIAnalyticsItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
    const item = items[0];
    const startRequest = DateTime.now();
    const result: Array<OIATimeValues> = await this.queryData(item, startTime, endTime);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();
    const { formattedResult, maxInstant } = parseData(result);

    if (formattedResult.length > 0) {
      this.logger.info(`Found ${formattedResult.length} results for item ${item.name} in ${requestDuration} ms`);
      await persistResults(
        formattedResult,
        item.settings.serialization,
        this.connector.name,
        item,
        startRequest.toUTC().toISO(),
        this.tmpFolder,
        this.addContent.bind(this),
        this.logger
      );
    } else {
      this.logger.debug(`No result found for item ${item.name}. Request done in ${requestDuration} ms`);
    }

    return { trackedInstant: maxInstant, value: formattedResult.length > 0 ? formattedResult[formattedResult.length - 1] : null };
  }

  async queryData(
    item: SouthConnectorItemEntity<SouthOIAnalyticsItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<OIATimeValues>> {
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    const httpOptions = await buildHttpOptions(
      'GET',
      this.connector.settings.useOiaModule,
      registrationSettings,
      this.connector.settings.specificSettings,
      this.connector.settings.timeout * 1000,
      this.certificateRepository
    );
    httpOptions.query = formatQueryParams(startTime, endTime, item.settings.queryParams);
    const url = getUrl(
      item.settings.endpoint,
      getHost(this.connector.settings.useOiaModule, registrationSettings, this.connector.settings.specificSettings),
      { useApiGateway: registrationSettings.useApiGateway, apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint }
    );
    this.logger.info(`Requesting data from URL "${url}" and query params "${JSON.stringify(httpOptions.query)}"`);
    const response = await HTTPRequest(url, httpOptions);
    if (!response.ok) {
      throw new Error(`HTTP request failed with status code ${response.statusCode} and message: ${await response.body.text()}`);
    }
    return response.body.json() as unknown as Array<OIATimeValues>;
  }
}
