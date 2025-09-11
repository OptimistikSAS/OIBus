import NorthConnector from '../north-connector';
import pino from 'pino';
import { NorthModbusSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import net from 'node:net';
import ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';
import { client } from 'jsmodbus';
import fs from 'node:fs/promises';
import { OIBusModbusValue } from '../../service/transformers/connector-types.model';
import CacheService from '../../service/cache/cache.service';

/**
 * Class NorthModbus - Write values in a Modbus server
 */
export default class NorthModbus extends NorthConnector<NorthModbusSettings> {
  private socket: net.Socket | null = null;
  private modbusClient: ModbusTCPClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    configuration: NorthConnectorEntity<NorthModbusSettings>,
    logger: pino.Logger,
    cacheFolderPath: string,
    cacheService: CacheService
  ) {
    super(configuration, logger, cacheFolderPath, cacheService);
  }

  override async connect(): Promise<void> {
    return new Promise(resolve => {
      this.socket = new net.Socket();
      this.modbusClient = new client.TCP(this.socket, this.connector.settings.slaveId);
      this.logger.debug(`Connecting Modbus socket into ${this.connector.settings.host}:${this.connector.settings.port}`);
      this.socket.connect(
        {
          host: this.connector.settings.host,
          port: this.connector.settings.port
        },
        async () => {
          this.logger.info(`Modbus socket connected to ${this.connector.settings.host}:${this.connector.settings.port}`);
          await super.connect();
          resolve();
        }
      );
      this.socket.on('error', async error => {
        this.logger.error(`Modbus socket error: ${(error as Error).message}`);
        await this.disconnect();
        if (!this.disconnecting && this.connector.enabled) {
          this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.end();
      this.socket = null;
    }
    this.modbusClient = null;
    await super.disconnect();
    this.disconnecting = false;
  }

  override async testConnection(): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = new net.Socket();
        socket.connect({ host: this.connector.settings.host, port: this.connector.settings.port }, async () => {
          socket.end();
          resolve();
        });
      });
    } catch (error: unknown) {
      switch ((error as { code: string; message: string }).code) {
        case 'ENOTFOUND':
        case 'ECONNREFUSED':
          throw new Error(`Please check host and port: ${(error as Error).message}`);

        default:
          throw new Error(`Unable to connect to socket: ${(error as Error).message}`);
      }
    }
  }

  async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
    if (!this.supportedTypes().includes(cacheMetadata.contentType)) {
      throw new Error(`Unsupported data type: ${cacheMetadata.contentType} (file ${cacheMetadata.contentFile})`);
    }
    if (!this.modbusClient) {
      throw new Error('Modbus client not set. The connector cannot write values');
    }
    return this.handleValues(
      this.modbusClient,
      JSON.parse(await fs.readFile(cacheMetadata.contentFile, { encoding: 'utf-8' })) as Array<OIBusModbusValue>
    );
  }

  private async handleValues(modbusClient: ModbusTCPClient, values: Array<OIBusModbusValue>) {
    for (const value of values) {
      await this.modbusFunction(modbusClient, value);
    }
  }

  async modbusFunction(modbusClient: ModbusTCPClient, modbusValue: OIBusModbusValue): Promise<void> {
    const offset = this.connector.settings.addressOffset === 'modbus' ? 0 : -1;
    const address =
      (modbusValue.address.match(/^0x[0-9a-f]+$/i) ? parseInt(modbusValue.address, 16) : parseInt(modbusValue.address, 10)) + offset;

    switch (modbusValue.modbusType) {
      case 'coil':
        await modbusClient.writeSingleCoil(address, modbusValue.value as boolean);
        break;
      case 'register':
        await modbusClient.writeSingleRegister(address, modbusValue.value as number);
        break;

      default:
        throw new Error(`Wrong Modbus type "${modbusValue.modbusType}" for address ${address}`);
    }
  }

  supportedTypes(): Array<string> {
    return ['modbus'];
  }
}
