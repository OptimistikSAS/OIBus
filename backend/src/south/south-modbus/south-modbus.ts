import net from 'node:net';

import { client } from 'jsmodbus';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import ProxyService from '../../service/proxy.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';

/**
 * Class SouthModbus - Provides instruction for Modbus client connection
 */
export default class SouthModbus extends SouthConnector {
  static category = manifest.category;

  private socket: net.Socket | null = null;
  private client: ModbusTCPClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    configuration: SouthConnectorDTO,
    items: Array<OibusItemDTO>,
    engineAddValuesCallback: () => Promise<void>,
    engineAddFileCallback: () => Promise<void>,
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
  }

  override async lastPointQuery(items: Array<OibusItemDTO>): Promise<void> {
    try {
      for (const item of items) {
        await this.modbusFunction(item);
      }
    } catch (error: any) {
      if (error.err === 'Offline') {
        this.logger.error('Modbus server offline.');
        await this.disconnect();
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.configuration.settings.retryInterval);
      } else {
        throw new Error(error.err);
      }
    }
  }

  /**
   * Dynamically call the right function based on the given point settings
   */
  async modbusFunction(item: OibusItemDTO): Promise<void> {
    const offset = this.configuration.settings.addressOffset === 'Modbus' ? 0 : -1;
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
    const formattedData = {
      pointId: item.name,
      timestamp: new Date().toISOString(),
      data: { value: JSON.stringify(value) }
    };
    await this.addValues([formattedData]);
  }

  /**
   * Read a Modbus coil
   */
  async readCoil(address: number): Promise<number> {
    if (!this.client) {
      throw new Error('Modbus client undefined');
    }
    const { response } = await this.client.readCoils(address, 1);
    return parseInt(response.body.valuesAsArray[0].toString());
  }

  /**
   * Read a Modbus discrete input register
   */
  async readDiscreteInputRegister(address: number): Promise<number> {
    if (!this.client) {
      throw new Error('Modbus client undefined');
    }
    const { response } = await this.client.readDiscreteInputs(address, 1);
    return parseInt(response.body.valuesAsArray[0].toString());
  }

  /**
   * Read a Modbus input register
   */
  async readInputRegister(address: number, multiplier: number, dataType: string): Promise<number> {
    if (!this.client) {
      throw new Error('Modbus client undefined');
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
      throw new Error('Modbus client undefined');
    }
    const numberOfWords = this.getNumberOfWords(dataType);
    const { response } = await this.client.readHoldingRegisters(address, numberOfWords);
    return this.getValueFromBuffer(response.body.valuesAsBuffer, multiplier, dataType);
  }

  /**
   * Retrieve a value from buffer with appropriate conversion according to the modbus settings
   */
  getValueFromBuffer(buffer: any, multiplier: number, dataType: string): number {
    const endianness = this.configuration.settings.endianness === 'Big Endian' ? 'BE' : 'LE';
    const bufferFunctionName = `read${dataType}${endianness}`;
    if (!['Int16', 'UInt16'].includes(dataType)) {
      buffer.swap32().swap16();
      if (this.configuration.settings.swapWordsInDWords) {
        buffer.swap16().swap32();
      }
      if (this.configuration.settings.swapBytesInWords) {
        buffer.swap16();
      }
      const bufferValue = buffer[bufferFunctionName]();
      return parseFloat((bufferValue * multiplier).toFixed(5));
    }

    if (this.configuration.settings.swapBytesInWords) {
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
      this.client = new client.TCP(this.socket, this.configuration.settings.slaveId);
      this.logger.debug(`Connecting Modbus socket into ${this.configuration.settings.host}:${this.configuration.settings.port}`);
      this.socket.connect({ host: this.configuration.settings.host, port: this.configuration.settings.port }, async () => {
        this.logger.info(`Modbus socket connected to ${this.configuration.settings.host}:${this.configuration.settings.port}`);

        await super.connect();
        resolve();
      });
      this.socket.on('error', async error => {
        this.logger.error(`Modbus socket error: ${error}`);
        await this.disconnect();
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.configuration.settings.retryInterval);
      });
    });
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
