import NorthConnector from '../north-connector';
import pino from 'pino';
import { NorthModbusSettings } from '../../../shared/model/north-settings.model';
import { CacheMetadata, OIBusConnectionTestResult } from '../../../shared/model/engine.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import net from 'node:net';
import ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';
import { client } from 'jsmodbus';
import { OIBusModbusValue } from '../../transformers/connector-types.model';
import CacheService from '../../service/cache/cache.service';
import { connectSocket } from '../../service/utils-modbus';
import { OIBusError } from '../../model/engine.model';
import { ReadStream } from 'node:fs';
import { streamToString } from '../../service/utils';

/**
 * Class NorthModbus - Write values in a Modbus server
 */
export default class NorthModbus extends NorthConnector<NorthModbusSettings> {
  private socket: net.Socket | null = null;
  private modbusClient: ModbusTCPClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(configuration: NorthConnectorEntity<NorthModbusSettings>, logger: pino.Logger, cacheService: CacheService) {
    super(configuration, logger, cacheService);
  }

  supportedTypes(): Array<string> {
    return ['modbus'];
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    const socket = new net.Socket();
    try {
      await connectSocket(socket, this.connector.settings);
      return {
        items: [{ key: 'RemoteAddress', value: `${socket.remoteAddress}:${socket.remotePort}` }]
      };
    } catch (error: unknown) {
      switch ((error as { code: string; message: string }).code) {
        case 'ENOTFOUND':
        case 'ECONNREFUSED':
          throw new Error(`Please check host and port: ${(error as Error).message}`);
        default:
          throw new Error(`Unable to connect to socket: ${(error as Error).message}`);
      }
    } finally {
      socket.destroy();
    }
  }

  override async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      this.logger.debug(`Connecting Modbus socket into ${this.connector.settings.host}:${this.connector.settings.port}`);
      this.socket = new net.Socket();
      this.modbusClient = new client.TCP(this.socket, this.connector.settings.slaveId);
      await connectSocket(this.socket, this.connector.settings);
      this.logger.info(`Modbus socket connected to ${this.connector.settings.host}:${this.connector.settings.port}`);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(`Modbus socket error: ${(error as Error).message}`);
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    }
  }

  async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    this.modbusClient = null;
    await super.disconnect();
    this.disconnecting = false;
  }

  async handleContent(fileStream: ReadStream, _cacheMetadata: CacheMetadata): Promise<void> {
    if (this.reconnectTimeout) {
      throw new OIBusError('Connector is reconnecting...', true);
    }
    const values = JSON.parse(await streamToString(fileStream)) as Array<OIBusModbusValue>;
    try {
      if (!this.modbusClient) {
        throw new OIBusError('Modbus client not set. The connector cannot write values', true);
      }
      for (const value of values) {
        await this.modbusFunction(this.modbusClient, value);
      }
    } catch (error: unknown) {
      await this.triggerReconnect();
      if (typeof error === 'object' && error !== null && 'err' in error && 'message' in error) {
        throw new OIBusError(`${error.err} - ${error.message}`, true);
      }
      throw error;
    }
  }

  private async triggerReconnect(): Promise<void> {
    await this.disconnect();
    // Only schedule if not already disconnecting, enabled, and no timer already active
    if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
      this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
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
}
