import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { OleDbBridge, OleDbConnection, __resetSharedBridgeForTesting, resolveOleDbBinaryPath } from './index';

/** A fake child process good enough to drive readline + event listeners the same way a real one would. */
class FakeChildProcess extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  stdin = { write: mock.fn((_chunk: string) => true) };
  kill = mock.fn(() => true);

  respond(response: unknown): void {
    this.stdout.write(`${JSON.stringify(response)}\n`);
  }

  lastRequest(): Record<string, unknown> {
    const calls = this.stdin.write.mock.calls;
    return JSON.parse((calls[calls.length - 1].arguments[0] as string).trim());
  }
}

const originalPlatform = process.platform;
function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform });
}

describe('OleDbBridge', () => {
  let lastChild: FakeChildProcess;
  const spawnMock = mock.fn((_binary: string, _args: Array<string>, _options: unknown) => {
    lastChild = new FakeChildProcess();
    return lastChild as unknown as ReturnType<typeof spawnMock>;
  });

  beforeEach(() => {
    spawnMock.mock.resetCalls();
  });

  describe('resolveOleDbBinaryPath', () => {
    afterEach(() => {
      delete process.env.OIBUS_OLEDB_WINDOWS_BINARY;
    });

    it('returns the OIBUS_OLEDB_WINDOWS_BINARY override when set', () => {
      process.env.OIBUS_OLEDB_WINDOWS_BINARY = 'C:\\custom\\OIBusOleDbWindows.exe';
      assert.strictEqual(resolveOleDbBinaryPath(), 'C:\\custom\\OIBusOleDbWindows.exe');
    });

    it('throws for an unsupported architecture', () => {
      const originalArch = process.arch;
      Object.defineProperty(process, 'arch', { value: 'mips' });
      try {
        assert.throws(() => resolveOleDbBinaryPath(), /Unsupported architecture/);
      } finally {
        Object.defineProperty(process, 'arch', { value: originalArch });
      }
    });
  });

  it('spawns the helper lazily on the first send() call', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bridge = new OleDbBridge('binary.exe', spawnMock as any);
    assert.strictEqual(spawnMock.mock.calls.length, 0);
    void bridge.send({ command: 'connect', id: 'a' });
    assert.strictEqual(spawnMock.mock.calls.length, 1);
  });

  it('tags every outgoing command with a distinct requestId and resolves by matching it back', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bridge = new OleDbBridge('binary.exe', spawnMock as any);
    const first = bridge.send({ command: 'read', id: 'a', sql: 'SELECT 1' });
    const second = bridge.send({ command: 'read', id: 'b', sql: 'SELECT 2' });

    const req1 = JSON.parse((lastChild.stdin.write.mock.calls[0].arguments[0] as string).trim());
    const req2 = JSON.parse((lastChild.stdin.write.mock.calls[1].arguments[0] as string).trim());
    assert.notStrictEqual(req1.requestId, req2.requestId);

    // Answer out of order — the second request's response arrives first.
    lastChild.respond({ requestId: req2.requestId, ok: true, rows: [{ v: 2 }] });
    lastChild.respond({ requestId: req1.requestId, ok: true, rows: [{ v: 1 }] });

    assert.deepStrictEqual(await second, { requestId: req2.requestId, ok: true, rows: [{ v: 2 }] });
    assert.deepStrictEqual(await first, { requestId: req1.requestId, ok: true, rows: [{ v: 1 }] });
  });

  it('ignores a response line with no matching pending request', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bridge = new OleDbBridge('binary.exe', spawnMock as any);
    const pending = bridge.send({ command: 'connect', id: 'a' });
    lastChild.respond({ requestId: 'not-a-real-id', ok: true });
    lastChild.respond({ requestId: JSON.parse((lastChild.stdin.write.mock.calls[0].arguments[0] as string).trim()).requestId, ok: true });
    await pending; // must resolve despite the earlier unmatched line
  });

  it('fails every pending request when the process exits unexpectedly', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bridge = new OleDbBridge('binary.exe', spawnMock as any);
    const pending = bridge.send({ command: 'read', id: 'a', sql: 'SELECT 1' });
    lastChild.emit('exit', 1, null);
    await assert.rejects(pending, { message: /exited unexpectedly/ });
    assert.strictEqual(bridge.isRunning, false);
  });

  it('fails a send() issued while spawning failed', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bridge = new OleDbBridge('binary.exe', spawnMock as any);
    const pending = bridge.send({ command: 'connect', id: 'a' });
    lastChild.emit('error', new Error('spawn ENOENT'));
    await assert.rejects(pending, { message: 'spawn ENOENT' });
  });

  it('stop() kills the process and rejects anything still pending', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bridge = new OleDbBridge('binary.exe', spawnMock as any);
    const pending = bridge.send({ command: 'read', id: 'a', sql: 'SELECT 1' });
    bridge.stop();
    await assert.rejects(pending, { message: 'OLE DB helper process was stopped' });
    assert.strictEqual(lastChild.kill.mock.calls.length, 1);
  });
});

describe('OleDbConnection', () => {
  let lastChild: FakeChildProcess;
  const spawnMock = mock.fn((_binary: string, _args: Array<string>, _options: unknown) => {
    lastChild = new FakeChildProcess();
    return lastChild as unknown as ReturnType<typeof spawnMock>;
  });

  beforeEach(() => {
    spawnMock.mock.resetCalls();
    setPlatform('win32');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __resetSharedBridgeForTesting(() => new OleDbBridge('binary.exe', spawnMock as any));
  });

  afterEach(() => {
    setPlatform(originalPlatform);
  });

  it('rejects immediately on a non-Windows platform without touching the shared bridge', async () => {
    setPlatform('linux');
    await assert.rejects(OleDbConnection.connect('conn'), { message: /Windows/ });
    assert.strictEqual(spawnMock.mock.calls.length, 0);
  });

  it('shares one process across two concurrent connections and answers both independently', async () => {
    const firstConnectPromise = OleDbConnection.connect('Provider=A;');
    lastChild.respond({ ...lastChild.lastRequest(), ok: true });
    const first = await firstConnectPromise;

    const secondConnectPromise = OleDbConnection.connect('Provider=B;');
    lastChild.respond({ ...lastChild.lastRequest(), ok: true });
    const second = await secondConnectPromise;

    assert.strictEqual(spawnMock.mock.calls.length, 1, 'only one helper process for both connections');

    // Two overlapping reads, on two different logical connections, in flight at once.
    const readA = first.read('SELECT a');
    const readB = second.read('SELECT b');
    const reqA = JSON.parse((lastChild.stdin.write.mock.calls[2].arguments[0] as string).trim());
    const reqB = JSON.parse((lastChild.stdin.write.mock.calls[3].arguments[0] as string).trim());
    assert.notStrictEqual(reqA.id, reqB.id, 'each connection keeps its own id');

    // Answer B first, then A — order must not matter.
    lastChild.respond({ requestId: reqB.requestId, ok: true, rows: [{ v: 'b' }] });
    lastChild.respond({ requestId: reqA.requestId, ok: true, rows: [{ v: 'a' }] });
    assert.deepStrictEqual(await readB, [{ v: 'b' }]);
    assert.deepStrictEqual(await readA, [{ v: 'a' }]);
  });

  it('keeps the shared process alive until the last connection disconnects', async () => {
    const firstPromise = OleDbConnection.connect('Provider=A;');
    lastChild.respond({ ...lastChild.lastRequest(), ok: true });
    const first = await firstPromise;

    const secondPromise = OleDbConnection.connect('Provider=B;');
    lastChild.respond({ ...lastChild.lastRequest(), ok: true });
    const second = await secondPromise;

    const firstDisconnect = first.disconnect();
    lastChild.respond({ ...lastChild.lastRequest(), ok: true });
    await firstDisconnect;
    assert.strictEqual(lastChild.kill.mock.calls.length, 0, 'still one connection using the shared process');

    const secondDisconnect = second.disconnect();
    lastChild.respond({ ...lastChild.lastRequest(), ok: true });
    await secondDisconnect;
    assert.strictEqual(lastChild.kill.mock.calls.length, 1, 'process stopped once the last connection left');
  });

  it('respawns a fresh process for the next connection after the shared one was stopped', async () => {
    const firstPromise = OleDbConnection.connect('Provider=A;');
    lastChild.respond({ ...lastChild.lastRequest(), ok: true });
    const first = await firstPromise;
    const disconnectPromise = first.disconnect();
    lastChild.respond({ ...lastChild.lastRequest(), ok: true });
    await disconnectPromise;

    const secondPromise = OleDbConnection.connect('Provider=A;');
    lastChild.respond({ ...lastChild.lastRequest(), ok: true });
    await secondPromise;

    assert.strictEqual(spawnMock.mock.calls.length, 2);
  });

  it('releases the shared process reference when connect() itself fails', async () => {
    const failingPromise = OleDbConnection.connect('Provider=Bad;');
    lastChild.respond({ ...lastChild.lastRequest(), ok: false, error: 'provider not registered' });
    await assert.rejects(failingPromise, { message: 'provider not registered' });
    assert.strictEqual(lastChild.kill.mock.calls.length, 1, 'nothing else was using the process, so it is torn down');

    const nextPromise = OleDbConnection.connect('Provider=Good;');
    lastChild.respond({ ...lastChild.lastRequest(), ok: true });
    await nextPromise;
    assert.strictEqual(spawnMock.mock.calls.length, 2, 'a fresh process is spawned for the next attempt');
  });

  it('read() rejects when the helper reports a query failure', async () => {
    const connectPromise = OleDbConnection.connect('Provider=A;');
    lastChild.respond({ ...lastChild.lastRequest(), ok: true });
    const connection = await connectPromise;

    const readPromise = connection.read('BAD SQL');
    lastChild.respond({ ...lastChild.lastRequest(), ok: false, error: 'syntax error' });
    await assert.rejects(readPromise, { message: 'syntax error' });
  });

  it('read() rejects once the connection is closed', async () => {
    const connectPromise = OleDbConnection.connect('Provider=A;');
    lastChild.respond({ ...lastChild.lastRequest(), ok: true });
    const connection = await connectPromise;
    const disconnectPromise = connection.disconnect();
    lastChild.respond({ ...lastChild.lastRequest(), ok: true });
    await disconnectPromise;

    await assert.rejects(connection.read('SELECT 1'), { message: 'Connection is closed' });
  });

  it('disconnect() is idempotent', async () => {
    const connectPromise = OleDbConnection.connect('Provider=A;');
    lastChild.respond({ ...lastChild.lastRequest(), ok: true });
    const connection = await connectPromise;
    const first = connection.disconnect();
    lastChild.respond({ ...lastChild.lastRequest(), ok: true });
    await first;

    await assert.doesNotReject(connection.disconnect());
    assert.strictEqual(lastChild.kill.mock.calls.length, 1);
  });
});
