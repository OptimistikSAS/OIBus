import NorthConnector from '../north-connector';
import { addAuthenticationToHeaders, httpSend } from '../../service/http-request-static-functions';

import manifest from './manifest';
import { NorthConnectorDTO } from '../../../shared/model/north-connector.model';
import { Authentication } from '../../../shared/model/engine.model';

import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';

/**
 * Class NorthOIAnalytics - Send files to a POST Multipart HTTP request and values as JSON payload
 * OIAnalytics endpoints are set in this connector
 */
export default class NorthOIAnalytics extends NorthConnector {
  static category = manifest.category;

  private readonly valuesUrl: string;
  private readonly fileUrl: string;
  private proxyAgent: any | null;

  constructor(
    configuration: NorthConnectorDTO,
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(configuration, encryptionService, proxyService, repositoryService, logger, baseFolder, manifest);
    const queryParam = `?dataSourceId=${this.configuration.name}`;
    this.valuesUrl = `${this.configuration.settings.host}/api/oianalytics/oibus/time-values${queryParam}`;
    this.fileUrl = `${this.configuration.settings.host}/api/oianalytics/value-upload/file${queryParam}`;
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  override async start(): Promise<void> {
    await super.start();

    if (this.configuration.settings.proxyId) {
      this.proxyAgent = await this.proxyService.createProxyAgent(this.configuration.settings.proxyId);
    }
  }

  /**
   * Handle values by sending them to OIAnalytics
   */
  override async handleValues(values: Array<any>): Promise<void> {
    // Remove empty values
    const cleanedValues = values
      .filter(
        value => value?.data?.value !== undefined && value?.data?.value !== null && value.timestamp !== null && value.pointId !== null
      )
      .map(value => ({
        timestamp: value.timestamp,
        data: value.data,
        pointId: value.pointId
      }));
    const data = JSON.stringify(cleanedValues);
    const headers = { 'Content-Type': 'application/json' };
    const authentication: Authentication = {
      type: this.configuration.settings.authentication.type,
      key: this.configuration.settings.authentication.key,
      secret: this.configuration.settings.authentication.secret
        ? await this.encryptionService.decryptText(this.configuration.settings.authentication.secret)
        : ''
    };
    addAuthenticationToHeaders(headers, authentication);
    await httpSend(this.valuesUrl, 'POST', headers, data, this.configuration.caching.timeout, this.proxyAgent);
  }

  /**
   * Handle the file by sending it to OIAnalytics.
   */
  override async handleFile(filePath: string): Promise<void> {
    const headers = {};
    const authentication: Authentication = {
      type: this.configuration.settings.authentication.type,
      key: this.configuration.settings.authentication.key,
      secret: this.configuration.settings.authentication.secret
        ? await this.encryptionService.decryptText(this.configuration.settings.authentication.secret)
        : ''
    };
    addAuthenticationToHeaders(headers, authentication);
    await httpSend(this.fileUrl, 'POST', headers, filePath, this.configuration.caching.timeout, this.proxyAgent);
  }
}
