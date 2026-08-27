import { AdsDataType, AdsSymbol, Client } from 'ads-client';
import SouthConnector from '../south-connector';
import { DateTime } from 'luxon';
import { Instant } from '../../../shared/model/types';
import { SouthADSItemSettings, SouthADSSettings, SouthItemSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { AdsEnumInfoEntry } from 'ads-client/dist/types/ads-protocol-types';
import { SouthDirectQuery } from '../south-interface';
import { getErrorMessage, workUnitLogCtx } from '../../service/utils';
import { shouldCacheValue } from '../../service/south-caching-strategy.service';

interface ADSOptions {
  targetAmsNetId: string;
  targetAdsPort: number;
  localAmsNetId?: string;
  localAdsPort?: number;
  routerAddress?: string;
  routerTcpPort?: number;
  autoReconnect: boolean;
}

/**
 * Class SouthADS - Provides instruction for TwinCAT ADS client connection
 */
export default class SouthADS extends SouthConnector<SouthADSSettings, SouthADSItemSettings> implements SouthDirectQuery {
  private static readonly BATCH_SIZE = 500;

  private client: Client | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;
  private symbolCache = new Map<string, { symbol: AdsSymbol; dataType: AdsDataType }>();

  constructor(
    connector: SouthConnectorEntity<SouthADSSettings, SouthADSItemSettings>,
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
   * Parse received values to convert them in points before sending them to the Cache
   */
  parseValues(
    itemName: string,
    dataType: string,
    valueToParse: unknown,
    timestamp: Instant,
    subItems: Array<AdsDataType> = [],
    enumInfo: Array<AdsEnumInfoEntry> = []
  ): Array<OIBusTimeValue> {
    let valueToAdd: string | null = null;
    /**
     * Source of the following data types:
     * https://infosys.beckhoff.com/english.php?content=../content/1033/tcplccontrol/html/tcplcctrl_plc_data_types_overview.htm&id
     * Used by TwinCAT PLC Control
     */
    switch (dataType) {
      case 'BOOL':
        if (this.connector.settings.boolAsText === 'text') {
          valueToAdd = JSON.stringify(valueToParse);
        } else {
          valueToAdd = valueToParse ? '1' : '0';
        }
        break;
      case 'BYTE':
      case 'WORD':
      case 'DWORD':
      case 'SINT':
      case 'USINT':
      case 'INT':
      case 'UINT':
      case 'DINT':
      case 'UDINT':
      case 'LINT':
      case 'ULINT':
      case 'TIME': // TIME and TIME_OF_DAY are parsed as numbers
      case 'TIME_OF_DAY':
        valueToAdd = JSON.stringify(parseInt(valueToParse as string, 10));
        break;
      case 'REAL':
      case 'LREAL':
        valueToAdd = JSON.stringify(parseFloat(valueToParse as string));
        break;
      case 'STRING':
      case dataType.match(/^STRING\([0-9]*\)$/)?.input: // Example: STRING(35)
        valueToAdd = valueToParse as string;
        break;
      case 'DATE':
      case 'DATE_AND_TIME':
        valueToAdd = DateTime.fromISO(valueToParse as string)
          .toUTC()
          .toISO()!;
        break;
      case dataType.match(/^ARRAY\s\[[0-9][0-9]*\.\.[0-9][0-9]*]\sOF\s.*$/)?.input: {
        // Example: ARRAY [0..4] OF INT
        const parsedValues = (valueToParse as Array<unknown>).map((element: unknown, index: number) =>
          this.parseValues(
            `${itemName}.${index}`,
            dataType.split(/^ARRAY\s\[[0-9][0-9]*\.\.[0-9][0-9]*]\sOF\s/)[1],
            element,
            timestamp,
            subItems,
            enumInfo
          )
        );
        return parsedValues.reduce(
          (concatenatedResults: Array<OIBusTimeValue>, result: Array<OIBusTimeValue>) => [...concatenatedResults, ...result],
          []
        );
      }
      default:
        if (subItems.length > 0) {
          // It is an ADS structure object (as json)
          const structure = this.connector.settings.structureFiltering!.find(
            (element: { name: string; fields: string }) => element.name === dataType
          );
          if (structure) {
            const parsedValues = subItems
              .filter(item => structure.fields === '*' || structure.fields.split(',').includes(item.name))
              .map(subItem =>
                this.parseValues(
                  `${itemName}.${subItem.name}`,
                  subItem.type,
                  (valueToParse as Record<string, unknown>)[subItem.name],
                  timestamp,
                  subItem.subItems,
                  subItem.enumInfos
                )
              );
            return parsedValues.reduce((concatenatedResults, result) => [...concatenatedResults, ...result], []);
          }
          this.logger.debug(
            `Data Structure ${dataType} not parsed for data ${itemName}. To parse it, please specify it in the connector settings`
          );
        } else if (enumInfo.length > 0) {
          // It is an ADS Enum object
          if (this.connector.settings.enumAsText === 'text') {
            valueToAdd = (valueToParse as { name: string }).name;
          } else {
            valueToAdd = JSON.stringify((valueToParse as { value: number }).value);
          }
        } else {
          this.logger.warn(`dataType ${dataType} not supported yet for point ${itemName}. Value was ${JSON.stringify(valueToParse)}`);
        }
        break;
    }
    if (valueToAdd) {
      return [
        {
          pointId: itemName,
          timestamp,
          data: { value: valueToAdd }
        }
      ];
    }
    return [];
  }

  private async buildSymbolCache(
    items: Array<SouthConnectorItemEntity<SouthADSItemSettings>>,
    logCtx: Record<string, string>
  ): Promise<void> {
    const missing = items.filter(item => !this.symbolCache.has(item.settings.address));
    if (missing.length === 0) return;

    // Bulk lookup covers most items in one request
    const allSymbols = await this.client!.getSymbols();
    const foundInBulk: Array<{ item: SouthConnectorItemEntity<SouthADSItemSettings>; symbol: AdsSymbol }> = [];
    const notInBulk: Array<SouthConnectorItemEntity<SouthADSItemSettings>> = [];
    for (const item of missing) {
      const symbol = allSymbols[item.settings.address.toLowerCase()];
      if (symbol) {
        foundInBulk.push({ item, symbol });
      } else {
        notInBulk.push(item);
      }
    }

    // Per-item fallback for addresses the bulk table doesn't list individually
    // (e.g. array-indexed paths like "BDE.BDEs[1].EC1000.OK")
    const perItemResolved = (
      await Promise.all(
        notInBulk.map(async item => {
          try {
            return { item, symbol: await this.client!.getSymbol(item.settings.address) };
          } catch {
            this.logger.warn(logCtx, `Symbol "${item.settings.address}" not found on PLC, item "${item.name}" will be skipped`);
            return null;
          }
        })
      )
    ).filter((r): r is { item: SouthConnectorItemEntity<SouthADSItemSettings>; symbol: AdsSymbol } => r !== null);

    const allResolved = [...foundInBulk, ...perItemResolved];

    // Deduplicate types and fetch all at once
    const uniqueTypes = [...new Set(allResolved.map(r => r.symbol.type))];
    const resolvedTypes = await Promise.all(uniqueTypes.map(type => this.client!.getDataType(type)));
    const typeMap = new Map(uniqueTypes.map((type, i) => [type, resolvedTypes[i]]));

    for (const { item, symbol } of allResolved) {
      this.symbolCache.set(item.settings.address, { symbol, dataType: typeMap.get(symbol.type)! });
    }
    this.logger.debug(logCtx, `Symbol cache: ${this.symbolCache.size}/${items.length} symbols resolved`);
  }

  async directQuery(items: Array<SouthConnectorItemEntity<SouthADSItemSettings>>): Promise<OIBusTimeValue | null> {
    const logCtx = workUnitLogCtx(items);
    // Values are collected paired with the item that produced them, and grouped per top-level item
    // (a struct/array item parses into several OIBusTimeValues) since caching-strategy filtering below
    // treats each top-level item as a single caching unit rather than filtering sub-fields separately.
    const valuePairs: Array<{ item: SouthConnectorItemEntity<SouthADSItemSettings>; values: Array<OIBusTimeValue> }> = [];
    try {
      await this.buildSymbolCache(items, logCtx);

      const timestamp = DateTime.now().toUTC().toISO()!;
      const startRequest = DateTime.now();

      const cachedItems = items.filter(item => this.symbolCache.has(item.settings.address));
      const uncachedItems = items.filter(item => !this.symbolCache.has(item.settings.address));

      for (let offset = 0; offset < cachedItems.length; offset += SouthADS.BATCH_SIZE) {
        const chunk = cachedItems.slice(offset, offset + SouthADS.BATCH_SIZE);
        const commands = chunk.map(item => {
          const { symbol } = this.symbolCache.get(item.settings.address)!;
          return { indexGroup: symbol.indexGroup, indexOffset: symbol.indexOffset, size: symbol.size };
        });

        const results = await this.client!.readRawMulti(commands);

        const converted = await Promise.all(
          results.map(async (result, i) => {
            const item = chunk[i];
            if (!result.success) {
              this.logger.error(logCtx, `Failed to read "${item.settings.address}" (${item.name}): ${result.errorStr}`);
              return { item, values: [] as Array<OIBusTimeValue> };
            }
            const { dataType } = this.symbolCache.get(item.settings.address)!;
            const value = await this.client!.convertFromRaw(result.value!, dataType);
            const values = this.parseValues(
              `${this.connector.settings.plcName}${item.name}`,
              dataType.type,
              value,
              timestamp,
              dataType.subItems,
              dataType.enumInfos
            );
            return { item, values };
          })
        );
        valuePairs.push(...converted);
      }

      const uncachedResults = await Promise.all(
        uncachedItems.map(async item => ({ item, values: await this.readAdsSymbol(item, timestamp) }))
      );
      valuePairs.push(...uncachedResults);

      const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();
      this.logger.debug(logCtx, `Requested ${items.length} items in ${requestDuration} ms`);

      // Batch-read the previous cached state once for this cycle, then decide per item whether the
      // newly parsed value(s) should be cached, based on the item's (already group-resolved) caching
      // strategy. A struct/array item's parsed sub-values are compared/cached as one unit.
      const lastValues = this.southCacheRepository.getItemsLastValues(
        this.connector.id,
        items.map(item => item.id)
      );
      const itemsToCache: Array<SouthConnectorItemEntity<SouthADSItemSettings>> = [];
      const cachedEntries: Array<{ itemId: string; value: unknown; instant: string }> = [];
      const filteredContent: Array<OIBusTimeValue> = [];
      for (const { item, values } of valuePairs) {
        if (values.length === 0) continue;
        const previous = lastValues.get(item.id) ?? null;
        const comparableValue = values.map(v => v.data.value);
        const shouldCache = shouldCacheValue({
          cachingStrategy: item.cachingStrategy ?? 'allValues',
          thresholdType: item.thresholdType,
          threshold: item.threshold,
          rangeLow: item.rangeLow,
          rangeHigh: item.rangeHigh,
          maxCachingInterval: item.maxCachingInterval,
          previousCachedValue: previous?.value ?? null,
          previousCachedInstant: previous?.trackedInstant ?? null,
          newValue: comparableValue,
          newQueryTime: timestamp
        });
        if (shouldCache) {
          filteredContent.push(...values);
          itemsToCache.push(item);
          cachedEntries.push({ itemId: item.id, value: comparableValue, instant: timestamp });
        }
      }

      await this.addContent({ type: 'time-values', content: filteredContent }, startRequest.toUTC().toISO(), itemsToCache);
      this.southCacheRepository.saveItemsLastValues(this.connector.id, cachedEntries);
    } catch (error: unknown) {
      if (getErrorMessage(error).includes('Client is not connected')) {
        // This branch handles the error itself (reconnect scheduled) rather than rethrowing, so —
        // unlike other errors here, which the base class logs generically via its own runTask()
        // catch — this is the only place this failure gets logged at all.
        this.logger.error(logCtx, `ADS client disconnected while reading ${items.length} item(s). Reconnecting`);
        await this.disconnect();
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      } else {
        throw error;
      }
    }
    const allValues = valuePairs.flatMap(pair => pair.values);
    return allValues.length > 0 ? allValues[allValues.length - 1] : null;
  }

  async readAdsSymbol(
    item: SouthConnectorItemEntity<SouthADSItemSettings>,
    timestamp: Instant,
    client: Client = this.client!
  ): Promise<Array<OIBusTimeValue>> {
    const result = await client.readValue(item.settings.address);

    return this.parseValues(
      `${this.connector.settings.plcName}${item.name}`,
      result.symbol?.type,
      result.value,
      timestamp,
      result.dataType?.subItems,
      result.dataType?.enumInfos
    );
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthADSItemSettings>,
    _testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    // Reuse the already-connected live client when this instance is live and connected, instead of
    // opening a second one on top of it. This.client (the connector's persistent connection) must
    // never be mutated or closed from here — some ADS/TwinCAT routers also cap concurrent client
    // connections, so reusing avoids exceeding that cap while the connector is running.
    const reusingLiveClient = this.client !== null;
    let client: Client | undefined = this.client ?? undefined;
    let connectionDuration = 0;
    try {
      if (!client) {
        const options = this.createConnectionOptions();
        client = new Client(options);
        const connectStart = DateTime.now().toMillis();
        await client.connect();
        connectionDuration = DateTime.now().toMillis() - connectStart;
      }
      const queryStart = DateTime.now().toMillis();
      const dataValues: Array<OIBusTimeValue> = await this.readAdsSymbol(item, DateTime.now().toUTC().toISO()!, client);
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
      throw new Error(`Unable to connect. ${getErrorMessage(error)}`);
    } finally {
      if (client && !reusingLiveClient) {
        await this.closeLocalAdsClient(client);
      }
    }
  }

  createConnectionOptions(): ADSOptions {
    const options: ADSOptions = {
      targetAmsNetId: this.connector.settings.netId, // example: 192.168.1.120.1.1
      targetAdsPort: this.connector.settings.port, // example: 851
      autoReconnect: false
    };
    if (this.connector.settings.clientAmsNetId) {
      // needs to match a route declared in PLC StaticRoutes.xml file. Example: 10.211.55.2.1.1
      options.localAmsNetId = this.connector.settings.clientAmsNetId;
    }
    if (this.connector.settings.clientAdsPort) {
      // should be an unused port. Example: 32750
      options.localAdsPort = this.connector.settings.clientAdsPort;
    }
    if (this.connector.settings.routerAddress) {
      // distant address of the PLC. Example: 10.211.55.3
      options.routerAddress = this.connector.settings.routerAddress;
    }
    if (this.connector.settings.routerTcpPort) {
      // port of the Ams router (must be open on the PLC). Example : 48898 (which is default)
      options.routerTcpPort = this.connector.settings.routerTcpPort;
    }
    return options;
  }
  /**
   * Initiates a connection to the right netId and port.
   */
  async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      const options = this.createConnectionOptions();
      this.logger.debug(`Connecting to ADS Client with options ${JSON.stringify(options)}`);

      this.client = new Client(options);
      const connectStart = DateTime.now().toMillis();
      const result = await this.client.connect();
      const connectDuration = DateTime.now().toMillis() - connectStart;
      this.logger.info(
        `Connected to the ${result.targetAmsNetId} with local AmsNetId ${result.localAmsNetId} and local port ${result.localAdsPort} in ${connectDuration} ms`
      );
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(`ADS connect error: ${getErrorMessage(error)}`);
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    }
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    // Reuse the already-connected live client when this instance is live and connected, instead of
    // opening a second one on top of it. This.client (the connector's persistent connection) must
    // never be mutated or closed from here — some ADS/TwinCAT routers also cap concurrent client
    // connections, so reusing avoids exceeding that cap while the connector is running.
    const reusingLiveClient = this.client !== null;
    let client: Client | undefined = this.client ?? undefined;
    try {
      if (!client) {
        const options = this.createConnectionOptions();
        client = new Client(options);
        await client.connect();
      }
      const [deviceInfo, state] = await Promise.all([client.readDeviceInfo(), client.readState()]);
      return {
        items: [
          { key: 'Device name', value: deviceInfo.deviceName },
          { key: 'Firmware version', value: `${deviceInfo.majorVersion}.${deviceInfo.minorVersion}.${deviceInfo.versionBuild}` },
          { key: 'ADS state', value: state.adsStateStr ?? String(state.adsState) },
          { key: 'Device state', value: String(state.deviceState) }
        ]
      };
    } finally {
      if (client && !reusingLiveClient) {
        await this.closeLocalAdsClient(client);
      }
    }
  }

  /**
   * Close a local ADS client created for testConnection()/testItem(). This is separate from
   * disconnectAdsClient()/disconnect() which operate on the connector's persistent this.client —
   * it must never touch this.client or this.reconnectTimeout.
   */
  private async closeLocalAdsClient(client: Client): Promise<void> {
    if (!client.connection.connected) return;
    try {
      await client.disconnect();
    } catch (error) {
      this.logger.error(`ADS test client disconnect error. ${error}`);
    }
  }

  /**
   * Disconnect the ADS Client
   */
  disconnectAdsClient(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.connection.connected) {
        resolve();
      } else {
        this.client
          .disconnect()
          .then(() => resolve())
          .catch((error: Error) => reject(error));
      }
    });
  }

  /**
   * Close the connection
   */
  async disconnect(): Promise<void> {
    this.symbolCache.clear();
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.client) {
      const disconnectStart = DateTime.now().toMillis();
      try {
        await this.disconnectAdsClient();
        this.logger.info(
          `ADS client disconnected from ${this.connector.settings.netId}:${this.connector.settings.port} in ${DateTime.now().toMillis() - disconnectStart} ms`
        );
      } catch (error) {
        this.logger.error(`ADS disconnect error: ${getErrorMessage(error)}`);
      }
      this.client = null;
    }
    await super.disconnect();
    this.disconnecting = false;
  }
}
