import { Aggregate, Instant, Resampling } from '../../../shared/model/types';
import SouthConnector from '../south-connector';
import { DateTime } from 'luxon';
import { SouthConfigurationDiscovery, SouthDirectQuery, SouthExplore, SouthHistoryQuery, SouthSubscription } from '../south-interface';
import { SouthItemSettings, SouthOPCUAItemSettings, SouthOPCUASettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusRecord, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import {
  SouthConnectorExploreEntry,
  SouthConnectorItemQueryResult,
  SouthConnectorItemTestingSettings
} from '../../../shared/model/south-connector.model';
import {
  AttributeIds,
  ClientMonitoredItem,
  ClientSession,
  ClientSubscription,
  DataValue,
  MessageSecurityMode,
  NodeClass,
  NodeId,
  OPCUAClient,
  ReferenceDescription,
  resolveNodeId,
  StatusCode,
  StatusCodes,
  TimestampsToReturn,
  UserTokenType
} from 'node-opcua';
import { EUInformation, HistoryDataOptions, HistoryReadValueIdOptions, Range } from 'node-opcua-types/source/_generated_opcua_types';
import { createSessionConfigs, getHistoryReadRequest, getTimestamp, logMessages, parseOPCUAValue } from '../../service/utils-opcua';
import { getErrorMessage, workUnitLogCtx } from '../../service/utils';
import { shouldCacheValue } from '../../service/south-caching-strategy.service';

// OPC-UA status codes that indicate a device/PLC-level failure. The OPC-UA session
// itself is still alive — only the device behind the server is unreachable. Do NOT
// disconnect the session for these; other groups reading from healthy devices can
// continue without a full reconnect cycle.
// Contrast with session-breaking codes (BadSessionClosed, BadSecureChannelClosed, …)
// and raw Node.js network errors (ECONNRESET, socket hang up) which are NOT in this
// set and therefore still trigger a disconnect + reconnect.
const DEVICE_ERROR_CODES = [
  'BadCommunicationError',
  'BadNoCommunication',
  'BadNotConnected',
  'BadDeviceFailure',
  'BadOutOfService',
  'BadTimeout'
];

// node-opcua's own secure-channel-layer request timeout — thrown by
// node-opcua-secure-channel's client_secure_channel_layer.js when the server never answers a single
// ReadRequest/HistoryReadRequest within the configured timeout — is functionally the same event as our
// own synthetic "BadTimeout" above: the server accepted the request but never replied, typically because
// it is itself stuck waiting on an unreachable device (e.g. Kepware polling a disconnected PLC). It just
// surfaces as plain wording instead of a Bad* status code, so it needs its own pattern match. Left
// unmatched, this device-level timeout used to be treated as a session-breaking error: it triggered a
// full reconnect that tore down the shared session for every other, healthy device on the same server.
const DEVICE_ERROR_MESSAGE_PATTERNS = [/Transaction has timed out/];

function isDeviceError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    DEVICE_ERROR_CODES.some(code => error.message.includes(code)) ||
    DEVICE_ERROR_MESSAGE_PATTERNS.some(pattern => pattern.test(error.message))
  );
}

// OPC-UA status codes / errors meaning the session itself is no longer usable. When these
// happen during an interactive explore, the caller must restart the exploration.
const SESSION_ERROR_CODES = [
  'BadSessionIdInvalid',
  'BadSessionClosed',
  'BadSessionNotActivated',
  'BadSecureChannelClosed',
  'BadServerNotConnected'
];

function isSessionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return SESSION_ERROR_CODES.some(code => error.message.includes(code));
}

/**
 * Class SouthOPCUA - Connect to an OPCUA server
 */
export default class SouthOPCUA
  extends SouthConnector<SouthOPCUASettings, SouthOPCUAItemSettings>
  implements SouthHistoryQuery, SouthDirectQuery, SouthSubscription, SouthExplore, SouthConfigurationDiscovery
{
  private disconnecting = false;
  private connecting = false;
  private monitoredItems = new Map<string, ClientMonitoredItem>();
  private subscription: ClientSubscription | null = null;
  private flushTimeout: NodeJS.Timeout | null = null;
  private subscriptionWatchdog: NodeJS.Timeout | null = null;
  private bufferedValues: Array<{
    item: SouthConnectorItemEntity<SouthOPCUAItemSettings>;
    timestamp: Instant;
    value: number | string;
    quality: string;
  }> = [];
  // In-memory shadow of the last *cached* value per item for subscription-mode items, keyed by
  // item id. The subscription handler fires far more often than the flush cycle, so caching
  // strategy decisions can't afford a database read per event: this shadow is hydrated once from
  // `south_item_cache` (via getItemsLastValues) whenever subscribe() (re)registers items — never
  // created empty — and kept up to date optimistically at push time so it stays correct across
  // several changed-events between flush cycles. The database row itself (the durable "last
  // cached" state, e.g. for maxCachingInterval to survive a restart) is only written in
  // flushMessages(), via saveItemsLastValues, once a value has actually made it into addContent.
  private lastCachedValuesByItem = new Map<string, { value: unknown; instant: Instant }>();
  // Single persistent session shared by ad hoc DA/HA queries (directQuery/historyQuery) and, when
  // this connector has subscription-mode items, the OPC-UA subscription itself (see subscribe()).
  // One physical session — rather than a pool sized to getMaxParallelRun() plus a second dedicated
  // subscription session — because some OPC-UA servers (especially PLC-embedded ones) cap
  // concurrent sessions per client at a low number, sometimes exactly 1. A single ClientSession
  // already supports safely overlapping concurrent requests, so nothing is lost by sharing it.
  private session: ClientSession | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    connector: SouthConnectorEntity<SouthOPCUASettings, SouthOPCUAItemSettings>,
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
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    try {
      this.session = await this.createSession();
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(`Error while connecting to the OPCUA server: ${getErrorMessage(error)}`);
      // Wrap disconnect() so that errors from client.close() / subscription.terminate()
      // on an already-dead session do not escape the catch block. If they did, connect()
      // would itself reject — and since connect() is invoked from setTimeout, that
      // rejection would be unhandled and kill the Node.js process silently.
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
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.clearSubscriptionWatchdog();
    if (this.subscription) {
      await this.subscription.terminate();
      this.subscription = null;
    }
    this.monitoredItems.clear();
    if (this.session) {
      const disconnectStart = DateTime.now().toMillis();
      try {
        await this.session.close();
        this.logger.info(
          `Disconnected from OPCUA server ${this.connector.settings.url} in ${DateTime.now().toMillis() - disconnectStart} ms`
        );
      } catch (error: unknown) {
        this.logger.error(`Error closing OPC-UA session: ${getErrorMessage(error)}`);
      }
      this.session = null;
    }

    await super.disconnect();
    this.disconnecting = false;
  }

  /** Concurrency ceiling for this connector — see SouthConnector.getMaxParallelRun(). All
   * concurrent work-units pipeline their requests over the single shared OPC-UA session (see
   * `session` above), which safely supports overlapping in-flight requests; this ceiling just
   * bounds how many requests get pipelined at once so a burst of triggers can't flood one
   * device/session. */
  protected override getMaxParallelRun(): number {
    const CEILING = 32;
    return Math.max(1, Math.min(this.connector.settings.maxParallelRun ?? 1, CEILING));
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const items: Array<{ key: string; value: string }> = [];
    // Reuse the already-open shared session when this instance is live and connected, instead of
    // opening a second one — some OPC-UA servers cap concurrent sessions per client, and testing
    // a connector while it's running shouldn't be able to exceed that cap.
    const reusingLiveSession = this.session !== null;
    let session: ClientSession | undefined = this.session ?? undefined;
    try {
      if (!session) {
        session = await this.createSession();
      }

      // Attempt to read server state and BuildInfo — gracefully degraded if unavailable
      // Standard OPC UA node IDs per node-opcua-constants (VariableIds enum):
      //   2259 = Server_ServerStatus_State
      //   2261 = Server_ServerStatus_BuildInfo_ProductName
      //   2263 = Server_ServerStatus_BuildInfo_ManufacturerName
      //   2264 = Server_ServerStatus_BuildInfo_SoftwareVersion
      //   2265 = Server_ServerStatus_BuildInfo_BuildNumber
      try {
        const SERVER_STATE_LABELS: Record<number, string> = {
          0: 'Running',
          1: 'Failed',
          2: 'No Configuration',
          3: 'Suspended',
          4: 'Shutdown',
          5: 'Test',
          6: 'Communication Fault',
          7: 'Unknown'
        };
        const nodesToRead = [
          { nodeId: resolveNodeId('ns=0;i=2259'), key: 'State' },
          { nodeId: resolveNodeId('ns=0;i=2263'), key: 'ManufacturerName' },
          { nodeId: resolveNodeId('ns=0;i=2261'), key: 'ProductName' },
          { nodeId: resolveNodeId('ns=0;i=2264'), key: 'SoftwareVersion' },
          { nodeId: resolveNodeId('ns=0;i=2265'), key: 'BuildNumber' }
        ];
        const dataValues = await session.read(nodesToRead.map(n => ({ nodeId: n.nodeId, attributeId: AttributeIds.Value })));
        for (let i = 0; i < nodesToRead.length; i++) {
          const dv = dataValues[i];
          if (dv && dv.statusCode.value === StatusCodes.Good.value && dv.value?.value != null) {
            const raw = dv.value.value;
            let value: string;
            if (nodesToRead[i].key === 'State') {
              value = SERVER_STATE_LABELS[raw as number] ?? String(raw);
            } else {
              value = raw instanceof Date ? raw.toISOString() : String(raw);
            }
            items.push({ key: nodesToRead[i].key, value });
          }
        }
      } catch {
        // Server does not expose BuildInfo — not an error, no diagnostic data added
      }

      try {
        const SECURITY_MODE_LABELS: Partial<Record<MessageSecurityMode, string>> = {
          [MessageSecurityMode.None]: 'None',
          [MessageSecurityMode.Sign]: 'Sign',
          [MessageSecurityMode.SignAndEncrypt]: 'SignAndEncrypt'
        };
        const AUTH_TYPE_LABELS: Partial<Record<UserTokenType, string>> = {
          [UserTokenType.Anonymous]: 'Anonymous',
          [UserTokenType.UserName]: 'Username/Password',
          [UserTokenType.Certificate]: 'X509 Certificate',
          [UserTokenType.IssuedToken]: 'IssuedToken'
        };

        const endpointClient = OPCUAClient.create({
          applicationName: 'OIBus',
          connectionStrategy: { initialDelay: 1000, maxRetry: 1 },
          endpointMustExist: false
        });
        try {
          await endpointClient.connect(this.connector.settings.url);
          const endpoints = await endpointClient.getEndpoints();

          const securityModes = [...new Set(endpoints.map(e => SECURITY_MODE_LABELS[e.securityMode] ?? String(e.securityMode)))].filter(
            Boolean
          );
          items.push({ key: 'SecurityModes', value: securityModes.join(', ') });

          const securityPolicies = [
            ...new Set(
              endpoints
                .map(e => {
                  const uri = e.securityPolicyUri ?? '';
                  const hashIdx = uri.lastIndexOf('#');
                  return hashIdx >= 0 ? uri.substring(hashIdx + 1) : uri;
                })
                .filter(Boolean)
            )
          ];
          if (securityPolicies.length) items.push({ key: 'SecurityPolicies', value: securityPolicies.join(', ') });

          const authModes = [
            ...new Set(endpoints.flatMap(e => (e.userIdentityTokens ?? []).map(t => AUTH_TYPE_LABELS[t.tokenType] ?? String(t.tokenType))))
          ];
          if (authModes.length) items.push({ key: 'AuthenticationModes', value: authModes.join(', ') });
        } finally {
          await endpointClient.disconnect();
        }
      } catch {
        // Server may not expose endpoint details
      }

      try {
        const browseResult = await session.browse('ns=0;i=11201');
        const aggregates = (browseResult.references ?? [])
          .map(ref => ref.displayName?.text)
          .filter((text): text is string => Boolean(text));
        if (aggregates.length) items.push({ key: 'SupportedAggregates', value: aggregates.join(', ') });
      } catch {
        // Server does not expose aggregate functions
      }
    } finally {
      if (session && !reusingLiveSession) {
        await session.close();
      }
    }

    return { items };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthOPCUAItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    // Reuse the already-open shared session when this instance is live and connected, instead of
    // opening a second one — some OPC-UA servers cap concurrent sessions per client, and testing
    // an item while the connector is running shouldn't be able to exceed that cap.
    const reusingLiveSession = this.session !== null;
    let session: ClientSession | undefined = this.session ?? undefined;
    let connectionDuration = 0;
    try {
      if (!session) {
        const connectStart = DateTime.now().toMillis();
        session = await this.createSession();
        connectionDuration = DateTime.now().toMillis() - connectStart;
      }
      const queryStart = DateTime.now().toMillis();
      let result: OIBusContent;
      if (item.settings.mode === 'da') {
        const nodeId = resolveNodeId(item.settings.nodeId);
        const daValues = await this.getDAValues([{ nodeId, name: item.name, settings: item.settings }], session, workUnitLogCtx([item]));
        result = { type: 'time-values', content: daValues };
      } else {
        const haResult = await this.getHAValues(
          [item],
          testingSettings.history!.startTime,
          testingSettings.history!.endTime,
          session,
          true
        );
        result = { type: 'time-values', content: haResult.value ? [haResult.value] : [] };
      }
      return { result, connectionDuration, queryDuration: DateTime.now().toMillis() - queryStart };
    } finally {
      if (session && !reusingLiveSession) {
        await session.close();
      }
    }
  }

  override filterHistoryItems(
    items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>
  ): Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>> {
    return items.filter(
      item =>
        item.settings.mode === 'ha' &&
        ((item.syncWithGroup && item.group && item.group.scanMode.id !== 'subscription') ||
          (!(item.syncWithGroup && item.group) && item.scanMode!.id !== 'subscription'))
    );
  }

  override filterDirectItems(
    items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>
  ): Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>> {
    return items.filter(
      item =>
        item.settings.mode === 'da' &&
        ((item.syncWithGroup && item.group && item.group.scanMode.id !== 'subscription') ||
          (!(item.syncWithGroup && item.group) && item.scanMode!.id !== 'subscription'))
    );
  }

  async createSession(): Promise<ClientSession> {
    const { options, userIdentity } = await createSessionConfigs(
      this.connector.id,
      this.connector.name,
      this.connector.settings,
      this.connector.settings.readTimeout
    );
    this.logger.debug(`Connecting to OPCUA on ${this.connector.settings.url}`);
    const connectStart = DateTime.now().toMillis();
    const session = await OPCUAClient.createSession(this.connector.settings.url, userIdentity, options);
    this.logger.info(`Connected to OPCUA server ${this.connector.settings.url} in ${DateTime.now().toMillis() - connectStart} ms`);
    return session;
  }

  /**
   * Browse the OPC-UA address space one level at a time for the interactive explore feature. For every
   * Variable found in the level, also fetches its current value and, when the server exposes them (the
   * OPC-UA "AnalogItem" convention), its engineering unit and acceptable range — done eagerly, before
   * returning, so the tree shows this metadata immediately rather than requiring a separate step.
   * @param parentId - the node id to expand, or null to browse the Objects folder root (ns=0;i=85)
   */
  async explore(parentId: string | null): Promise<Array<SouthConnectorExploreEntry>> {
    // connect() swallows connection errors to drive the streaming reconnect loop. For the
    // interactive explore we (re)establish the session lazily so the real connection failure
    // is surfaced to the user instead of a generic "not connected" message.
    if (this.session === null) {
      this.session = await this.createSession();
    }
    const session = this.session;
    const nodeToBrowse = parentId ?? 'ns=0;i=85';
    try {
      const references: Array<ReferenceDescription> = [];
      const browseResult = await session.browse(nodeToBrowse);
      references.push(...(browseResult.references ?? []));
      let continuationPoint = browseResult.continuationPoint;
      while (continuationPoint && continuationPoint.length > 0) {
        const nextResult = await session.browseNext(continuationPoint, false);
        references.push(...(nextResult.references ?? []));
        continuationPoint = nextResult.continuationPoint;
      }

      const liveData = await this.readVariableLiveData(
        session,
        references.filter(reference => reference.nodeClass === NodeClass.Variable)
      );

      return references.map(reference => {
        const nodeIdString = reference.nodeId.toString();
        return {
          id: nodeIdString,
          name: reference.displayName?.text ?? reference.browseName?.toString() ?? nodeIdString,
          metadata: {
            nodeId: nodeIdString,
            type: NodeClass[reference.nodeClass] ?? String(reference.nodeClass),
            ...liveData.get(nodeIdString)
          },
          hasChildren: reference.nodeClass === NodeClass.Object || reference.nodeClass === NodeClass.Variable
        };
      });
    } catch (error) {
      if (isSessionError(error)) {
        // The session is dead: release it so a later browse reconnects instead of
        // repeatedly hitting a broken client (and free the socket immediately).
        await this.disconnect();
        throw new Error(`OPCUA explore session expired, please restart the exploration: ${(error as Error).message}`);
      }
      throw error;
    }
  }

  /**
   * For every browsed Variable, batch-fetch its current value plus, when present, its unit and
   * acceptable range. Units/ranges are not plain node attributes in OPC-UA: they only exist as child
   * "EngineeringUnits"/"EURange" Property nodes on servers that model the variable as an AnalogItem, so
   * finding them costs one extra browse (batched over every variable in the level) before the values
   * themselves can be read. Regardless of how many variables are in the level, this is at most 3 requests
   * total (1 value read + 1 property browse, run in parallel, then 1 property-value read) — never a
   * per-node round trip.
   *
   * Best-effort: a server that doesn't support one of these reads/browses degrades to plain entries
   * rather than failing the whole explore step.
   */
  private async readVariableLiveData(
    session: ClientSession,
    variableReferences: Array<ReferenceDescription>
  ): Promise<Map<string, { value?: string; unit?: string; min?: number; max?: number }>> {
    const result = new Map<string, { value?: string; unit?: string; min?: number; max?: number }>();
    if (variableReferences.length === 0) {
      return result;
    }
    const variableNodeIds = variableReferences.map(reference => reference.nodeId.toString());

    try {
      const [valueDataValues, propertyBrowseResults] = await Promise.all([
        session.read(variableNodeIds.map(nodeId => ({ nodeId, attributeId: AttributeIds.Value }))),
        session.browse(variableNodeIds)
      ]);

      variableReferences.forEach((reference, index) => {
        const dataValue = valueDataValues[index];
        const entry: { value?: string; unit?: string; min?: number; max?: number } = {};
        if (dataValue && dataValue.statusCode.value === StatusCodes.Good.value && dataValue.value?.value != null) {
          const parsedValue = parseOPCUAValue(reference.displayName?.text ?? variableNodeIds[index], dataValue.value, this.logger);
          if (parsedValue) {
            entry.value = parsedValue;
          }
        }
        result.set(variableNodeIds[index], entry);
      });

      // EngineeringUnits/EURange live as child Property nodes (HasProperty), not as attributes of the
      // variable itself — locate them per variable from the batched browse above before they can be read.
      const propertyLookups: Array<{ variableNodeId: string; kind: 'unit' | 'range'; propertyNodeId: string }> = [];
      propertyBrowseResults.forEach((propertyBrowseResult, index) => {
        for (const propertyReference of propertyBrowseResult.references ?? []) {
          const propertyName = propertyReference.browseName?.name;
          if (propertyName === 'EngineeringUnits' || propertyName === 'EURange') {
            propertyLookups.push({
              variableNodeId: variableNodeIds[index],
              kind: propertyName === 'EngineeringUnits' ? 'unit' : 'range',
              propertyNodeId: propertyReference.nodeId.toString()
            });
          }
        }
      });

      if (propertyLookups.length > 0) {
        const propertyDataValues = await session.read(
          propertyLookups.map(lookup => ({ nodeId: lookup.propertyNodeId, attributeId: AttributeIds.Value }))
        );
        propertyLookups.forEach((lookup, index) => {
          const dataValue = propertyDataValues[index];
          if (!dataValue || dataValue.statusCode.value !== StatusCodes.Good.value || dataValue.value?.value == null) {
            return;
          }
          const entry = result.get(lookup.variableNodeId) ?? {};
          if (lookup.kind === 'unit') {
            const euInformation = dataValue.value.value as EUInformation;
            if (euInformation.displayName?.text) {
              entry.unit = euInformation.displayName.text;
            }
          } else {
            const range = dataValue.value.value as Range;
            entry.min = range.low;
            entry.max = range.high;
          }
          result.set(lookup.variableNodeId, entry);
        });
      }
    } catch (error) {
      // Never let a value/unit read failure (unsupported server, timeout, ...) fail the browse itself —
      // the caller falls back to plain entries.
      this.logger.debug(`Could not read value/unit while exploring: ${getErrorMessage(error)}`);
    }

    return result;
  }

  /**
   * Retrieve step of a Configuration Workflow run: a full recursive walk of the address space under
   * `scope.rootNodeId` (or the Objects folder root, matching `explore()`'s own default, if omitted),
   * flattened into one record per Variable node — Object/folder nodes are walked into, never recorded
   * themselves. Reuses `explore()` level by level rather than a bespoke traversal, so a Variable's
   * value/unit/min/max already come from the same enrichment `explore()` itself does; this assumes
   * `rootNodeId` names a folder/Object, not a Variable directly — pointing it at a leaf Variable would
   * walk into that Variable's own EngineeringUnits/EURange properties as if they were data points.
   */
  async discover(scope: Record<string, unknown>): Promise<Array<OIBusRecord>> {
    const rootNodeId = (scope.rootNodeId as string | undefined) ?? null;
    const records: Array<OIBusRecord> = [];
    await this.walkForDiscovery(rootNodeId, records);
    return records;
  }

  private async walkForDiscovery(parentId: string | null, records: Array<OIBusRecord>): Promise<void> {
    const entries = await this.explore(parentId);
    for (const entry of entries) {
      if (entry.metadata.type === 'Variable') {
        records.push({ id: entry.id, name: entry.name, ...entry.metadata });
      } else if (entry.hasChildren) {
        await this.walkForDiscovery(entry.id, records);
      }
    }
  }

  /**
   * Get values from the OPCUA server between startTime and endTime and write them into the cache.
   */
  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
    const session = this.session;
    if (!session) {
      this.logger.debug('No OPCUA session available, skipping history query');
      return { trackedInstant: null, value: null };
    }
    try {
      return await this.getHAValues(items, startTime, endTime, session);
    } catch (error: unknown) {
      if (isDeviceError(error)) {
        this.logger.warn(
          workUnitLogCtx(items),
          `HA read failed for ${items.length} item(s) (device/PLC error, session kept): ${getErrorMessage(error)}`
        );
        return { trackedInstant: null, value: null };
      }
      this.triggerReconnect();
      throw error;
    }
  }

  async getHAValues(
    items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>,
    startTime: Instant,
    endTime: Instant,
    session: ClientSession,
    testingItem = false
  ): Promise<{ trackedInstant: Instant | null; value: OIBusTimeValue | null }> {
    // One work-unit (single item, or a synced group) can still fan out into several
    // aggregate/resampling sub-batches below — logCtx identifies the work-unit as a whole and is
    // reused across all of them rather than recomputed per sub-batch.
    const logCtx = workUnitLogCtx(items);
    let lastValue: OIBusTimeValue | null = null;
    // Track the most-recent timestamp in epoch-ms so we can compare numerically
    // and avoid re-parsing lastValue.timestamp ISO string on every history value.
    let lastValueTimestampMs = -Infinity;
    const itemsByAggregates = new Map<
      Aggregate,
      Map<Resampling | undefined, Array<{ nodeId: NodeId; item: SouthConnectorItemEntity<SouthOPCUAItemSettings> }>>
    >();

    // Batch-read previous cached state once for the whole work-unit (not once per round-trip) so
    // per-value comparisons below don't hit the database repeatedly.
    const lastValues = this.southCacheRepository.getItemsLastValues(
      this.connector.id,
      items.map(item => item.id)
    );

    for (const item of items) {
      let nodeId;
      try {
        nodeId = resolveNodeId(item.settings.nodeId);
      } catch (error: unknown) {
        this.logger.error(logCtx, `Error when parsing node ID ${item.settings.nodeId} for item ${item.name}: ${getErrorMessage(error)}`);
        continue;
      }

      // Normalise resampling: null and undefined both mean "no resampling" and must
      // map to the same bucket so items aren't split into separate historyRead requests.
      const aggregate = item.settings.haMode!.aggregate;
      const resampling = item.settings.haMode!.resampling ?? undefined;

      if (!itemsByAggregates.has(aggregate)) {
        itemsByAggregates.set(
          aggregate,
          new Map<
            Resampling,
            Array<{
              nodeId: NodeId;
              item: SouthConnectorItemEntity<SouthOPCUAItemSettings>;
            }>
          >()
        );
      }
      const resamplingMap = itemsByAggregates.get(aggregate)!;
      if (!resamplingMap.has(resampling)) {
        resamplingMap.set(resampling, [{ nodeId, item }]);
      } else {
        resamplingMap.get(resampling)!.push({ nodeId, item });
      }
    }

    for (const [aggregate, aggregatedItems] of itemsByAggregates.entries()) {
      for (const [resampling, resampledItems] of aggregatedItems.entries()) {
        const logs = new Map<string, { description: string; affectedNodes: Array<string> }>();

        // Each entry carries its associated item alongside the node descriptor so
        // we can look up the item by index (O(1)) instead of via .find() per result
        // (which was O(N²) per response). The .filter() below preserves the pairing
        // for continuation-point round-trips.
        let nodesToRead: Array<{
          nodeToRead: HistoryReadValueIdOptions;
          item: SouthConnectorItemEntity<SouthOPCUAItemSettings>;
        }> = resampledItems.map(({ nodeId, item }) => ({
          nodeToRead: {
            continuationPoint: undefined,
            dataEncoding: undefined,
            indexRange: undefined,
            nodeId
          },
          item
        }));
        const totalNodes = resampledItems.length;
        this.logger.trace(logCtx, `Reading ${totalNodes} items with aggregate ${aggregate} and resampling ${resampling}`);
        // Accumulated across every continuation-point round-trip below so we can log one debug
        // summary per sub-batch instead of one line per round-trip (a wide HA backfill can need many).
        let totalValuesAdded = 0;
        let roundTripCount = 0;
        const subBatchStart = DateTime.now();
        do {
          roundTripCount++;
          const batchValues: Array<OIBusTimeValue> = [];
          // A Set, not an array: a single item can produce several history values in one round-trip
          // (multiple timestamps for the same node), and each must only appear once in the item list
          // passed to addContent — same "one entry per item" shape as resampledItemsAsItems before.
          const itemsToCacheSet = new Set<SouthConnectorItemEntity<SouthOPCUAItemSettings>>();
          const cachedEntries: Array<{ itemId: string; value: unknown; instant: string }> = [];
          const startRequest = DateTime.now();
          const request = getHistoryReadRequest(
            startTime,
            endTime,
            aggregate,
            resampling,
            nodesToRead.map(n => n.nodeToRead)
          );
          const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();
          this.logger.trace(logCtx, `HA request done in ${requestDuration} ms`);
          request.requestHeader.timeoutHint = this.connector.settings.readTimeout;

          const response = await session.historyRead(request);
          if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
            this.logger.error(logCtx, `Error while reading history: ${response.responseHeader.serviceResult.description}`);
          }

          if (response.results) {
            this.logger.trace(
              logCtx,
              `Received a response of ${response.results.length}/${totalNodes} nodes` +
                (response.results.length < totalNodes ? ` (${totalNodes - response.results.length} completed in a previous batch)` : '')
            );

            nodesToRead = nodesToRead
              .map(({ nodeToRead: node, item: associatedItem }, i) => {
                const result = response.results![i];

                if (
                  ![StatusCodes.Good.value, StatusCodes.GoodNoData.value, StatusCodes.GoodMoreData.value].includes(result.statusCode.value)
                ) {
                  if (!logs.has(result.statusCode.name)) {
                    logs.set(result.statusCode.name, {
                      description: result.statusCode.description,
                      affectedNodes: [associatedItem.name]
                    });
                  } else {
                    logs.get(result.statusCode.name)!.affectedNodes.push(associatedItem.name);
                  }
                } else if (result.historyData && (result.historyData as HistoryDataOptions).dataValues) {
                  const historyDataValues = (result.historyData as HistoryDataOptions).dataValues!.filter(
                    value => value
                  ) as Array<DataValue>;
                  // Per-node-per-batch hot path inside HistoryRead loop. Gate the
                  // template-literal interpolation (including NodeId.toString) so it
                  // only runs when a transport actually accepts trace.
                  if (this.logger.isLevelEnabled('trace')) {
                    this.logger.trace(
                      `Result for node "${node.nodeId}" (number ${i}) contains ` +
                        `${historyDataValues.length} values and has status code ` +
                        `${result.statusCode.name}, continuation point is ${result.continuationPoint}`
                    );
                  }
                  for (const historyValue of historyDataValues) {
                    const value = parseOPCUAValue(associatedItem.name, historyValue.value, this.logger);
                    if (!value) {
                      continue;
                    }
                    const selectedTimestamp = historyValue.sourceTimestamp ?? historyValue.serverTimestamp;
                    const selectedTimestampMs = selectedTimestamp!.getTime();
                    const timeValue: OIBusTimeValue = {
                      pointId: associatedItem.name,
                      timestamp: selectedTimestamp!.toISOString(),
                      data: {
                        value,
                        quality: historyValue.statusCode.name
                      }
                    };
                    const previous = lastValues.get(associatedItem.id) ?? null;
                    const shouldCache = shouldCacheValue({
                      cachingStrategy: associatedItem.cachingStrategy ?? 'allValues',
                      thresholdType: associatedItem.thresholdType,
                      threshold: associatedItem.threshold,
                      rangeLow: associatedItem.rangeLow,
                      rangeHigh: associatedItem.rangeHigh,
                      maxCachingInterval: associatedItem.maxCachingInterval,
                      previousCachedValue: previous?.value ?? null,
                      previousCachedInstant: previous?.trackedInstant ?? null,
                      newValue: value,
                      newQueryTime: timeValue.timestamp
                    });
                    if (shouldCache) {
                      batchValues.push(timeValue);
                      itemsToCacheSet.add(associatedItem);
                      cachedEntries.push({ itemId: associatedItem.id, value, instant: timeValue.timestamp });
                      // Keep the shadow up to date so a later value within the same round-trip for
                      // the same item is compared against the value that was actually cached, not
                      // the stale pre-cycle state.
                      lastValues.set(associatedItem.id, { value, trackedInstant: timeValue.timestamp });
                    }
                    if (selectedTimestampMs > lastValueTimestampMs) {
                      lastValue = timeValue;
                      lastValueTimestampMs = selectedTimestampMs;
                    }
                  }
                }

                return {
                  nodeToRead: { ...node, continuationPoint: result.continuationPoint },
                  item: associatedItem,
                  status: result.statusCode,
                  hasData:
                    result.historyData &&
                    (result.historyData as HistoryDataOptions).dataValues &&
                    (result.historyData as HistoryDataOptions).dataValues!.length > 0
                };
              })
              .filter(
                entry =>
                  entry.hasData &&
                  [StatusCodes.Good.value, StatusCodes.GoodNoData.value, StatusCodes.GoodMoreData.value].includes(entry.status.value) &&
                  entry.nodeToRead.continuationPoint &&
                  entry.nodeToRead.continuationPoint.length > 0
              );

            totalValuesAdded += batchValues.length;
            if (!testingItem) {
              // addContent errors (cache/disk) must not propagate: they are unrelated
              // to the OPC-UA session and would trigger a needless disconnect+reconnect.
              try {
                await this.addContent(
                  { type: 'time-values', content: batchValues },
                  startRequest.toUTC().toISO(),
                  Array.from(itemsToCacheSet)
                );
                this.southCacheRepository.saveItemsLastValues(this.connector.id, cachedEntries);
              } catch (addError: unknown) {
                this.logger.error(logCtx, `Error saving HA values to cache: ${getErrorMessage(addError)}`);
              }
              this.logger.trace(logCtx, `Continue read for ${nodesToRead.length}/${totalNodes} nodes with pending data`);
            }
          } else {
            this.logger.error(logCtx, 'No result found in response');
            nodesToRead = [];
          }
        } while (nodesToRead.length > 0);
        const subBatchDuration = DateTime.now().toMillis() - subBatchStart.toMillis();
        this.logger.debug(
          logCtx,
          `Added ${totalValuesAdded} values for ${totalNodes} items between ${startTime} and ${endTime} ` +
            `in ${roundTripCount} request(s) (${subBatchDuration} ms)`
        );

        // If all is retrieved, clear continuation points
        const releaseRequest = getHistoryReadRequest(
          startTime,
          endTime,
          aggregate,
          resampling,
          resampledItems.map(({ nodeId }) => ({
            continuationPoint: undefined,
            dataEncoding: undefined,
            indexRange: undefined,
            nodeId
          }))
        );
        releaseRequest.releaseContinuationPoints = true;
        const response = await session.historyRead(releaseRequest);

        if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
          this.logger.error(logCtx, `Error while releasing continuation points: ${response.responseHeader.serviceResult.description}`);
        }
        logMessages(logs, this.logger, logCtx);
      }
    }

    // TypeScript's control-flow analysis can't see assignments inside the .map()
    // callback above, so it narrows lastValue to its initial type (null) here.
    // The `as` cast disables narrowing for the use site.
    const result = lastValue as OIBusTimeValue | null;
    return {
      trackedInstant: result?.timestamp ?? null,
      value: result
    };
  }

  async directQuery(items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>): Promise<OIBusTimeValue | null> {
    const logCtx = workUnitLogCtx(items);
    const nodesToRead: Array<{ nodeId: NodeId; name: string; settings: SouthOPCUAItemSettings }> = [];
    let content: Array<OIBusTimeValue> = [];
    for (const item of items) {
      if (item.settings.mode === 'da') {
        let nodeId;
        try {
          nodeId = resolveNodeId(item.settings.nodeId);
          nodesToRead.push({ nodeId, name: item.name, settings: item.settings });
        } catch (error: unknown) {
          this.logger.error(logCtx, `Error when parsing node ID ${item.settings.nodeId} for item ${item.name}: ${getErrorMessage(error)}`);
        }
      }
    }
    if (nodesToRead.length === 0) {
      return null;
    }
    this.logger.debug(logCtx, `Reading ${nodesToRead.length} node(s)`);
    const session = this.session;
    if (!session) {
      this.logger.debug('No OPCUA session available, skipping direct query');
      return null;
    }
    // addContent is outside the try so that a cache/disk error never causes a
    // session reconnect. For the read itself: per-node unavailability
    // (BadNodeIdUnknown, BadNotConnected, …) is normally returned as individual
    // DataValue status codes and never reaches this catch. If the server raises a
    // service-level error (e.g. Kepware reporting a device/PLC offline as
    // BadCommunicationError), that is a device error — log it and skip this group
    // without touching the session so other PLC groups keep working. Only genuine
    // session/transport failures (BadSessionClosed, ECONNRESET, …) trigger a reconnect.
    const queryTime = DateTime.now().toUTC().toISO();
    try {
      content = await this.getDAValues(nodesToRead, session, logCtx);
    } catch (error) {
      if (isDeviceError(error)) {
        this.logger.warn(
          logCtx,
          `DA read failed for ${nodesToRead.length} node(s) (device/PLC error, session kept): ${getErrorMessage(error)}`
        );
        return null;
      }
      this.triggerReconnect();
      throw error;
    }

    // getDAValues doesn't carry the full item entity at push time (only nodeId/name/settings), so
    // join back to the full entities here (item name is unique within a direct-query batch) and
    // apply the caching strategy in a single post-processing step before addContent.
    const itemsByName = new Map(items.map(item => [item.name, item]));
    const candidates = content.flatMap(timeValue => {
      const item = itemsByName.get(timeValue.pointId);
      return item ? [{ item, value: timeValue }] : [];
    });
    const cachedPairs = this.applyCachingStrategy(candidates, ({ item, value }) => ({
      item,
      value: value.data.value,
      timestamp: value.timestamp
    }));

    await this.addContent(
      { type: 'time-values', content: cachedPairs.map(({ value }) => value) },
      queryTime,
      cachedPairs.map(({ item }) => item)
    );
    return content && content.length > 0 ? content[content.length - 1] : null;
  }

  async getDAValues(
    nodesToRead: Array<{ nodeId: NodeId; name: string; settings: SouthOPCUAItemSettings }>,
    session: ClientSession,
    logCtx: Record<string, string> = {}
  ): Promise<Array<OIBusTimeValue>> {
    const startRequest = DateTime.now().toMillis();
    const timeoutMs = this.connector.settings.readTimeout;

    // Mirror the HA path: cap the read so a hanging PLC/server cannot leave the
    // connector stuck in run() indefinitely (runProgress$ set but never resolved).
    // BadTimeout is classified as a device error → session kept, no reconnect.
    let timeoutId: NodeJS.Timeout | undefined;
    const readPromise = session.read(nodesToRead) as Promise<Array<DataValue>>;
    const dataValues = await Promise.race([
      readPromise.finally(() => clearTimeout(timeoutId)),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          // Silence any late rejection from the still-pending read so it doesn't
          // become an unhandled rejection after the timeout fires.
          readPromise.catch(() => {
            /* empty */
          });
          reject(new Error(`BadTimeout: DA read timed out after ${timeoutMs} ms`));
        }, timeoutMs);
      })
    ]);
    const requestDuration = DateTime.now().toMillis() - startRequest;
    this.logger.debug(logCtx, `Found ${dataValues.length} results for ${nodesToRead.length} items (DA mode) in ${requestDuration} ms`);
    if (dataValues.length !== nodesToRead.length) {
      this.logger.error(
        logCtx,
        `Received ${dataValues.length} node results, requested ${nodesToRead.length} nodes. Request done in ${requestDuration} ms`
      );
    }

    const oibusTimestamp = DateTime.now().toUTC().toISO();
    return dataValues
      .map((dataValue: DataValue, i) => {
        const selectedTimestamp = getTimestamp(dataValue, nodesToRead[i].settings, oibusTimestamp);
        return {
          pointId: nodesToRead[i].name,
          timestamp: selectedTimestamp,
          data: {
            value: parseOPCUAValue(nodesToRead[i].name, dataValue.value, this.logger),
            quality: dataValue.statusCode.name
          }
        };
      })
      .filter(parsedValue => parsedValue.data.value);
  }

  async subscribe(items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>): Promise<void> {
    if (!items.length) {
      return;
    }
    // Hydrate the in-memory shadow from the persisted table for any of these items not already
    // known in-memory, so maxCachingInterval's clock correctly resumes across restarts instead of
    // starting from a cold, empty shadow.
    const itemsToHydrate = items.filter(item => !this.lastCachedValuesByItem.has(item.id));
    if (itemsToHydrate.length > 0) {
      const lastValues = this.southCacheRepository.getItemsLastValues(
        this.connector.id,
        itemsToHydrate.map(item => item.id)
      );
      for (const [itemId, entry] of lastValues) {
        if (entry.trackedInstant) {
          this.lastCachedValuesByItem.set(itemId, { value: entry.value, instant: entry.trackedInstant });
        }
      }
    }
    if (!this.subscription) {
      this.subscription = await this.session!.createSubscription2({
        requestedPublishingInterval: 150,
        requestedLifetimeCount: 100,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 0,
        publishingEnabled: true,
        priority: 10
      });
      this.subscription.on('terminated', () => {
        if (!this.disconnecting) {
          this.logger.error('OPC-UA subscription terminated by server. Triggering reconnect');
          this.triggerReconnect();
        }
      });
      this.subscription.on('keepalive', () => {
        this.resetSubscriptionWatchdog();
      });
      this.subscription.on('status_changed', (status: StatusCode) => {
        this.logger.warn(`OPC-UA subscription status changed: ${status}`);
      });
      this.flushTimeout = setTimeout(this.flushMessages.bind(this), this.connector.settings.flushMessageTimeout);
      this.resetSubscriptionWatchdog();
    }

    for (const item of items) {
      if (this.monitoredItems.has(item.id)) {
        continue;
      }
      let nodeId;
      try {
        nodeId = resolveNodeId(item.settings.nodeId);
      } catch (error: unknown) {
        this.logger.error(`Error when parsing node ID ${item.settings.nodeId} for item ${item.name}: ${getErrorMessage(error)}`);
        continue;
      }
      const monitoredItem = await this.subscription.monitor(
        {
          nodeId,
          attributeId: AttributeIds.Value
        },
        {
          samplingInterval: -1,
          discardOldest: true,
          queueSize: 10
        },
        TimestampsToReturn.Neither
      );
      monitoredItem.on('changed', (dataValue: DataValue) => {
        this.resetSubscriptionWatchdog();
        const parsedValue = parseOPCUAValue(item.name, dataValue.value, this.logger);
        if (parsedValue) {
          const timestamp = DateTime.now().toUTC().toISO();
          const previous = this.lastCachedValuesByItem.get(item.id) ?? null;
          const shouldCache = shouldCacheValue({
            cachingStrategy: item.cachingStrategy ?? 'allValues',
            thresholdType: item.thresholdType,
            threshold: item.threshold,
            rangeLow: item.rangeLow,
            rangeHigh: item.rangeHigh,
            maxCachingInterval: item.maxCachingInterval,
            previousCachedValue: previous?.value ?? null,
            previousCachedInstant: previous?.instant ?? null,
            newValue: parsedValue,
            newQueryTime: timestamp
          });
          if (!shouldCache) {
            return;
          }
          this.lastCachedValuesByItem.set(item.id, { value: parsedValue, instant: timestamp });
          this.bufferedValues.push({
            item: item,
            timestamp,
            value: parsedValue,
            quality: dataValue.statusCode.name
          });
          if (this.bufferedValues.length >= this.connector.settings.maxNumberOfMessages) {
            // flushMessages() is async; keep the event handler synchronous so any
            // rejection from flush is handled inside flushMessages itself rather than
            // becoming an unhandled rejection from an async event handler.
            this.flushMessages().catch((err: unknown) => {
              this.logger.error(`Error flushing messages from subscription: ${getErrorMessage(err)}`);
            });
          }
        }
      });
      this.monitoredItems.set(item.id, monitoredItem);
    }
  }

  async flushMessages(): Promise<void> {
    // Swap-and-walk: take ownership of the current buffer in O(1) and let the
    // subscription handler accumulate into a fresh one. Avoids the Array.from copy.
    const valuesToSend = this.bufferedValues;
    this.bufferedValues = [];
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    if (valuesToSend.length) {
      this.logger.debug(`Flushing ${valuesToSend.length} messages`);
      try {
        const content = new Array<OIBusTimeValue>(valuesToSend.length);
        const uniqueItems = new Set<SouthConnectorItemEntity<SouthOPCUAItemSettings>>();
        // Every buffered value already passed shouldCacheValue at push time (see subscribe()), so
        // the whole flushed batch is what actually gets cached this cycle. Dedupe to one row per
        // item (keeping the most recent value/instant) since south_item_cache is keyed by item id.
        const cachedEntriesByItem = new Map<string, { itemId: string; value: unknown; instant: string }>();
        for (let i = 0; i < valuesToSend.length; i++) {
          const element = valuesToSend[i];
          content[i] = {
            pointId: element.item.name,
            timestamp: element.timestamp,
            data: { value: element.value, quality: element.quality }
          };
          uniqueItems.add(element.item);
          cachedEntriesByItem.set(element.item.id, { itemId: element.item.id, value: element.value, instant: element.timestamp });
        }
        await this.addContent({ type: 'time-values', content }, DateTime.now().toUTC().toISO(), Array.from(uniqueItems));
        // Subscription mode never wrote to south_item_cache before this feature: this is the first
        // path that persists the per-item "last cached" row for push-based items.
        this.southCacheRepository.saveItemsLastValues(this.connector.id, Array.from(cachedEntriesByItem.values()));
      } catch (error: unknown) {
        this.logger.error(`Error when flushing messages: ${getErrorMessage(error)}`);
      }
    }
    this.flushTimeout = setTimeout(this.flushMessages.bind(this), this.connector.settings.flushMessageTimeout);
  }

  private resetSubscriptionWatchdog(): void {
    if (this.subscriptionWatchdog) {
      clearTimeout(this.subscriptionWatchdog);
    }
    this.subscriptionWatchdog = setTimeout(() => {
      if (!this.disconnecting) {
        this.logger.error(
          `OPC-UA subscription watchdog: no keepalive or data received for ${this.connector.settings.readTimeout} ms. Triggering reconnect`
        );
        this.triggerReconnect();
      }
    }, this.connector.settings.readTimeout);
  }

  private clearSubscriptionWatchdog(): void {
    if (this.subscriptionWatchdog) {
      clearTimeout(this.subscriptionWatchdog);
      this.subscriptionWatchdog = null;
    }
  }

  private triggerReconnect(): void {
    if (this.disconnecting) return;
    this.disconnect()
      .then(() => {
        if (!this.disconnecting && this.connector.enabled) {
          this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
        }
      })
      .catch((err: unknown) => {
        this.logger.error(`Error during reconnect after subscription issue: ${getErrorMessage(err)}`);
      });
  }

  async unsubscribe(items: Array<SouthConnectorItemEntity<SouthOPCUAItemSettings>>): Promise<void> {
    for (const item of items) {
      if (this.monitoredItems.has(item.id)) {
        this.monitoredItems.get(item.id)!.removeAllListeners();
        await this.monitoredItems.get(item.id)!.terminate();
        this.monitoredItems.delete(item.id);
      }
    }
  }
}
