import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Launcher from './launcher';

type MockFn = ReturnType<typeof mock.fn>;

// A minimal ChildProcess stand-in that extends EventEmitter (gives proper `on` return type)
// and provides all non-EventEmitter required fields of ChildProcessWithoutNullStreams.
class MockChildProcess extends EventEmitter {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  stdio: ChildProcessWithoutNullStreams['stdio'];
  killed = false;
  pid: number | undefined = undefined;
  connected = false;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  spawnargs: Array<string> = [];
  spawnfile = '';
  readonly killMock: MockFn = mock.fn(() => true);

  constructor() {
    super();
    this.stdio = [this.stdin, this.stdout, this.stderr, undefined, undefined];
  }

  kill(signal?: NodeJS.Signals | number): boolean {
    this.killMock(signal);
    return true;
  }

  send(): boolean {
    return false;
  }

  disconnect(): void {
    // noop
  }

  unref(): void {
    // noop
  }

  ref(): void {
    // noop
  }
}

const createdDirectories: Array<string> = [];

const createTempDir = (): string => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-test-'));
  createdDirectories.push(tempDir);
  return tempDir;
};

afterEach(() => {
  while (createdDirectories.length > 0) {
    const directory = createdDirectories.pop();
    if (directory) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
  mock.reset();
});

describe('Launcher', () => {
  let workDir: string;
  let updateDir: string;
  let backupDir: string;
  let configDir: string;

  const launcherInstances: Array<Launcher> = [];

  const createAndTrackLauncher = (
    wd: string,
    ud: string,
    bd: string,
    cd: string,
    version: boolean,
    processArgs: Array<string>
  ): Launcher => {
    const launcher = new Launcher(wd, ud, bd, cd, version, processArgs);
    launcherInstances.push(launcher);
    return launcher;
  };

  beforeEach(() => {
    workDir = createTempDir();
    updateDir = createTempDir();
    backupDir = createTempDir();
    configDir = createTempDir();
    mock.timers.enable();
  });

  afterEach(() => {
    launcherInstances.forEach(launcher => {
      launcher.stop();
    });
    launcherInstances.length = 0;
    mock.timers.reset();
  });

  describe('constructor', () => {
    it('initializes with provided directories', () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, ['node', 'script.js', '--config', './data']);

      assert.ok(launcher instanceof Launcher);
    });

    it('passes the absolute config path to spawn when starting', async () => {
      mock.method(os, 'type', () => 'Linux');
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, ['node', 'script.js', '--config', './data']);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      const spawnMock = mock.method(cp, 'spawn', () => new MockChildProcess());

      await launcher.start();
      launcher.stop();

      assert.ok(spawnMock.mock.calls.length > 0);
      const spawnArgs = spawnMock.mock.calls[0].arguments[1] as Array<string>;
      assert.ok(spawnArgs.includes(configDir));
      assert.ok(spawnArgs.includes('--launcherVersion'));
    });
  });

  describe('getOibusExecutable', () => {
    it('returns oibus.exe on Windows', () => {
      mock.method(os, 'type', () => 'Windows_NT');

      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const executable = launcher.getOibusExecutable();

      assert.strictEqual(executable, 'oibus.exe');
    });

    it('returns oibus on non-Windows', () => {
      mock.method(os, 'type', () => 'Linux');

      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const executable = launcher.getOibusExecutable();

      assert.strictEqual(executable, 'oibus');
    });
  });

  describe('getOibusLauncherExecutable', () => {
    it('returns oibus-launcher_backup.exe on Windows', () => {
      mock.method(os, 'type', () => 'Windows_NT');

      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const executable = launcher.getOibusLauncherExecutable();

      assert.strictEqual(executable, 'oibus-launcher_backup.exe');
    });

    it('returns oibus-launcher_backup on non-Windows', () => {
      mock.method(os, 'type', () => 'Linux');

      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const executable = launcher.getOibusLauncherExecutable();

      assert.strictEqual(executable, 'oibus-launcher_backup');
    });
  });

  describe('getOibusPath', () => {
    it('returns resolved path to oibus executable in workDir', () => {
      mock.method(os, 'type', () => 'Linux');
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = launcher.getOibusPath();

      assert.strictEqual(oibusPath, path.resolve(workDir, 'oibus'));
    });
  });

  describe('getOibusUpdatePath', () => {
    it('returns resolved path to oibus executable in updateDir/binaries', () => {
      mock.method(os, 'type', () => 'Linux');
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const updatePath = launcher.getOibusUpdatePath();

      assert.strictEqual(updatePath, path.resolve(updateDir, 'binaries', 'oibus'));
    });
  });

  describe('getOibusBackupPath', () => {
    it('returns resolved path to oibus executable in backupDir', () => {
      mock.method(os, 'type', () => 'Linux');
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const backupPath = launcher.getOibusBackupPath();

      assert.strictEqual(backupPath, path.resolve(backupDir, 'oibus'));
    });
  });

  describe('getOibusLauncherBackupPath', () => {
    it('returns resolved path to launcher backup in current working directory', () => {
      mock.method(os, 'type', () => 'Linux');
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const launcherBackupPath = launcher.getOibusLauncherBackupPath();

      assert.strictEqual(launcherBackupPath, path.resolve(process.cwd(), 'oibus-launcher_backup'));
    });
  });

  describe('checkForUpdate', () => {
    beforeEach(() => {
      mock.method(os, 'type', () => 'Linux');
    });

    it('returns true when update file exists', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const updateBinaryPath = path.resolve(updateDir, 'binaries', 'oibus');
      fs.mkdirSync(path.dirname(updateBinaryPath), { recursive: true });
      fs.writeFileSync(updateBinaryPath, 'binary content');

      const hasUpdate = await launcher.checkForUpdate();

      assert.strictEqual(hasUpdate, true);
    });

    it('returns false when update file does not exist', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);

      const hasUpdate = await launcher.checkForUpdate();

      assert.strictEqual(hasUpdate, false);
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      mock.method(os, 'type', () => 'Linux');
    });

    it('kills child process when it exists', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');
      const mockChild = new MockChildProcess();
      mock.method(cp, 'spawn', () => mockChild);

      await launcher.start();
      launcher.stop();
      launcher.stop();

      assert.ok(mockChild.killMock.mock.calls.length > 0);
      assert.deepStrictEqual(mockChild.killMock.mock.calls[0].arguments, ['SIGINT']);
    });

    it('handles stop when no child exists', () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      assert.doesNotThrow(() => launcher.stop());
    });
  });

  describe('start', () => {
    beforeEach(() => {
      mock.method(os, 'type', () => 'Linux');
    });

    it('starts OIBus without update when no update exists', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      const mockChild = new MockChildProcess();
      const spawnMock = mock.method(cp, 'spawn', () => mockChild);

      await launcher.start();
      launcher.stop();

      assert.ok(spawnMock.mock.calls.length > 0);
      assert.strictEqual(spawnMock.mock.calls[0].arguments[0], oibusPath);
      assert.deepStrictEqual(spawnMock.mock.calls[0].arguments[2], { cwd: workDir });
      assert.ok(mockChild.stdout.listenerCount('data') > 0);
      assert.ok(mockChild.stderr.listenerCount('data') > 0);
      assert.ok(mockChild.listenerCount('close') > 0);
      assert.ok(mockChild.listenerCount('error') > 0);
    });

    it('handles stdout data events', async () => {
      const consoleInfoMock = mock.method(console, 'info', () => undefined);
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      const mockChild = new MockChildProcess();
      mock.method(cp, 'spawn', () => mockChild);

      await launcher.start();
      launcher.stop();

      mockChild.stdout.write(Buffer.from('test stdout output'));

      assert.ok(consoleInfoMock.mock.calls.some(c => c.arguments[0] === 'OIBus stdout: test stdout output'));
    });

    it('handles stderr data events', async () => {
      const consoleErrorMock = mock.method(console, 'error', () => undefined);
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      const mockChild = new MockChildProcess();
      mock.method(cp, 'spawn', () => mockChild);

      await launcher.start();
      launcher.stop();

      mockChild.stderr.write(Buffer.from('test stderr output'));

      assert.ok(consoleErrorMock.mock.calls.some(c => c.arguments[0] === 'OIBus stderr: test stderr output'));
    });

    it('performs update when update exists and version is false', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      const updatePath = path.resolve(updateDir, 'binaries', 'oibus');
      fs.mkdirSync(path.dirname(updatePath), { recursive: true });
      fs.writeFileSync(updatePath, 'new binary');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'old binary');

      mock.method(cp, 'spawn', () => new MockChildProcess());

      await launcher.start();
      launcher.stop();

      assert.ok(fs.existsSync(path.resolve(backupDir, 'oibus')));
    });

    it('skips update when version is true even if update exists', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, true, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      const updatePath = path.resolve(updateDir, 'binaries', 'oibus');
      fs.mkdirSync(path.dirname(updatePath), { recursive: true });
      fs.writeFileSync(updatePath, 'new binary');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'old binary');

      mock.method(cp, 'spawn', () => new MockChildProcess());

      await launcher.start();
      launcher.stop();

      assert.strictEqual(fs.existsSync(path.resolve(backupDir, 'oibus')), false);
    });

    it('handles child process close event with updated flag', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      const mockChild = new MockChildProcess();
      mock.method(cp, 'spawn', () => mockChild);

      await launcher.start();
      launcher.stop();
      const updatePath = path.resolve(updateDir, 'binaries', 'oibus');
      fs.mkdirSync(path.dirname(updatePath), { recursive: true });
      fs.writeFileSync(updatePath, 'new binary');
      await launcher.start();
      launcher.stop();

      const closeListeners = mockChild.rawListeners('close');
      if (closeListeners.length > 0) {
        await (closeListeners[closeListeners.length - 1] as (code: number | null) => Promise<void>)(0);
      }
    });

    it('handles child process close event when not stopping and not in version mode', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      const mockChild = new MockChildProcess();
      let spawnCallCount = 0;
      mock.method(cp, 'spawn', () => {
        spawnCallCount += 1;
        return mockChild;
      });

      await launcher.start();
      const initialCallCount = spawnCallCount;

      const [closeListener] = mockChild.rawListeners('close') as Array<(code: number | null) => Promise<void>>;
      if (closeListener) {
        await closeListener(0);
      }

      assert.ok(spawnCallCount > initialCallCount);

      launcher.stop();
    });

    it('handles child process close event when stopping is true', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      const mockChild = new MockChildProcess();
      let secondStartCallCount = 0;
      mock.method(cp, 'spawn', () => {
        secondStartCallCount += 1;
        return mockChild;
      });

      await launcher.start();
      launcher.stop();

      secondStartCallCount = 0;

      const [closeListener] = mockChild.rawListeners('close') as Array<(code: number | null) => Promise<void>>;
      if (closeListener) {
        await closeListener(0);
      }

      assert.strictEqual(secondStartCallCount, 0);
    });

    it('handles child process close event in version mode with non-zero code', async () => {
      const exitMock = mock.method(process, 'exit', (_code?: number | string | null) => undefined as never);
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, true, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      const mockChild = new MockChildProcess();
      mock.method(cp, 'spawn', () => mockChild);

      await launcher.start();
      launcher.stop();

      const [closeListener] = mockChild.rawListeners('close') as Array<(code: number | null) => Promise<void>>;
      if (closeListener) {
        await closeListener(1);
      }

      assert.ok(exitMock.mock.calls.some(c => c.arguments[0] === 1));
    });

    it('handles child process close event in version mode with zero code', async () => {
      const exitMock = mock.method(process, 'exit', (_code?: number | string | null) => undefined as never);
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, true, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      const mockChild = new MockChildProcess();
      mock.method(cp, 'spawn', () => mockChild);

      await launcher.start();
      launcher.stop();

      const [closeListener] = mockChild.rawListeners('close') as Array<(code: number | null) => Promise<void>>;
      if (closeListener) {
        await closeListener(0);
      }

      assert.ok(exitMock.mock.calls.some(c => c.arguments[0] === 0));
    });

    it('handles child process error event', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      const mockChild = new MockChildProcess();
      mock.method(cp, 'spawn', () => mockChild);

      await launcher.start();
      launcher.stop();

      const [errorListener] = mockChild.rawListeners('error') as Array<(error: Error) => void>;
      if (errorListener) {
        errorListener(new Error('Spawn failed'));
      }
    });

    it('handles child process error event in version mode', async () => {
      const exitMock = mock.method(process, 'exit', (_code?: number | string | null) => undefined as never);
      const consoleInfoMock = mock.method(console, 'info', () => undefined);
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, true, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      const mockChild = new MockChildProcess();
      mock.method(cp, 'spawn', () => mockChild);

      await launcher.start();
      launcher.stop();

      const [errorListener] = mockChild.rawListeners('error') as Array<(error: Error) => void>;
      if (errorListener) {
        errorListener(new Error('Spawn failed'));
      }

      assert.ok(consoleInfoMock.mock.calls.some(c => (c.arguments[0] as string).includes('Launcher version:')));
      assert.ok(exitMock.mock.calls.some(c => c.arguments[0] === 1));
    });

    it('handles spawn exception', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      const backupPath = launcher.getOibusBackupPath();
      const dataFolderBackup = path.resolve(backupDir, 'data-folder');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'old binary');
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.writeFileSync(backupPath, 'old binary');
      fs.mkdirSync(dataFolderBackup, { recursive: true });
      fs.writeFileSync(oibusPath, 'new binary');

      let callCount = 0;
      mock.method(cp, 'spawn', () => {
        callCount += 1;
        if (callCount === 1) {
          throw new Error('Spawn error');
        }
        return new MockChildProcess();
      });

      await launcher.start();
      launcher.stop();
      assert.ok(callCount > 0);
    });

    it('handles spawn exception in version mode', async () => {
      const exitMock = mock.method(process, 'exit', (_code?: number | string | null) => undefined as never);
      const consoleInfoMock = mock.method(console, 'info', () => undefined);
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, true, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      mock.method(cp, 'spawn', () => {
        throw new Error('Spawn error');
      });

      await launcher.start();
      launcher.stop();

      assert.ok(consoleInfoMock.mock.calls.some(c => (c.arguments[0] as string).includes('Launcher version:')));
      assert.ok(exitMock.mock.calls.some(c => c.arguments[0] === 1));
    });
  });

  describe('update', () => {
    beforeEach(() => {
      mock.method(os, 'type', () => 'Linux');
    });

    it('performs update with default backup folders', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      const updatePath = path.resolve(updateDir, 'binaries', 'oibus');
      fs.mkdirSync(path.dirname(updatePath), { recursive: true });
      fs.writeFileSync(updatePath, 'new binary');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'old binary');

      await launcher.update();

      assert.ok(fs.existsSync(path.resolve(backupDir, 'oibus')));
      assert.ok(fs.existsSync(oibusPath));
    });

    it('performs update with custom backup folders from update.json', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      const updatePath = path.resolve(updateDir, 'binaries', 'oibus');
      const updateSettingsPath = path.resolve('./', 'update.json');
      fs.mkdirSync(path.dirname(updatePath), { recursive: true });
      fs.writeFileSync(updatePath, 'new binary');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'old binary');
      fs.writeFileSync(updateSettingsPath, JSON.stringify({ backupFolders: 'logs/*' }));

      await launcher.update();

      assert.ok(fs.existsSync(path.resolve(backupDir, 'oibus')));
      fs.unlinkSync(updateSettingsPath);
    });

    it('performs update with update.json that has no backupFolders property', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      const updatePath = path.resolve(updateDir, 'binaries', 'oibus');
      const updateSettingsPath = path.resolve('./', 'update.json');
      fs.mkdirSync(path.dirname(updatePath), { recursive: true });
      fs.writeFileSync(updatePath, 'new binary');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'old binary');
      fs.writeFileSync(updateSettingsPath, JSON.stringify({}));

      await launcher.update();

      assert.ok(fs.existsSync(path.resolve(backupDir, 'oibus')));
      fs.unlinkSync(updateSettingsPath);
    });

    it('handles missing update.json file', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      const updatePath = path.resolve(updateDir, 'binaries', 'oibus');
      fs.mkdirSync(path.dirname(updatePath), { recursive: true });
      fs.writeFileSync(updatePath, 'new binary');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'old binary');

      await launcher.update();

      assert.ok(fs.existsSync(path.resolve(backupDir, 'oibus')));
    });

    it('cleans up update directory after update', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      const updatePath = path.resolve(updateDir, 'binaries', 'oibus');
      const otherFile = path.resolve(updateDir, 'other-file.txt');
      fs.mkdirSync(path.dirname(updatePath), { recursive: true });
      fs.writeFileSync(updatePath, 'new binary');
      fs.writeFileSync(otherFile, 'other content');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'old binary');

      await launcher.update();

      assert.strictEqual(fs.existsSync(otherFile), false);
    });

    it('handles errors when cleaning up update directory', async () => {
      const consoleErrorMock = mock.method(console, 'error', () => undefined);
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      const updatePath = path.resolve(updateDir, 'binaries', 'oibus');
      const problematicFile = path.resolve(updateDir, 'problematic-file.txt');
      fs.mkdirSync(path.dirname(updatePath), { recursive: true });
      fs.writeFileSync(updatePath, 'new binary');
      fs.writeFileSync(problematicFile, 'problematic content');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'old binary');

      const originalRm = fs.promises.rm.bind(fs.promises);
      mock.method(
        fs.promises,
        'rm',
        async (target: Parameters<typeof fs.promises.rm>[0], options?: Parameters<typeof fs.promises.rm>[1]) => {
          const targetPath = typeof target === 'string' ? target : String(target);
          if (targetPath.includes(updateDir) && !targetPath.includes('binaries')) {
            if (targetPath === problematicFile) {
              throw new Error('Permission denied');
            }
          }
          return originalRm(target, options!);
        }
      );

      await launcher.update();

      assert.ok(consoleErrorMock.mock.calls.length > 0);
    });
  });

  describe('rollback', () => {
    beforeEach(() => {
      mock.method(os, 'type', () => 'Linux');
    });

    it('rolls back binary and data folder', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      const backupPath = path.resolve(backupDir, 'oibus');
      const dataFolderBackup = path.resolve(backupDir, 'data-folder');
      const dataFile = path.join(dataFolderBackup, 'test.txt');

      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(backupPath, 'backup binary');
      fs.mkdirSync(dataFolderBackup, { recursive: true });
      fs.writeFileSync(dataFile, 'backup data');

      await launcher.rollback();

      assert.ok(fs.existsSync(oibusPath));
      assert.ok(fs.existsSync(path.join(configDir, 'test.txt')));
      assert.strictEqual(fs.existsSync(dataFolderBackup), false);
    });
  });

  describe('handleOibusStarted', () => {
    beforeEach(() => {
      mock.method(os, 'type', () => 'Linux');
    });

    it('cleans up backup files and settings', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      const backupPath = path.resolve(backupDir, 'oibus');
      const launcherBackupPath = path.resolve(process.cwd(), 'oibus-launcher_backup');
      const dataFolderBackup = path.resolve(backupDir, 'data-folder');
      const updateSettingsPath = path.resolve(process.cwd(), 'update.json');

      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');
      fs.writeFileSync(backupPath, 'backup');
      fs.writeFileSync(launcherBackupPath, 'launcher backup');
      fs.mkdirSync(dataFolderBackup, { recursive: true });
      fs.writeFileSync(updateSettingsPath, '{}');

      mock.method(cp, 'spawn', () => new MockChildProcess());

      await launcher.start();
      launcher.stop();
      await launcher.handleOibusStarted();

      assert.strictEqual(fs.existsSync(backupPath), false);
      assert.strictEqual(fs.existsSync(launcherBackupPath), false);
      assert.strictEqual(fs.existsSync(dataFolderBackup), false);
      assert.strictEqual(fs.existsSync(updateSettingsPath), false);
    });

    it('handles handleOibusStarted when startedTimeout is null', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const backupPath = path.resolve(backupDir, 'oibus');
      const launcherBackupPath = path.resolve(process.cwd(), 'oibus-launcher_backup');
      const dataFolderBackup = path.resolve(backupDir, 'data-folder');
      const updateSettingsPath = path.resolve(process.cwd(), 'update.json');

      fs.writeFileSync(backupPath, 'backup');
      fs.writeFileSync(launcherBackupPath, 'launcher backup');
      fs.mkdirSync(dataFolderBackup, { recursive: true });
      fs.writeFileSync(updateSettingsPath, '{}');

      await launcher.handleOibusStarted();

      assert.strictEqual(fs.existsSync(backupPath), false);
      assert.strictEqual(fs.existsSync(launcherBackupPath), false);
      assert.strictEqual(fs.existsSync(dataFolderBackup), false);
      assert.strictEqual(fs.existsSync(updateSettingsPath), false);
    });
  });

  describe('backupDataFolder', () => {
    beforeEach(() => {
      mock.method(os, 'type', () => 'Linux');
    });

    it('backs up data folder matching pattern', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const cacheDir = path.join(configDir, 'cache');
      const cacheFile = path.join(cacheDir, 'file.txt');
      const otherDir = path.join(configDir, 'other');
      const otherFile = path.join(otherDir, 'file.txt');

      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(cacheFile, 'cache content');
      fs.mkdirSync(otherDir, { recursive: true });
      fs.writeFileSync(otherFile, 'other content');

      const pattern = RegExp('cache/*');
      await launcher.backupDataFolder(pattern);

      const backupCacheFile = path.resolve(backupDir, 'data-folder', 'cache', 'file.txt');
      const backupOtherFile = path.resolve(backupDir, 'data-folder', 'other', 'file.txt');
      assert.ok(fs.existsSync(backupCacheFile));
      assert.strictEqual(fs.existsSync(backupOtherFile), false);
    });
  });

  describe('copyFilesAndDirectoriesRecursively', () => {
    it('copies matching directories recursively', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const srcDir = configDir;
      const destDir = path.resolve(backupDir, 'data-folder');
      const cacheDir = path.join(srcDir, 'cache');
      const cacheSubDir = path.join(cacheDir, 'subdir');
      const cacheFile = path.join(cacheSubDir, 'file.txt');

      fs.mkdirSync(cacheSubDir, { recursive: true });
      fs.writeFileSync(cacheFile, 'content');

      const pattern = RegExp('cache/*');
      await launcher.copyFilesAndDirectoriesRecursively(srcDir, destDir, pattern);

      const destFile = path.join(destDir, 'cache', 'subdir', 'file.txt');
      assert.ok(fs.existsSync(destFile));
    });

    it('copies matching files', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const srcDir = configDir;
      const destDir = path.resolve(backupDir, 'data-folder');
      const logFile = path.join(srcDir, 'logs', 'app.log');

      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      fs.writeFileSync(logFile, 'log content');

      const pattern = RegExp('logs/*');
      await launcher.copyFilesAndDirectoriesRecursively(srcDir, destDir, pattern);

      const destFile = path.join(destDir, 'logs', 'app.log');
      assert.ok(fs.existsSync(destFile));
    });

    it('skips non-matching entries', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const srcDir = configDir;
      const destDir = path.resolve(backupDir, 'data-folder');
      const cacheDir = path.join(srcDir, 'cache');
      const otherDir = path.join(srcDir, 'other');
      const cacheFile = path.join(cacheDir, 'file.txt');
      const otherFile = path.join(otherDir, 'file.txt');

      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(cacheFile, 'cache');
      fs.mkdirSync(otherDir, { recursive: true });
      fs.writeFileSync(otherFile, 'other');

      const pattern = RegExp('cache/*');
      await launcher.copyFilesAndDirectoriesRecursively(srcDir, destDir, pattern);

      const destCacheFile = path.join(destDir, 'cache', 'file.txt');
      const destOtherFile = path.join(destDir, 'other', 'file.txt');
      assert.ok(fs.existsSync(destCacheFile));
      assert.strictEqual(fs.existsSync(destOtherFile), false);
    });
  });
});
