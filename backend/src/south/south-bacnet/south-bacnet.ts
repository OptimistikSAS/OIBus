import { DateTime } from 'luxon';
import BACnetClient, {
  ASN1_ARRAY_ALL,
  BACNetAddress,
  BACNetObjectID,
  BACNetReadAccessSpecification,
  CovNotifyPayload,
  IAMResult,
  ObjectType,
  PropertyIdentifier
} from '@bacnet-js/client';
import SouthConnector from '../south-connector';
import { SouthDirectQuery, SouthExplore, SouthSubscription } from '../south-interface';
import {
  SouthBACnetItemSettings,
  SouthBACnetItemSettingsObjectType,
  SouthBACnetItemSettingsPropertyIdentifier,
  SouthBACnetSettings,
  SouthItemSettings
} from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import {
  SouthConnectorExploreEntry,
  SouthConnectorItemQueryResult,
  SouthConnectorItemTestingSettings
} from '../../../shared/model/south-connector.model';
import { Instant } from '../../../shared/model/types';
import { getErrorMessage, workUnitLogCtx } from '../../service/utils';

const OBJECT_TYPE_BY_SETTING: Record<SouthBACnetItemSettingsObjectType, ObjectType> = {
  'analog-input': ObjectType.ANALOG_INPUT,
  'analog-output': ObjectType.ANALOG_OUTPUT,
  'analog-value': ObjectType.ANALOG_VALUE,
  'binary-input': ObjectType.BINARY_INPUT,
  'binary-output': ObjectType.BINARY_OUTPUT,
  'binary-value': ObjectType.BINARY_VALUE,
  'multi-state-input': ObjectType.MULTI_STATE_INPUT,
  'multi-state-output': ObjectType.MULTI_STATE_OUTPUT,
  'multi-state-value': ObjectType.MULTI_STATE_VALUE
};

const PROPERTY_IDENTIFIER_BY_SETTING: Record<SouthBACnetItemSettingsPropertyIdentifier, PropertyIdentifier> = {
  'present-value': PropertyIdentifier.PRESENT_VALUE,
  'status-flags': PropertyIdentifier.STATUS_FLAGS,
  reliability: PropertyIdentifier.RELIABILITY,
  'out-of-service': PropertyIdentifier.OUT_OF_SERVICE,
  units: PropertyIdentifier.UNITS
};

/**
 * A Reject/Abort PDU or the client's own per-request timeout is scoped to the one device that
 * failed to answer - other devices in the same batched work-unit (an OIBus item group is not
 * necessarily one physical BACnet device, unlike an OPC-UA session) must keep working, so these
 * are logged and skipped rather than tearing down the shared UDP client. Message text matches
 * @bacnet-js/client's RequestManager/Client implementation (ERR_TIMEOUT, BacnetError, BacnetAbort).
 */
function isDeviceScopedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message === 'ERR_TIMEOUT' || error.message.startsWith('BacnetError') || error.message.startsWith('BacnetAbort');
}

function toAddress(item: SouthConnectorItemEntity<SouthBACnetItemSettings>): BACNetAddress {
  return { address: item.settings.deviceAddress };
}

function toObjectId(item: SouthConnectorItemEntity<SouthBACnetItemSettings>): BACNetObjectID {
  return { type: OBJECT_TYPE_BY_SETTING[item.settings.objectType], instance: item.settings.objectInstance };
}

function toPropertyIdentifier(item: SouthConnectorItemEntity<SouthBACnetItemSettings>): PropertyIdentifier {
  return PROPERTY_IDENTIFIER_BY_SETTING[item.settings.propertyIdentifier];
}

/** Coerces a decoded BACnet application value into the string|number shape OIBusTimeValue expects. */
function toPointValue(raw: unknown): string | number {
  if (typeof raw === 'number' || typeof raw === 'string') return raw;
  if (typeof raw === 'boolean') return raw ? 1 : 0;
  if (raw && typeof raw === 'object') {
    const bitString = raw as Partial<{ bitsUsed: number; value: Array<number> }>;
    if (Array.isArray(bitString.value) && typeof bitString.bitsUsed === 'number') {
      return bitString.value.slice(0, bitString.bitsUsed).join('');
    }
    return JSON.stringify(raw);
  }
  return String(raw);
}

interface CovSubscriptionEntry {
  item: SouthConnectorItemEntity<SouthBACnetItemSettings>;
  address: BACNetAddress;
  objectId: BACNetObjectID;
  subscriberProcessId: number;
  lifetimeSeconds: number;
  renewalTimeout: NodeJS.Timeout | null;
}

export default class SouthBACnet
  extends SouthConnector<SouthBACnetSettings, SouthBACnetItemSettings>
  implements SouthDirectQuery, SouthSubscription, SouthExplore
{
  private client: BACnetClient | null = null;
  private connecting = false;
  private disconnecting = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private foreignDeviceRenewalTimeout: NodeJS.Timeout | null = null;
  private nextSubscriberProcessId = 1;
  private readonly covSubscriptions = new Map<string, CovSubscriptionEntry>();
  private bufferedValues: Array<{ item: SouthConnectorItemEntity<SouthBACnetItemSettings>; timestamp: Instant; value: OIBusTimeValue }> =
    [];
  private flushTimeout: NodeJS.Timeout | null = null;

  constructor(
    connector: SouthConnectorEntity<SouthBACnetSettings, SouthBACnetItemSettings>,
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
    this.connecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      this.client = await this.createClient();
      if (this.connector.settings.bbmd.enabled) {
        await this.registerForeignDevice();
      }
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(`Error while connecting to the BACnet network: ${getErrorMessage(error)}`);
      try {
        await this.disconnect();
      } catch (disconnectError: unknown) {
        this.logger.error(`Error while disconnecting after failed connect: ${getErrorMessage(disconnectError)}`);
      }
      if (!this.disconnecting && this.connector.enabled) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    } finally {
      this.connecting = false;
    }
  }

  override async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    if (this.foreignDeviceRenewalTimeout) {
      clearTimeout(this.foreignDeviceRenewalTimeout);
      this.foreignDeviceRenewalTimeout = null;
    }
    for (const subscription of this.covSubscriptions.values()) {
      if (subscription.renewalTimeout) {
        clearTimeout(subscription.renewalTimeout);
      }
    }
    this.covSubscriptions.clear();

    if (this.client) {
      try {
        this.client.close();
      } catch (error: unknown) {
        this.logger.error(`Error closing BACnet client: ${getErrorMessage(error)}`);
      }
      this.client = null;
    }

    await super.disconnect();
    this.disconnecting = false;
  }

  /** Opens the BACnet/IP UDP socket and waits for it to be bound before returning. */
  private async createClient(): Promise<BACnetClient> {
    const client = new BACnetClient({
      interface: this.connector.settings.localInterface || undefined,
      port: this.connector.settings.port,
      apduTimeout: this.connector.settings.apduTimeout,
      broadcastAddress: this.connector.settings.broadcastAddress
    });
    await new Promise<void>((resolve, reject) => {
      const onListening = () => {
        client.off('error', onError);
        resolve();
      };
      const onError = (error: Error) => {
        client.off('listening', onListening);
        reject(error);
      };
      client.once('listening', onListening);
      client.once('error', onError);
    });
    client.on('error', (error: Error) => {
      this.logger.error(`BACnet transport error: ${getErrorMessage(error)}`);
      this.triggerReconnect();
    });
    client.on('covNotifyUnconfirmed', content => this.handleCovNotification(content.payload));
    return client;
  }

  private triggerReconnect(): void {
    if (this.disconnecting || this.connecting) return;
    this.disconnect()
      .then(() => {
        if (!this.disconnecting && this.connector.enabled) {
          this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
        }
      })
      .catch((error: unknown) => {
        this.logger.error(`Error during reconnect after transport issue: ${getErrorMessage(error)}`);
      });
  }

  private async registerForeignDevice(): Promise<void> {
    const bbmd = this.connector.settings.bbmd;
    await this.client!.registerForeignDevice({ address: bbmd.address! }, bbmd.foreignDeviceTtl!);
    this.logger.info(`Registered as a foreign device with BBMD ${bbmd.address}`);
    this.scheduleForeignDeviceRenewal(bbmd.foreignDeviceTtl!);
  }

  private scheduleForeignDeviceRenewal(ttlSeconds: number): void {
    if (this.foreignDeviceRenewalTimeout) {
      clearTimeout(this.foreignDeviceRenewalTimeout);
    }
    const renewalDelayMs = Math.max(1000, Math.floor(ttlSeconds * 500));
    this.foreignDeviceRenewalTimeout = setTimeout(() => {
      this.registerForeignDevice().catch((error: unknown) => {
        this.logger.error(`Error renewing BBMD foreign device registration: ${getErrorMessage(error)}`);
      });
    }, renewalDelayMs);
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const reusingLiveClient = this.client !== null;
    let client = this.client;
    try {
      if (!client) {
        client = await this.createClient();
      }
      const devices = await this.discoverDevices(client);
      const items: Array<{ key: string; value: string }> = [{ key: 'DevicesFound', value: String(devices.length) }];
      for (const device of devices.slice(0, 5)) {
        items.push({ key: `Device ${device.deviceId}`, value: device.address });
      }
      return { items };
    } finally {
      if (client && !reusingLiveClient) {
        client.close();
      }
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthBACnetItemSettings>,
    _testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    const reusingLiveClient = this.client !== null;
    let client = this.client;
    let connectionDuration = 0;
    try {
      if (!client) {
        const connectStart = DateTime.now().toMillis();
        client = await this.createClient();
        connectionDuration = DateTime.now().toMillis() - connectStart;
      }
      await this.verifyDeviceIdentity(client, item);
      const queryStart = DateTime.now().toMillis();
      const timeValue = await this.readItem(client, item);
      const result: OIBusContent = { type: 'time-values', content: timeValue ? [timeValue] : [] };
      return { result, connectionDuration, queryDuration: DateTime.now().toMillis() - queryStart };
    } finally {
      if (client && !reusingLiveClient) {
        client.close();
      }
    }
  }

  /**
   * Discovers devices via Who-Is and collects I-Am responses for a fixed window. When
   * `discoveryTargetAddress` is set, the Who-Is is sent directly to that one address (unicast)
   * instead of broadcasting - this takes priority over BBMD routing, since a unicast request needs
   * no broadcast forwarding at all (it's plain routed UDP, same reachability requirement as
   * readProperty/readPropertyMultiple). Otherwise falls back to a broadcast, direct or through the
   * configured BBMD.
   */
  private discoverDevices(client: BACnetClient): Promise<Array<IAMResult>> {
    return new Promise<Array<IAMResult>>(resolve => {
      const devices: Array<IAMResult> = [];
      const onIAm = (content: { payload: IAMResult }) => {
        devices.push(content.payload);
      };
      client.on('iAm', onIAm);

      const targetAddress = this.connector.settings.discoveryTargetAddress;
      const bbmd = this.connector.settings.bbmd;
      if (targetAddress) {
        client.whoIs({ address: targetAddress });
      } else if (bbmd.enabled) {
        client.whoIsThroughBBMD({ address: bbmd.address! });
      } else {
        client.whoIs();
      }

      const windowMs = Math.max(this.connector.settings.apduTimeout, 3000);
      setTimeout(() => {
        client.off('iAm', onIAm);
        resolve(devices);
      }, windowMs);
    });
  }

  /**
   * Sends a unicast Who-Is directly to the item's configured device address and, if an I-Am comes
   * back, checks its reported device instance against the item's configured `Device instance` -
   * catching the classic static-binding mistake (wrong IP/instance pairing) before it silently
   * produces data attributed to the wrong device. Best-effort and never throws: a device that
   * doesn't answer Who-Is (some restricted profiles don't implement it) must not fail the item test,
   * since `readProperty` succeeding is the real pass/fail criterion.
   */
  private async verifyDeviceIdentity(client: BACnetClient, item: SouthConnectorItemEntity<SouthBACnetItemSettings>): Promise<void> {
    const targetHost = item.settings.deviceAddress.split(':')[0];
    const match = await new Promise<IAMResult | null>(resolve => {
      const onIAm = (content: { payload: IAMResult }) => {
        if (content.payload.address.split(':')[0] === targetHost) {
          client.off('iAm', onIAm);
          clearTimeout(timeoutHandle);
          resolve(content.payload);
        }
      };
      client.on('iAm', onIAm);
      client.whoIs({ address: item.settings.deviceAddress });
      const timeoutHandle = setTimeout(
        () => {
          client.off('iAm', onIAm);
          resolve(null);
        },
        Math.max(this.connector.settings.apduTimeout, 3000)
      );
    });

    if (!match) {
      this.logger.debug(`No unicast Who-Is response from ${item.settings.deviceAddress} for item "${item.name}"`);
    } else if (match.deviceId !== item.settings.deviceInstance) {
      this.logger.warn(
        `Unicast Who-Is to ${item.settings.deviceAddress} for item "${item.name}" replied with device instance ${match.deviceId}, ` +
          `but the item is configured for device instance ${item.settings.deviceInstance} - check the static binding`
      );
    } else {
      this.logger.debug(
        `Unicast Who-Is confirmed device instance ${match.deviceId} at ${item.settings.deviceAddress} for item "${item.name}"`
      );
    }
  }

  private async readItem(client: BACnetClient, item: SouthConnectorItemEntity<SouthBACnetItemSettings>): Promise<OIBusTimeValue | null> {
    const result = await client.readProperty(toAddress(item), toObjectId(item), toPropertyIdentifier(item));
    const rawValue = result.values[0]?.value;
    if (rawValue === undefined || rawValue === null) return null;
    return {
      pointId: item.name,
      timestamp: DateTime.now().toUTC().toISO()!,
      data: { value: toPointValue(rawValue) }
    };
  }

  async directQuery(items: Array<SouthConnectorItemEntity<SouthBACnetItemSettings>>): Promise<OIBusTimeValue | null> {
    const logCtx = workUnitLogCtx(items);
    const client = this.client;
    if (!client) {
      this.logger.debug('No BACnet client available, skipping direct query');
      return null;
    }

    const itemsByDevice = new Map<string, Array<SouthConnectorItemEntity<SouthBACnetItemSettings>>>();
    for (const item of items) {
      const bucket = itemsByDevice.get(item.settings.deviceAddress);
      if (bucket) {
        bucket.push(item);
      } else {
        itemsByDevice.set(item.settings.deviceAddress, [item]);
      }
    }

    const queryTime = DateTime.now().toUTC().toISO()!;
    const candidates: Array<{ item: SouthConnectorItemEntity<SouthBACnetItemSettings>; value: OIBusTimeValue }> = [];
    const chunkSize = Math.max(1, this.connector.settings.maxObjectsPerRequest);

    for (const [deviceAddressText, deviceItems] of itemsByDevice) {
      const address: BACNetAddress = { address: deviceAddressText };
      for (let i = 0; i < deviceItems.length; i += chunkSize) {
        const chunk = deviceItems.slice(i, i + chunkSize);
        const readSpecs: Array<BACNetReadAccessSpecification> = chunk.map(item => ({
          objectId: toObjectId(item),
          properties: [{ id: toPropertyIdentifier(item), index: ASN1_ARRAY_ALL }]
        }));

        try {
          const result = await client.readPropertyMultiple(address, readSpecs);
          const itemsByObjectKey = new Map(chunk.map(item => [`${toObjectId(item).type}-${toObjectId(item).instance}`, item] as const));
          for (const objectResult of result.values) {
            const matchedItem = itemsByObjectKey.get(`${objectResult.objectId.type}-${objectResult.objectId.instance}`);
            if (!matchedItem) continue;
            const propertyValue = objectResult.values.find(value => value.id === toPropertyIdentifier(matchedItem));
            const rawValue = propertyValue?.value?.[0]?.value;
            if (rawValue === undefined || rawValue === null) continue;
            candidates.push({
              item: matchedItem,
              value: { pointId: matchedItem.name, timestamp: queryTime, data: { value: toPointValue(rawValue) } }
            });
          }
        } catch (error: unknown) {
          if (isDeviceScopedError(error)) {
            this.logger.warn(
              logCtx,
              `Read failed for device ${deviceAddressText} (device error, connection kept): ${getErrorMessage(error)}`
            );
            continue;
          }
          this.triggerReconnect();
          throw error;
        }
      }
    }

    const cachedCandidates = this.applyCachingStrategy(candidates, candidate => ({
      item: candidate.item,
      value: candidate.value.data.value,
      timestamp: candidate.value.timestamp
    }));
    if (cachedCandidates.length > 0) {
      await this.addContent(
        { type: 'time-values', content: cachedCandidates.map(candidate => candidate.value) },
        queryTime,
        cachedCandidates.map(candidate => candidate.item)
      );
    }
    return cachedCandidates.length > 0 ? cachedCandidates[cachedCandidates.length - 1].value : null;
  }

  async subscribe(items: Array<SouthConnectorItemEntity<SouthBACnetItemSettings>>): Promise<void> {
    if (!items.length) return;
    const client = this.client;
    if (!client) {
      this.logger.debug('No BACnet client available, skipping subscribe');
      return;
    }
    if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(this.flushMessages.bind(this), this.connector.settings.flushMessageTimeout);
    }

    for (const item of items) {
      if (this.covSubscriptions.has(item.id)) continue;
      const address = toAddress(item);
      const objectId = toObjectId(item);
      const subscriberProcessId = this.nextSubscriberProcessId++;
      const lifetimeSeconds = this.connector.settings.covDefaultLifetime;
      try {
        // issueConfirmedNotifications=false so notifications arrive as 'covNotifyUnconfirmed'. Standard
        // SubscribeCOV always reports PRESENT_VALUE + STATUS_FLAGS regardless of the item's configured
        // propertyIdentifier - handleCovNotification() picks PRESENT_VALUE out of the notification.
        await client.subscribeCov(address, objectId, subscriberProcessId, false, false, lifetimeSeconds, {});
      } catch (error: unknown) {
        this.logger.error(workUnitLogCtx([item]), `Error subscribing to COV for item "${item.name}": ${getErrorMessage(error)}`);
        continue;
      }
      const entry: CovSubscriptionEntry = { item, address, objectId, subscriberProcessId, lifetimeSeconds, renewalTimeout: null };
      if (lifetimeSeconds > 0) {
        entry.renewalTimeout = this.scheduleCovRenewal(entry);
      }
      this.covSubscriptions.set(item.id, entry);
    }
  }

  async unsubscribe(items: Array<SouthConnectorItemEntity<SouthBACnetItemSettings>>): Promise<void> {
    const client = this.client;
    for (const item of items) {
      const entry = this.covSubscriptions.get(item.id);
      if (!entry) continue;
      if (entry.renewalTimeout) {
        clearTimeout(entry.renewalTimeout);
      }
      this.covSubscriptions.delete(item.id);
      if (client) {
        try {
          await client.subscribeCov(entry.address, entry.objectId, entry.subscriberProcessId, true, false, 0, {});
        } catch (error: unknown) {
          this.logger.error(workUnitLogCtx([item]), `Error cancelling COV subscription for item "${item.name}": ${getErrorMessage(error)}`);
        }
      }
    }
  }

  private scheduleCovRenewal(entry: CovSubscriptionEntry): NodeJS.Timeout {
    const marginSeconds = this.connector.settings.covRenewalMargin;
    const renewalDelaySeconds = Math.max(1, entry.lifetimeSeconds - marginSeconds);
    return setTimeout(() => {
      this.renewCovSubscription(entry).catch((error: unknown) => {
        this.logger.error(
          workUnitLogCtx([entry.item]),
          `Error renewing COV subscription for item "${entry.item.name}": ${getErrorMessage(error)}`
        );
      });
    }, renewalDelaySeconds * 1000);
  }

  private async renewCovSubscription(entry: CovSubscriptionEntry): Promise<void> {
    const client = this.client;
    if (!client || !this.covSubscriptions.has(entry.item.id)) return;
    await client.subscribeCov(entry.address, entry.objectId, entry.subscriberProcessId, false, false, entry.lifetimeSeconds, {});
    entry.renewalTimeout = this.scheduleCovRenewal(entry);
  }

  private handleCovNotification(payload: CovNotifyPayload): void {
    const subscription = Array.from(this.covSubscriptions.values()).find(
      candidate => candidate.subscriberProcessId === payload.subscriberProcessId
    );
    if (!subscription) return;

    const presentValueEntry = payload.values.find(value => value.property.id === PropertyIdentifier.PRESENT_VALUE) ?? payload.values[0];
    const rawValue = presentValueEntry?.value?.[0]?.value;
    if (rawValue === undefined || rawValue === null) return;

    const timestamp = DateTime.now().toUTC().toISO()!;
    this.bufferedValues.push({
      item: subscription.item,
      timestamp,
      value: { pointId: subscription.item.name, timestamp, data: { value: toPointValue(rawValue) } }
    });
    if (this.bufferedValues.length >= this.connector.settings.maxNumberOfMessages) {
      this.flushMessages().catch((error: unknown) => {
        this.logger.error(`Error flushing messages from BACnet COV subscription: ${getErrorMessage(error)}`);
      });
    }
  }

  private async flushMessages(): Promise<void> {
    const valuesToSend = this.bufferedValues;
    this.bufferedValues = [];
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    if (valuesToSend.length > 0) {
      try {
        const cachedEntries = this.applyCachingStrategy(valuesToSend, entry => ({
          item: entry.item,
          value: entry.value.data.value,
          timestamp: entry.timestamp
        }));
        if (cachedEntries.length > 0) {
          await this.addContent(
            { type: 'time-values', content: cachedEntries.map(entry => entry.value) },
            DateTime.now().toUTC().toISO()!,
            cachedEntries.map(entry => entry.item)
          );
        }
      } catch (error: unknown) {
        this.logger.error(`Error when flushing BACnet COV messages: ${getErrorMessage(error)}`);
      }
    }
    this.flushTimeout = setTimeout(this.flushMessages.bind(this), this.connector.settings.flushMessageTimeout);
  }

  async explore(parentId: string | null): Promise<Array<SouthConnectorExploreEntry>> {
    if (this.client === null) {
      this.client = await this.createClient();
    }
    const client = this.client;

    if (parentId === null) {
      const devices = await this.discoverDevices(client);
      const entries: Array<SouthConnectorExploreEntry> = [];
      for (const device of devices) {
        let name = `Device ${device.deviceId}`;
        try {
          const nameResult = await client.readProperty(
            { address: device.address },
            { type: ObjectType.DEVICE, instance: device.deviceId },
            PropertyIdentifier.OBJECT_NAME
          );
          const rawName = nameResult.values[0]?.value;
          if (typeof rawName === 'string' && rawName) name = rawName;
        } catch (error: unknown) {
          this.logger.debug(`Could not read device name for device ${device.deviceId}: ${getErrorMessage(error)}`);
        }
        entries.push({
          id: `${device.address}|${device.deviceId}`,
          name,
          metadata: { address: device.address, deviceInstance: device.deviceId },
          hasChildren: true
        });
      }
      return entries;
    }

    const [deviceAddressText, deviceInstanceText] = parentId.split('|');
    const deviceInstance = Number(deviceInstanceText);
    const address: BACNetAddress = { address: deviceAddressText };
    const deviceObjectId: BACNetObjectID = { type: ObjectType.DEVICE, instance: deviceInstance };

    const objectListResult = await client.readProperty(address, deviceObjectId, PropertyIdentifier.OBJECT_LIST);
    const objectIds = objectListResult.values
      .map(applicationData => applicationData.value)
      .filter((value): value is BACNetObjectID => typeof value === 'object' && value !== null && 'type' in value && 'instance' in value);

    const entries: Array<SouthConnectorExploreEntry> = [];
    const chunkSize = Math.max(1, this.connector.settings.maxObjectsPerRequest);
    for (let i = 0; i < objectIds.length; i += chunkSize) {
      const chunk = objectIds.slice(i, i + chunkSize);
      const readSpecs: Array<BACNetReadAccessSpecification> = chunk.map(objectId => ({
        objectId,
        properties: [
          { id: PropertyIdentifier.OBJECT_NAME, index: ASN1_ARRAY_ALL },
          { id: PropertyIdentifier.PRESENT_VALUE, index: ASN1_ARRAY_ALL }
        ]
      }));
      try {
        const result = await client.readPropertyMultiple(address, readSpecs);
        for (const objectResult of result.values) {
          entries.push(this.toExploreEntry(deviceAddressText, deviceInstance, objectResult));
        }
      } catch (error: unknown) {
        this.logger.debug(`Could not enrich BACnet objects while exploring device ${deviceInstance}: ${getErrorMessage(error)}`);
        for (const objectId of chunk) {
          entries.push({
            id: `${deviceAddressText}|${deviceInstance}|${objectId.type}|${objectId.instance}`,
            name: `${ObjectType[objectId.type] ?? objectId.type} ${objectId.instance}`,
            metadata: { objectType: ObjectType[objectId.type] ?? String(objectId.type), objectInstance: objectId.instance },
            hasChildren: false
          });
        }
      }
    }
    return entries;
  }

  private toExploreEntry(
    deviceAddressText: string,
    deviceInstance: number,
    objectResult: { objectId: BACNetObjectID; values: Array<{ id: PropertyIdentifier; value: Array<{ value: unknown }> }> }
  ): SouthConnectorExploreEntry {
    const nameEntry = objectResult.values.find(value => value.id === PropertyIdentifier.OBJECT_NAME);
    const valueEntry = objectResult.values.find(value => value.id === PropertyIdentifier.PRESENT_VALUE);
    const rawName = nameEntry?.value?.[0]?.value;
    const rawValue = valueEntry?.value?.[0]?.value;
    const objectTypeLabel = ObjectType[objectResult.objectId.type] ?? String(objectResult.objectId.type);
    const metadata: Record<string, string | number> = {
      objectType: objectTypeLabel,
      objectInstance: objectResult.objectId.instance
    };
    if (rawValue !== undefined && rawValue !== null) {
      metadata.value = toPointValue(rawValue);
    }
    return {
      id: `${deviceAddressText}|${deviceInstance}|${objectResult.objectId.type}|${objectResult.objectId.instance}`,
      name: typeof rawName === 'string' && rawName ? rawName : `${objectTypeLabel} ${objectResult.objectId.instance}`,
      metadata,
      hasChildren: false
    };
  }
}
