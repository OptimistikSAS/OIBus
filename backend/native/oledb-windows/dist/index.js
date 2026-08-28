"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OleDbConnection = exports.OleDbBridge = void 0;
exports.resolveOleDbBinaryPath = resolveOleDbBinaryPath;
exports.__resetSharedBridgeForTesting = __resetSharedBridgeForTesting;
const node_child_process_1 = require("node:child_process");
const node_readline_1 = require("node:readline");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const ARCH_FOLDERS = {
    x64: 'win-x64',
    ia32: 'win-x86',
    arm64: 'win-arm64'
};
/**
 * Resolves the bundled OIBusOleDbWindows helper binary for the current architecture.
 * Overridable via OIBUS_OLEDB_WINDOWS_BINARY (used by this package's own tests, and by anyone
 * running a custom build during development).
 */
function resolveOleDbBinaryPath() {
    const override = process.env.OIBUS_OLEDB_WINDOWS_BINARY;
    if (override) {
        return override;
    }
    const archFolder = ARCH_FOLDERS[process.arch];
    if (!archFolder) {
        throw new Error(`Unsupported architecture for the OLE DB Windows helper: ${process.arch}`);
    }
    return node_path_1.default.join(__dirname, '..', 'runtimes', archFolder, 'OIBusOleDbWindows.exe');
}
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
class OleDbBridge {
    binaryPath;
    spawnFn;
    child = null;
    pending = new Map();
    nextRequestId = 1;
    startupError = null;
    constructor(binaryPath = resolveOleDbBinaryPath(), spawnFn = node_child_process_1.spawn) {
        this.binaryPath = binaryPath;
        this.spawnFn = spawnFn;
    }
    get isRunning() {
        return this.child !== null;
    }
    send(command) {
        this.ensureStarted();
        if (this.startupError) {
            return Promise.reject(this.startupError);
        }
        const child = this.child;
        const requestId = String(this.nextRequestId++);
        return new Promise((resolve, reject) => {
            this.pending.set(requestId, { resolve, reject });
            child.stdin.write(`${JSON.stringify({ ...command, requestId })}\n`);
        });
    }
    stop() {
        if (this.child) {
            this.child.kill();
            this.child = null;
        }
        this.failAll(new Error('OLE DB helper process was stopped'));
    }
    ensureStarted() {
        if (this.child) {
            return;
        }
        this.startupError = null;
        const child = this.spawnFn(this.binaryPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
        this.child = child;
        (0, node_readline_1.createInterface)({ input: child.stdout }).on('line', line => this.handleLine(line));
        child.on('error', error => {
            this.startupError = error;
            this.failAll(error);
        });
        child.on('exit', (code, signal) => {
            this.child = null;
            this.failAll(new Error(`OLE DB helper exited unexpectedly (code ${code}, signal ${signal})`));
        });
    }
    handleLine(line) {
        let response;
        try {
            response = JSON.parse(line);
        }
        catch {
            return;
        }
        const requestId = response.requestId;
        if (!requestId) {
            return;
        }
        const pending = this.pending.get(requestId);
        if (!pending) {
            return;
        }
        this.pending.delete(requestId);
        pending.resolve(response);
    }
    failAll(error) {
        const pending = Array.from(this.pending.values());
        this.pending.clear();
        for (const request of pending) {
            request.reject(error);
        }
    }
}
exports.OleDbBridge = OleDbBridge;
let sharedBridge = null;
let refCount = 0;
let bridgeFactory = () => new OleDbBridge();
function acquireBridge() {
    if (!sharedBridge) {
        sharedBridge = bridgeFactory();
    }
    refCount++;
    return sharedBridge;
}
function releaseBridge() {
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0 && sharedBridge) {
        sharedBridge.stop();
        sharedBridge = null;
    }
}
/**
 * Test-only seam: swaps the factory used to create the shared bridge singleton (so tests can inject a
 * fake spawn without touching the real one) and resets reference counting. Not part of the package's
 * public surface for consumers — used only by this package's own spec.
 */
function __resetSharedBridgeForTesting(factory) {
    if (sharedBridge) {
        sharedBridge.stop();
    }
    sharedBridge = null;
    refCount = 0;
    bridgeFactory = factory ?? (() => new OleDbBridge());
}
/**
 * One logical OLE DB connection. Any number of `OleDbConnection`s — from the same or different OIBus
 * south connectors, against the same or different OLE DB targets — share a single
 * OIBusOleDbWindows child process under the hood, spawned lazily on the first `connect()` call and
 * torn down once the last connection using it calls `disconnect()`. Concurrent `read()` calls on
 * different connections run genuinely in parallel; the helper serializes commands per connection id
 * (a single OleDbConnection isn't safe for concurrent commands) but never blocks one connection's
 * work on another's.
 */
class OleDbConnection {
    id;
    bridge;
    closed = false;
    constructor(id, bridge) {
        this.id = id;
        this.bridge = bridge;
    }
    static async connect(connectionString) {
        if (process.platform !== 'win32') {
            throw new Error('OLE DB requires Windows (System.Data.OleDb is Windows-only)');
        }
        const bridge = acquireBridge();
        const id = node_crypto_1.default.randomUUID();
        try {
            const response = await bridge.send({ command: 'connect', id, connectionString });
            if (!response.ok) {
                throw new Error(response.error ?? 'Unknown error while connecting');
            }
            return new OleDbConnection(id, bridge);
        }
        catch (error) {
            releaseBridge();
            throw error;
        }
    }
    async read(sql, readTimeout) {
        if (this.closed) {
            throw new Error('Connection is closed');
        }
        const response = await this.bridge.send({ command: 'read', id: this.id, sql, readTimeout });
        if (!response.ok) {
            throw new Error(response.error ?? 'Unknown error while querying');
        }
        return response.rows;
    }
    async disconnect() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        try {
            await this.bridge.send({ command: 'disconnect', id: this.id });
        }
        catch {
            // Best-effort: the helper may already be gone (crash, prior stop). Either way this
            // connection's slot on the shared bridge is released below regardless.
        }
        finally {
            releaseBridge();
        }
    }
}
exports.OleDbConnection = OleDbConnection;
