import { spawn } from 'node:child_process';
/**
 * One raw value out of `PIPointList.RecordedValues`, JSON-serialized as-is (timestamp as an ISO
 * string, value as a string) — building the `time-values` shape and tracking the max instant are the
 * south connector's job, the same division of responsibility `@oibus/oledb-windows` uses for rows.
 *
 * `pointId` is the raw PI point name as resolved by the AF SDK (`PIPoint.Name`) — for a wildcard mask
 * that's the only name there ever is (one mask can match several real points), and for an exact tag
 * name it's the resolved form of whatever string was passed in, which may differ from the OIBus item's
 * own `name` (case, aliasing). The helper does not know the item list, so it never maps this back to
 * an item name — the south connector does that itself from `piPoint`.
 */
export interface PiRawValue {
    pointId: string;
    timestamp: string;
    value: string;
}
/**
 * The PI server `connect()` actually resolved to — since there's only ever one "default" PI server per
 * machine, this is the same for every connection sharing the process, but each `PiConnection` carries
 * its own copy so the south connector doesn't have to track a separate lookup for it.
 */
export interface PiServerInfo {
    name: string;
    version: string;
    host: string;
    port: number;
}
/**
 * `ok` only ever appears on `connect`/`disconnect` responses (a plain success/failure signal with no
 * payload beyond `serverInfo` for connect). `read` responses carry no `ok` at all — `error` present
 * means failure, `values` present means success; see `PiConnection.read`'s doc comment.
 */
interface PiResponse {
    requestId?: string;
    ok?: boolean;
    error?: string;
    values?: Array<PiRawValue>;
    serverInfo?: PiServerInfo;
}
/**
 * Resolves the bundled OIBusPiAfSdkWindows helper binary for the current architecture.
 * Overridable via OIBUS_PI_AFSDK_WINDOWS_BINARY (used by this package's own tests, and by anyone
 * running a custom build during development).
 */
export declare function resolvePiBinaryPath(): string;
/**
 * Manages exactly one OIBusPiAfSdkWindows child process and multiplexes any number of concurrent
 * logical connections over it via a per-connection `id` and a per-request `requestId` for response
 * correlation — see `backend/native/oledb-windows/src/index.ts`'s `OleDbBridge`, which this mirrors
 * exactly (same shape, same reasoning: responses can arrive out of order across connections, and
 * `spawnFn` is injectable only because `node:child_process` can't be module-mocked in this
 * codebase's tests).
 *
 * Unlike OLE DB, every logical connection ultimately shares the *same* underlying PI server
 * connection on the .NET side (there is only ever one "default" PI server per machine) — but the
 * bridge itself doesn't need to know that; it just ships commands tagged with an id and matches
 * responses by requestId, the same as for OLE DB.
 */
export declare class PiBridge {
    private readonly binaryPath;
    private readonly spawnFn;
    private child;
    private readonly pending;
    private nextRequestId;
    private startupError;
    constructor(binaryPath?: string, spawnFn?: typeof spawn);
    get isRunning(): boolean;
    send(command: Record<string, unknown>): Promise<PiResponse>;
    stop(): void;
    private ensureStarted;
    private handleLine;
    private failAll;
}
/**
 * Test-only seam: swaps the factory used to create the shared bridge singleton (so tests can inject a
 * fake spawn without touching the real one) and resets reference counting. Not part of the package's
 * public surface for consumers — used only by this package's own spec.
 */
export declare function __resetSharedBridgeForTesting(factory?: () => PiBridge): void;
/**
 * One logical PI connection. Any number of `PiConnection`s — from the same or different OIBus south
 * connectors — share a single OIBusPiAfSdkWindows child process under the hood, spawned lazily on the
 * first `connect()` call and torn down once the last connection using it calls `disconnect()`. All
 * connections ultimately read from the same underlying PI server (there is only one "default" server
 * per machine — see the helper's own doc comment), but reads on different connections still run
 * concurrently against it and each connection's own commands stay correctly ordered.
 *
 * `disconnect()` deliberately does not tear down the underlying PI server session (neither did
 * OIBusAgentWindows's own agent) — reconnecting to a PI server is comparatively expensive, so it's
 * kept alive on the helper process for as long as that process runs.
 */
export declare class PiConnection {
    private readonly id;
    private readonly bridge;
    readonly serverInfo: PiServerInfo;
    private closed;
    private constructor();
    static connect(): Promise<PiConnection>;
    /**
     * `points` is a flat list of PI point name masks — either an exact tag name or a wildcard pattern
     * (`*`, `?`) — with no other structure needed: `PIPoint.FindPIPoints(server, names)` on the .NET
     * side resolves any mix of the two in one bulk call, so there's no reason to keep an exact-name
     * lookup and a wildcard-search lookup as separate concepts on the wire (see Program.cs's
     * `HandleRead`). The south connector is the one that knows which of its items' `piPoint`/`piQuery`
     * settings produced which mask, and maps raw PI point names back to item names itself afterward.
     *
     * Returns just the raw values — no `ok`/`logs` envelope: a single bulk resolution either succeeds
     * (returns whatever values it found, however many) or fails outright (rejects), so there's nothing
     * partial left to report through a separate `logs` array. On failure the rejection's `message` is
     * the PI error text as-is; logging it is the south connector's job, not this package's.
     */
    read(startTime: string, endTime: string, points: Array<string>): Promise<Array<PiRawValue>>;
    disconnect(): Promise<void>;
}
export {};
