import { ReadStream } from 'node:fs';

import mqtt from 'mqtt';
import { IConnackPacket, QoS } from 'mqtt-packet';

import { NorthMQTTSettings } from '../../../shared/model/connector/north-settings.model';
import { CacheMetadata, OIBusConnectionTestResult } from '../../../shared/model/domain/engine.model';
import { ServerIdentity, ServerIdentityTrustStatus } from '../../../shared/model/domain/server-identity.model';

import { OIBusError } from '../../model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import type CacheService from '../../service/cache/cache.service';
import type CertificateService from '../../service/certificate.service';
import { toServerNotTrustedError } from '../../service/server-trust.utils';
import { getErrorMessage, streamToString } from '../../service/utils';
import { createConnectionOptions, getMQTTProbeTarget } from '../../service/utils-mqtt';
import { TlsServerTrust } from '../../service/utils-tls';
import { OIBusMQTTValue } from '../../transformers/connector-types.model';
import NorthConnector from '../north-connector';

/**
 * Class NorthOPCUA - Write values in a MQTT broker
 */
export default class NorthMQTT extends NorthConnector<NorthMQTTSettings> {
  private client: mqtt.MqttClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    configuration: NorthConnectorEntity<NorthMQTTSettings>,
    cacheService: CacheService,
    private readonly certificateService: CertificateService
  ) {
    super(configuration, cacheService);
  }

  /** The validation of the certificate of the broker (see `TlsServerTrust`) */
  private readonly tlsServerTrust = new TlsServerTrust(
    () => this.connector.settings,
    () => this.connector.serverTrust.identity,
    certificateId => this.certificateService.findById(certificateId),
    () => getMQTTProbeTarget(this.connector.settings),
    (presented, status) => this.serverIdentityVerifier.refuse(presented, status)
  );

  override async retrieveServerIdentity(): Promise<ServerIdentity | null> {
    return await this.tlsServerTrust.retrieveServerIdentity();
  }

  /** Whether the certificate the broker presents validates (see `testConnectionWithServerIdentity`) */
  getServerIdentityTrustStatus(presented: ServerIdentity): ServerIdentityTrustStatus {
    return this.tlsServerTrust.status(presented);
  }

  /** The options of the MQTT client, validating the certificate of the broker */
  private async connectionOptions(): Promise<mqtt.IClientOptions> {
    return await createConnectionOptions(this.connector.id, this.connector.settings, this.logger, this.tlsServerTrust.tls());
  }

  /**
   * The error of a connection: when the certificate of the broker does not validate, the certificate it presents is kept
   * as pending, for a user to review and trust it, and the error tells how to
   */
  private async toConnectionError(error: unknown): Promise<unknown> {
    return (await this.tlsServerTrust.refuseIfNotTrusted(error)) ? toServerNotTrustedError(this, error) : error;
  }

  supportedTypes(): Array<string> {
    return ['mqtt'];
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    const options = await this.connectionOptions();
    let connack: IConnackPacket;
    try {
      connack = await new Promise<IConnackPacket>((resolve, reject) => {
        const client = mqtt.connect(this.connector.settings.url, options);
        client.once('connect', (packet: IConnackPacket) => {
          client.end(true, { cmd: 'disconnect', properties: { sessionExpiryInterval: 60 } });
          resolve(packet);
        });
        client.once('error', (error: Error) => {
          client.end(true);
          reject(error);
        });
      });
    } catch (error: unknown) {
      throw await this.toConnectionError(error);
    }

    const items: Array<{ key: string; value: string }> = [];
    items.push({ key: 'SessionPresent', value: String(connack.sessionPresent) });
    if (connack.properties) {
      const p = connack.properties;
      if (p.maximumQoS !== undefined) items.push({ key: 'MaximumQoS', value: String(p.maximumQoS) });
      if (p.retainAvailable !== undefined) items.push({ key: 'RetainAvailable', value: String(p.retainAvailable) });
      if (p.wildcardSubscriptionAvailable !== undefined)
        items.push({ key: 'WildcardSubscriptions', value: String(p.wildcardSubscriptionAvailable) });
      if (p.sharedSubscriptionAvailable !== undefined)
        items.push({ key: 'SharedSubscriptions', value: String(p.sharedSubscriptionAvailable) });
      if (p.maximumPacketSize !== undefined) items.push({ key: 'MaxPacketSize', value: String(p.maximumPacketSize) });
      if (p.serverKeepAlive !== undefined) items.push({ key: 'ServerKeepAlive', value: `${p.serverKeepAlive}s` });
      if (p.topicAliasMaximum !== undefined) items.push({ key: 'TopicAliasMaximum', value: String(p.topicAliasMaximum) });
    }
    return { items };
  }

  override async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      const options = await this.connectionOptions();
      this.logger.info(`Connecting to "${this.connector.settings.url}"`);

      this.client = await mqtt.connectAsync(this.connector.settings.url, options);

      this.client.once('error', async error => {
        this.logger.error(`MQTT Client error: ${error.message}`);
        await this.triggerReconnect();
      });
      this.client.once('close', async () => {
        if (this.disconnecting) {
          this.logger.debug('MQTT Client intentionally disconnected');
        } else {
          this.logger.debug(`MQTT Client closed unintentionally`);
          await this.triggerReconnect();
        }
      });

      this.logger.info(`MQTT North connector "${this.connector.name}" connected`);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(`Error while connecting to the MQTT broker: ${getErrorMessage(await this.toConnectionError(error))}`);
      await this.triggerReconnect();
    }
  }

  override async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.client) {
      this.client.removeAllListeners();
      this.client.end(true);
      this.logger.info(`Disconnected from ${this.connector.settings.url}`);
      this.client = null;
    }
    await super.disconnect();
    this.disconnecting = false;
  }

  async handleContent(fileStream: ReadStream, _cacheMetadata: CacheMetadata): Promise<void> {
    if (this.reconnectTimeout) {
      throw new OIBusError('Connector is reconnecting...', true);
    }
    const values = JSON.parse(await streamToString(fileStream)) as Array<OIBusMQTTValue>;
    for (const value of values) {
      try {
        if (!this.client) {
          throw new OIBusError('MQTT client not set. The connector cannot write values', true);
        }
        await this.client.publishAsync(value.topic, value.payload, { qos: parseInt(this.connector.settings.qos) as QoS });
      } catch (error: unknown) {
        const oibusError = new OIBusError((error as Error).message, true);
        this.logger.error(`MQTT Publish error: ${oibusError.message}`);
        await this.triggerReconnect();
        throw oibusError;
      }
    }
  }

  private async triggerReconnect(): Promise<void> {
    await this.disconnect();
    // Only schedule if not already disconnecting, enabled, and no timer already active
    if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
      this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.reconnectPeriod);
    }
  }
}
