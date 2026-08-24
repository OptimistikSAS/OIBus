"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PiConnection = exports.PiBridge = void 0;
exports.resolvePiBinaryPath = resolvePiBinaryPath;
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
 * Resolves the bundled OIBusPiAfSdkWindows helper binary for the current architecture.
 * Overridable via OIBUS_PI_AFSDK_WINDOWS_BINARY (used by this package's own tests, and by anyone
 * running a custom build during development).
 */
function resolvePiBinaryPath() {
    const override = process.env.OIBUS_PI_AFSDK_WINDOWS_BINARY;
    if (override) {
        return override;
    }
    const archFolder = ARCH_FOLDERS[process.arch];
    if (!archFolder) {
        throw new Error(`Unsupported architecture for the PI AF SDK Windows helper: ${process.arch}`);
    }
    return node_path_1.default.join(__dirname, '..', 'runtimes', archFolder, 'OIBusPiAfSdkWindows.exe');
}
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
class PiBridge {
    binaryPath;
    spawnFn;
    child = null;
    pending = new Map();
    nextRequestId = 1;
    startupError = null;
    constructor(binaryPath = resolvePiBinaryPath(), spawnFn = node_child_process_1.spawn) {
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
        this.failAll(new Error('PI AF SDK helper process was stopped'));
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
            this.failAll(new Error(`PI AF SDK helper exited unexpectedly (code ${code}, signal ${signal})`));
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
exports.PiBridge = PiBridge;
let sharedBridge = null;
let refCount = 0;
let bridgeFactory = () => new PiBridge();
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
    bridgeFactory = factory ?? (() => new PiBridge());
}
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
class PiConnection {
    id;
    bridge;
    serverInfo;
    closed = false;
    constructor(id, bridge, serverInfo) {
        this.id = id;
        this.bridge = bridge;
        this.serverInfo = serverInfo;
    }
    static async connect() {
        if (process.platform !== 'win32') {
            throw new Error('PI requires Windows (the OSIsoft AF SDK is Windows-only)');
        }
        const bridge = acquireBridge();
        const id = node_crypto_1.default.randomUUID();
        try {
            const response = await bridge.send({ command: 'connect', id });
            if (!response.ok) {
                throw new Error(response.error ?? 'Unknown error while connecting');
            }
            return new PiConnection(id, bridge, response.serverInfo);
        }
        catch (error) {
            releaseBridge();
            throw error;
        }
    }
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
    async read(startTime, endTime, points) {
        if (this.closed) {
            throw new Error('Connection is closed');
        }
        const response = await this.bridge.send({ command: 'read', id: this.id, startTime, endTime, points });
        if (response.error) {
            throw new Error(response.error);
        }
        return response.values ?? [];
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
exports.PiConnection = PiConnection;
