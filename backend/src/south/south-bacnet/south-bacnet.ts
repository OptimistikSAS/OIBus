import crypto from 'node:crypto';

import BACnetClient, {
  ApplicationData,
  ApplicationTag,
  ASN1_ARRAY_ALL,
  BACNetAddress,
  BACnetMessageHeader,
  BACNetObjectID,
  BACNetReadAccessSpecification,
  CovNotifyPayload,
  DecodeAcknowledgeMultipleResult,
  ErrorClass,
  ErrorCode,
  IAMResult,
  ObjectType,
  PropertyIdentifier
} from '@bacnet-js/client';
import { DateTime } from 'luxon';

import { OIBusContent, OIBusTimeValue } from '../../../shared/model/common/content.model';
import { Instant } from '../../../shared/model/common/types';
import {
  SouthBACnetItemSettings,
  SouthBACnetItemSettingsObjectType,
  SouthBACnetItemSettingsPropertyIdentifier,
  SouthBACnetSettings,
  SouthItemSettings
} from '../../../shared/model/connector/south-settings.model';
import { OIBusConnectionTestResult } from '../../../shared/model/domain/engine.model';
import {
  SouthConnectorExploreEntry,
  SouthConnectorItemQueryResult,
  SouthConnectorItemTestingSettings
} from '../../../shared/model/domain/south-connector.model';

import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { getErrorMessage, workUnitLogCtx } from '../../service/utils';
import SouthConnector from '../south-connector';
import { SouthDirectQuery, SouthExplore, SouthHistoryQuery, SouthSubscription } from '../south-interface';

const OBJECT_TYPE_BY_SETTING: Record<SouthBACnetItemSettingsObjectType, ObjectType> = {
  'analog-input': ObjectType.ANALOG_INPUT,
  'analog-output': ObjectType.ANALOG_OUTPUT,
  'analog-value': ObjectType.ANALOG_VALUE,
  'binary-input': ObjectType.BINARY_INPUT,
  'binary-output': ObjectType.BINARY_OUTPUT,
  'binary-value': ObjectType.BINARY_VALUE,
  'multi-state-input': ObjectType.MULTI_STATE_INPUT,
  'multi-state-output': ObjectType.MULTI_STATE_OUTPUT,
  'multi-state-value': ObjectType.MULTI_STATE_VALUE,
  accumulator: ObjectType.ACCUMULATOR,
  'pulse-converter': ObjectType.PULSE_CONVERTER,
  loop: ObjectType.LOOP,
  'integer-value': ObjectType.INTEGER_VALUE,
  'positive-integer-value': ObjectType.POSITIVE_INTEGER_VALUE,
  'large-analog-value': ObjectType.LARGE_ANALOG_VALUE,
  'characterstring-value': ObjectType.CHARACTERSTRING_VALUE,
  'trend-log': ObjectType.TREND_LOG
};

const PROPERTY_IDENTIFIER_BY_SETTING: Record<SouthBACnetItemSettingsPropertyIdentifier, PropertyIdentifier> = {
  'present-value': PropertyIdentifier.PRESENT_VALUE,
  'status-flags': PropertyIdentifier.STATUS_FLAGS,
  reliability: PropertyIdentifier.RELIABILITY,
  'out-of-service': PropertyIdentifier.OUT_OF_SERVICE,
  units: PropertyIdentifier.UNITS
};

// Every SubscribeCOV notification for the supported object types carries both (ASHRAE 135, clause 13.1):
// items reading them use SubscribeCOV. Any other property needs SubscribeCOVProperty.
const SUBSCRIBE_COV_PROPERTIES = new Set<PropertyIdentifier>([PropertyIdentifier.PRESENT_VALUE, PropertyIdentifier.STATUS_FLAGS]);
// Concurrent SubscribeCOV cancellations sent on disconnect. Kept well below the client's 256 invoke ids.
const COV_CANCEL_BATCH_SIZE = 32;
// Who-Is to this network number is a global broadcast: routers forward it to every network they reach.
const GLOBAL_BROADCAST_NETWORK = 0xffff;
// Upper bound of maxParallelRun, as in the manifest.
const MAX_PARALLEL_RUN_CEILING = 16;
// A failing COV subscription is retried after retryInterval, then twice as late each time, up to this delay.
const MAX_COV_RETRY_DELAY_MS = 600_000;
// Subscriber process ids start at a random value (BACnet allows any Unsigned32), so the ids of a
// previous run, whose subscriptions may still be alive on the devices, are unlikely to be reused.
const MAX_INITIAL_SUBSCRIBER_PROCESS_ID = 0x400000;

/** The device's own request timeout: it never answered, so it is unreachable for now. */
function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.message === 'ERR_TIMEOUT';
}

/**
 * The device answered with an Error, Reject or Abort PDU (@bacnet-js/client reports a Reject as a
 * BacnetAbort): it is reachable, but refused this request - unknown object or property, a service it
 * does not implement, or a reply too large for a device that does not support segmentation.
 */
function isServiceRefusal(error: unknown): boolean {
  return error instanceof Error && (error.message.startsWith('BacnetError') || error.message.startsWith('BacnetAbort'));
}

/**
 * A refusal or a timeout is scoped to the one device that failed to answer - other devices in the
 * same batched work-unit (an OIBus item group is not necessarily one physical BACnet device, unlike
 * an OPC-UA session) must keep working, so these are logged and skipped rather than tearing down the
 * shared UDP client. Message text matches @bacnet-js/client's RequestManager/Client implementation.
 */
function isDeviceScopedError(error: unknown): boolean {
  return isTimeout(error) || isServiceRefusal(error);
}

/** A device that answered Who-Is. */
interface DiscoveredDevice {
  address: BACNetAddress;
  deviceId: number;
}

/** MAC address setting to bytes: one decimal byte (an MS/TP station), or hexadecimal bytes separated by colons. */
function parseMacAddress(text: string): Array<number> {
  return text.includes(':') ? text.split(':').map(byte => parseInt(byte, 16)) : [Number(text)];
}

/** Bytes to MAC address setting, the reverse of parseMacAddress. */
function formatMacAddress(bytes: Array<number>): string {
  return bytes.length === 1 ? String(bytes[0]) : bytes.map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(':');
}

/** A device on another BACnet network, reached through the router at `address`. */
function isRouted(address: BACNetAddress): boolean {
  return address.net !== undefined && address.net > 0 && address.net !== GLOBAL_BROADCAST_NETWORK;
}

/** Identifies a device: devices behind the same router share its IP address. */
function toDeviceKey(address: BACNetAddress): string {
  return isRouted(address) ? `${address.address}|${address.net}|${formatMacAddress(address.adr ?? [])}` : address.address!;
}

/** Device address for logs: "10.0.0.5", or "10.0.0.5, network 2, MAC 5" for a routed device. */
function describeAddress(address: BACNetAddress): string {
  return isRouted(address) ? `${address.address}, network ${address.net}, MAC ${formatMacAddress(address.adr ?? [])}` : address.address!;
}

/** Same device, whether or not the IP address carries the default port. */
function isSameDevice(a: BACNetAddress, b: BACNetAddress): boolean {
  const host = (address: BACNetAddress) => address.address?.split(':')[0];
  const route = (address: BACNetAddress) => (isRouted(address) ? `${address.net}|${formatMacAddress(address.adr ?? [])}` : '');
  return host(a) === host(b) && route(a) === route(b);
}

/**
 * The address of the device that sent an unconfirmed request such as I-Am. @bacnet-js/client keeps
 * it in the message header, not in the payload (its `IAMResult.address` typing is wrong). A broadcast
 * relayed by a BBMD arrives from the BBMD itself, with the original sender in `forwardedFrom`; a
 * device behind a router comes with the network number and MAC address the router relayed it from.
 */
function senderAddress(header: BACnetMessageHeader | undefined): BACNetAddress | null {
  const address = header?.sender.forwardedFrom || header?.sender.address;
  if (!address) return null;
  const { net, adr } = header!.sender;
  return net ? { address, net, adr: adr ?? [] } : { address };
}

/** One property (or one entry of an array property) of one object, on a device. */
interface PropertyReference {
  objectId: BACNetObjectID;
  propertyId: PropertyIdentifier;
  /** ASN1_ARRAY_ALL reads the whole property. */
  arrayIndex: number;
}

/** The value of a property reference, or why the device could not return it. */
type PropertyReadResult = { values: Array<ApplicationData> } | { error: string };

function referenceKey(objectId: BACNetObjectID, propertyId: number, arrayIndex: number): string {
  return `${objectId.type}:${objectId.instance}:${propertyId}:${arrayIndex}`;
}

function toReferenceKey(reference: PropertyReference): string {
  return referenceKey(reference.objectId, reference.propertyId, reference.arrayIndex);
}

/** Groups references by object: a ReadPropertyMultiple request lists each object once, with all its properties. */
function toReadAccessSpecifications(references: Array<PropertyReference>): Array<BACNetReadAccessSpecification> {
  const specifications = new Map<string, BACNetReadAccessSpecification>();
  for (const reference of references) {
    const objectKey = `${reference.objectId.type}:${reference.objectId.instance}`;
    let specification = specifications.get(objectKey);
    if (!specification) {
      specification = { objectId: reference.objectId, properties: [] };
      specifications.set(objectKey, specification);
    }
    specification.properties.push({ id: reference.propertyId, index: reference.arrayIndex });
  }
  return Array.from(specifications.values());
}

/** Formats the error a device returns for one property of a ReadPropertyMultiple, e.g. "OBJECT/UNKNOWN_OBJECT". */
function toPropertyErrorMessage(error: { errorClass: number; errorCode: number }): string {
  return `${ErrorClass[error.errorClass] ?? error.errorClass}/${ErrorCode[error.errorCode] ?? error.errorCode}`;
}

/**
 * The message of a failed request, a device Error PDU being named as a ReadPropertyMultiple property error
 * is: "BacnetError - Class:1 - Code:31" becomes "OBJECT/UNKNOWN_OBJECT".
 */
function toRequestErrorMessage(error: unknown): string {
  const match = error instanceof Error ? /^BacnetError - Class:(\d+) - Code:(\d+)$/.exec(error.message) : null;
  return match ? toPropertyErrorMessage({ errorClass: Number(match[1]), errorCode: Number(match[2]) }) : getErrorMessage(error);
}

function isObjectId(value: unknown): value is BACNetObjectID {
  return typeof value === 'object' && value !== null && 'type' in value && 'instance' in value;
}

/** The item's device: its IP address, or its router's IP address with the device's network number and MAC address. */
function toAddress(item: SouthConnectorItemEntity<SouthBACnetItemSettings>): BACNetAddress {
  if (!item.settings.routed) {
    return { address: item.settings.deviceAddress };
  }
  return { address: item.settings.deviceAddress, net: item.settings.networkNumber, adr: parseMacAddress(item.settings.macAddress!) };
}

function toObjectId(item: SouthConnectorItemEntity<SouthBACnetItemSettings>): BACNetObjectID {
  return { type: OBJECT_TYPE_BY_SETTING[item.settings.objectType], instance: item.settings.objectInstance };
}

function toPropertyIdentifier(item: SouthConnectorItemEntity<SouthBACnetItemSettings>): PropertyIdentifier {
  // Only a trend log has no property: it is read as a whole, see SouthBACnet.readTrendLog
  return PROPERTY_IDENTIFIER_BY_SETTING[item.settings.propertyIdentifier ?? 'present-value'];
}

function toPropertyReference(item: SouthConnectorItemEntity<SouthBACnetItemSettings>): PropertyReference {
  return { objectId: toObjectId(item), propertyId: toPropertyIdentifier(item), arrayIndex: ASN1_ARRAY_ALL };
}

/** A trend log item is collected by history queries (its log buffer), the other items by polling or COV. */
function isTrendLog(item: SouthConnectorItemEntity<SouthBACnetItemSettings>): boolean {
  return item.settings.objectType === 'trend-log';
}

/**
 * A log record's timestamp is the device's local date and time, without time zone. @bacnet-js/client
 * turns it into a Date in the OIBus host's time zone: its fields are read back in the devices' time zone.
 */
function toInstant(date: Date, timezone: string): Instant {
  return DateTime.fromObject(
    {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
      millisecond: date.getMilliseconds()
    },
    { zone: timezone }
  )
    .toUTC()
    .toISO()!;
}

/** Coerces a decoded BACnet application value into the string|number shape OIBusTimeValue expects. */
function toPointValue(raw: unknown): string | number {
  if (typeof raw === 'number' || typeof raw === 'string') return raw;
  if (typeof raw === 'boolean') return raw ? 1 : 0;
  if (raw && typeof raw === 'object') {
    // @bacnet-js/client decodes a bit string into bytes, bit 0 in the least significant bit of byte 0.
    // Rendered one character per bit in BACnet order: status flags "0100" is in-alarm, FAULT, overridden, out-of-service.
    const bitString = raw as Partial<{ bitsUsed: number; value: Array<number> }>;
    const bytes = bitString.value;
    if (Array.isArray(bytes) && typeof bitString.bitsUsed === 'number') {
      return Array.from({ length: bitString.bitsUsed }, (_, bit) => ((bytes[bit >> 3] ?? 0) >> (bit & 7)) & 1).join('');
    }
    return JSON.stringify(raw);
  }
  return String(raw);
}

interface CovSubscriptionEntry {
  item: SouthConnectorItemEntity<SouthBACnetItemSettings>;
  address: BACNetAddress;
  objectId: BACNetObjectID;
  propertyId: PropertyIdentifier;
  subscriberProcessId: number;
  lifetimeSeconds: number;
  renewalTimeout: NodeJS.Timeout | null;
  // Consecutive failed requests: drives the retry delay, and only the first one is logged as a warning.
  failedAttempts: number;
}

export default class SouthBACnet
  extends SouthConnector<SouthBACnetSettings, SouthBACnetItemSettings>
  implements SouthDirectQuery, SouthHistoryQuery, SouthSubscription, SouthExplore
{
  private client: BACnetClient | null = null;
  private connecting = false;
  private disconnecting = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private foreignDeviceRenewalTimeout: NodeJS.Timeout | null = null;
  private nextSubscriberProcessId = crypto.randomInt(1, MAX_INITIAL_SUBSCRIBER_PROCESS_ID);
  // Kept across reconnects: re-subscribing an item with its previous process id renews the
  // subscription the device still holds (a subscription is identified by subscriber address,
  // process id and object) instead of adding one more, which would take another of its few COV slots.
  private readonly subscriberProcessIds = new Map<string, number>();
  private readonly covSubscriptions = new Map<string, CovSubscriptionEntry>();
  // Last pending read of each device address: work-units run in parallel (maxParallelRun), but each
  // device gets one request at a time - small controllers handle a single transaction.
  private readonly deviceReads = new Map<string, Promise<void>>();
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
      this.client = await this.openClient();
      this.scheduleForeignDeviceRenewal(this.client);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(`Error while connecting to the BACnet network: ${getErrorMessage(error)}`);
      try {
        await this.closeConnection(false);
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
    await this.closeConnection(true);
  }

  /**
   * Closes the BACnet client. COV subscriptions are cancelled on their devices only on a real stop:
   * after a transport failure the cancellations would most likely be lost too, and the reconnect
   * renews the same subscriptions anyway (see `subscriberProcessIds`).
   */
  private async closeConnection(cancelCovSubscriptions: boolean): Promise<void> {
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
        subscription.renewalTimeout = null;
      }
    }
    if (cancelCovSubscriptions && this.client) {
      await this.cancelCovSubscriptions(this.client);
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
    this.closeConnection(false)
      .then(() => {
        if (!this.disconnecting && this.connector.enabled) {
          this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
        }
      })
      .catch((error: unknown) => {
        this.logger.error(`Error during reconnect after transport issue: ${getErrorMessage(error)}`);
      });
  }

  /**
   * Opens a client, registered as a foreign device when a BBMD is configured. Every client needs
   * the registration, including the short-lived ones of Test settings and Test item: the BBMD
   * rejects a Who-Is to distribute from an unregistered device, and I-Am replies, usually
   * broadcast on the device's own subnet, only reach OIBus through it.
   */
  private async openClient(): Promise<BACnetClient> {
    const client = await this.createClient();
    if (!this.connector.settings.bbmd.enabled) return client;
    try {
      await this.registerForeignDevice(client);
    } catch (error: unknown) {
      client.close();
      throw new Error(
        `Could not register as a foreign device with BBMD ${this.connector.settings.bbmd.address}: ${getErrorMessage(error)}`
      );
    }
    return client;
  }

  private async registerForeignDevice(client: BACnetClient): Promise<void> {
    const bbmd = this.connector.settings.bbmd;
    await client.registerForeignDevice({ address: bbmd.address! }, bbmd.foreignDeviceTtl!);
    this.logger.info(`Registered as a foreign device with BBMD ${bbmd.address}`);
  }

  /** Keeps a long-lived client registered: renewed halfway through its TTL. No-op without a BBMD. */
  private scheduleForeignDeviceRenewal(client: BACnetClient): void {
    if (!this.connector.settings.bbmd.enabled) return;
    this.scheduleForeignDeviceRegistration(client, Math.max(1000, Math.floor(this.connector.settings.bbmd.foreignDeviceTtl! * 500)));
  }

  /** A failed renewal is retried every `retryInterval` until it succeeds. */
  private scheduleForeignDeviceRegistration(client: BACnetClient, delayMs: number): void {
    if (this.foreignDeviceRenewalTimeout) {
      clearTimeout(this.foreignDeviceRenewalTimeout);
    }
    this.foreignDeviceRenewalTimeout = setTimeout(() => {
      this.foreignDeviceRenewalTimeout = null;
      this.registerForeignDevice(client)
        .then(() => this.scheduleForeignDeviceRenewal(client))
        .catch((error: unknown) => {
          if (this.client !== client) return;
          this.logger.error(
            `Error renewing BBMD foreign device registration, retrying in ${this.connector.settings.retryInterval} ms: ${getErrorMessage(error)}`
          );
          this.scheduleForeignDeviceRegistration(client, this.connector.settings.retryInterval);
        });
    }, delayMs);
  }

  /** Work-units read in parallel; requests to one device are still serialized (see `deviceReads`). */
  protected override getMaxParallelRun(): number {
    return Math.max(1, Math.min(this.connector.settings.maxParallelRun, MAX_PARALLEL_RUN_CEILING));
  }

  /** Runs `read` once every earlier read of the same device (see toDeviceKey) has settled. */
  private async readDevice<T>(deviceKey: string, read: () => Promise<T>): Promise<T> {
    const previous = this.deviceReads.get(deviceKey) ?? Promise.resolve();
    let release!: () => void;
    const current = previous.then(() => new Promise<void>(resolve => (release = resolve)));
    this.deviceReads.set(deviceKey, current);
    await previous;
    try {
      return await read();
    } finally {
      release();
      if (this.deviceReads.get(deviceKey) === current) {
        this.deviceReads.delete(deviceKey);
      }
    }
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const reusingLiveClient = this.client !== null;
    let client = this.client;
    try {
      if (!client) {
        client = await this.openClient();
      }
      const devices = await this.discoverDevices(client);
      const items: Array<{ key: string; value: string }> = [{ key: 'DevicesFound', value: String(devices.length) }];
      for (const device of devices.slice(0, 5)) {
        items.push({ key: `Device ${device.deviceId}`, value: describeAddress(device.address) });
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
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    const reusingLiveClient = this.client !== null;
    let client = this.client;
    let connectionDuration = 0;
    try {
      if (!client) {
        const connectStart = DateTime.now().toMillis();
        client = await this.openClient();
        connectionDuration = DateTime.now().toMillis() - connectStart;
      }
      await this.verifyDeviceIdentity(client, item);
      const queryStart = DateTime.now().toMillis();
      let content: Array<OIBusTimeValue>;
      if (isTrendLog(item)) {
        // The test window, or the last hour when testing outside of a history window
        const endTime = testingSettings.history?.endTime ?? DateTime.now().toUTC().toISO()!;
        const startTime = testingSettings.history?.startTime ?? DateTime.fromISO(endTime).minus({ hours: 1 }).toUTC().toISO()!;
        const records = await this.readTrendLog(client, item, startTime, endTime);
        content = records.map(record => ({ pointId: item.name, timestamp: record.timestamp, data: { value: record.value } }));
      } else {
        const timeValue = await this.readItem(client, item);
        content = timeValue ? [timeValue] : [];
      }
      const result: OIBusContent = { type: 'time-values', content };
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
   *
   * The direct and unicast Who-Is are global broadcasts (network 0xFFFF): a BACnet router receiving
   * one forwards it to the networks behind it (MS/TP trunks...), so their devices answer too. Through a
   * BBMD it stays a local broadcast on each subnet - @bacnet-js/client sends Distribute-Broadcast-To-Network
   * without a destination network.
   */
  private discoverDevices(client: BACnetClient): Promise<Array<DiscoveredDevice>> {
    return new Promise<Array<DiscoveredDevice>>(resolve => {
      // Keyed by address and instance: a device reachable by several paths answers more than once.
      const devices = new Map<string, DiscoveredDevice>();
      const onIAm = (content: { header?: BACnetMessageHeader; payload: IAMResult }) => {
        const address = senderAddress(content.header);
        if (!address) return;
        devices.set(`${toDeviceKey(address)}|${content.payload.deviceId}`, { address, deviceId: content.payload.deviceId });
      };
      client.on('iAm', onIAm);

      const targetAddress = this.connector.settings.discoveryTargetAddress;
      const bbmd = this.connector.settings.bbmd;
      if (targetAddress) {
        client.whoIs({ address: targetAddress, net: GLOBAL_BROADCAST_NETWORK });
      } else if (bbmd.enabled) {
        client.whoIsThroughBBMD({ address: bbmd.address! });
      } else {
        client.whoIs({ net: GLOBAL_BROADCAST_NETWORK });
      }

      const windowMs = Math.max(this.connector.settings.apduTimeout, 3000);
      setTimeout(() => {
        client.off('iAm', onIAm);
        resolve(Array.from(devices.values()));
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
    const target = toAddress(item);
    const match = await new Promise<number | null>(resolve => {
      const onIAm = (content: { header?: BACnetMessageHeader; payload: IAMResult }) => {
        const sender = senderAddress(content.header);
        if (sender && isSameDevice(sender, target)) {
          client.off('iAm', onIAm);
          clearTimeout(timeoutHandle);
          resolve(content.payload.deviceId);
        }
      };
      client.on('iAm', onIAm);
      client.whoIs(target);
      const timeoutHandle = setTimeout(
        () => {
          client.off('iAm', onIAm);
          resolve(null);
        },
        Math.max(this.connector.settings.apduTimeout, 3000)
      );
    });

    if (match === null) {
      this.logger.debug(`No unicast Who-Is response from ${describeAddress(target)} for item "${item.name}"`);
    } else if (match !== item.settings.deviceInstance) {
      this.logger.warn(
        `Unicast Who-Is to ${describeAddress(target)} for item "${item.name}" replied with device instance ${match}, ` +
          `but the item is configured for device instance ${item.settings.deviceInstance} - check the static binding`
      );
    } else {
      this.logger.debug(`Unicast Who-Is confirmed device instance ${match} at ${describeAddress(target)} for item "${item.name}"`);
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

  /**
   * Reads property references from one device, in ReadPropertyMultiple requests of at most
   * `maxObjectsPerRequest` references each. When the device refuses a ReadPropertyMultiple (a service
   * it does not implement, or a reply too large without segmentation), that chunk is read one
   * property at a time with ReadProperty instead, as YABE does. An error scoped to one property
   * (unknown object or property) is returned in the map, never as a value; a timeout or a transport
   * failure is thrown, since the rest of the device is then out of reach too.
   */
  private async readProperties(
    client: BACnetClient,
    device: BACNetAddress,
    references: Array<PropertyReference>
  ): Promise<Map<string, PropertyReadResult>> {
    const results = new Map<string, PropertyReadResult>();
    const uniqueReferences = Array.from(new Map(references.map(reference => [toReferenceKey(reference), reference])).values());
    const chunkSize = Math.max(1, this.connector.settings.maxObjectsPerRequest);
    for (let i = 0; i < uniqueReferences.length; i += chunkSize) {
      const chunk = uniqueReferences.slice(i, i + chunkSize);
      let response: DecodeAcknowledgeMultipleResult;
      try {
        response = await client.readPropertyMultiple(device, toReadAccessSpecifications(chunk));
      } catch (error: unknown) {
        if (!isServiceRefusal(error)) throw error;
        this.logger.debug(
          `Device ${describeAddress(device)} refused ReadPropertyMultiple (${getErrorMessage(error)}), using ReadProperty instead`
        );
        await this.readPropertiesOneByOne(client, device, chunk, results);
        continue;
      }
      for (const objectResult of response.values) {
        for (const property of objectResult.values) {
          const first = property.value[0];
          results.set(
            referenceKey(objectResult.objectId, property.id, property.index),
            first?.type === ApplicationTag.ERROR
              ? { error: toPropertyErrorMessage(first.value as { errorClass: number; errorCode: number }) }
              : { values: property.value }
          );
        }
      }
    }
    return results;
  }

  private async readPropertiesOneByOne(
    client: BACnetClient,
    device: BACNetAddress,
    references: Array<PropertyReference>,
    results: Map<string, PropertyReadResult>
  ): Promise<void> {
    for (const reference of references) {
      try {
        const response = await client.readProperty(
          device,
          reference.objectId,
          reference.propertyId,
          reference.arrayIndex === ASN1_ARRAY_ALL ? {} : { arrayIndex: reference.arrayIndex }
        );
        results.set(toReferenceKey(reference), { values: response.values });
      } catch (error: unknown) {
        if (!isServiceRefusal(error)) throw error;
        results.set(toReferenceKey(reference), { error: toRequestErrorMessage(error) });
      }
    }
  }

  override filterDirectItems(items: Array<SouthConnectorItemEntity<SouthBACnetItemSettings>>) {
    return items.filter(item => !isTrendLog(item));
  }

  override filterHistoryItems(items: Array<SouthConnectorItemEntity<SouthBACnetItemSettings>>) {
    return items.filter(isTrendLog);
  }

  async directQuery(allItems: Array<SouthConnectorItemEntity<SouthBACnetItemSettings>>): Promise<OIBusTimeValue | null> {
    // directQueryHandler passes the whole work-unit: trend logs are left to historyQuery.
    const items = this.filterDirectItems(allItems);
    if (!items.length) return null;
    const logCtx = workUnitLogCtx(items);
    const client = this.client;
    if (!client) {
      this.logger.debug('No BACnet client available, skipping direct query');
      return null;
    }

    const itemsByDevice = new Map<string, { device: BACNetAddress; items: Array<SouthConnectorItemEntity<SouthBACnetItemSettings>> }>();
    for (const item of items) {
      const device = toAddress(item);
      const deviceKey = toDeviceKey(device);
      const bucket = itemsByDevice.get(deviceKey);
      if (bucket) {
        bucket.items.push(item);
      } else {
        itemsByDevice.set(deviceKey, { device, items: [item] });
      }
    }

    const queryTime = DateTime.now().toUTC().toISO()!;
    const candidates: Array<{ item: SouthConnectorItemEntity<SouthBACnetItemSettings>; value: OIBusTimeValue }> = [];

    for (const [deviceKey, { device, items: deviceItems }] of itemsByDevice) {
      let results: Map<string, PropertyReadResult>;
      try {
        results = await this.readDevice(deviceKey, () => this.readProperties(client, device, deviceItems.map(toPropertyReference)));
      } catch (error: unknown) {
        if (isDeviceScopedError(error)) {
          this.logger.warn(
            logCtx,
            `Read failed for device ${describeAddress(device)} (device error, connection kept): ${toRequestErrorMessage(error)}`
          );
          continue;
        }
        this.triggerReconnect();
        throw error;
      }
      for (const item of deviceItems) {
        const result = results.get(toReferenceKey(toPropertyReference(item)));
        if (!result) continue;
        if ('error' in result) {
          this.logger.warn(logCtx, `Could not read item "${item.name}" on device ${describeAddress(device)}: ${result.error}`);
          continue;
        }
        const rawValue = result.values[0]?.value;
        if (rawValue === undefined || rawValue === null) continue;
        candidates.push({ item, value: { pointId: item.name, timestamp: queryTime, data: { value: toPointValue(rawValue) } } });
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

  /**
   * Collects the records each trend log item logged between `startTime` (excluded) and `endTime`
   * (included). The tracked instant is the most recent record collected, so the next run picks up after it.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthBACnetItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
    const client = this.client;
    if (!client) {
      this.logger.debug('No BACnet client available, skipping history query');
      return { trackedInstant: null, value: null };
    }
    const logCtx = workUnitLogCtx(items);
    const queryTime = DateTime.now().toUTC().toISO()!;
    const candidates: Array<{ item: SouthConnectorItemEntity<SouthBACnetItemSettings>; value: OIBusTimeValue }> = [];
    let trackedInstant: Instant | null = null;
    for (const item of this.filterHistoryItems(items)) {
      const device = toAddress(item);
      let records: Array<{ timestamp: Instant; value: string | number }>;
      try {
        records = await this.readDevice(toDeviceKey(device), () => this.readTrendLog(client, item, startTime, endTime));
      } catch (error: unknown) {
        if (isDeviceScopedError(error)) {
          this.logger.warn(
            logCtx,
            `Could not read trend log "${item.name}" on device ${describeAddress(device)}: ${toRequestErrorMessage(error)}`
          );
          continue;
        }
        this.triggerReconnect();
        throw error;
      }
      for (const record of records) {
        candidates.push({ item, value: { pointId: item.name, timestamp: record.timestamp, data: { value: record.value } } });
        if (!trackedInstant || record.timestamp > trackedInstant) {
          trackedInstant = record.timestamp;
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
    return { trackedInstant, value: cachedCandidates.length > 0 ? cachedCandidates[cachedCandidates.length - 1].value : null };
  }

  /**
   * Reads the records of a trend log logged between `startTime` (excluded) and `endTime` (included),
   * oldest first. @bacnet-js/client can only read a log buffer by position: it is read backwards from
   * the most recent record (position = record count), `maxObjectsPerRequest` records at a time, until
   * a record older than `startTime`. A device logging while it is read shifts the positions of a full
   * buffer by one record at a time: the duplicates this may cause are dropped by timestamp. Log status
   * and time change records carry no value and are skipped. Record timestamps are read in the item's
   * time zone, the one its device's clock is set to.
   */
  private async readTrendLog(
    client: BACnetClient,
    item: SouthConnectorItemEntity<SouthBACnetItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<{ timestamp: Instant; value: string | number }>> {
    const device = toAddress(item);
    const trendLog = toObjectId(item);
    const timezone = item.settings.timezone ?? 'UTC';
    const recordCount = (await client.readProperty(device, trendLog, PropertyIdentifier.RECORD_COUNT)).values[0]?.value;
    if (typeof recordCount !== 'number' || recordCount === 0) return [];

    const start = DateTime.fromISO(startTime).toMillis();
    const end = DateTime.fromISO(endTime).toMillis();
    const chunkSize = Math.max(1, this.connector.settings.maxObjectsPerRequest);
    const records = new Map<Instant, string | number>();
    let position = recordCount;
    while (position >= 1) {
      const response = await client.readRange(device, trendLog, position, -Math.min(chunkSize, position));
      const batch = response.values ?? [];
      if (batch.length === 0) break;
      let reachedStart = false;
      for (const record of batch) {
        const timestamp = toInstant(record.timestamp, timezone);
        const time = DateTime.fromISO(timestamp).toMillis();
        if (time <= start) {
          reachedStart = true;
        } else if (time <= end && !record.isLogStatus && !record.isTimeChange && record.value !== null) {
          records.set(timestamp, toPointValue(record.value));
        }
      }
      if (reachedStart) break;
      position -= batch.length;
    }
    return Array.from(records.entries())
      .map(([timestamp, value]) => ({ timestamp, value }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  async subscribe(items: Array<SouthConnectorItemEntity<SouthBACnetItemSettings>>): Promise<void> {
    if (!items.length) return;
    if (!this.client) {
      this.logger.debug('No BACnet client available, skipping subscribe');
      return;
    }
    if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(this.flushMessages.bind(this), this.connector.settings.flushMessageTimeout);
    }

    for (const item of items) {
      if (this.covSubscriptions.has(item.id)) continue;
      if (isTrendLog(item)) {
        this.logger.warn(
          workUnitLogCtx([item]),
          `Trend log item "${item.name}" cannot be subscribed to: its records are collected by history queries, give it a scan mode`
        );
        continue;
      }
      let subscriberProcessId = this.subscriberProcessIds.get(item.id);
      if (subscriberProcessId === undefined) {
        subscriberProcessId = this.nextSubscriberProcessId++;
        this.subscriberProcessIds.set(item.id, subscriberProcessId);
      }
      const entry: CovSubscriptionEntry = {
        item,
        address: toAddress(item),
        objectId: toObjectId(item),
        propertyId: toPropertyIdentifier(item),
        subscriberProcessId,
        lifetimeSeconds: this.connector.settings.covDefaultLifetime,
        renewalTimeout: null,
        failedAttempts: 0
      };
      // Registered before the request: a subscription that fails now is retried by sendCovSubscription.
      this.covSubscriptions.set(item.id, entry);
      await this.sendCovSubscription(entry);
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
          await this.sendSubscriptionRequest(client, entry, true);
        } catch (error: unknown) {
          this.logger.error(workUnitLogCtx([item]), `Error cancelling COV subscription for item "${item.name}": ${getErrorMessage(error)}`);
        }
      }
    }
  }

  /**
   * Best-effort cancellation of every COV subscription on its device, so a stopped connector frees
   * the device's limited COV slots instead of holding them until the subscriptions expire (never,
   * with a 0 lifetime). Bounded by one APDU timeout, so an unreachable device cannot hold up the stop.
   */
  private async cancelCovSubscriptions(client: BACnetClient): Promise<void> {
    const entries = Array.from(this.covSubscriptions.values());
    if (entries.length === 0) return;
    let deadlineReached = false;
    const cancelAll = async () => {
      for (let i = 0; i < entries.length && !deadlineReached; i += COV_CANCEL_BATCH_SIZE) {
        await Promise.allSettled(
          entries.slice(i, i + COV_CANCEL_BATCH_SIZE).map(entry => this.sendSubscriptionRequest(client, entry, true))
        );
      }
    };
    let deadline: NodeJS.Timeout | undefined;
    await Promise.race([
      cancelAll(),
      new Promise<void>(resolve => {
        deadline = setTimeout(resolve, this.connector.settings.apduTimeout);
      })
    ]);
    deadlineReached = true;
    clearTimeout(deadline);
  }

  private scheduleCovSubscription(entry: CovSubscriptionEntry, delayMs: number): void {
    entry.renewalTimeout = setTimeout(() => {
      entry.renewalTimeout = null;
      this.sendCovSubscription(entry).catch((error: unknown) => {
        this.logger.error(
          workUnitLogCtx([entry.item]),
          `Error renewing COV subscription for item "${entry.item.name}": ${getErrorMessage(error)}`
        );
      });
    }, delayMs);
  }

  /**
   * Sends (or cancels) the subscription of an item, with issueConfirmedNotifications=false so that
   * notifications arrive as 'covNotifyUnconfirmed'. present-value and status-flags use SubscribeCOV,
   * which every COV-capable device implements. Any other property needs SubscribeCOVProperty, an
   * optional service that @bacnet-js/client always requests without expiry (lifetime 0): it is still
   * renewed on the same schedule, which re-creates it after a device restart, and cancelled when the
   * item is unsubscribed or the connector stops.
   */
  private sendSubscriptionRequest(client: BACnetClient, entry: CovSubscriptionEntry, cancel: boolean): Promise<void> {
    if (SUBSCRIBE_COV_PROPERTIES.has(entry.propertyId)) {
      return client.subscribeCov(
        entry.address,
        entry.objectId,
        entry.subscriberProcessId,
        cancel,
        false,
        cancel ? 0 : entry.lifetimeSeconds,
        {}
      );
    }
    return client.subscribeProperty(
      entry.address,
      entry.objectId,
      { id: entry.propertyId, index: ASN1_ARRAY_ALL },
      entry.subscriberProcessId,
      cancel,
      false,
      {}
    );
  }

  /**
   * Sends the subscription request of a registered subscription, then schedules its renewal before
   * the lifetime runs out - `covRenewalMargin` seconds before, but never sooner than halfway through it,
   * so a margin larger than the lifetime cannot make it renew in a loop. A failed request is retried
   * until it succeeds or the item is unsubscribed, so a device that is offline for a while starts
   * sending again once back: after `retryInterval`, then twice as late each time (up to 10 minutes).
   * Only the first failure is a warning - a device that refuses the subscription for good would
   * otherwise fill the logs.
   */
  private async sendCovSubscription(entry: CovSubscriptionEntry): Promise<void> {
    const client = this.client;
    if (!client || this.covSubscriptions.get(entry.item.id) !== entry) return;
    try {
      await this.sendSubscriptionRequest(client, entry, false);
    } catch (error: unknown) {
      if (this.covSubscriptions.get(entry.item.id) !== entry) return;
      entry.failedAttempts++;
      const retryInterval = this.connector.settings.retryInterval;
      const delayMs = Math.min(retryInterval * 2 ** (entry.failedAttempts - 1), Math.max(retryInterval, MAX_COV_RETRY_DELAY_MS));
      if (entry.failedAttempts === 1) {
        // @bacnet-js/client 3.3.2 sends SubscribeCOV(Property) with a hop count of 0, which routers drop: fixed
        // upstream (bacnet-js/client#87) but not released yet. Drop the routed hint once the dependency is bumped.
        const hint =
          isServiceRefusal(error) && !SUBSCRIBE_COV_PROPERTIES.has(entry.propertyId)
            ? ' - the device may not support SubscribeCOVProperty: poll this item with a scan mode instead'
            : isTimeout(error) && isRouted(entry.address)
              ? ' - COV subscriptions to devices behind a router are not supported yet: poll this item with a scan mode instead'
              : '';
        this.logger.warn(
          workUnitLogCtx([entry.item]),
          `Error subscribing to COV for item "${entry.item.name}": ${toRequestErrorMessage(error)}${hint}. ` +
            `Retrying in ${delayMs} ms, then less and less often (further failures are logged at debug level)`
        );
      } else {
        this.logger.debug(
          workUnitLogCtx([entry.item]),
          `COV subscription attempt ${entry.failedAttempts} failed for item "${entry.item.name}", ` +
            `retrying in ${delayMs} ms: ${toRequestErrorMessage(error)}`
        );
      }
      this.scheduleCovSubscription(entry, delayMs);
      return;
    }
    if (entry.failedAttempts > 0) {
      this.logger.info(
        workUnitLogCtx([entry.item]),
        `Subscribed to COV for item "${entry.item.name}" after ${entry.failedAttempts} failed attempt(s)`
      );
      entry.failedAttempts = 0;
    }
    if (entry.lifetimeSeconds > 0 && this.covSubscriptions.get(entry.item.id) === entry) {
      const renewalDelaySeconds = Math.max(
        1,
        entry.lifetimeSeconds - this.connector.settings.covRenewalMargin,
        Math.ceil(entry.lifetimeSeconds / 2)
      );
      this.scheduleCovSubscription(entry, renewalDelaySeconds * 1000);
    }
  }

  private handleCovNotification(payload: CovNotifyPayload): void {
    // The monitored object is checked too: a subscription left on a device by an earlier run keeps
    // notifying until it expires, and may happen to carry a process id this run reuses.
    const subscription = Array.from(this.covSubscriptions.values()).find(
      candidate =>
        candidate.subscriberProcessId === payload.subscriberProcessId &&
        candidate.objectId.type === payload.monitoredObjectId.type &&
        candidate.objectId.instance === payload.monitoredObjectId.instance
    );
    if (!subscription) {
      this.logger.trace(
        `Ignoring COV notification for unknown subscription ${payload.subscriberProcessId} ` +
          `(object ${payload.monitoredObjectId.type}:${payload.monitoredObjectId.instance}, device ${payload.initiatingDeviceId})`
      );
      return;
    }

    // A notification carries several properties (present-value and status-flags for SubscribeCOV):
    // only the one the item reads is published.
    const propertyEntry = payload.values.find(value => value.property.id === subscription.propertyId);
    const rawValue = propertyEntry?.value?.[0]?.value;
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
      this.client = await this.openClient();
      this.scheduleForeignDeviceRenewal(this.client);
    }
    const client = this.client;

    if (parentId === null) {
      const devices = await this.discoverDevices(client);
      const entries: Array<SouthConnectorExploreEntry> = [];
      for (const device of devices) {
        let name = `Device ${device.deviceId}`;
        try {
          const nameResult = await client.readProperty(
            device.address,
            { type: ObjectType.DEVICE, instance: device.deviceId },
            PropertyIdentifier.OBJECT_NAME
          );
          const rawName = nameResult.values[0]?.value;
          if (typeof rawName === 'string' && rawName) name = rawName;
        } catch (error: unknown) {
          this.logger.debug(`Could not read device name for device ${device.deviceId}: ${getErrorMessage(error)}`);
        }
        // The metadata holds the item settings to read this device with.
        const metadata: Record<string, string | number> = { address: device.address.address!, deviceInstance: device.deviceId };
        const routed = isRouted(device.address);
        if (routed) {
          metadata.networkNumber = device.address.net!;
          metadata.macAddress = formatMacAddress(device.address.adr ?? []);
        }
        entries.push({
          // address|network|MAC|instance, network and MAC left empty for a device on the IP network
          id: `${device.address.address}|${routed ? device.address.net : ''}|${routed ? metadata.macAddress : ''}|${device.deviceId}`,
          name,
          metadata,
          hasChildren: true
        });
      }
      return entries;
    }

    const [ipAddress, networkNumber, macAddress, deviceInstanceText] = parentId.split('|');
    const device: BACNetAddress = networkNumber
      ? { address: ipAddress, net: Number(networkNumber), adr: parseMacAddress(macAddress) }
      : { address: ipAddress };
    const deviceInstance = Number(deviceInstanceText);
    const objectIds = await this.readObjectList(client, device, { type: ObjectType.DEVICE, instance: deviceInstance });

    let properties: Map<string, PropertyReadResult> | null = null;
    try {
      properties = await this.readProperties(
        client,
        device,
        objectIds.flatMap(objectId => [
          { objectId, propertyId: PropertyIdentifier.OBJECT_NAME, arrayIndex: ASN1_ARRAY_ALL },
          { objectId, propertyId: PropertyIdentifier.PRESENT_VALUE, arrayIndex: ASN1_ARRAY_ALL }
        ])
      );
    } catch (error: unknown) {
      this.logger.debug(`Could not enrich BACnet objects while exploring device ${deviceInstance}: ${getErrorMessage(error)}`);
    }
    return objectIds.map(objectId => this.toExploreEntry(parentId, objectId, properties));
  }

  /**
   * Reads a device's object list. A device that cannot send the whole list in one reply (no
   * segmentation support, common on MS/TP) refuses the plain read; the list is then read one entry
   * at a time, as YABE does: array index 0 holds the number of entries.
   */
  private async readObjectList(
    client: BACnetClient,
    device: BACNetAddress,
    deviceObjectId: BACNetObjectID
  ): Promise<Array<BACNetObjectID>> {
    try {
      const result = await client.readProperty(device, deviceObjectId, PropertyIdentifier.OBJECT_LIST);
      return result.values.map(applicationData => applicationData.value).filter(isObjectId);
    } catch (error: unknown) {
      if (!isServiceRefusal(error)) throw error;
      this.logger.debug(
        `Device ${deviceObjectId.instance} refused to send its whole object list (${getErrorMessage(error)}), reading it entry by entry`
      );
    }
    const countResult = await client.readProperty(device, deviceObjectId, PropertyIdentifier.OBJECT_LIST, {
      arrayIndex: 0
    });
    const count = countResult.values[0]?.value;
    if (typeof count !== 'number') return [];
    const references: Array<PropertyReference> = Array.from({ length: count }, (_, index) => ({
      objectId: deviceObjectId,
      propertyId: PropertyIdentifier.OBJECT_LIST,
      arrayIndex: index + 1
    }));
    const results = await this.readProperties(client, device, references);
    return references.flatMap(reference => {
      const result = results.get(toReferenceKey(reference));
      return result && 'values' in result ? result.values.map(applicationData => applicationData.value).filter(isObjectId) : [];
    });
  }

  private toExploreEntry(
    deviceEntryId: string,
    objectId: BACNetObjectID,
    properties: Map<string, PropertyReadResult> | null
  ): SouthConnectorExploreEntry {
    const valueOf = (propertyId: PropertyIdentifier): unknown => {
      const result = properties?.get(referenceKey(objectId, propertyId, ASN1_ARRAY_ALL));
      return result && 'values' in result ? result.values[0]?.value : undefined;
    };
    const rawName = valueOf(PropertyIdentifier.OBJECT_NAME);
    const rawValue = valueOf(PropertyIdentifier.PRESENT_VALUE);
    const objectTypeLabel = ObjectType[objectId.type] ?? String(objectId.type);
    const metadata: Record<string, string | number> = { objectType: objectTypeLabel, objectInstance: objectId.instance };
    if (rawValue !== undefined && rawValue !== null) {
      metadata.value = toPointValue(rawValue);
    }
    return {
      id: `${deviceEntryId}|${objectId.type}|${objectId.instance}`,
      name: typeof rawName === 'string' && rawName ? rawName : `${objectTypeLabel} ${objectId.instance}`,
      metadata,
      hasChildren: false
    };
  }
}
