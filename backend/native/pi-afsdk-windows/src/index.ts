import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import path from 'node:path';
import crypto from 'node:crypto';

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

const ARCH_FOLDERS: Partial<Record<NodeJS.Architecture, string>> = {
  x64: 'win-x64',
  ia32: 'win-x86',
  arm64: 'win-arm64'
};

/**
 * Resolves the bundled OIBusPiAfSdkWindows helper binary for the current architecture.
 * Overridable via OIBUS_PI_AFSDK_WINDOWS_BINARY (used by this package's own tests, and by anyone
 * running a custom build during development).
 */
export function resolvePiBinaryPath(): string {
  const override = process.env.OIBUS_PI_AFSDK_WINDOWS_BINARY;
  if (override) {
    return override;
  }
  const archFolder = ARCH_FOLDERS[process.arch];
  if (!archFolder) {
    throw new Error(`Unsupported architecture for the PI AF SDK Windows helper: ${process.arch}`);
  }
  return path.join(__dirname, '..', 'runtimes', archFolder, 'OIBusPiAfSdkWindows.exe');
}

interface PendingRequest {
  resolve: (response: PiResponse) => void;
  reject: (error: Error) => void;
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
export class PiBridge {
  private child: ChildProcessWithoutNullStreams | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private nextRequestId = 1;
  private startupError: Error | null = null;

  constructor(
    private readonly binaryPath: string = resolvePiBinaryPath(),
    private readonly spawnFn: typeof spawn = spawn
  ) {}

  get isRunning(): boolean {
    return this.child !== null;
  }

  send(command: Record<string, unknown>): Promise<PiResponse> {
    this.ensureStarted();
    if (this.startupError) {
      return Promise.reject(this.startupError);
    }
    const child = this.child!;
    const requestId = String(this.nextRequestId++);
    return new Promise<PiResponse>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      child.stdin.write(`${JSON.stringify({ ...command, requestId })}\n`);
    });
  }

  stop(): void {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
    this.failAll(new Error('PI AF SDK helper process was stopped'));
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
      this.failAll(new Error(`PI AF SDK helper exited unexpectedly (code ${code}, signal ${signal})`));
    });
  }

  private handleLine(line: string): void {
    let response: PiResponse;
    try {
      response = JSON.parse(line) as PiResponse;
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

let sharedBridge: PiBridge | null = null;
let refCount = 0;
let bridgeFactory: () => PiBridge = () => new PiBridge();

function acquireBridge(): PiBridge {
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
 * Test-only seam: swaps the factory used to create the shared bridge singleton (so tests can inject a
 * fake spawn without touching the real one) and resets reference counting. Not part of the package's
 * public surface for consumers — used only by this package's own spec.
 */
export function __resetSharedBridgeForTesting(factory?: () => PiBridge): void {
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
export class PiConnection {
  private closed = false;

  private constructor(
    private readonly id: string,
    private readonly bridge: PiBridge,
    readonly serverInfo: PiServerInfo
  ) {}

  static async connect(): Promise<PiConnection> {
    if (process.platform !== 'win32') {
      throw new Error('PI requires Windows (the OSIsoft AF SDK is Windows-only)');
    }
    const bridge = acquireBridge();
    const id = crypto.randomUUID();
    try {
      const response = await bridge.send({ command: 'connect', id });
      if (!response.ok) {
        throw new Error(response.error ?? 'Unknown error while connecting');
      }
      return new PiConnection(id, bridge, response.serverInfo!);
    } catch (error) {
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
  async read(startTime: string, endTime: string, points: Array<string>): Promise<Array<PiRawValue>> {
    if (this.closed) {
      throw new Error('Connection is closed');
    }
    const response = await this.bridge.send({ command: 'read', id: this.id, startTime, endTime, points });
    if (response.error) {
      throw new Error(response.error);
    }
    return response.values ?? [];
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
