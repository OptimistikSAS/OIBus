import net from 'node:net';

import { client } from 'jsmodbus';

import SouthConnector from '../south-connector';
import ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';
import { SouthDirectQuery } from '../south-interface';
import { DateTime } from 'luxon';
import { SouthItemSettings, SouthModbusItemSettings, SouthModbusSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import {
  connectSocket,
  getNumberOfWords,
  getValueFromBuffer,
  parseAddress,
  readCoil,
  readDiscreteInputRegister,
  readHoldingRegister,
  readInputRegister
} from '../../service/utils-modbus';
import { Instant } from '../../model/types';
import { getErrorMessage, workUnitLogCtx } from '../../service/utils';

// Modbus Application Protocol limits (spec v1.1b3, §6.1 / §6.2 / §6.3 / §6.4)
const MAX_COIL_READ_COUNT = 2000; // FC01 / FC02
const MAX_REGISTER_WORD_COUNT = 125; // FC03 / FC04
// Number of item names quoted in a Modbus exception message before the rest is summarised
const MAX_ITEM_NAMES_IN_ERROR = 5;

/**
 * Shape of the rejection jsmodbus produces when the device answers with a Modbus exception response
 * (illegal data address, illegal function, device busy…). It is a plain object, not an Error instance.
 */
interface ModbusExceptionRejection {
  err: 'ModbusException';
  response?: { body?: { code?: number; message?: string } };
}

const isModbusExceptionRejection = (error: unknown): error is ModbusExceptionRejection =>
  typeof error === 'object' && error !== null && (error as { err?: unknown }).err === 'ModbusException';

/**
 * Raised when the device rejected one or more reads with a Modbus exception response. The device did
 * answer, so the connection is healthy and must not be torn down.
 */
class ModbusExceptionResponseError extends Error {}

const describeModbusException = (
  error: ModbusExceptionRejection,
  type: string,
  address: number,
  count: number,
  items: Array<SouthConnectorItemEntity<SouthModbusItemSettings>>
): string => {
  const code = error.response?.body?.code;
  const reason = code === undefined ? 'unknown code' : `${code} (${error.response?.body?.message ?? 'unknown'})`;
  const unit = type === 'coil' || type === 'discrete-input' ? 'bit(s)' : 'word(s)';
  const names = items
    .slice(0, MAX_ITEM_NAMES_IN_ERROR)
    .map(item => `"${item.name}"`)
    .join(', ');
  const more = items.length > MAX_ITEM_NAMES_IN_ERROR ? ` and ${items.length - MAX_ITEM_NAMES_IN_ERROR} more` : '';
  return `Modbus exception ${reason} when reading ${count} ${type} ${unit} at protocol address ${address} for item(s) ${names}${more}`;
};

/**
 * Class SouthModbus - Provides instruction for Modbus client connection
 */
export default class SouthModbus extends SouthConnector<SouthModbusSettings, SouthModbusItemSettings> implements SouthDirectQuery {
  private socket: net.Socket | null = null;
  private modbusClient: ModbusTCPClient | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    connector: SouthConnectorEntity<SouthModbusSettings, SouthModbusItemSettings>,
    engineAddContentCallback: (
      southId: string,
      data: OIBusContent,
      queryTime: Instant,
      items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, cacheFolderPath);
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
      const connectStart = DateTime.now().toMillis();
      await connectSocket(this.socket, this.connector.settings);
      const connectDuration = DateTime.now().toMillis() - connectStart;
      // Enable TCP keepalive probes so idle connections survive firewall / NAT
      // idle timeouts and stale connections are detected at the OS level.
      this.socket.setKeepAlive(true, this.connector.settings.networkTimeout);
      // Detect unexpected disconnections between scan cycles (server-side
      // timeout, network interruption, etc.) and reconnect immediately so the
      // next scan cycle does not fail on a dead socket.
      this.socket.once('close', async () => {
        if (this.disconnecting) return;
        this.logger.warn(`Modbus socket closed unexpectedly. Reconnecting in ${this.connector.settings.retryInterval} ms`);
        await this.disconnect();
        if (this.connector.enabled) {
          this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
        }
      });
      this.logger.info(
        `Modbus socket connected to ${this.connector.settings.host}:${this.connector.settings.port} in ${connectDuration} ms`
      );
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(`Modbus socket error: ${getErrorMessage(error)}`);
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
      // No duration here: unlike OPC UA's session.close(), destroying a socket is a synchronous,
      // local, always-fast operation — timing it would just add noise, not signal.
      this.logger.info(`Modbus socket disconnected from ${this.connector.settings.host}:${this.connector.settings.port}`);
    }
    this.modbusClient = null;
    await super.disconnect();
    this.disconnecting = false;
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const socket = new net.Socket();
    try {
      this.logger.debug(`Connecting Modbus socket into ${this.connector.settings.host}:${this.connector.settings.port}`);
      const connectStart = DateTime.now().toMillis();
      await connectSocket(socket, this.connector.settings);
      this.logger.info(
        `Modbus socket connected to ${this.connector.settings.host}:${this.connector.settings.port} in ${DateTime.now().toMillis() - connectStart} ms`
      );
      return {
        items: [{ key: 'RemoteAddress', value: `${socket.remoteAddress}:${socket.remotePort}` }]
      };
    } catch (error: unknown) {
      switch ((error as { code: string; message: string }).code) {
        case 'ENOTFOUND':
        case 'ECONNREFUSED':
          throw new Error(`Please check host and port: ${getErrorMessage(error)}`);
        default:
          throw new Error(`Unable to connect to socket: ${getErrorMessage(error)}`);
      }
    } finally {
      socket.destroy();
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthModbusItemSettings>,
    _testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    const socket = new net.Socket();
    try {
      const modbusClient = new client.TCP(socket, this.connector.settings.slaveId);
      this.logger.debug(`Connecting Modbus socket into ${this.connector.settings.host}:${this.connector.settings.port}`);
      const connectStart = DateTime.now().toMillis();
      await connectSocket(socket, this.connector.settings);
      const connectionDuration = DateTime.now().toMillis() - connectStart;
      this.logger.info(
        `Modbus socket connected to ${this.connector.settings.host}:${this.connector.settings.port} in ${connectionDuration} ms`
      );
      const queryStart = DateTime.now().toMillis();
      const dataValues: Array<OIBusTimeValue> = await this.modbusFunction(modbusClient, item);
      const queryDuration = DateTime.now().toMillis() - queryStart;
      return {
        result: {
          type: 'time-values',
          content: dataValues
        },
        connectionDuration,
        queryDuration
      };
    } catch (error: unknown) {
      if (isModbusExceptionRejection(error)) {
        // The device answered but rejected the read: report why instead of a misleading socket error
        throw new Error(
          describeModbusException(error, item.settings.modbusType, this.getProtocolAddress(item), this.getReadCount(item), [item])
        );
      }
      switch ((error as { code: string; message: string }).code) {
        case 'ENOTFOUND':
        case 'ECONNREFUSED':
          throw new Error(`Please check host and port: ${getErrorMessage(error)}`);
        default:
          throw new Error(`Unable to connect to socket: ${getErrorMessage(error)}`);
      }
    } finally {
      socket.destroy();
    }
  }

  async directQuery(items: Array<SouthConnectorItemEntity<SouthModbusItemSettings>>): Promise<OIBusTimeValue | null> {
    const logCtx = workUnitLogCtx(items);
    const dataValues: Array<OIBusTimeValue> = [];
    // Reads the device rejected with a Modbus exception response. They are skipped so that the other
    // items of the scan still get their values, and reported once all reads are done.
    const rejectedReads: Array<string> = [];
    try {
      if (!this.modbusClient) {
        throw new Error('Could not read address: Modbus client not set');
      }
      const modbusClient = this.modbusClient;
      const startRequest = DateTime.now();
      // Single timestamp for all values in this scan cycle
      const timestamp = startRequest.toUTC().toISO();

      // Pre-compute numeric addresses for all items in one pass
      const resolvedItems = items.map(item => ({ item, address: this.getProtocolAddress(item) }));

      // batchQuery may be undefined on connectors created before this setting existed; treat that as true
      if (this.connector.settings.batchQuery) {
        // Batch mode: group by modbusType and issue as few requests as possible
        const groups = new Map<string, Array<{ item: SouthConnectorItemEntity<SouthModbusItemSettings>; address: number }>>();
        for (const resolved of resolvedItems) {
          const key = resolved.item.settings.modbusType;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(resolved);
        }

        const groupingGap = this.connector.settings.groupingGap!;
        for (const [type, group] of groups) {
          group.sort((a, b) => a.address - b.address);
          if (type === 'coil' || type === 'discrete-input') {
            dataValues.push(
              ...(await this.queryBitsGrouped(type as 'coil' | 'discrete-input', group, timestamp, groupingGap, rejectedReads, logCtx))
            );
          } else if (type === 'input-register' || type === 'holding-register') {
            dataValues.push(
              ...(await this.queryRegistersGrouped(
                type as 'input-register' | 'holding-register',
                group,
                timestamp,
                groupingGap,
                rejectedReads,
                logCtx
              ))
            );
          }
        }
      } else {
        // Individual mode: one request per point
        for (const { item, address } of resolvedItems) {
          this.logger.trace(logCtx, `Reading item "${item.name}" (${item.settings.modbusType} at address ${item.settings.address})`);
          const values = await this.readOrSkipRejected(
            () => this.modbusFunction(modbusClient, item),
            item.settings.modbusType,
            address,
            this.getReadCount(item),
            [item],
            rejectedReads
          );
          for (const v of values ?? []) {
            dataValues.push({ ...v, timestamp });
          }
        }
      }

      const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();
      this.logger.debug(logCtx, `Requested ${items.length} items in ${requestDuration} ms`);
      await this.addContent({ type: 'time-values', content: dataValues }, startRequest.toUTC().toISO(), items);
      if (rejectedReads.length > 0) {
        throw new ModbusExceptionResponseError(`${rejectedReads.length} read(s) rejected by the device: ${rejectedReads.join('; ')}`);
      }
    } catch (error: unknown) {
      // The device answered with a Modbus exception: the connection is fine, so keep it open for the
      // next scans (and for the other scan modes sharing it) and only report the error.
      if (error instanceof ModbusExceptionResponseError) {
        throw error;
      }
      // Only tear down and (re)schedule a reconnect when this failure happened on a connection that
      // was actually up (modbusClient/socket still set). Once they are null, a reconnect is already
      // pending — either scheduled below on a previous tick or by the socket 'close' handler. Calling
      // disconnect() unconditionally on every subsequent scan-mode tick would clear that pending timer
      // and immediately re-arm a fresh one, so the retryInterval backoff would never elapse and
      // connect() would never actually be retried — the query would fail forever at scan-mode rate.
      if (this.modbusClient || this.socket) {
        await this.disconnect();
        if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
        }
      }
      throw error;
    }
    return dataValues.length > 0 ? dataValues[dataValues.length - 1] : null;
  }

  /**
   * Read a batch of coil or discrete-input items in as few requests as possible.
   * Items must already be sorted by address. Runs where the address gap between two adjacent items
   * is at most `groupingGap + 1` are merged into a single request; filler bits in the gaps are
   * read but discarded. Each run is then chunked to stay within the FC01/FC02 limit of 2 000 coils.
   */
  private async queryBitsGrouped(
    type: 'coil' | 'discrete-input',
    sortedItems: Array<{ item: SouthConnectorItemEntity<SouthModbusItemSettings>; address: number }>,
    timestamp: string,
    groupingGap: number,
    rejectedReads: Array<string>,
    logCtx: Record<string, string>
  ): Promise<Array<OIBusTimeValue>> {
    const results: Array<OIBusTimeValue> = [];
    let i = 0;
    while (i < sortedItems.length) {
      // Find the end of a run where every gap between adjacent items is ≤ groupingGap
      let j = i + 1;
      while (j < sortedItems.length && sortedItems[j].address <= sortedItems[j - 1].address + 1 + groupingGap) {
        j++;
      }
      const batch = sortedItems.slice(i, j);
      // Chunk the run to stay within the FC01/FC02 limit (measured as inclusive address range)
      let c = 0;
      while (c < batch.length) {
        let chunkEnd = c + 1;
        while (chunkEnd < batch.length && batch[chunkEnd].address - batch[c].address + 1 <= MAX_COIL_READ_COUNT) {
          chunkEnd++;
        }
        const chunk = batch.slice(c, chunkEnd);
        const count = chunk[chunk.length - 1].address - chunk[0].address + 1; // includes gap bits
        this.logger.trace(logCtx, `Reading ${chunk.length} ${type}(s) in ${count} address(es) starting at ${chunk[0].address}`);
        const values = await this.readOrSkipRejected(
          async () =>
            (type === 'coil'
              ? await this.modbusClient!.readCoils(chunk[0].address, count)
              : await this.modbusClient!.readDiscreteInputs(chunk[0].address, count)
            ).response.body.valuesAsArray,
          type,
          chunk[0].address,
          count,
          chunk.map(({ item }) => item),
          rejectedReads
        );
        if (!values) {
          c = chunkEnd;
          continue;
        }
        for (const { item, address } of chunk) {
          results.push({ pointId: item.name, timestamp, data: { value: values[address - chunk[0].address].toString() } });
        }
        c = chunkEnd;
      }
      i = j;
    }
    return results;
  }

  /**
   * Read a batch of input-register or holding-register items in as few requests as possible.
   * Items must already be sorted by address. Runs where the address gap between two adjacent items
   * (after accounting for the preceding item's word width) is at most `groupingGap` are merged into
   * a single request; filler words in the gaps are read but discarded. Each run is then chunked to
   * stay within the FC03/FC04 limit of 125 words.
   */
  private async queryRegistersGrouped(
    type: 'input-register' | 'holding-register',
    sortedItems: Array<{ item: SouthConnectorItemEntity<SouthModbusItemSettings>; address: number }>,
    timestamp: string,
    groupingGap: number,
    rejectedReads: Array<string>,
    logCtx: Record<string, string>
  ): Promise<Array<OIBusTimeValue>> {
    const results: Array<OIBusTimeValue> = [];
    let i = 0;
    while (i < sortedItems.length) {
      // Find the end of a run where every gap between adjacent items is ≤ groupingGap
      let j = i + 1;
      while (
        j < sortedItems.length &&
        sortedItems[j].address <=
          sortedItems[j - 1].address + getNumberOfWords(sortedItems[j - 1].item.settings.data!.dataType!) + groupingGap
      ) {
        j++;
      }
      const batch = sortedItems.slice(i, j);
      // Chunk the run to stay within the FC03/FC04 limit.
      // Span (first → last address + its word width) is used because gap words count against the
      // 125-word ceiling even though they are not mapped to any item.
      let c = 0;
      while (c < batch.length) {
        let chunkEnd = c + 1;
        while (chunkEnd < batch.length) {
          const last = batch[chunkEnd];
          const span = last.address - batch[c].address + getNumberOfWords(last.item.settings.data!.dataType!);
          if (span > MAX_REGISTER_WORD_COUNT) break;
          chunkEnd++;
        }
        const chunk = batch.slice(c, chunkEnd);
        const chunkStartAddress = chunk[0].address;
        const chunkLastItem = chunk[chunk.length - 1];
        const chunkWords = chunkLastItem.address - chunkStartAddress + getNumberOfWords(chunkLastItem.item.settings.data!.dataType!);

        this.logger.trace(logCtx, `Reading ${chunk.length} ${type}(s) in ${chunkWords} word(s) starting at ${chunkStartAddress}`);
        const fullBuffer = await this.readOrSkipRejected(
          async () =>
            (type === 'input-register'
              ? await this.modbusClient!.readInputRegisters(chunkStartAddress, chunkWords)
              : await this.modbusClient!.readHoldingRegisters(chunkStartAddress, chunkWords)
            ).response.body.valuesAsBuffer,
          type,
          chunkStartAddress,
          chunkWords,
          chunk.map(({ item }) => item),
          rejectedReads
        );
        if (!fullBuffer) {
          c = chunkEnd;
          continue;
        }
        for (const { item, address } of chunk) {
          const wordOffset = address - chunkStartAddress;
          const numWords = getNumberOfWords(item.settings.data!.dataType!);
          // Copy the slice so that in-place swap operations in getValueFromBuffer do not corrupt
          // adjacent items' data in the shared response buffer.
          const slice = Buffer.from(fullBuffer.subarray(wordOffset * 2, (wordOffset + numWords) * 2));
          results.push({
            pointId: item.name,
            timestamp,
            data: {
              value: getValueFromBuffer(
                slice,
                item.settings.data!.multiplierCoefficient!,
                item.settings.data!.dataType!,
                this.connector.settings.swapWordsInDWords,
                this.connector.settings.swapBytesInWords,
                this.connector.settings.endianness,
                item.settings.data!.bitIndex
              )
            }
          });
        }
        c = chunkEnd;
      }
      i = j;
    }
    return results;
  }

  /**
   * Run a read and return its result. When the device rejects it with a Modbus exception response,
   * record why in `rejectedReads` and return null so the caller can skip it; any other error (timeout,
   * closed socket…) is rethrown because it means the connection itself is in trouble.
   */
  private async readOrSkipRejected<T>(
    read: () => Promise<T>,
    type: string,
    address: number,
    count: number,
    items: Array<SouthConnectorItemEntity<SouthModbusItemSettings>>,
    rejectedReads: Array<string>
  ): Promise<T | null> {
    try {
      return await read();
    } catch (error: unknown) {
      if (!isModbusExceptionRejection(error)) throw error;
      rejectedReads.push(describeModbusException(error, type, address, count, items));
      return null;
    }
  }

  /**
   * Address sent on the wire for an item, once the connector address offset is applied
   */
  private getProtocolAddress(item: SouthConnectorItemEntity<SouthModbusItemSettings>): number {
    return parseAddress(item.settings.address) + (this.connector.settings.addressOffset === 'modbus' ? 0 : -1);
  }

  /**
   * Number of bits (coils, discrete inputs) or words (registers) read for a single item
   */
  private getReadCount(item: SouthConnectorItemEntity<SouthModbusItemSettings>): number {
    return item.settings.modbusType === 'coil' || item.settings.modbusType === 'discrete-input'
      ? 1
      : getNumberOfWords(item.settings.data!.dataType!);
  }

  /**
   * Dynamically call the right function based on the given point settings
   */
  async modbusFunction(
    modbusClient: ModbusTCPClient,
    item: SouthConnectorItemEntity<SouthModbusItemSettings>
  ): Promise<Array<OIBusTimeValue>> {
    const address = this.getProtocolAddress(item);

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
        timestamp: DateTime.now().toUTC().toISO(),
        data: { value }
      }
    ];
  }
}
