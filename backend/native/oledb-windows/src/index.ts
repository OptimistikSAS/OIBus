import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import path from 'node:path';
import crypto from 'node:crypto';

export type OleDbValue = string | number | boolean | null;
export type OleDbRow = Record<string, OleDbValue>;

interface OleDbResponse {
  requestId?: string;
  ok: boolean;
  error?: string;
  rows?: Array<OleDbRow>;
}

const ARCH_FOLDERS: Partial<Record<NodeJS.Architecture, string>> = {
  x64: 'win-x64',
  ia32: 'win-x86',
  arm64: 'win-arm64'
};

/**
 * Resolves the bundled OIBusOleDbWindows helper binary for the current architecture.
 * Overridable via OIBUS_OLEDB_WINDOWS_BINARY (used by this package's own tests, and by anyone
 * running a custom build during development).
 */
export function resolveOleDbBinaryPath(): string {
  const override = process.env.OIBUS_OLEDB_WINDOWS_BINARY;
  if (override) {
    return override;
  }
  const archFolder = ARCH_FOLDERS[process.arch];
  if (!archFolder) {
    throw new Error(`Unsupported architecture for the OLE DB Windows helper: ${process.arch}`);
  }
  return path.join(__dirname, '..', 'runtimes', archFolder, 'OIBusOleDbWindows.exe');
}

interface PendingRequest {
  resolve: (response: OleDbResponse) => void;
  reject: (error: Error) => void;
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
export class OleDbBridge {
  private child: ChildProcessWithoutNullStreams | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private nextRequestId = 1;
  private startupError: Error | null = null;

  constructor(
    private readonly binaryPath: string = resolveOleDbBinaryPath(),
    private readonly spawnFn: typeof spawn = spawn
  ) {}

  get isRunning(): boolean {
    return this.child !== null;
  }

  send(command: Record<string, unknown>): Promise<OleDbResponse> {
    this.ensureStarted();
    if (this.startupError) {
      return Promise.reject(this.startupError);
    }
    const child = this.child!;
    const requestId = String(this.nextRequestId++);
    return new Promise<OleDbResponse>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      child.stdin.write(`${JSON.stringify({ ...command, requestId })}\n`);
    });
  }

  stop(): void {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
    this.failAll(new Error('OLE DB helper process was stopped'));
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
      this.failAll(new Error(`OLE DB helper exited unexpectedly (code ${code}, signal ${signal})`));
    });
  }

  private handleLine(line: string): void {
    let response: OleDbResponse;
    try {
      response = JSON.parse(line) as OleDbResponse;
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

let sharedBridge: OleDbBridge | null = null;
let refCount = 0;
let bridgeFactory: () => OleDbBridge = () => new OleDbBridge();

function acquireBridge(): OleDbBridge {
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
export function __resetSharedBridgeForTesting(factory?: () => OleDbBridge): void {
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
export class OleDbConnection {
  private closed = false;

  private constructor(
    private readonly id: string,
    private readonly bridge: OleDbBridge
  ) {}

  static async connect(connectionString: string): Promise<OleDbConnection> {
    if (process.platform !== 'win32') {
      throw new Error('OLE DB requires Windows (System.Data.OleDb is Windows-only)');
    }
    const bridge = acquireBridge();
    const id = crypto.randomUUID();
    try {
      const response = await bridge.send({ command: 'connect', id, connectionString });
      if (!response.ok) {
        throw new Error(response.error ?? 'Unknown error while connecting');
      }
      return new OleDbConnection(id, bridge);
    } catch (error) {
      releaseBridge();
      throw error;
    }
  }

  async read(sql: string, readTimeout?: number): Promise<Array<OleDbRow>> {
    if (this.closed) {
      throw new Error('Connection is closed');
    }
    const response = await this.bridge.send({ command: 'read', id: this.id, sql, readTimeout });
    if (!response.ok) {
      throw new Error(response.error ?? 'Unknown error while querying');
    }
    return response.rows!;
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
