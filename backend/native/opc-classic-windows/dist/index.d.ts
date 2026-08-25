import { spawn } from 'node:child_process';
export type OpcMode = 'da' | 'hda';
/** {vendorInfo, productVersion, serverState} off the OPC server's own GetStatus() call, gathered once on connect. */
export interface OpcServerInfo {
    vendorInfo: string;
    productVersion: string;
    serverState: string;
}
/**
 * One raw value out of a DA `Read()` or an HDA `ReadRaw()`/`ReadProcessed()` page, JSON-serialized
 * as-is — building the `time-values` shape and tracking the max instant are the south connector's
 * job, the same division of responsibility `@oibus/pi-afsdk-windows` uses for raw PI values.
 *
 * `nodeId` is always the exact OPC item id the read was issued for (never a mask/wildcard — OPC
 * Classic items are always exact references, unlike PI's `piQuery`), so the south connector can map
 * it back to its own item's `name` with a plain lookup.
 */
export interface OpcRawValue {
    nodeId: string;
    timestamp: string;
    value: string;
    quality: string;
}
/** Extra HDA-only parameters for `read()` — ignored entirely by the helper for a DA connection. */
export interface OpcHdaReadOptions {
    aggregate?: string;
    resampling?: string;
    maxReadValues?: number;
    intervalReadDelay?: number;
}
export interface OpcNode {
    name: string;
    nodeId: string;
    isItem: boolean;
    hasChildren: boolean;
    nodes: Array<OpcNode>;
}
/**
 * `ok` only ever appears on `connect`/`disconnect` responses. `read`/`browse` carry no `ok` at all —
 * `error`'s presence is the only failure signal, matching `@oibus/pi-afsdk-windows`'s simplified
 * envelope: a single bulk call either succeeds outright or fails outright, nothing partial to report.
 */
interface OpcResponse {
    requestId?: string;
    ok?: boolean;
    error?: string;
    serverInfo?: OpcServerInfo;
    values?: Array<OpcRawValue>;
    nodes?: Array<OpcNode>;
}
/**
 * Resolves the bundled OIBusOpcClassicWindows helper binary for the current architecture.
 * Overridable via OIBUS_OPC_CLASSIC_WINDOWS_BINARY (used by this package's own tests, and by anyone
 * running a custom build during development).
 */
export declare function resolveOpcBinaryPath(): string;
/**
 * Manages exactly one OIBusOpcClassicWindows child process and multiplexes any number of concurrent
 * logical connections over it via a per-connection `id` and a per-request `requestId` for response
 * correlation — see `backend/native/oledb-windows/src/index.ts`'s `OleDbBridge`, which this mirrors
 * exactly (same shape, same reasoning: responses can arrive out of order across connections, and
 * `spawnFn` is injectable only because `node:child_process` can't be module-mocked in this
 * codebase's tests).
 *
 * Unlike PI (every connection shares one underlying PIServer), each connection here gets its own
 * real `Opc.Server` on the .NET side — different OPC connectors can genuinely target different
 * hosts/servers/modes — but the bridge itself doesn't need to know that; it just ships commands
 * tagged with an id and matches responses by requestId, same as for OLE DB and PI.
 */
export declare class OpcBridge {
    private readonly binaryPath;
    private readonly spawnFn;
    private child;
    private readonly pending;
    private nextRequestId;
    private startupError;
    constructor(binaryPath?: string, spawnFn?: typeof spawn);
    get isRunning(): boolean;
    send(command: Record<string, unknown>): Promise<OpcResponse>;
    stop(): void;
    private ensureStarted;
    private handleLine;
    private failAll;
}
/**
 * Test-only seam: swaps the factory used to create the shared bridge singleton (so tests can inject
 * a fake spawn without touching the real one) and resets reference counting. Not part of the
 * package's public surface for consumers — used only by this package's own spec.
 */
export declare function __resetSharedBridgeForTesting(factory?: () => OpcBridge): void;
/**
 * One logical OPC Classic connection (DA or HDA). Any number of `OpcConnection`s — from the same or
 * different OIBus south connectors, against the same or different OPC servers — share a single
 * OIBusOpcClassicWindows child process under the hood, spawned lazily on the first `connect()` call
 * and torn down once the last connection using it calls `disconnect()`. Each connection gets its own
 * real `Opc.Server` on the .NET side, so reads/browses on different connections run fully
 * independently even against different servers.
 */
export declare class OpcConnection {
    private readonly id;
    private readonly bridge;
    readonly serverInfo: OpcServerInfo;
    private closed;
    private constructor();
    static connect(host: string, serverName: string, mode: OpcMode): Promise<OpcConnection>;
    /**
     * `nodeIds` is a flat list of exact OPC item ids — no name/type on the wire, same reasoning as
     * `@oibus/pi-afsdk-windows`'s `PiConnection.read`. `options` only matters for an HDA connection
     * (aggregate/resampling/paging); a DA connection ignores it entirely.
     *
     * Returns just the raw values found — no `ok` envelope: one bulk read either succeeds (with
     * however many values it found, including a proper HDA read's own internal pagination) or fails
     * outright, so there's nothing partial to report through a separate field. On failure the
     * rejection's `message` is the OPC/DCOM error text as-is; logging it is the south connector's job.
     */
    read(startTime: string, endTime: string, nodeIds: Array<string>, options?: OpcHdaReadOptions): Promise<Array<OpcRawValue>>;
    browse(nodeId: string, recursive: boolean): Promise<Array<OpcNode>>;
    disconnect(): Promise<void>;
}
export {};
