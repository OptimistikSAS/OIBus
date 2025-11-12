import { spawn } from 'node:child_process';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { Readable } from 'node:stream';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Launcher from './launcher';
import * as utils from './utils';

jest.mock('node:child_process', () => ({
  spawn: jest.fn()
}));

// Helper function to create a mock child process
const createMockChildProcess = (): MockChildProcess => {
  const killMock = jest.fn(() => true);
  const onMock = jest.fn();
  const stdoutOnMock = jest.fn();
  const stderrOnMock = jest.fn();

  const mockChild = {
    kill: killMock as (signal?: NodeJS.Signals | number) => boolean,
    stdout: { on: stdoutOnMock } as Readable & { on: typeof stdoutOnMock },
    stderr: { on: stderrOnMock } as Readable & { on: typeof stderrOnMock },
    on: onMock as unknown as ChildProcessWithoutNullStreams['on'],
    killMock,
    onMock,
    stdoutOnMock,
    stderrOnMock
  } as MockChildProcess;

  return mockChild;
};

type MockChildProcess = Partial<ChildProcessWithoutNullStreams> & {
  kill: (signal?: NodeJS.Signals | number) => boolean;
  stdout: Readable & { on: (event: string, listener: (...args: Array<unknown>) => void) => Readable };
  stderr: Readable & { on: (event: string, listener: (...args: Array<unknown>) => void) => Readable };
  on: (event: string, listener: (...args: Array<unknown>) => void) => ChildProcessWithoutNullStreams;
  killMock: ReturnType<typeof jest.fn>;
  onMock: ReturnType<typeof jest.fn>;
  stdoutOnMock: ReturnType<typeof jest.fn>;
  stderrOnMock: ReturnType<typeof jest.fn>;
};

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
  jest.clearAllMocks();
  jest.clearAllTimers();
});

describe('Launcher', () => {
  let workDir: string;
  let updateDir: string;
  let backupDir: string;
  let configDir: string;

  beforeEach(() => {
    workDir = createTempDir();
    updateDir = createTempDir();
    backupDir = createTempDir();
    configDir = createTempDir();
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Stop all launcher instances to clear their timeouts
    launcherInstances.forEach(launcher => {
      launcher.stop();
    });
    launcherInstances.length = 0;
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // Track all launcher instances for cleanup
  const launcherInstances: Array<Launcher> = [];

  // Helper to track and start launcher
  const createAndTrackLauncher = (
    workDir: string,
    updateDir: string,
    backupDir: string,
    configDir: string,
    version: boolean,
    processArgs: Array<string>
  ): Launcher => {
    const launcher = new Launcher(workDir, updateDir, backupDir, configDir, version, processArgs);
    launcherInstances.push(launcher);
    return launcher;
  };

  describe('constructor', () => {
    it('initializes with provided directories', () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, ['node', 'script.js', '--config', './data']);

      expect(launcher).toBeInstanceOf(Launcher);
    });

    it('processes arguments with replaceConfigArgumentWithAbsolutePath', () => {
      const replaceSpy = jest.spyOn(utils, 'replaceConfigArgumentWithAbsolutePath');
      createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, ['node', 'script.js', '--config', './data']);

      expect(replaceSpy).toHaveBeenCalledWith(['node', 'script.js', '--config', './data'], configDir);
    });
  });

  describe('getOibusExecutable', () => {
    it('returns oibus.exe on Windows', () => {
      jest.spyOn(os, 'type').mockReturnValue('Windows_NT' as NodeJS.Platform);

      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const executable = launcher.getOibusExecutable();

      expect(executable).toBe('oibus.exe');
      jest.mocked(os.type).mockRestore();
    });

    it('returns oibus on non-Windows', () => {
      jest.spyOn(os, 'type').mockReturnValue('Linux' as NodeJS.Platform);

      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const executable = launcher.getOibusExecutable();

      expect(executable).toBe('oibus');
      jest.mocked(os.type).mockRestore();
    });
  });

  describe('getOibusLauncherExecutable', () => {
    it('returns oibus-launcher_backup.exe on Windows', () => {
      jest.spyOn(os, 'type').mockReturnValue('Windows_NT' as NodeJS.Platform);

      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const executable = launcher.getOibusLauncherExecutable();

      expect(executable).toBe('oibus-launcher_backup.exe');
      jest.mocked(os.type).mockRestore();
    });

    it('returns oibus-launcher_backup on non-Windows', () => {
      jest.spyOn(os, 'type').mockReturnValue('Linux' as NodeJS.Platform);

      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const executable = launcher.getOibusLauncherExecutable();

      expect(executable).toBe('oibus-launcher_backup');
      jest.mocked(os.type).mockRestore();
    });
  });

  describe('getOibusPath', () => {
    it('returns resolved path to oibus executable in workDir', () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = launcher.getOibusPath();

      expect(oibusPath).toBe(path.resolve(workDir, 'oibus'));
    });
  });

  describe('getOibusUpdatePath', () => {
    it('returns resolved path to oibus executable in updateDir/binaries', () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const updatePath = launcher.getOibusUpdatePath();

      expect(updatePath).toBe(path.resolve(updateDir, 'binaries', 'oibus'));
    });
  });

  describe('getOibusBackupPath', () => {
    it('returns resolved path to oibus executable in backupDir', () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const backupPath = launcher.getOibusBackupPath();

      expect(backupPath).toBe(path.resolve(backupDir, 'oibus'));
    });
  });

  describe('getOibusLauncherBackupPath', () => {
    it('returns resolved path to launcher backup in current working directory', () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const launcherBackupPath = launcher.getOibusLauncherBackupPath();

      expect(launcherBackupPath).toBe(path.resolve(process.cwd(), 'oibus-launcher_backup'));
    });
  });

  describe('checkForUpdate', () => {
    it('returns true when update file exists', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const updateBinaryPath = path.resolve(updateDir, 'binaries', 'oibus');
      fs.mkdirSync(path.dirname(updateBinaryPath), { recursive: true });
      fs.writeFileSync(updateBinaryPath, 'binary content');

      const hasUpdate = await launcher.checkForUpdate();

      expect(hasUpdate).toBe(true);
    });

    it('returns false when update file does not exist', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);

      const hasUpdate = await launcher.checkForUpdate();

      expect(hasUpdate).toBe(false);
    });
  });

  describe('stop', () => {
    it('kills child process when it exists', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');
      const mockChild = createMockChildProcess();
      jest.mocked(spawn).mockReturnValue(mockChild as ChildProcessWithoutNullStreams);

      // Start to create a child
      await launcher.start();
      launcher.stop(); // Clean up timeout
      launcher.stop();

      expect(mockChild.killMock).toHaveBeenCalledWith('SIGINT');
    });

    it('handles stop when no child exists', () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      expect(() => launcher.stop()).not.toThrow();
    });
  });

  describe('start', () => {
    it('starts OIBus without update when no update exists', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      const mockChild = createMockChildProcess();
      jest.mocked(spawn).mockReturnValue(mockChild as ChildProcessWithoutNullStreams);

      await launcher.start();
      launcher.stop(); // Clean up timeout

      expect(spawn).toHaveBeenCalledWith(oibusPath, expect.arrayContaining<string>([]), { cwd: workDir });
      expect(mockChild.stdoutOnMock).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockChild.stderrOnMock).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockChild.onMock).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockChild.onMock).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('handles stdout data events', async () => {
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      let stdoutHandler: ((data: Buffer) => void) | undefined;
      const mockChild = createMockChildProcess();
      mockChild.stdoutOnMock = jest.fn((event: string, handler: (...args: Array<unknown>) => void) => {
        if (event === 'data') {
          stdoutHandler = handler as (data: Buffer) => void;
        }
        return mockChild.stdout;
      }) as ReturnType<typeof jest.fn>;
      mockChild.stdout = { on: mockChild.stdoutOnMock } as Readable & { on: typeof mockChild.stdoutOnMock };
      jest.mocked(spawn).mockReturnValue(mockChild as ChildProcessWithoutNullStreams);

      await launcher.start();
      launcher.stop(); // Clean up timeout

      if (stdoutHandler) {
        stdoutHandler(Buffer.from('test stdout output'));
      }

      expect(consoleInfoSpy).toHaveBeenCalledWith('OIBus stdout: test stdout output');
      consoleInfoSpy.mockRestore();
    });

    it('handles stderr data events', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      let stderrHandler: ((data: Buffer) => void) | undefined;
      const mockChild = createMockChildProcess();
      mockChild.stderrOnMock = jest.fn((event: string, handler: (...args: Array<unknown>) => void) => {
        if (event === 'data') {
          stderrHandler = handler as (data: Buffer) => void;
        }
        return mockChild.stderr;
      }) as ReturnType<typeof jest.fn>;
      mockChild.stderr = { on: mockChild.stderrOnMock } as Readable & { on: typeof mockChild.stderrOnMock };
      jest.mocked(spawn).mockReturnValue(mockChild as ChildProcessWithoutNullStreams);

      await launcher.start();
      launcher.stop(); // Clean up timeout

      if (stderrHandler) {
        stderrHandler(Buffer.from('test stderr output'));
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith('OIBus stderr: test stderr output');
      consoleErrorSpy.mockRestore();
    });

    it('performs update when update exists and version is false', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      const updatePath = path.resolve(updateDir, 'binaries', 'oibus');
      fs.mkdirSync(path.dirname(updatePath), { recursive: true });
      fs.writeFileSync(updatePath, 'new binary');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'old binary');

      const mockChild = createMockChildProcess();
      jest.mocked(spawn).mockReturnValue(mockChild as ChildProcessWithoutNullStreams);

      await launcher.start();
      launcher.stop(); // Clean up timeout

      expect(fs.existsSync(path.resolve(backupDir, 'oibus'))).toBe(true);
    });

    it('skips update when version is true even if update exists', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, true, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      const updatePath = path.resolve(updateDir, 'binaries', 'oibus');
      fs.mkdirSync(path.dirname(updatePath), { recursive: true });
      fs.writeFileSync(updatePath, 'new binary');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'old binary');

      const mockChild = createMockChildProcess();
      jest.mocked(spawn).mockReturnValue(mockChild as ChildProcessWithoutNullStreams);

      await launcher.start();
      launcher.stop(); // Clean up timeout

      expect(fs.existsSync(path.resolve(backupDir, 'oibus'))).toBe(false);
    });

    it('handles child process close event with updated flag', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      let closeHandler: ((code: number | null) => void) | undefined;
      const mockChild = createMockChildProcess();
      mockChild.onMock = jest.fn((event: string, handler: (...args: Array<unknown>) => void) => {
        if (event === 'close') {
          closeHandler = handler as (code: number | null) => void;
        }
        return mockChild as ChildProcessWithoutNullStreams;
      }) as unknown as ReturnType<typeof jest.fn>;
      mockChild.on = mockChild.onMock as unknown as ChildProcessWithoutNullStreams['on'];
      jest.mocked(spawn).mockReturnValue(mockChild as ChildProcessWithoutNullStreams);

      await launcher.start();
      launcher.stop(); // Clean up timeout
      // Simulate updated flag by calling update first
      const updatePath = path.resolve(updateDir, 'binaries', 'oibus');
      fs.mkdirSync(path.dirname(updatePath), { recursive: true });
      fs.writeFileSync(updatePath, 'new binary');
      await launcher.start();
      launcher.stop(); // Clean up timeout

      // Trigger close event
      if (closeHandler!) {
        await closeHandler(0);
      }
    });

    it('handles child process close event when not stopping and not in version mode', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      let closeHandler: ((code: number | null) => void) | undefined;
      let spawnCallCount = 0;
      const mockChild = createMockChildProcess();
      mockChild.onMock = jest.fn((event: string, handler: (...args: Array<unknown>) => void) => {
        if (event === 'close') {
          closeHandler = handler as (code: number | null) => void;
        }
        return mockChild as ChildProcessWithoutNullStreams;
      }) as unknown as ReturnType<typeof jest.fn>;
      mockChild.on = mockChild.onMock as unknown as ChildProcessWithoutNullStreams['on'];

      // Mock spawn to track all calls
      jest.mocked(spawn).mockImplementation(() => {
        spawnCallCount += 1;
        return mockChild as ChildProcessWithoutNullStreams;
      });

      await launcher.start();
      const initialCallCount = spawnCallCount;

      // Trigger close event when not stopping and not in version mode
      // Don't call launcher.stop() here as that would set stopping=true and prevent restart
      if (closeHandler!) {
        await closeHandler(0);
      }

      // Verify that spawn was called again (restart behavior)
      expect(spawnCallCount).toBeGreaterThan(initialCallCount);

      // Clean up after test
      launcher.stop();
    });

    it('handles child process close event when stopping is true', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      let closeHandler: ((code: number | null) => void) | undefined;
      let secondStartCallCount = 0;
      const mockChild = createMockChildProcess();
      mockChild.onMock = jest.fn((event: string, handler: (...args: Array<unknown>) => void) => {
        if (event === 'close') {
          closeHandler = handler as (code: number | null) => void;
        }
        return mockChild as ChildProcessWithoutNullStreams;
      }) as unknown as ReturnType<typeof jest.fn>;
      mockChild.on = mockChild.onMock as unknown as ChildProcessWithoutNullStreams['on'];

      // Mock spawn to track calls
      jest.mocked(spawn).mockImplementation(() => {
        secondStartCallCount += 1;
        return mockChild as ChildProcessWithoutNullStreams;
      });

      await launcher.start();
      launcher.stop(); // Clean up timeout

      // Stop the launcher to set stopping flag
      launcher.stop();

      // Reset counter to track restart calls
      secondStartCallCount = 0;

      // Trigger close event when stopping is true
      if (closeHandler!) {
        await closeHandler(0);
      }

      // Verify that spawn was NOT called again (no restart when stopping)
      expect(secondStartCallCount).toBe(0);
    });

    it('handles child process close event in version mode with non-zero code', async () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, true, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      let closeHandler: ((code: number | null) => void) | undefined;
      const mockChild = createMockChildProcess();
      mockChild.onMock = jest.fn((event: string, handler: (...args: Array<unknown>) => void) => {
        if (event === 'close') {
          closeHandler = handler as (code: number | null) => void;
        }
        return mockChild as ChildProcessWithoutNullStreams;
      }) as unknown as ReturnType<typeof jest.fn>;
      mockChild.on = mockChild.onMock as unknown as ChildProcessWithoutNullStreams['on'];
      jest.mocked(spawn).mockReturnValue(mockChild as ChildProcessWithoutNullStreams);

      await launcher.start();
      launcher.stop(); // Clean up timeout

      if (closeHandler!) {
        await closeHandler(1);
      }

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });

    it('handles child process close event in version mode with zero code', async () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, true, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      let closeHandler: ((code: number | null) => void) | undefined;
      const mockChild = createMockChildProcess();
      mockChild.onMock = jest.fn((event: string, handler: (...args: Array<unknown>) => void) => {
        if (event === 'close') {
          closeHandler = handler as (code: number | null) => void;
        }
        return mockChild as ChildProcessWithoutNullStreams;
      }) as unknown as ReturnType<typeof jest.fn>;
      mockChild.on = mockChild.onMock as unknown as ChildProcessWithoutNullStreams['on'];
      jest.mocked(spawn).mockReturnValue(mockChild as ChildProcessWithoutNullStreams);

      await launcher.start();
      launcher.stop(); // Clean up timeout

      if (closeHandler!) {
        await closeHandler(0);
      }

      expect(exitSpy).toHaveBeenCalledWith(0);
      exitSpy.mockRestore();
    });

    it('handles child process error event', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      let errorHandler: ((error: Error) => void) | undefined;
      const mockChild = createMockChildProcess();
      mockChild.onMock = jest.fn((event: string, handler: (...args: Array<unknown>) => void) => {
        if (event === 'error') {
          errorHandler = handler as (error: Error) => void;
        }
        return mockChild as ChildProcessWithoutNullStreams;
      });
      mockChild.on = mockChild.onMock as unknown as ChildProcessWithoutNullStreams['on'];
      jest.mocked(spawn).mockReturnValue(mockChild as ChildProcessWithoutNullStreams);

      await launcher.start();
      launcher.stop(); // Clean up timeout

      if (errorHandler!) {
        errorHandler(new Error('Spawn failed'));
      }
    });

    it('handles child process error event in version mode', async () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, true, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      let errorHandler: ((error: Error) => void) | undefined;
      const mockChild = createMockChildProcess();
      mockChild.onMock = jest.fn((event: string, handler: (...args: Array<unknown>) => void) => {
        if (event === 'error') {
          errorHandler = handler as (error: Error) => void;
        }
        return mockChild as ChildProcessWithoutNullStreams;
      });
      mockChild.on = mockChild.onMock as unknown as ChildProcessWithoutNullStreams['on'];
      jest.mocked(spawn).mockReturnValue(mockChild as ChildProcessWithoutNullStreams);

      await launcher.start();
      launcher.stop(); // Clean up timeout

      if (errorHandler!) {
        errorHandler(new Error('Spawn failed'));
      }

      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Launcher version:'));
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      consoleInfoSpy.mockRestore();
    });

    it('handles spawn exception', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      const backupPath = launcher.getOibusBackupPath();
      const dataFolderBackup = path.resolve(backupDir, 'data-folder');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'old binary');
      // Create backup files as if an update was attempted
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.writeFileSync(backupPath, 'old binary');
      fs.mkdirSync(dataFolderBackup, { recursive: true });
      // Simulate that update was attempted by creating the updated binary
      fs.writeFileSync(oibusPath, 'new binary');

      let callCount = 0;
      jest.mocked(spawn).mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) {
          throw new Error('Spawn error');
        }
        // On retry, return a mock child process to prevent infinite loop
        return createMockChildProcess() as ChildProcessWithoutNullStreams;
      });

      // The spawn exception will trigger rollback and retry
      // The test verifies the exception is caught and handled
      await launcher.start();
      launcher.stop(); // Clean up timeout
      expect(callCount).toBeGreaterThan(0);
    });

    it('handles spawn exception in version mode', async () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, true, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'binary');

      jest.mocked(spawn).mockImplementation(() => {
        throw new Error('Spawn error');
      });

      // The spawn exception in version mode should exit with version info
      await launcher.start();
      launcher.stop(); // Clean up timeout

      expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Launcher version:'));
      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
      consoleInfoSpy.mockRestore();
    });
  });

  describe('update', () => {
    it('performs update with default backup folders', async () => {
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      const updatePath = path.resolve(updateDir, 'binaries', 'oibus');
      fs.mkdirSync(path.dirname(updatePath), { recursive: true });
      fs.writeFileSync(updatePath, 'new binary');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'old binary');

      await launcher.update();

      expect(fs.existsSync(path.resolve(backupDir, 'oibus'))).toBe(true);
      expect(fs.existsSync(oibusPath)).toBe(true);
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

      expect(fs.existsSync(path.resolve(backupDir, 'oibus'))).toBe(true);
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
      // Create update.json without backupFolders property
      fs.writeFileSync(updateSettingsPath, JSON.stringify({}));

      await launcher.update();

      expect(fs.existsSync(path.resolve(backupDir, 'oibus'))).toBe(true);
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

      expect(fs.existsSync(path.resolve(backupDir, 'oibus'))).toBe(true);
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

      expect(fs.existsSync(otherFile)).toBe(false);
    });

    it('handles errors when cleaning up update directory', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const launcher = createAndTrackLauncher(workDir, updateDir, backupDir, configDir, false, []);
      const oibusPath = path.resolve(workDir, 'oibus');
      const updatePath = path.resolve(updateDir, 'binaries', 'oibus');
      const problematicFile = path.resolve(updateDir, 'problematic-file.txt');
      fs.mkdirSync(path.dirname(updatePath), { recursive: true });
      fs.writeFileSync(updatePath, 'new binary');
      fs.writeFileSync(problematicFile, 'problematic content');
      fs.mkdirSync(workDir, { recursive: true });
      fs.writeFileSync(oibusPath, 'old binary');

      // Mock fs.rm to throw an error when cleaning up files in updateDir
      const originalRm = fs.promises.rm;
      jest.spyOn(fs.promises, 'rm').mockImplementation(async (target, options) => {
        const targetPath = typeof target === 'string' ? target : String(target);
        // Check if this is a call to remove a file in updateDir (not the binaries subdirectory)
        if (targetPath.includes(updateDir) && !targetPath.includes('binaries')) {
          // Throw error when trying to remove the problematic file
          if (targetPath === problematicFile) {
            throw new Error('Permission denied');
          }
        }
        return originalRm(target, options);
      });

      await launcher.update();

      // Verify that the error was logged (line 150)
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
      jest.clearAllMocks();
    });
  });

  describe('rollback', () => {
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

      expect(fs.existsSync(oibusPath)).toBe(true);
      expect(fs.existsSync(path.join(configDir, 'test.txt'))).toBe(true);
      expect(fs.existsSync(dataFolderBackup)).toBe(false);
    });
  });

  describe('handleOibusStarted', () => {
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

      const mockChild = createMockChildProcess();
      jest.mocked(spawn).mockReturnValue(mockChild as ChildProcessWithoutNullStreams);

      await launcher.start();
      launcher.stop(); // Clean up timeout
      // Manually trigger handleOibusStarted to test cleanup
      await launcher.handleOibusStarted();

      expect(fs.existsSync(backupPath)).toBe(false);
      expect(fs.existsSync(launcherBackupPath)).toBe(false);
      expect(fs.existsSync(dataFolderBackup)).toBe(false);
      expect(fs.existsSync(updateSettingsPath)).toBe(false);
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

      // Call handleOibusStarted when startedTimeout is null (not set)
      // This tests the branch where if (this.startedTimeout) is false (line 170)
      await launcher.handleOibusStarted();

      expect(fs.existsSync(backupPath)).toBe(false);
      expect(fs.existsSync(launcherBackupPath)).toBe(false);
      expect(fs.existsSync(dataFolderBackup)).toBe(false);
      expect(fs.existsSync(updateSettingsPath)).toBe(false);
    });
  });

  describe('backupDataFolder', () => {
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
      expect(fs.existsSync(backupCacheFile)).toBe(true);
      expect(fs.existsSync(backupOtherFile)).toBe(false);
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
      expect(fs.existsSync(destFile)).toBe(true);
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
      expect(fs.existsSync(destFile)).toBe(true);
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
      expect(fs.existsSync(destCacheFile)).toBe(true);
      expect(fs.existsSync(destOtherFile)).toBe(false);
    });
  });
});
