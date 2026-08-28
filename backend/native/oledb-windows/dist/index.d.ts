import { spawn } from 'node:child_process';
export type OleDbValue = string | number | boolean | null;
export type OleDbRow = Record<string, OleDbValue>;
interface OleDbResponse {
    requestId?: string;
    ok: boolean;
    error?: string;
    rows?: Array<OleDbRow>;
}
/**
 * Resolves the bundled OIBusOleDbWindows helper binary for the current architecture.
 * Overridable via OIBUS_OLEDB_WINDOWS_BINARY (used by this package's own tests, and by anyone
 * running a custom build during development).
 */
export declare function resolveOleDbBinaryPath(): string;
/**
 * Manages exactly one OIBusOleDbWindows child process and multiplexes any number of concurrent
 * logical OLE DB connections over it: each connection gets a stable `id` the .NET helper uses as a
 * key into its own dictionary of open OleDbConnections, and each individual request gets a
 * `requestId` used to match a response back to the right caller — responses can arrive out of order
 * across different connections (two different connections can each have a query in flight at once;
 * the helper answers whichever finishes first), so `pending` is a map keyed by `requestId`, not a
 * FIFO queue.
 *
 * `spawnFn` is injectable for tests only — `node:child_process` is a Node built-in and can't be
 * reliably intercepted through require-cache-based module mocking.
 */
export declare class OleDbBridge {
    private readonly binaryPath;
    private readonly spawnFn;
    private child;
    private readonly pending;
    private nextRequestId;
    private startupError;
    constructor(binaryPath?: string, spawnFn?: typeof spawn);
    get isRunning(): boolean;
    send(command: Record<string, unknown>): Promise<OleDbResponse>;
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
export declare function __resetSharedBridgeForTesting(factory?: () => OleDbBridge): void;
/**
 * One logical OLE DB connection. Any number of `OleDbConnection`s — from the same or different OIBus
 * south connectors, against the same or different OLE DB targets — share a single
 * OIBusOleDbWindows child process under the hood, spawned lazily on the first `connect()` call and
 * torn down once the last connection using it calls `disconnect()`. Concurrent `read()` calls on
 * different connections run genuinely in parallel; the helper serializes commands per connection id
 * (a single OleDbConnection isn't safe for concurrent commands) but never blocks one connection's
 * work on another's.
 */
export declare class OleDbConnection {
    private readonly id;
    private readonly bridge;
    private closed;
    private constructor();
    static connect(connectionString: string): Promise<OleDbConnection>;
    read(sql: string, readTimeout?: number): Promise<Array<OleDbRow>>;
    disconnect(): Promise<void>;
}
export {};
