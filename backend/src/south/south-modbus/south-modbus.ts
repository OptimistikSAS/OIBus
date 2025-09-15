import net from 'node:net';

import { client } from 'jsmodbus';

import SouthConnector from '../south-connector';
import pino from 'pino';
import ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';
import { QueriesLastPoint } from '../south-interface';
import { DateTime } from 'luxon';
import { SouthModbusItemSettings, SouthModbusSettings } from '../../../shared/model/south-settings.model';
import { OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { connectSocket, readCoil, readDiscreteInputRegister, readHoldingRegister, readInputRegister } from '../../service/utils-modbus';

/**
 * Class SouthModbus - Provides instruction for Modbus client connection
 */
export default class SouthModbus extends SouthConnector<SouthModbusSettings, SouthModbusItemSettings> implements QueriesLastPoint {
  private socket: net.Socket | null = null;
  private modbusClient: ModbusTCPClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    connector: SouthConnectorEntity<SouthModbusSettings, SouthModbusItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    logger: pino.Logger,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, logger, cacheFolderPath);
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

  override async testConnection(): Promise<void> {
    try {
      const socket = new net.Socket();
      await connectSocket(socket, this.connector.settings);
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

  override async testItem(
    item: SouthConnectorItemEntity<SouthModbusItemSettings>,
    _testingSettings: SouthConnectorItemTestingSettings,
    callback: (data: OIBusContent) => void
  ): Promise<void> {
    try {
      const socket = new net.Socket();
      const modbusClient = new client.TCP(socket, this.connector.settings.slaveId);
      await connectSocket(socket, this.connector.settings);
      const dataValues: Array<OIBusTimeValue> = await this.modbusFunction(modbusClient, item);
      callback({
        type: 'time-values',
        content: dataValues
      });
      await this.disconnect();
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

  async lastPointQuery(items: Array<SouthConnectorItemEntity<SouthModbusItemSettings>>): Promise<void> {
    const dataValues: Array<OIBusTimeValue> = [];
    try {
      if (!this.modbusClient) {
        throw new Error('Could not read address: Modbus client not set');
      }
      const startRequest = DateTime.now().toMillis();
      for (const item of items) {
        dataValues.push(...(await this.modbusFunction(this.modbusClient, item)));
      }
      const requestDuration = DateTime.now().toMillis() - startRequest;
      this.logger.debug(`Requested ${items.length} items in ${requestDuration} ms`);
      await this.addContent({
        type: 'time-values',
        content: dataValues
      });
    } catch (error: unknown) {
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
      throw error;
    }
  }

  /**
   * Dynamically call the right function based on the given point settings
   */
  async modbusFunction(
    modbusClient: ModbusTCPClient,
    item: SouthConnectorItemEntity<SouthModbusItemSettings>
  ): Promise<Array<OIBusTimeValue>> {
    const offset = this.connector.settings.addressOffset === 'modbus' ? 0 : -1;
    const address =
      (item.settings.address.match(/^0x[0-9a-f]+$/i) ? parseInt(item.settings.address, 16) : parseInt(item.settings.address, 10)) + offset;

    let value;
    switch (item.settings.modbusType) {
      case 'coil':
        value = await readCoil(modbusClient, address);
        break;
      case 'discrete-input':
        value = await readDiscreteInputRegister(modbusClient, address);
        break;
      case 'input-register':
        value = await readInputRegister(
          modbusClient,
          address,
          this.connector.settings.swapWordsInDWords,
          this.connector.settings.swapBytesInWords,
          this.connector.settings.endianness,
          item.settings.data!.multiplierCoefficient!,
          item.settings.data!.dataType!,
          item.settings.data!.bitIndex
        );
        break;
      case 'holding-register':
        value = await readHoldingRegister(
          modbusClient,
          address,
          this.connector.settings.swapWordsInDWords,
          this.connector.settings.swapBytesInWords,
          this.connector.settings.endianness,
          item.settings.data!.multiplierCoefficient!,
          item.settings.data!.dataType!,
          item.settings.data!.bitIndex
        );
        break;
      default:
        throw new Error(`Wrong Modbus type "${item.settings.modbusType}" for point "${item.name}"`);
    }
    return [
      {
        pointId: item.name,
        timestamp: DateTime.now().toUTC().toISO()!,
        data: { value }
      }
    ];
  }
}
