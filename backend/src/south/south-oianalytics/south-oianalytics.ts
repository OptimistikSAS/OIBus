import { DateTime } from 'luxon';

import { OIBusContent } from '../../../shared/model/common/content.model';
import { Instant } from '../../../shared/model/common/types';
import {
  SouthItemSettings,
  SouthOIAnalyticsItemSettings,
  SouthOIAnalyticsSettings
} from '../../../shared/model/connector/south-settings.model';
import { OIBusConnectionTestResult } from '../../../shared/model/domain/engine.model';
import { ServerIdentity, ServerIdentityTrustStatus } from '../../../shared/model/domain/server-identity.model';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/domain/south-connector.model';

import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import type CertificateService from '../../service/certificate.service';
import { HTTPRequest, ReqOptions, ReqResponse } from '../../service/http-request.utils';
import { toServerNotTrustedError } from '../../service/server-trust.utils';
import { formatQueryParams, workUnitLogCtx } from '../../service/utils';
import {
  buildHttpOptions,
  getHost,
  getOIAnalyticsProbeTarget,
  getOIAnalyticsTlsSettings,
  getUrl,
  OIATimeValues,
  parseData,
  testOIAnalyticsConnection,
  toRegistrationNotTrustedError
} from '../../service/utils-oianalytics';
import { TlsServerTrust } from '../../service/utils-tls';
import SouthConnector from '../south-connector';
import { SouthHistoryQuery } from '../south-interface';

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
    cacheFolderPath: string,
    private readonly certificateService: CertificateService,
    private readonly oIAnalyticsRegistrationRepository: OIAnalyticsRegistrationRepository
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, cacheFolderPath);
  }

  /**
   * The validation of the certificate of OIAnalytics (see `TlsServerTrust`): as the registration of OIBus validates it when
   * the connector uses it (the identity of OIAnalytics is then reviewed from the registration), or as its specific settings do
   */
  private readonly tlsServerTrust = new TlsServerTrust(
    () =>
      getOIAnalyticsTlsSettings(
        this.connector.settings.useOiaModule,
        this.oIAnalyticsRegistrationRepository.get()!,
        this.connector.settings.specificSettings
      ),
    () => (this.connector.settings.useOiaModule ? null : this.connector.serverTrust.identity),
    certificateId => this.certificateService.findById(certificateId),
    () =>
      this.connector.settings.useOiaModule
        ? null
        : getOIAnalyticsProbeTarget(
            false,
            this.oIAnalyticsRegistrationRepository.get()!,
            this.connector.settings.specificSettings,
            this.connector.settings.timeout * 1000
          ),
    (presented, status, awaitingCertificate) => this.serverIdentityVerifier.refuseCertificate(presented, status, awaitingCertificate)
  );

  override async retrieveServerIdentity(): Promise<ServerIdentity | null> {
    return await this.tlsServerTrust.retrieveServerIdentity();
  }

  /** Whether the certificate OIAnalytics presents validates (see `testConnectionWithServerIdentity`) */
  getServerIdentityTrustStatus(presented: ServerIdentity): ServerIdentityTrustStatus {
    return this.tlsServerTrust.status(presented);
  }

  /**
   * Sends a request to OIAnalytics, validating its certificate: when it does not validate, the certificate OIAnalytics
   * presents is kept as pending, for a user to review and trust it (from the registration, when the connector uses it)
   */
  private async request(url: URL, options: ReqOptions): Promise<ReqResponse> {
    try {
      return await HTTPRequest(url, { ...options, tls: this.tlsServerTrust.tls() });
    } catch (error: unknown) {
      if (this.connector.settings.useOiaModule) {
        throw toRegistrationNotTrustedError(error);
      }
      if (await this.tlsServerTrust.refuseIfNotTrusted(error)) {
        throw toServerNotTrustedError(this, error);
      }
      throw error;
    }
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const registrationSettings = this.oIAnalyticsRegistrationRepository.get()!;
    await testOIAnalyticsConnection(
      this.connector.settings.useOiaModule,
      registrationSettings,
      this.connector.settings.specificSettings,
      (url, options) => this.request(url, options),
      false
    );
    return { items: [] };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthOIAnalyticsItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;
    const queryStart = DateTime.now().toMillis();
    const result: Array<OIATimeValues> = await this.queryData(item, startTime, endTime);
    const queryDuration = DateTime.now().toMillis() - queryStart;
    const { formattedResult } = parseData(result);
    return {
      result: { type: 'record-list', content: formattedResult },
      // No separate connection step in testItem() for this connector — the call above does
      // connect + query together, so connectionDuration stays 0 and queryDuration covers the whole call.
      connectionDuration: 0,
      queryDuration
    };
  }

  /**
   * Retrieve the values of an item from the OIAnalytics REST API, and send them to the Engine as point records with their
   * unit.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthOIAnalyticsItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
    const item = items[0];
    const logCtx = workUnitLogCtx(items);
    const startRequest = DateTime.now();
    const result: Array<OIATimeValues> = await this.queryData(item, startTime, endTime);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();
    const { formattedResult, maxInstant } = parseData(result);

    if (formattedResult.length > 0) {
      this.logger.info(logCtx, `Found ${formattedResult.length} results in ${requestDuration} ms`);
      await this.addContent({ type: 'record-list', content: formattedResult }, startRequest.toUTC().toISO()!, [item]);
    } else {
      this.logger.debug(logCtx, `No result found. Request done in ${requestDuration} ms`);
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
      this.certificateService
    );
    httpOptions.query = formatQueryParams(startTime, endTime, item.settings.queryParams);
    const url = getUrl(
      item.settings.endpoint,
      getHost(this.connector.settings.useOiaModule, registrationSettings, this.connector.settings.specificSettings),
      { useApiGateway: registrationSettings.useApiGateway, apiGatewayBaseEndpoint: registrationSettings.apiGatewayBaseEndpoint }
    );
    this.logger.info(workUnitLogCtx([item]), `Requesting data from URL "${url}" and query params "${JSON.stringify(httpOptions.query)}"`);
    const response = await this.request(url, httpOptions);
    if (!response.ok) {
      throw new Error(`HTTP request failed with status code ${response.statusCode} and message: ${await response.body.text()}`);
    }
    return response.body.json() as unknown as Array<OIATimeValues>;
  }
}
