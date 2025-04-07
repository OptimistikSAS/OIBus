import NorthConnector from '../north-connector';
import EncryptionService from '../../service/encryption.service';
import pino from 'pino';
import { NorthModbusSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import TransformerService from '../../service/transformer.service';
import net from 'node:net';
import ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';
import { client } from 'jsmodbus';
import fs from 'node:fs/promises';
import { OIBusModbusValue } from '../../service/transformers/oibus-time-values-to-modbus-transformer';

/**
 * Class NorthOPCUA - Write values in an OPCUA server
 */
export default class NorthModbus extends NorthConnector<NorthModbusSettings> {
  private socket: net.Socket | null = null;
  private client: ModbusTCPClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    configuration: NorthConnectorEntity<NorthModbusSettings>,
    encryptionService: EncryptionService,
    transformerService: TransformerService,
    northConnectorRepository: NorthConnectorRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(configuration, encryptionService, transformerService, northConnectorRepository, scanModeRepository, logger, baseFolders);
  }

  async handleContent(cacheMetadata: CacheMetadata): Promise<void> {
    switch (cacheMetadata.contentType) {
      case 'modbus':
        return this.handleValues(
          JSON.parse(await fs.readFile(cacheMetadata.contentFile, { encoding: 'utf-8' })) as Array<OIBusModbusValue>
        );

      default:
        this.logger.debug(`File "${cacheMetadata.contentFile}" of type ${cacheMetadata.contentType} ignored`);
        return;
    }
  }

  override async connect(): Promise<void> {
    return new Promise(resolve => {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      this.socket = new net.Socket();
      this.client = new client.TCP(this.socket, this.connector.settings.slaveId);
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
        this.logger.error(`Modbus socket error: ${error}`);
        await this.disconnect();
        if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
        }
      });
    });
  }

  override async testConnection(): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = new net.Socket();
        socket.connect({ host: this.connector.settings.host, port: this.connector.settings.port }, async () => {
          socket.end();
          resolve();
        });
        socket.on('error', async error => {
          reject(error);
        });
      });
    } catch (error: unknown) {
      switch ((error as { code: string; message: string }).code) {
        case 'ENOTFOUND':
        case 'ECONNREFUSED':
          throw new Error(`Please check host and port. ${(error as { code: string; message: string }).message}`);

        default:
          throw new Error(`Unable to connect to socket. ${(error as { code: string; message: string }).message}`);
      }
    }
  }

  async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.socket?.end();
    this.socket = null;
    this.client = null;
    this.reconnectTimeout = null;
    await super.disconnect();
    this.disconnecting = false;
  }

  private async handleValues(values: Array<OIBusModbusValue>) {
    for (const value of values) {
      await this.modbusFunction(value);
    }
  }

  async modbusFunction(modbusValue: OIBusModbusValue): Promise<void> {
    if (!this.client) {
      throw new Error('Modbus client not set. The connector cannot write values');
    }
    const offset = this.connector.settings.addressOffset === 'modbus' ? 0 : -1;
    const address =
      (modbusValue.address.match(/^0x[0-9a-f]+$/i) ? parseInt(modbusValue.address, 16) : parseInt(modbusValue.address, 10)) + offset;

    switch (modbusValue.modbusType) {
      case 'coil':
        await this.client.writeSingleCoil(address, modbusValue.value as boolean);
        break;
      case 'register':
        await this.client.writeSingleRegister(address, modbusValue.value as number);
        break;

      default:
        throw new Error(`Wrong Modbus type "${modbusValue.modbusType}" for address ${address}`);
    }
  }
}
