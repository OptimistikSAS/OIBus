import net from 'node:net';

import { client } from 'jsmodbus';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import { SouthConnectorItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';
import { QueriesLastPoint, TestsConnection } from '../south-interface';
import { DateTime } from 'luxon';
import { SouthModbusItemSettings, SouthModbusSettings } from '../../../../shared/model/south-settings.model';

/**
 * Class SouthModbus - Provides instruction for Modbus client connection
 */
export default class SouthModbus
  extends SouthConnector<SouthModbusSettings, SouthModbusItemSettings>
  implements QueriesLastPoint, TestsConnection
{
  static type = manifest.id;

  private socket: net.Socket | null = null;
  private client: ModbusTCPClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    configuration: SouthConnectorDTO<SouthModbusSettings>,
    items: Array<SouthConnectorItemDTO<SouthModbusItemSettings>>,
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
      streamMode
    );
  }

  async lastPointQuery(items: Array<SouthConnectorItemDTO<SouthModbusItemSettings>>): Promise<void> {
    try {
      for (const item of items) {
        await this.modbusFunction(item);
      }
    } catch (error: any) {
      if (error.err === 'Offline') {
        this.logger.error(`Modbus server ${this.connector.settings.host}:${this.connector.settings.port} offline`);
        await this.disconnect();
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      } else {
        throw new Error(error.err);
      }
    }
  }

  /**
   * Dynamically call the right function based on the given point settings
   */
  async modbusFunction(item: SouthConnectorItemDTO<SouthModbusItemSettings>): Promise<void> {
    const offset = this.connector.settings.addressOffset === 'Modbus' ? 0 : -1;
    const address =
      (item.settings.address.match(/^0x[0-9a-f]+$/i) ? parseInt(item.settings.address, 16) : parseInt(item.settings.address, 10)) + offset;

    let value;
    switch (item.settings.modbusType) {
      case 'coil':
        value = await this.readCoil(address);
        break;
      case 'discreteInput':
        value = await this.readDiscreteInputRegister(address);
        break;
      case 'inputRegister':
        value = await this.readInputRegister(address, item.settings.multiplierCoefficient, item.settings.dataType);
        break;
      case 'holdingRegister':
        value = await this.readHoldingRegister(address, item.settings.multiplierCoefficient, item.settings.dataType);
        break;
      default:
        throw new Error(`Wrong Modbus type "${item.settings.modbusType}" for point ${item.name}`);
    }
    await this.addValues([
      {
        pointId: item.name,
        timestamp: DateTime.now().toUTC().toISO(),
        data: { value: JSON.stringify(value) }
      }
    ]);
  }

  /**
   * Read a Modbus coil
   */
  async readCoil(address: number): Promise<number> {
    if (!this.client) {
      throw new Error('Read coil error: Modbus client not set');
    }
    const { response } = await this.client.readCoils(address, 1);
    return parseInt(response.body.valuesAsArray[0].toString());
  }

  /**
   * Read a Modbus discrete input register
   */
  async readDiscreteInputRegister(address: number): Promise<number> {
    if (!this.client) {
      throw new Error('Read discrete input error: Modbus client not set');
    }
    const { response } = await this.client.readDiscreteInputs(address, 1);
    return parseInt(response.body.valuesAsArray[0].toString());
  }

  /**
   * Read a Modbus input register
   */
  async readInputRegister(address: number, multiplier: number, dataType: string): Promise<number> {
    if (!this.client) {
      throw new Error('Read input error: Modbus client not set');
    }
    const numberOfWords = this.getNumberOfWords(dataType);
    const { response } = await this.client.readInputRegisters(address, numberOfWords);
    return this.getValueFromBuffer(response.body.valuesAsBuffer, multiplier, dataType);
  }

  /**
   * Read a Modbus holding register
   */
  async readHoldingRegister(address: number, multiplier: number, dataType: string): Promise<number> {
    if (!this.client) {
      throw new Error('Read holding error: Modbus client not set');
    }
    const numberOfWords = this.getNumberOfWords(dataType);
    const { response } = await this.client.readHoldingRegisters(address, numberOfWords);
    return this.getValueFromBuffer(response.body.valuesAsBuffer, multiplier, dataType);
  }

  /**
   * Retrieve a value from buffer with appropriate conversion according to the modbus settings
   */
  getValueFromBuffer(buffer: any, multiplier: number, dataType: string): number {
    const endianness = this.connector.settings.endianness === 'Big Endian' ? 'BE' : 'LE';
    const bufferFunctionName = `read${dataType}${endianness}`;
    if (!['Int16', 'UInt16'].includes(dataType)) {
      buffer.swap32().swap16();
      if (this.connector.settings.swapWordsInDWords) {
        buffer.swap16().swap32();
      }
      if (this.connector.settings.swapBytesInWords) {
        buffer.swap16();
      }
      const bufferValue = buffer[bufferFunctionName]();
      return parseFloat((bufferValue * multiplier).toFixed(5));
    }

    if (this.connector.settings.swapBytesInWords) {
      buffer.swap16();
    }

    const bufferValue = buffer[bufferFunctionName]();
    return parseFloat((bufferValue * multiplier).toFixed(5));
  }

  /**
   * Initiates a connection to the right host and port.
   */
  override async connect(): Promise<void> {
    return new Promise(resolve => {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
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
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      });
    });
  }

  // TODO: method needs to be implemented
  static async testConnection(settings: SouthModbusSettings, logger: pino.Logger, _encryptionService: EncryptionService): Promise<void> {
    logger.trace(`Testing connection`);
    throw new Error('TODO: method needs to be implemented');
  }

  /**
   * Close the connection
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.socket?.end();
    this.socket = null;
    this.client = null;
    this.reconnectTimeout = null;
    await super.disconnect();
  }

  /**
   * Retrieve the number of Words in Modbus associated to each data type
   */
  getNumberOfWords(dataType: string): number {
    if (['Int16', 'UInt16'].includes(dataType)) {
      return 1;
    }
    if (['UInt32', 'Int32', 'Float'].includes(dataType)) {
      return 2;
    }
    if (['BigUInt64', 'BigInt64', 'Double'].includes(dataType)) {
      return 4;
    }
    return 1;
  }
}
