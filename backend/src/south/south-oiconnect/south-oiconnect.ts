import fs from 'node:fs/promises';
import path from 'node:path';

import fetch from 'node-fetch';
import https from 'https';

import manifest from './manifest';
import SouthConnector from '../south-connector';
import { parsers, httpGetWithBody, formatQueryParams, generateCSV } from './utils';
import { replaceFilenameWithVariable, compress, createFolder } from '../../service/utils';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import { Instant } from '../../../../shared/model/types';
import { DateTime } from 'luxon';

/**
 * Class SouthOIConnect - Retrieve data from REST API
 * The results are parsed through the available parsers
 */
export default class SouthOIConnect extends SouthConnector {
  static category = manifest.category;

  private readonly tmpFolder: string;
  constructor(
    configuration: SouthConnectorDTO,
    items: Array<OibusItemDTO>,
    engineAddValuesCallback: (southId: string, values: Array<any>) => Promise<void>,
    engineAddFileCallback: (southId: string, filePath: string) => Promise<void>,
    encryptionService: EncryptionService,
    proxyService: ProxyService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string,
    streamMode: boolean
  ) {
    super(
      configuration,
      items,
      engineAddValuesCallback,
      engineAddFileCallback,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      baseFolder,
      streamMode,
      manifest
    );
    this.tmpFolder = path.resolve(this.baseFolder, 'tmp');
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   */
  async start(): Promise<void> {
    await createFolder(this.tmpFolder);
    await super.start();
  }

  /**
   * Retrieve result from a REST API write them into a CSV file and send it to the Engine.
   */
  override async historyQuery(items: Array<OibusItemDTO>, startTime: Instant, endTime: Instant): Promise<Instant> {
    if (!parsers.get(this.configuration.settings.payloadParser)) {
      throw new Error(`Parser "${this.configuration.settings.payloadParser}" does not exist.`);
    }
    this.logger.debug(`Read from ${startTime} to ${endTime}`);
    const results = await this.getDataFromRestApi(startTime, endTime);

    let updatedStartTime = startTime;
    if (results) {
      let formattedResults = null;
      try {
        // Use a formatter to format the retrieved data before converting it into CSV or adding values
        const { httpResults, latestDateRetrieved } = parsers.get(this.configuration.settings.payloadParser)!(results);
        formattedResults = httpResults;
        if (latestDateRetrieved > updatedStartTime) {
          updatedStartTime = latestDateRetrieved;
        }
      } catch (parsingError) {
        this.logger.trace(`Parsing error with the results: ${results}`);
        throw new Error(`Could not format the results with parser "${this.configuration.settings.payloadParser}". Error: ${parsingError}`);
      }
      this.logger.info(`Found and parsed ${formattedResults.length} results`);

      if (formattedResults.length > 0) {
        if (this.configuration.settings.convertToCsv) {
          const fileName = replaceFilenameWithVariable(this.configuration.settings.filename, 0, this.configuration.name);
          const filePath = path.join(this.tmpFolder, fileName);

          this.logger.debug(`Converting HTTP payload to CSV file ${filePath}`);
          const csvContent = generateCSV(formattedResults, this.configuration.settings.delimiter);

          this.logger.debug(`Writing CSV file "${filePath}"`);
          await fs.writeFile(filePath, csvContent);

          if (this.configuration.settings.compression) {
            // Compress and send the compressed file
            const gzipPath = `${filePath}.gz`;
            await compress(filePath, gzipPath);

            try {
              await fs.unlink(filePath);
              this.logger.info(`File ${filePath} compressed and deleted`);
            } catch (unlinkError) {
              this.logger.error(unlinkError);
            }

            this.logger.debug(`Sending compressed file "${gzipPath}" to Engine`);
            await this.addFile(gzipPath);
            try {
              await fs.unlink(gzipPath);
              this.logger.trace(`File ${gzipPath} deleted`);
            } catch (unlinkError) {
              this.logger.error(unlinkError);
            }
          } else {
            this.logger.debug(`Sending file "${filePath}" to Engine`);
            await this.addFile(filePath);
            try {
              await fs.unlink(filePath);
              this.logger.trace(`File ${filePath} deleted`);
            } catch (unlinkError) {
              this.logger.error(unlinkError);
            }
          }
        } else {
          await this.addValues(formattedResults);
        }
      } else {
        this.logger.debug(`No result found between ${startTime} and ${endTime}`);
      }
    }
    return updatedStartTime;
  }

  async getDataFromRestApi(startTime: Instant, endTime: Instant): Promise<any> {
    const headers: Record<string, string> = {};
    switch (this.configuration.settings.authentication.type) {
      case 'basic': {
        const decryptedPassword = await this.encryptionService.decryptText(this.configuration.settings.authentication.password);
        const basic = Buffer.from(`${this.configuration.settings.authentication.username}:${decryptedPassword}`).toString('base64');
        headers.authorization = `Basic ${basic}`;
        break;
      }
      case 'api-key': {
        headers[this.configuration.settings.authentication.key] = await this.encryptionService.decryptText(
          this.configuration.settings.authentication.secret
        );
        break;
      }
      case 'bearer': {
        headers.authorization = `Bearer ${await this.encryptionService.decryptText(this.configuration.settings.authentication.token)}`;
        break;
      }
      default:
        break;
    }

    // Some API such as SLIMS uses a body with GET. It's not standard and requires a specific implementation
    if (this.configuration.settings.requestMethod === 'GET' && this.configuration.settings.body) {
      const bodyToSend = this.configuration.settings.body
        .replace(
          /@StartTime/g,
          this.configuration.settings.variableDateFormat === 'ISO'
            ? DateTime.fromISO(startTime).toUTC().toISO()
            : DateTime.fromISO(startTime).toMillis()
        )
        .replace(
          /@EndTime/g,
          this.configuration.settings.variableDateFormat === 'ISO'
            ? DateTime.fromISO(endTime).toUTC().toISO()
            : DateTime.fromISO(endTime).toMillis()
        );
      headers['content-type'] = 'application/json';
      headers['content-length'] = bodyToSend.length;
      const requestOptions = {
        method: this.configuration.settings.requestMethod,
        agent: this.configuration.settings.acceptSelfSigned ? new https.Agent({ rejectUnauthorized: false }) : null,
        timeout: this.configuration.settings.connectionTimeout,
        host: this.configuration.settings.host,
        port: this.configuration.settings.port,
        protocol: `${this.configuration.settings.protocol}:`,
        path: this.configuration.settings.endpoint,
        headers
      };

      this.logger.info(`Requesting data with ${this.configuration.settings.requestMethod} method: "${requestOptions.host}"`);

      return httpGetWithBody(bodyToSend, requestOptions);
    }

    const fetchOptions: Record<string, any> = {
      method: this.configuration.settings.requestMethod,
      headers,
      agent: this.configuration.settings.acceptSelfSigned ? new https.Agent({ rejectUnauthorized: false }) : null,
      timeout: this.configuration.settings.connectionTimeout
    };
    const requestUrl = `${this.configuration.settings.protocol}://${this.configuration.settings.host}:${this.configuration.settings.port}${
      this.configuration.settings.endpoint
    }${formatQueryParams(startTime, endTime, this.configuration.settings.queryParams, this.configuration.settings.variableDateFormat)}`;

    if (this.configuration.settings.body) {
      fetchOptions.body = this.configuration.settings.body
        .replace(
          /@StartTime/g,
          this.configuration.settings.variableDateFormat === 'ISO'
            ? DateTime.fromISO(startTime).toUTC().toISO()
            : DateTime.fromISO(startTime).toMillis()
        )
        .replace(
          /@EndTime/g,
          this.configuration.settings.variableDateFormat === 'ISO'
            ? DateTime.fromISO(endTime).toUTC().toISO()
            : DateTime.fromISO(endTime).toMillis()
        );
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.headers['Content-Length'] = fetchOptions.body.length;
    }

    this.logger.info(`Requesting data with ${this.configuration.settings.requestMethod} method: "${requestUrl}"`);

    const response = await fetch(requestUrl, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP request failed with status code ${response.status} and message: ${response.statusText}`);
    }
    return response.json();
  }
}
