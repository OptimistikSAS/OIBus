import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import path from 'node:path';
import crypto from 'node:crypto';

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

const ARCH_FOLDERS: Partial<Record<NodeJS.Architecture, string>> = {
  x64: 'win-x64',
  ia32: 'win-x86',
  arm64: 'win-arm64'
};

/**
 * Resolves the bundled OIBusOpcClassicWindows helper binary for the current architecture.
 * Overridable via OIBUS_OPC_CLASSIC_WINDOWS_BINARY (used by this package's own tests, and by anyone
 * running a custom build during development).
 */
export function resolveOpcBinaryPath(): string {
  const override = process.env.OIBUS_OPC_CLASSIC_WINDOWS_BINARY;
  if (override) {
    return override;
  }
  const archFolder = ARCH_FOLDERS[process.arch];
  if (!archFolder) {
    throw new Error(`Unsupported architecture for the OPC Classic Windows helper: ${process.arch}`);
  }
  return path.join(__dirname, '..', 'runtimes', archFolder, 'OIBusOpcClassicWindows.exe');
}

interface PendingRequest {
  resolve: (response: OpcResponse) => void;
  reject: (error: Error) => void;
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
export class OpcBridge {
  private child: ChildProcessWithoutNullStreams | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private nextRequestId = 1;
  private startupError: Error | null = null;

  constructor(
    private readonly binaryPath: string = resolveOpcBinaryPath(),
    private readonly spawnFn: typeof spawn = spawn
  ) {}

  get isRunning(): boolean {
    return this.child !== null;
  }

  send(command: Record<string, unknown>): Promise<OpcResponse> {
    this.ensureStarted();
    if (this.startupError) {
      return Promise.reject(this.startupError);
    }
    const child = this.child!;
    const requestId = String(this.nextRequestId++);
    return new Promise<OpcResponse>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      child.stdin.write(`${JSON.stringify({ ...command, requestId })}\n`);
    });
  }

  stop(): void {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
    this.failAll(new Error('OPC Classic helper process was stopped'));
  }

  private ensureStarted(): void {
    if (this.child) {
      return;
    }
    this.startupError = null;
    const child = this.spawnFn(this.binaryPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.child = child;

    createInterface({ input: child.stdout }).on('line', line => this.handleLine(line));
    child.on('error', error => {
      this.startupError = error;
      this.failAll(error);
    });
    child.on('exit', (code, signal) => {
      this.child = null;
      this.failAll(new Error(`OPC Classic helper exited unexpectedly (code ${code}, signal ${signal})`));
    });
  }

  private handleLine(line: string): void {
    let response: OpcResponse;
    try {
      response = JSON.parse(line) as OpcResponse;
    } catch {
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

  private failAll(error: Error): void {
    const pending = Array.from(this.pending.values());
    this.pending.clear();
    for (const request of pending) {
      request.reject(error);
    }
  }
}

let sharedBridge: OpcBridge | null = null;
let refCount = 0;
let bridgeFactory: () => OpcBridge = () => new OpcBridge();

function acquireBridge(): OpcBridge {
  if (!sharedBridge) {
    sharedBridge = bridgeFactory();
  }
  refCount++;
  return sharedBridge;
}

function releaseBridge(): void {
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
export function __resetSharedBridgeForTesting(factory?: () => OpcBridge): void {
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
export class OpcConnection {
  private closed = false;

  private constructor(
    private readonly id: string,
    private readonly bridge: OpcBridge,
    readonly serverInfo: OpcServerInfo
  ) {}

  static async connect(host: string, serverName: string, mode: OpcMode): Promise<OpcConnection> {
    if (process.platform !== 'win32') {
      throw new Error('OPC Classic requires Windows (DCOM interop is Windows-only)');
    }
    const bridge = acquireBridge();
    const id = crypto.randomUUID();
    try {
      const response = await bridge.send({ command: 'connect', id, host, serverName, mode });
      if (!response.ok) {
        throw new Error(response.error ?? 'Unknown error while connecting');
      }
      return new OpcConnection(id, bridge, response.serverInfo!);
    } catch (error) {
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
  async read(startTime: string, endTime: string, nodeIds: Array<string>, options?: OpcHdaReadOptions): Promise<Array<OpcRawValue>> {
    if (this.closed) {
      throw new Error('Connection is closed');
    }
    const response = await this.bridge.send({ command: 'read', id: this.id, startTime, endTime, items: nodeIds, ...options });
    if (response.error) {
      throw new Error(response.error);
    }
    return response.values ?? [];
  }

  async browse(nodeId: string, recursive: boolean): Promise<Array<OpcNode>> {
    if (this.closed) {
      throw new Error('Connection is closed');
    }
    const response = await this.bridge.send({ command: 'browse', id: this.id, nodeId, recursive });
    if (response.error) {
      throw new Error(response.error);
    }
    return response.nodes ?? [];
  }

  async disconnect(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    try {
      await this.bridge.send({ command: 'disconnect', id: this.id });
    } catch {
      // Best-effort: the helper may already be gone (crash, prior stop). Either way this
      // connection's slot on the shared bridge is released below regardless.
    } finally {
      releaseBridge();
    }
  }
}
