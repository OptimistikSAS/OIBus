import { CIPDataType, ConnectionError, DiscoveredTag, Logger, PLC, TagValue, TimeoutError } from 'ethernet-ip';
import { DateTime } from 'luxon';

import { OIBusContent, OIBusPointRecord, OIBusRecord } from '../../../shared/model/common/content.model';
import {
  SouthEtherNetIPItemSettings,
  SouthEtherNetIPSettings,
  SouthItemSettings
} from '../../../shared/model/connector/south-settings.model';
import { OIBusConnectionTestResult } from '../../../shared/model/domain/engine.model';
import {
  SouthConnectorExploreEntry,
  SouthConnectorItemQueryResult,
  SouthConnectorItemTestingSettings
} from '../../../shared/model/domain/south-connector.model';

import type { ILogger } from '../../model/logger.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import { Instant } from '../../model/types';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { getErrorMessage } from '../../service/utils';
import { toExploreError } from '../explore-error';
import SouthConnector from '../south-connector';
import { SouthConfigurationDiscovery, SouthDirectQuery, SouthExplore } from '../south-interface';

const PROGRAM_PREFIX = 'Program:';

/** The full name a tag is read with: program-scoped tags are prefixed by their program */
const toTagName = (tag: DiscoveredTag): string => (tag.program ? `${PROGRAM_PREFIX}${tag.program}.${tag.name}` : tag.name);

/** The data type name of a tag: its UDT name for a structure, its CIP type otherwise */
const toDataType = (tag: DiscoveredTag): string => {
  if (tag.type.isStruct) {
    return tag.template?.name ?? 'STRUCT';
  }
  return CIPDataType[tag.type.code] ?? `0x${tag.type.code.toString(16)}`;
};

/** The dimensions of an array tag (e.g. "10x5"), empty for a scalar tag */
const toArrayDimensions = (tag: DiscoveredTag): string => tag.type.dimSizes.join('x');

/**
 * Formats a tag value as a point value: numbers as they are, booleans as 1 or 0, 64-bit integers as text (they may not
 * fit a number), raw bytes in hexadecimal, and structures and arrays as JSON.
 */
export const formatTagValue = (value: TagValue): string | number => {
  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'bigint' || Buffer.isBuffer(value)) {
    return Buffer.isBuffer(value) ? value.toString('hex') : value.toString();
  }
  return JSON.stringify(value, (_key, nested: unknown) => {
    if (typeof nested === 'bigint') {
      return nested.toString();
    }
    // JSON.stringify calls Buffer.toJSON() before the replacer: a buffer comes as { type: 'Buffer', data }
    if (nested && typeof nested === 'object' && (nested as { type?: unknown }).type === 'Buffer') {
      return Buffer.from((nested as { data: Array<number> }).data).toString('hex');
    }
    return nested;
  });
};

/**
 * Whether a read error concerns the session (connection lost, timeout) rather than the tags read (unknown tag, no
 * access, unsupported type...): the session must then be reconnected.
 */
const isSessionError = (plc: PLC, error: unknown): boolean =>
  error instanceof ConnectionError || error instanceof TimeoutError || !plc.isConnected;

/** Forwards the library logs to the connector logger, one level lower: the connector logs what matters itself */
const toLibraryLogger = (logger: ILogger): Logger => ({
  debug: (message: string) => logger.trace(`[ethernet-ip] ${message}`),
  info: (message: string) => logger.debug(`[ethernet-ip] ${message}`),
  warn: (message: string) => logger.debug(`[ethernet-ip] ${message}`),
  error: (message: string) => logger.debug(`[ethernet-ip] ${message}`)
});

/**
 * Class SouthEtherNetIP - reads the tags of a Rockwell Logix PLC (ControlLogix, CompactLogix) over EtherNet/IP (CIP).
 * Tags are addressed by name (controller-scoped "MyTag", program-scoped "Program:MainProgram.MyTag", "MyUDT.Member",
 * "MyArray[3]") and read in batches (Multiple Service Packet).
 */
export default class SouthEtherNetIP
  extends SouthConnector<SouthEtherNetIPSettings, SouthEtherNetIPItemSettings>
  implements SouthDirectQuery, SouthExplore, SouthConfigurationDiscovery
{
  private plc: PLC | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;
  // The tags listed by the last explore of the root level, to explore the programs without listing them again
  private exploredTags: Array<DiscoveredTag> | null = null;

  constructor(
    connector: SouthConnectorEntity<SouthEtherNetIPSettings, SouthEtherNetIPItemSettings>,
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

  /**
   * Connects a new PLC session. The library does not reconnect by itself: the connector does, after the retry interval.
   */
  private async openPlc(): Promise<PLC> {
    const settings = this.connector.settings;
    const plc = new PLC({ logger: toLibraryLogger(this.logger) });
    // An 'error' event without listener would throw: the error is raised again by the request that failed
    plc.on('error', (error: Error) => this.logger.debug(`EtherNet/IP transport error: ${error.message}`));
    try {
      await plc.connect(settings.host, {
        slot: settings.slot,
        timeout: settings.timeout,
        connected: settings.connectedMessaging,
        autoReconnect: false
      });
    } catch (error: unknown) {
      plc.removeAllListeners();
      await plc.disconnect().catch(() => undefined);
      throw error;
    }
    return plc;
  }

  override async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      this.logger.debug(`Connecting EtherNet/IP client to ${this.connector.settings.host} (slot ${this.connector.settings.slot})`);
      this.plc = await this.openPlc();
      // Detect unexpected disconnections between scan cycles and reconnect, so that the next scan does not fail
      this.plc.once('disconnected', async () => {
        if (this.disconnecting) return;
        this.logger.warn(`EtherNet/IP connection lost. Reconnecting in ${this.connector.settings.retryInterval} ms`);
        await this.disconnect();
        this.scheduleReconnect();
      });
      this.logger.info(`EtherNet/IP client connected to ${this.connector.settings.host} (slot ${this.connector.settings.slot})`);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(`EtherNet/IP connection error: ${getErrorMessage(error)}`);
      await this.disconnect();
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
      this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
    }
  }

  override async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.exploredTags = null;
    if (this.plc) {
      const plc = this.plc;
      this.plc = null;
      plc.removeAllListeners();
      try {
        await plc.disconnect();
      } catch (error: unknown) {
        this.logger.error(`Error while disconnecting EtherNet/IP client: ${getErrorMessage(error)}`);
      }
    }
    await super.disconnect();
    this.disconnecting = false;
  }

  /**
   * Connects a temporary session, for the connection and item tests
   */
  private async connectTestPlc(): Promise<PLC> {
    try {
      return await this.openPlc();
    } catch (error: unknown) {
      throw new Error(`Please check the host and the slot: ${getErrorMessage(error)}`);
    }
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const plc = await this.connectTestPlc();
    try {
      const tags = await plc.discover();
      return {
        items: [
          { key: 'Host', value: this.connector.settings.host },
          { key: 'Slot', value: String(this.connector.settings.slot) },
          { key: 'Tags', value: String(tags.length) }
        ]
      };
    } finally {
      await plc.disconnect().catch(() => undefined);
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthEtherNetIPItemSettings>,
    _testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    const connectStart = DateTime.now().toMillis();
    const plc = await this.connectTestPlc();
    try {
      const connectionDuration = DateTime.now().toMillis() - connectStart;
      const queryStart = DateTime.now().toMillis();
      let value: TagValue;
      try {
        value = await plc.read(item.settings.tagName);
      } catch (error: unknown) {
        throw new Error(`Could not read tag "${item.settings.tagName}": ${getErrorMessage(error)}`);
      }
      const queryDuration = DateTime.now().toMillis() - queryStart;
      return {
        result: {
          type: 'record-list',
          content: [{ pointId: item.name, timestamp: DateTime.now().toUTC().toISO()!, value: formatTagValue(value) }]
        },
        connectionDuration,
        queryDuration
      };
    } finally {
      await plc.disconnect().catch(() => undefined);
    }
  }

  async directQuery(items: Array<SouthConnectorItemEntity<SouthEtherNetIPItemSettings>>): Promise<OIBusPointRecord | null> {
    if (!this.plc || !this.plc.isConnected) {
      throw new Error('Could not read tags: EtherNet/IP client not connected');
    }
    const timestamp = DateTime.now().toUTC().toISO()!;
    let readEntries: Array<{ item: SouthConnectorItemEntity<SouthEtherNetIPItemSettings>; value: string | number }>;
    try {
      readEntries = await this.readTags(this.plc, items);
    } catch (error: unknown) {
      await this.disconnect();
      this.scheduleReconnect();
      throw error;
    }

    const cachedItems = this.applyCachingStrategy(readEntries, entry => ({ item: entry.item, value: entry.value, timestamp }));
    const dataValues: Array<OIBusPointRecord> = cachedItems.map(({ item, value }) => ({ pointId: item.name, timestamp, value }));
    await this.addContent(
      { type: 'record-list', content: dataValues },
      timestamp,
      cachedItems.map(entry => entry.item)
    );
    return dataValues.length > 0 ? dataValues[dataValues.length - 1] : null;
  }

  /**
   * Reads the tags of the items in batches. A batch fails as a whole when one of its tags can't be read (unknown tag,
   * no access...): its tags are then read one by one, to read the others and log the faulty ones. A session error
   * (connection lost, timeout) is thrown.
   */
  private async readTags(
    plc: PLC,
    items: Array<SouthConnectorItemEntity<SouthEtherNetIPItemSettings>>
  ): Promise<Array<{ item: SouthConnectorItemEntity<SouthEtherNetIPItemSettings>; value: string | number }>> {
    if (items.length === 0) {
      return [];
    }
    try {
      const values = await plc.read(items.map(item => item.settings.tagName));
      return items.map((item, index) => ({ item, value: formatTagValue(values[index]) }));
    } catch (error: unknown) {
      if (isSessionError(plc, error)) {
        throw error;
      }
      this.logger.debug(`Batch read failed (${getErrorMessage(error)}), reading the ${items.length} tags one by one`);
    }
    const readEntries: Array<{ item: SouthConnectorItemEntity<SouthEtherNetIPItemSettings>; value: string | number }> = [];
    for (const item of items) {
      try {
        readEntries.push({ item, value: formatTagValue(await plc.read(item.settings.tagName)) });
      } catch (error: unknown) {
        if (isSessionError(plc, error)) {
          throw error;
        }
        this.logger.error(`Could not read item "${item.name}" with tag "${item.settings.tagName}": ${getErrorMessage(error)}`);
      }
    }
    return readEntries;
  }

  /** The PLC session to explore or discover with: the live one when connected, a new one otherwise (closed by stop()) */
  private async getBrowsingPlc(): Promise<PLC> {
    if (this.plc?.isConnected) {
      return this.plc;
    }
    try {
      this.plc = await this.openPlc();
    } catch (error: unknown) {
      throw toExploreError(error, 'connection');
    }
    return this.plc;
  }

  /**
   * The root level lists the programs and the controller-scoped tags, a program lists its own tags. The library lists
   * the tags of every scope at once: the list read for the root level is kept to explore the programs.
   */
  async explore(parentId: string | null): Promise<Array<SouthConnectorExploreEntry>> {
    const plc = await this.getBrowsingPlc();
    if (parentId === null || !this.exploredTags) {
      this.exploredTags = await plc.discover();
    }
    const tags = this.exploredTags;
    if (parentId === null) {
      const programs = [...new Set(tags.filter(tag => tag.program).map(tag => tag.program!))].sort();
      return [
        ...programs.map(program => ({
          id: `${PROGRAM_PREFIX}${program}`,
          name: `${PROGRAM_PREFIX}${program}`,
          metadata: {},
          hasChildren: true
        })),
        ...tags.filter(tag => !tag.program).map(tag => this.toExploreEntry(tag))
      ];
    }
    const program = parentId.startsWith(PROGRAM_PREFIX) ? parentId.substring(PROGRAM_PREFIX.length) : parentId;
    return tags.filter(tag => tag.program === program).map(tag => this.toExploreEntry(tag));
  }

  private toExploreEntry(tag: DiscoveredTag): SouthConnectorExploreEntry {
    const metadata: Record<string, string | number> = { dataType: toDataType(tag) };
    const arrayDimensions = toArrayDimensions(tag);
    if (arrayDimensions) {
      metadata.arrayDimensions = arrayDimensions;
    }
    return { id: toTagName(tag), name: tag.name, metadata, hasChildren: false };
  }

  /**
   * Configuration Workflow discovery: one record per tag of the PLC - or of the `scope.rootNodeId` program - or of the
   * `scope.nodeIds` picked in the Explore modal: a picked program for all its tags, a picked tag for itself.
   */
  async discover(scope: Record<string, unknown>): Promise<Array<OIBusRecord>> {
    const plc = await this.getBrowsingPlc();
    const tags = await plc.discover();
    let selected: Array<DiscoveredTag> = tags;
    if (Array.isArray(scope.nodeIds)) {
      const nodeIds = new Set(scope.nodeIds.filter(nodeId => typeof nodeId === 'string'));
      selected = tags.filter(
        tag => nodeIds.has(toTagName(tag)) || (tag.program !== null && nodeIds.has(`${PROGRAM_PREFIX}${tag.program}`))
      );
    } else if (typeof scope.rootNodeId === 'string' && scope.rootNodeId) {
      const rootNodeId = scope.rootNodeId;
      selected = tags.filter(tag => tag.program !== null && `${PROGRAM_PREFIX}${tag.program}` === rootNodeId);
    }
    return selected.map(tag => ({
      id: toTagName(tag),
      name: tag.name,
      tagName: toTagName(tag),
      program: tag.program,
      dataType: toDataType(tag),
      structure: tag.type.isStruct,
      arrayDimensions: toArrayDimensions(tag) || null
    }));
  }
}
