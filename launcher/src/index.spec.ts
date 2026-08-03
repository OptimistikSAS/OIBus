import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

import { mockModule, reloadModule } from './tests/utils/test-utils';

const nodeRequire = createRequire(import.meta.url);

// Captured per-test so each reload of ./index picks up the current test's mock behaviour
let launcherConstructorArgs: Array<unknown> | null = null;
let launcherStartMock: ReturnType<typeof mock.fn>;
let launcherStopMock: ReturnType<typeof mock.fn>;
let userRepositoryConstructorArg: string | null = null;
let resetAdminMock: ReturnType<typeof mock.fn>;

function setupMocks() {
  launcherConstructorArgs = null;
  launcherStartMock = mock.fn();
  launcherStopMock = mock.fn();
  mockModule(nodeRequire, './launcher', {
    __esModule: true,
    default: class FakeLauncher {
      constructor(...args: Array<unknown>) {
        launcherConstructorArgs = args;
      }
      start = launcherStartMock;
      stop = launcherStopMock;
    }
  });

  userRepositoryConstructorArg = null;
  resetAdminMock = mock.fn(() => Promise.resolve());
  mockModule(nodeRequire, './user.repository', {
    __esModule: true,
    default: class FakeUserRepository {
      constructor(databasePath: string) {
        userRepositoryConstructorArg = databasePath;
      }
      resetAdmin = resetAdminMock;
    }
  });
}

const load = async () => {
  reloadModule(nodeRequire, './index');
  // main() is async and started with `void main()` — give its microtasks a chance to settle.
  await new Promise(resolve => setImmediate(resolve));
};

describe('launcher index (main)', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    setupMocks();
    mock.method(console, 'info', () => undefined);
    mock.method(console, 'error', () => undefined);
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = undefined;
    process.removeAllListeners('SIGINT');
    mock.restoreAll();
  });

  it('constructs a Launcher with the resolved config and starts it', async () => {
    process.argv = ['node', 'index.js', '--config', './my-data'];

    await load();

    assert.ok(launcherConstructorArgs !== null, 'Launcher should have been constructed');
    const [workDir, updateDir, backupDir, config, version] = launcherConstructorArgs!;
    assert.strictEqual(workDir, path.resolve(process.cwd(), 'binaries'));
    assert.strictEqual(updateDir, path.resolve(process.cwd(), 'update'));
    assert.strictEqual(backupDir, path.resolve(process.cwd(), 'backup'));
    assert.strictEqual(config, path.resolve('./my-data'));
    assert.strictEqual(version, false);
    assert.strictEqual(launcherStartMock.mock.calls.length, 1);
    assert.strictEqual(userRepositoryConstructorArg, null, 'UserRepository should not be used outside --reset-password');
  });

  it('defaults the config directory to "./" when --config is not given', async () => {
    process.argv = ['node', 'index.js'];

    await load();

    const config = (launcherConstructorArgs as Array<unknown>)[3];
    assert.strictEqual(config, path.resolve('./'));
  });

  it('resets the admin user and does not start the Launcher when --reset-password is given', async () => {
    process.argv = ['node', 'index.js', '--config', './my-data', '--reset-password=true'];

    await load();

    assert.strictEqual(userRepositoryConstructorArg, path.resolve('./my-data', 'oibus.db'));
    assert.strictEqual(resetAdminMock.mock.calls.length, 1);
    assert.strictEqual(launcherConstructorArgs, null, 'Launcher should not be constructed during a password reset');

    const infoCall = (console.info as unknown as ReturnType<typeof mock.fn>).mock.calls.find(call =>
      (call.arguments[0] as string).includes('Admin user reset to default credentials.')
    );
    assert.ok(infoCall, 'should log the success message');
  });

  it('logs an error and sets exitCode=1 when resetAdmin fails', async () => {
    resetAdminMock.mock.mockImplementation(() => Promise.reject(new Error('db is locked')));
    process.argv = ['node', 'index.js', '--reset-password=true'];

    await load();

    const errorCall = (console.error as unknown as ReturnType<typeof mock.fn>).mock.calls.find(call =>
      (call.arguments[0] as string).includes('Failed to reset admin user: db is locked')
    );
    assert.ok(errorCall, 'should log the failure message');
    assert.strictEqual(process.exitCode, 1);
  });

  it('stops the launcher on SIGINT, and ignores a second SIGINT while already stopping', async () => {
    process.argv = ['node', 'index.js'];

    await load();

    process.emit('SIGINT');
    process.emit('SIGINT');

    assert.strictEqual(launcherStopMock.mock.calls.length, 1);
    const infoCalls = (console.info as unknown as ReturnType<typeof mock.fn>).mock.calls.filter(call =>
      (call.arguments[0] as string).includes('SIGINT (Ctrl+C) received. Stopping everything.')
    );
    assert.strictEqual(infoCalls.length, 1);
  });
});
