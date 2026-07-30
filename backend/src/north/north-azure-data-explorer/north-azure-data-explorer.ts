import { ReadStream } from 'node:fs';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ClientCertificateCredential, ClientSecretCredential, DefaultAzureCredential, TokenCredential } from '@azure/identity';
import { Client, KustoConnectionStringBuilder } from 'azure-kusto-data';
import { DataFormat, IngestClient, IngestionProperties, dataFormatMappingKind } from 'azure-kusto-ingest';
import NorthConnector from '../north-connector';
import { encryptionService } from '../../service/encryption.service';
import { NorthAzureDataExplorerSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata, OIBusConnectionTestResult } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import type { ICacheService } from '../../model/cache.service.model';
import CertificateRepository from '../../repository/config/certificate.repository';

const TABLE_NAME_REGEX = /^[A-Za-z0-9_.-]+$/;

export default class NorthAzureDataExplorer extends NorthConnector<NorthAzureDataExplorerSettings> {
  private kustoClient: Client | null = null;
  private ingestClient: IngestClient | null = null;

  constructor(
    connector: NorthConnectorEntity<NorthAzureDataExplorerSettings>,
    cacheService: ICacheService,
    private readonly certificateRepository: CertificateRepository
  ) {
    super(connector, cacheService);
  }

  supportedTypes(): Array<string> {
    return ['any'];
  }

  override async start(): Promise<void> {
    await super.start();
    await this.prepareConnection(this.connector.settings);
  }

  async prepareConnection(settings: NorthAzureDataExplorerSettings): Promise<void> {
    this.logger.info(`Connecting to Azure Data Explorer cluster ${settings.clusterUrl} using ${settings.authentication} authentication`);

    const proxyAgent = await this.buildProxyAgent(settings);
    const credential = await this.buildCredential(settings);

    // Two separate connection string builders: IngestClient's autoCorrectEndpoint rewrites `dataSource` in place to
    // the `ingest-` DM endpoint, which would otherwise leave the management client pointing at the wrong host.
    const kustoKcsb = KustoConnectionStringBuilder.withTokenCredential(settings.clusterUrl, credential);
    this.kustoClient = new Client(kustoKcsb);

    const ingestKcsb = KustoConnectionStringBuilder.withTokenCredential(settings.clusterUrl, credential);
    this.ingestClient = new IngestClient(ingestKcsb, this.buildIngestionProperties());

    if (proxyAgent) {
      this.applyProxyAgent(proxyAgent);
    }
  }

  private async buildProxyAgent(settings: NorthAzureDataExplorerSettings): Promise<HttpsProxyAgent<string> | null> {
    if (!settings.useProxy) {
      return null;
    }
    const url = new URL(settings.proxyUrl!);
    if (settings.proxyUsername && settings.proxyPassword) {
      url.username = settings.proxyUsername;
      url.password = await encryptionService.decryptText(settings.proxyPassword);
    }
    // Only the host is logged: the authenticated URL carries the decrypted proxy password.
    this.logger.info(
      `Using proxy ${url.host} for Azure Data Explorer. Note that queued ingestion uploads the payload through the ` +
        `Azure Storage SDK, which does not honour this proxy: set HTTPS_PROXY at the OS level if those uploads must be proxied too.`
    );
    return new HttpsProxyAgent(url.toString());
  }

  /**
   * The Kusto SDK exposes no proxy option, but its underlying axios instances are reachable, so the agent can be
   * installed on both control-plane clients (management commands and ingestion resource discovery). `proxy: false`
   * stops axios from applying its own environment-based proxying on top of the agent.
   */
  private applyProxyAgent(agent: HttpsProxyAgent<string>): void {
    for (const client of [this.kustoClient, this.ingestClient?.resourceManager.kustoClient]) {
      if (client) {
        client.axiosInstance.defaults.httpsAgent = agent;
        client.axiosInstance.defaults.proxy = false;
      }
    }
  }

  private async buildCredential(settings: NorthAzureDataExplorerSettings): Promise<TokenCredential> {
    switch (settings.authentication) {
      case 'aad-app-secret':
        return new ClientSecretCredential(
          settings.tenantId!,
          settings.clientId!,
          await encryptionService.decryptText(settings.clientSecret!)
        );
      case 'aad-app-certificate': {
        const certificate = this.certificateRepository.findById(settings.certificateId!);
        if (!certificate) {
          throw new Error(`Could not find certificate "${settings.certificateId}"`);
        }
        const privateKey = await encryptionService.decryptText(certificate.privateKey);
        return new ClientCertificateCredential(settings.tenantId!, settings.clientId!, {
          certificate: `${certificate.certificate}\n${privateKey}`
        });
      }
      case 'managed-identity':
        return new DefaultAzureCredential();
    }
  }

  private buildIngestionProperties(): IngestionProperties {
    const settings = this.connector.settings;
    return new IngestionProperties({
      database: settings.database,
      table: settings.table,
      format: settings.dataFormat as DataFormat,
      ...(settings.ingestionMappingName
        ? {
            ingestionMappingReference: settings.ingestionMappingName,
            ingestionMappingKind: dataFormatMappingKind(settings.dataFormat as DataFormat)
          }
        : {})
    });
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    const table = this.connector.settings.table;
    if (!TABLE_NAME_REGEX.test(table)) {
      throw new Error(`Invalid table name "${table}"`);
    }

    await this.prepareConnection(this.connector.settings);

    try {
      await this.kustoClient!.executeMgmt(this.connector.settings.database, `.show table ${table} cslschema`);
    } catch (error: unknown) {
      throw new Error(`Error testing Azure Data Explorer connection: ${(error as Error).message}`);
    }

    return {
      items: [
        { key: 'Cluster', value: this.connector.settings.clusterUrl },
        { key: 'Database', value: this.connector.settings.database },
        { key: 'Table', value: this.connector.settings.table },
        { key: 'Data format', value: this.connector.settings.dataFormat }
      ]
    };
  }

  async handleContent(fileStream: ReadStream, cacheMetadata: CacheMetadata): Promise<void> {
    const database = this.connector.settings.database;
    const table = this.connector.settings.table;
    const filePath = fileStream.path as string;
    this.logger.info(`Ingesting file "${cacheMetadata.contentFile}" (${cacheMetadata.contentSize} bytes) into ${database}.${table}`);
    await this.ingestClient!.ingestFromFile(filePath, this.buildIngestionProperties());
    // Queued ingestion is asynchronous: Azure Data Explorer has accepted the batch, but the rows
    // only become queryable after its own batching latency.
    this.logger.info(`File "${cacheMetadata.contentFile}" queued for ingestion into ${database}.${table}`);
  }

  override async disconnect(): Promise<void> {
    try {
      this.ingestClient?.close();
    } catch (error: unknown) {
      this.logger.error(`Error closing Azure Data Explorer ingest client: ${(error as Error).message}`);
    }
    try {
      this.kustoClient?.close();
    } catch (error: unknown) {
      this.logger.error(`Error closing Azure Data Explorer kusto client: ${(error as Error).message}`);
    }
    this.ingestClient = null;
    this.kustoClient = null;
    await super.disconnect();
  }
}
