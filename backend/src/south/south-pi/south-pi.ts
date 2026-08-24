import SouthConnector from '../south-connector';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { SouthHistoryQuery } from '../south-interface';
import { SouthItemSettings, SouthPIItemSettings, SouthPISettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { getErrorMessage, workUnitLogCtx } from '../../service/utils';
import { PiConnection, PiRawValue } from '@oibus/pi-afsdk-windows';

/**
 * Class SouthPI - Retrieve data from an OSIsoft PI server.
 *
 * Windows-only: queries go through `@oibus/pi-afsdk-windows` (backend/native/pi-afsdk-windows), a
 * local package that spawns and multiplexes a bundled .NET child process wrapping the OSIsoft AF SDK
 * — see that package's README for why (Windows-only proprietary SDK, no maintained Node bridge, and
 * not runtime-compatible with modern .NET so it needs its own .NET Framework 4.8 helper, distinct
 * from the OLE DB helper's modern .NET target). `connection.read()` returns just the raw values it
 * found, or rejects outright on failure (no `logs`/partial-failure reporting) — building the
 * `time-values` content, tracking the incremental cursor, and logging a read failure are this class's
 * job, the same division of responsibility south-oledb.ts uses for rows. The package itself owns
 * process lifecycle and concurrency; this class only owns the connect/reconnect policy
 * (`retryInterval`) for its own connection.
 */
export default class SouthPI extends SouthConnector<SouthPISettings, SouthPIItemSettings> implements SouthHistoryQuery {
  private connection: PiConnection | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    connector: SouthConnectorEntity<SouthPISettings, SouthPIItemSettings>,
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

  async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      this.logger.debug('Connecting to the PI server');
      const connectStart = DateTime.now().toMillis();
      this.connection = await PiConnection.connect();
      const { name, version } = this.connection.serverInfo;
      this.logger.info(`Connected to the PI server ${name} (v${version}) in ${DateTime.now().toMillis() - connectStart} ms`);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(
        `Error while connecting to the PI server. Reconnecting in ${this.connector.settings.retryInterval} ms. ${getErrorMessage(error)}`
      );
      // Guarded together (not just the reschedule): disconnect() resets `disconnecting` to false at
      // its own end, so calling it re-entrantly while an outer disconnect()/stop() is still in
      // flight would cut that outer call's "disconnecting" state short.
      if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
        await this.disconnect();
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    }
  }

  async testConnection(): Promise<OIBusConnectionTestResult> {
    // A throwaway connection, isolated from the live `this.connection` — a running connector's own
    // session is never touched by a connection test (matches the old agent-based `${id}-test` isolation).
    this.logger.debug('Testing connection to the PI server');
    const connectStart = DateTime.now().toMillis();
    const connection = await PiConnection.connect();
    const { name, version, host, port } = connection.serverInfo;
    this.logger.info(`Connected to the PI server ${name} (v${version}) in ${DateTime.now().toMillis() - connectStart} ms`);
    await connection.disconnect();
    return {
      items: [
        { key: 'Name', value: name },
        { key: 'Version', value: version },
        { key: 'Host', value: `${host}:${port}` }
      ]
    };
  }

  /**
   * Uses a throwaway connection, isolated from `this.connection` — a running connector's own session
   * is never touched by testing an item from the UI.
   */
  override async testItem(
    item: SouthConnectorItemEntity<SouthPIItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;

    const connectStart = DateTime.now().toMillis();
    const connection = await PiConnection.connect();
    const connectionDuration = DateTime.now().toMillis() - connectStart;

    try {
      const queryStart = DateTime.now().toMillis();
      const values = await connection.read(startTime, endTime, toPoints([item]));
      const queryDuration = DateTime.now().toMillis() - queryStart;
      return { result: { type: 'time-values', content: toTimeValues(values, [item]) }, connectionDuration, queryDuration };
    } finally {
      await connection.disconnect().catch(error => {
        this.logger.error(`Error while disconnecting the test connection: ${getErrorMessage(error)}`);
      });
    }
  }

  /**
   * Get entries from the PI server between startTime and endTime and send them to the cache.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthPIItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
    if (!this.connection) {
      throw new Error('PI server is not connected');
    }
    const logCtx = workUnitLogCtx(items);
    this.logger.debug(logCtx, `Requesting ${items.length} items between ${startTime} and ${endTime}`);
    const startRequest = DateTime.now();

    let values: Array<PiRawValue>;
    try {
      values = await this.connection.read(startTime, endTime, toPoints(items));
    } catch (error: unknown) {
      // The package never logs its own errors — see PiConnection.read's doc comment — so this is the
      // only place a read failure's message actually reaches the logs, whether historyQuery's caller
      // does anything further with the rejection or not.
      this.logger.error(logCtx, `Error while querying the PI server: ${getErrorMessage(error)}`);
      throw error;
    }
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();

    const content = toTimeValues(values, items);
    let updatedStartTime: Instant | null = null;
    if (content.length > 0) {
      this.logger.debug(logCtx, `Found ${content.length} results for ${items.length} items in ${requestDuration} ms`);
      await this.addContent({ type: 'time-values', content }, startRequest.toUTC().toISO(), items);
      const maxInstant = trackMaxInstant(values, startTime);
      if (maxInstant && maxInstant > startTime) {
        updatedStartTime = maxInstant;
      }
    } else {
      this.logger.debug(logCtx, `No result found. Request done in ${requestDuration} ms`);
    }
    return { trackedInstant: updatedStartTime, value: content.length > 0 ? content[content.length - 1] : null };
  }

  async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.connection) {
      const connection = this.connection;
      this.connection = null;
      const disconnectStart = DateTime.now().toMillis();
      try {
        await connection.disconnect();
        this.logger.info(`Disconnected from the PI server in ${DateTime.now().toMillis() - disconnectStart} ms`);
      } catch (error) {
        this.logger.error(`Error while disconnecting from the PI server: ${getErrorMessage(error)}`);
      }
    }
    await super.disconnect();
    this.disconnecting = false;
  }
}

/**
 * Flattens items down to the raw PI point name mask each one configures — an exact tag name or a
 * wildcard pattern, `@oibus/pi-afsdk-windows` doesn't distinguish (see `PiConnection.read`'s doc
 * comment; `PIPoint.FindPIPoints` resolves either kind identically in one bulk call).
 */
function toPoints(items: Array<SouthConnectorItemEntity<SouthPIItemSettings>>): Array<string> {
  return items.map(item => item.settings.piPoint);
}

/**
 * The helper returns each value's `pointId` as the raw PI point name resolved by the AF SDK
 * (`PIPoint.Name`), not the OIBus item name — it doesn't know the item list. For an item whose
 * `piPoint` is an exact tag name, the resolved name matches it exactly, so the map lookup below finds
 * it and maps back to the item's own `name`. For a wildcard mask matching several real points, no
 * resolved name will ever equal the mask string itself, so the lookup naturally misses and the value
 * keeps its raw PI point name as-is (matching the old agent's own behavior for its equivalent
 * `point-query` items) — no need to track which items were "exact" vs "wildcard" separately to get
 * this right.
 */
function toTimeValues(values: Array<PiRawValue>, items: Array<SouthConnectorItemEntity<SouthPIItemSettings>>): Array<OIBusTimeValue> {
  const nameByPiPoint = new Map<string, string>();
  for (const item of items) {
    if (item.settings.piPoint) {
      nameByPiPoint.set(item.settings.piPoint, item.name);
    }
  }
  return values.map(value => ({
    pointId: nameByPiPoint.get(value.pointId) ?? value.pointId,
    timestamp: value.timestamp,
    data: { value: value.value }
  }));
}

/**
 * Scans the raw values for the max timestamp found, bumped by 1ms — mirroring
 * OIBusAgentWindows/Web/PI/PIController.cs's own `maxInstant.AddMilliseconds(1)`, so the next
 * incremental query's `@StartTime` (exclusive-by-convention here) doesn't re-fetch the same last
 * value again.
 */
function trackMaxInstant(values: Array<PiRawValue>, fallback: Instant): Instant | null {
  if (values.length === 0) return null;
  let max = fallback;
  for (const value of values) {
    if (value.timestamp > max) {
      max = value.timestamp;
    }
  }
  return DateTime.fromISO(max).plus({ milliseconds: 1 }).toUTC().toISO();
}
