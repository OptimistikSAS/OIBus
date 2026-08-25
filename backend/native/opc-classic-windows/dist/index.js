"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpcConnection = exports.OpcBridge = void 0;
exports.resolveOpcBinaryPath = resolveOpcBinaryPath;
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
 * Resolves the bundled OIBusOpcClassicWindows helper binary for the current architecture.
 * Overridable via OIBUS_OPC_CLASSIC_WINDOWS_BINARY (used by this package's own tests, and by anyone
 * running a custom build during development).
 */
function resolveOpcBinaryPath() {
    const override = process.env.OIBUS_OPC_CLASSIC_WINDOWS_BINARY;
    if (override) {
        return override;
    }
    const archFolder = ARCH_FOLDERS[process.arch];
    if (!archFolder) {
        throw new Error(`Unsupported architecture for the OPC Classic Windows helper: ${process.arch}`);
    }
    return node_path_1.default.join(__dirname, '..', 'runtimes', archFolder, 'OIBusOpcClassicWindows.exe');
}
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
class OpcBridge {
    binaryPath;
    spawnFn;
    child = null;
    pending = new Map();
    nextRequestId = 1;
    startupError = null;
    constructor(binaryPath = resolveOpcBinaryPath(), spawnFn = node_child_process_1.spawn) {
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
        this.failAll(new Error('OPC Classic helper process was stopped'));
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
            this.failAll(new Error(`OPC Classic helper exited unexpectedly (code ${code}, signal ${signal})`));
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
exports.OpcBridge = OpcBridge;
let sharedBridge = null;
let refCount = 0;
let bridgeFactory = () => new OpcBridge();
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
 * Test-only seam: swaps the factory used to create the shared bridge singleton (so tests can inject
 * a fake spawn without touching the real one) and resets reference counting. Not part of the
 * package's public surface for consumers — used only by this package's own spec.
 */
function __resetSharedBridgeForTesting(factory) {
    if (sharedBridge) {
        sharedBridge.stop();
    }
    sharedBridge = null;
    refCount = 0;
    bridgeFactory = factory ?? (() => new OpcBridge());
}
/**
 * One logical OPC Classic connection (DA or HDA). Any number of `OpcConnection`s — from the same or
 * different OIBus south connectors, against the same or different OPC servers — share a single
 * OIBusOpcClassicWindows child process under the hood, spawned lazily on the first `connect()` call
 * and torn down once the last connection using it calls `disconnect()`. Each connection gets its own
 * real `Opc.Server` on the .NET side, so reads/browses on different connections run fully
 * independently even against different servers.
 */
class OpcConnection {
    id;
    bridge;
    serverInfo;
    closed = false;
    constructor(id, bridge, serverInfo) {
        this.id = id;
        this.bridge = bridge;
        this.serverInfo = serverInfo;
    }
    static async connect(host, serverName, mode) {
        if (process.platform !== 'win32') {
            throw new Error('OPC Classic requires Windows (DCOM interop is Windows-only)');
        }
        const bridge = acquireBridge();
        const id = node_crypto_1.default.randomUUID();
        try {
            const response = await bridge.send({ command: 'connect', id, host, serverName, mode });
            if (!response.ok) {
                throw new Error(response.error ?? 'Unknown error while connecting');
            }
            return new OpcConnection(id, bridge, response.serverInfo);
        }
        catch (error) {
            releaseBridge();
            throw error;
        }
    }
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
    async read(startTime, endTime, nodeIds, options) {
        if (this.closed) {
            throw new Error('Connection is closed');
        }
        const response = await this.bridge.send({ command: 'read', id: this.id, startTime, endTime, items: nodeIds, ...options });
        if (response.error) {
            throw new Error(response.error);
        }
        return response.values ?? [];
    }
    async browse(nodeId, recursive) {
        if (this.closed) {
            throw new Error('Connection is closed');
        }
        const response = await this.bridge.send({ command: 'browse', id: this.id, nodeId, recursive });
        if (response.error) {
            throw new Error(response.error);
        }
        return response.nodes ?? [];
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
exports.OpcConnection = OpcConnection;
