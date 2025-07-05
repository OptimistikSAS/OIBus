import net from 'node:net';

import { client } from 'jsmodbus';

import SouthConnector from '../south-connector';
import pino from 'pino';
import ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';
import { QueriesLastPoint } from '../south-interface';
import { DateTime } from 'luxon';
import {
  SouthModbusItemSettings,
  SouthModbusItemSettingsDataDataType,
  SouthModbusSettings,
  SouthModbusSettingsEndianness
} from '../../../shared/model/south-settings.model';
import { OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import { BaseFolders } from '../../model/types';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';

/**
 * Class SouthModbus - Provides instruction for Modbus client connection
 */
export default class SouthModbus extends SouthConnector<SouthModbusSettings, SouthModbusItemSettings> implements QueriesLastPoint {
  private socket: net.Socket | null = null;
  private client: ModbusTCPClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    connector: SouthConnectorEntity<SouthModbusSettings, SouthModbusItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    southConnectorRepository: SouthConnectorRepository,
    southCacheRepository: SouthCacheRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolders: BaseFolders
  ) {
    super(connector, engineAddContentCallback, southConnectorRepository, southCacheRepository, scanModeRepository, logger, baseFolders);
  }

  async lastPointQuery(items: Array<SouthConnectorItemEntity<SouthModbusItemSettings>>): Promise<void> {
    const dataValues: Array<OIBusTimeValue> = [];
    try {
      const startRequest = DateTime.now().toMillis();
      for (const item of items) {
        dataValues.push(...(await this.modbusFunction(item)));
      }
      const requestDuration = DateTime.now().toMillis() - startRequest;
      this.logger.debug(`Requested ${items.length} items in ${requestDuration} ms`);
      await this.addContent({
        type: 'time-values',
        content: dataValues
      });
    } catch (error: unknown) {
      await this.addContent({
        type: 'time-values',
        content: dataValues
      });
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }

      if ((error as { err: string; message: string }).err) {
        throw new Error(`${(error as { err: string; message: string }).err} - ${(error as { err: string; message: string }).message}`);
      }
      throw error;
    }
  }

  /**
   * Dynamically call the right function based on the given point settings
   */
  async modbusFunction(item: SouthConnectorItemEntity<SouthModbusItemSettings>): Promise<Array<OIBusTimeValue>> {
    const offset = this.connector.settings.addressOffset === 'modbus' ? 0 : -1;
    const address =
      (item.settings.address.match(/^0x[0-9a-f]+$/i) ? parseInt(item.settings.address, 16) : parseInt(item.settings.address, 10)) + offset;

    let value;
    switch (item.settings.modbusType) {
      case 'coil':
        value = await this.readCoil(address);
        break;
      case 'discrete-input':
        value = await this.readDiscreteInputRegister(address);
        break;
      case 'input-register':
        value = await this.readInputRegister(
          address,
          item.settings.data!.multiplierCoefficient!,
          item.settings.data!.dataType!,
          item.settings.data!.bitIndex
        );
        break;
      case 'holding-register':
        value = await this.readHoldingRegister(
          address,
          item.settings.data!.multiplierCoefficient!,
          item.settings.data!.dataType!,
          item.settings.data!.bitIndex
        );
        break;
      default:
        throw new Error(`Wrong Modbus type "${item.settings.modbusType}" for point ${item.name}`);
    }
    return [
      {
        pointId: item.name,
        timestamp: DateTime.now().toUTC().toISO()!,
        data: { value }
      }
    ];
  }

  /**
   * Read a Modbus coil
   */
  async readCoil(address: number): Promise<string> {
    if (!this.client) {
      throw new Error('Read coil error: Modbus client not set');
    }
    const { response } = await this.client.readCoils(address, 1);
    return response.body.valuesAsArray[0].toString();
  }

  /**
   * Read a Modbus discrete input register
   */
  async readDiscreteInputRegister(address: number): Promise<string> {
    if (!this.client) {
      throw new Error('Read discrete input error: Modbus client not set');
    }
    const { response } = await this.client.readDiscreteInputs(address, 1);
    return response.body.valuesAsArray[0].toString();
  }

  /**
   * Read a Modbus input register
   */
  async readInputRegister(
    address: number,
    multiplier: number,
    dataType: SouthModbusItemSettingsDataDataType,
    bitIndex: number | undefined
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Read input error: Modbus client not set');
    }
    const numberOfWords = this.getNumberOfWords(dataType);
    const { response } = await this.client.readInputRegisters(address, numberOfWords);
    return this.getValueFromBuffer(response.body.valuesAsBuffer, multiplier, dataType, bitIndex);
  }

  /**
   * Read a Modbus holding register
   */
  async readHoldingRegister(
    address: number,
    multiplier: number,
    dataType: SouthModbusItemSettingsDataDataType,
    bitIndex: number | undefined
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Read holding error: Modbus client not set');
    }
    const numberOfWords = this.getNumberOfWords(dataType);
    const { response } = await this.client.readHoldingRegisters(address, numberOfWords);
    return this.getValueFromBuffer(response.body.valuesAsBuffer, multiplier, dataType, bitIndex);
  }

  /**
   * Retrieve a value from buffer with appropriate conversion according to the modbus settings
   */
  getValueFromBuffer(
    buffer: Buffer,
    multiplier: number,
    dataType: SouthModbusItemSettingsDataDataType,
    bitIndex: number | undefined
  ): string {
    if (!['bit', 'int16', 'uint16'].includes(dataType)) {
      buffer.swap32().swap16();
      if (this.connector.settings.swapWordsInDWords) {
        buffer.swap16().swap32();
      }
      if (this.connector.settings.swapBytesInWords) {
        buffer.swap16();
      }

      const bufferValue = this.readBuffer(buffer, dataType, this.connector.settings.endianness, 0);
      return (parseFloat(bufferValue) * multiplier).toString();
    }

    if (this.connector.settings.swapBytesInWords) {
      buffer.swap16();
    }

    const bufferValue = this.readBuffer(buffer, dataType, this.connector.settings.endianness, bitIndex || 0);
    return (parseFloat(bufferValue) * multiplier).toString();
  }

  /**
   * Initiates a connection to the right host and port.
   */
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

  override async testItem(
    item: SouthConnectorItemEntity<SouthModbusItemSettings>,
    _testingSettings: SouthConnectorItemTestingSettings,
    callback: (data: OIBusContent) => void
  ): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.socket = new net.Socket();
        this.client = new client.TCP(this.socket, this.connector.settings.slaveId);
        this.socket.connect(
          {
            host: this.connector.settings.host,
            port: this.connector.settings.port
          },
          async () => {
            const dataValues: Array<OIBusTimeValue> = await this.modbusFunction(item);
            callback({
              type: 'time-values',
              content: dataValues
            });
            await this.disconnect();
            resolve();
          }
        );
        this.socket.on('error', async error => {
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

  /**
   * Retrieve the right buffer function name according to the data type
   */
  readBuffer(
    buffer: Buffer,
    dataType: SouthModbusItemSettingsDataDataType,
    endianness: SouthModbusSettingsEndianness,
    bitIndex: number
  ): string {
    const methodSuffix = endianness === 'little-endian' ? 'LE' : 'BE';
    switch (dataType) {
      case 'uint16':
        return buffer[`readUInt16${methodSuffix}`]().toString();
      case 'int16':
        return buffer[`readInt16${methodSuffix}`]().toString();
      case 'uint32':
        return buffer[`readUInt32${methodSuffix}`]().toString();
      case 'int32':
        return buffer[`readInt32${methodSuffix}`]().toString();
      case 'big-uint64':
        return buffer[`readBigUInt64${methodSuffix}`]().toString();
      case 'big-int64':
        return buffer[`readBigInt64${methodSuffix}`]().toString();
      case 'float':
        return buffer[`readFloat${methodSuffix}`]().toString();
      case 'double':
        return buffer[`readDouble${methodSuffix}`]().toString();
      case 'bit':
        return `${(buffer[`readUInt16${methodSuffix}`]() >> bitIndex) & 1}`;
    }
  }

  /**
   * Close the connection
   */
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

  /**
   * Retrieve the number of Words in Modbus associated to each data type
   */
  getNumberOfWords(dataType: string): number {
    if (['bit', 'int16', 'uint16'].includes(dataType)) {
      return 1;
    }
    if (['uint32', 'int32', 'float'].includes(dataType)) {
      return 2;
    }
    if (['big-uint64', 'big-int64', 'double'].includes(dataType)) {
      return 4;
    }
    return 1;
  }
}
