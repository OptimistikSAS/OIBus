import net from 'node:net';

import { client } from 'jsmodbus';

import SouthConnector from '../south-connector';
import manifest from './manifest';
import { SouthConnectorDTO, SouthConnectorItemDTO } from '../../../../shared/model/south-connector.model';
import EncryptionService from '../../service/encryption.service';
import RepositoryService from '../../service/repository.service';
import pino from 'pino';
import ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';
import { QueriesLastPoint } from '../south-interface';
import { DateTime } from 'luxon';
import { SouthModbusItemSettings, SouthModbusSettings } from '../../../../shared/model/south-settings.model';
import { OIBusContent, OIBusTimeValue } from '../../../../shared/model/engine.model';

/**
 * Class SouthModbus - Provides instruction for Modbus client connection
 */
export default class SouthModbus extends SouthConnector<SouthModbusSettings, SouthModbusItemSettings> implements QueriesLastPoint {
  static type = manifest.id;

  private socket: net.Socket | null = null;
  private client: ModbusTCPClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    connector: SouthConnectorDTO<SouthModbusSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    encryptionService: EncryptionService,
    repositoryService: RepositoryService,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(connector, engineAddContentCallback, encryptionService, repositoryService, logger, baseFolder);
  }

  async lastPointQuery(items: Array<SouthConnectorItemDTO<SouthModbusItemSettings>>): Promise<void> {
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
    } catch (error: any) {
      await this.addContent({
        type: 'time-values',
        content: dataValues
      });
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }

      if (error.err) {
        throw new Error(`${error.err} - ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Dynamically call the right function based on the given point settings
   */
  async modbusFunction(item: SouthConnectorItemDTO<SouthModbusItemSettings>): Promise<Array<OIBusTimeValue>> {
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
        value = await this.readInputRegister(
          address,
          item.settings.data!.multiplierCoefficient!,
          item.settings.data!.dataType!,
          item.settings.data!.bitIndex
        );
        break;
      case 'holdingRegister':
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
        data: { value: JSON.stringify(value) }
      }
    ];
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
  async readInputRegister(address: number, multiplier: number, dataType: string, bitIndex: number | undefined): Promise<number> {
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
  async readHoldingRegister(address: number, multiplier: number, dataType: string, bitIndex: number | undefined): Promise<number> {
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
  getValueFromBuffer(buffer: any, multiplier: number, dataType: string, bitIndex: number | undefined): number {
    const bufferFunctionName = this.getBufferFunctionName(dataType);
    if (!['Bit', 'Int16', 'UInt16'].includes(dataType)) {
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

    if (dataType === 'Bit') {
      return (bufferValue >> bitIndex!) & 1;
    }

    return parseFloat((bufferValue * multiplier).toFixed(5));
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
    } catch (error: any) {
      switch (error.code) {
        case 'ENOTFOUND':
        case 'ECONNREFUSED':
          throw new Error(`Please check host and port. ${error.message}`);

        default:
          throw new Error(`Unable to connect to socket. ${error.message}`);
      }
    }
  }

  override async testItem(item: SouthConnectorItemDTO<SouthModbusItemSettings>, callback: (data: OIBusContent) => void): Promise<void> {
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
            const dataValues: OIBusTimeValue[] = await this.modbusFunction(item);
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
    } catch (error: any) {
      switch (error.code) {
        case 'ENOTFOUND':
        case 'ECONNREFUSED':
          throw new Error(`Please check host and port. ${error.message}`);
        default:
          throw new Error(`Unable to connect to socket. ${error.message}`);
      }
    }
  }

  /**
   * Retrieve the right buffer function name according to the data type
   */
  getBufferFunctionName(dataType: string): string {
    const endianness = this.connector.settings.endianness === 'Big Endian' ? 'BE' : 'LE';
    if (dataType === 'Bit') {
      return `readUInt16${endianness}`;
    }

    return `read${dataType}${endianness}`;
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
    if (['Bit', 'Int16', 'UInt16'].includes(dataType)) {
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
