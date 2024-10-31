import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ChildProcessWithoutNullStreams } from 'child_process';
import * as os from 'os';
import { createFolder, filesExists, replaceConfigArgumentWithAbsolutePath } from './utils';

const STARTED_DELAY = 30000;
const UPDATE_SETTINGS_FILE = 'update.json';

export default class Launcher {
  private updated = false;
  private startedTimeout: NodeJS.Timeout | null = null;
  private child: ChildProcessWithoutNullStreams | null = null;
  private stopping = false;

  constructor(
    private workDir: string,
    private updateDir: string,
    private backupDir: string,
    private config: string,
    private check: boolean
  ) {}

  async start(): Promise<void> {
    const oibusPath = this.getOibusPath();

    if ((await this.checkForUpdate()) && !this.check) {
      await this.update();
    }

    const args = replaceConfigArgumentWithAbsolutePath(process.argv, this.config);
    console.log(`Starting OIBus launcher: ${oibusPath} ${args}`);
    try {
      this.child = spawn(oibusPath, args, { cwd: this.workDir });

      this.child.stdout.on('data', data => {
        console.info(`OIBus stdout: ${data.toString()}`);
      });

      this.child.stderr.on('data', data => {
        console.error(`OIBus stderr: ${data.toString()}`);
      });

      this.child.on('close', async code => {
        console.info(`OIBus closed with code: ${code}`);

        if (this.updated) {
          this.updated = false;
          this.stop();
          await this.rollback();
          await this.start();
          return;
        }

        if (this.check) {
          console.info('OIBus launcher started in check mode. Exiting process.');
          process.exit();
        }
        if (!this.stopping) {
          await this.start();
        }
      });

      this.child.on('error', error => {
        console.error(`Failed to start OIBus: "${error.message}"`);
      });
    } catch (err) {
      console.error(err);
      this.updated = false;
      this.stop();
      await this.rollback();
      await this.start();
      return;
    }

    this.startedTimeout = setTimeout(this.handleOibusStarted.bind(this), STARTED_DELAY);
  }

  stop(): void {
    console.log('Stopping OIBus');
    this.stopping = true;
    if (this.child) {
      this.child.kill('SIGINT');
      this.child = null;
    }
  }

  getOibusExecutable(): string {
    return os.type() === 'Windows_NT' ? 'oibus.exe' : 'oibus';
  }

  getOibusPath(): string {
    return path.resolve(this.workDir, this.getOibusExecutable());
  }

  getOibusUpdatePath(): string {
    return path.resolve(this.updateDir, 'binaries', this.getOibusExecutable());
  }

  getOibusBackupPath(): string {
    return path.resolve(this.backupDir, this.getOibusExecutable());
  }

  async checkForUpdate(): Promise<boolean> {
    const oibusUpdatePath = this.getOibusUpdatePath();
    console.log(`Checking for OIBus update: ${oibusUpdatePath}`);
    return await filesExists(oibusUpdatePath);
  }

  async update(): Promise<void> {
    let backupFolders = RegExp('cache/*');
    try {
      const settings = JSON.parse(await fs.readFile(path.resolve('./', UPDATE_SETTINGS_FILE), 'utf8'));
      backupFolders = RegExp(settings?.backupFolders || 'cache/*');
    } catch (error: unknown) {
      console.error((error as Error).message);
    }
    const oibusUpdatePath = this.getOibusUpdatePath();
    const oibusBinaryPath = this.getOibusPath();
    const oibusBinaryBackupPath = this.getOibusBackupPath();

    await fs.rm(path.resolve(this.backupDir, 'data-folder'), { recursive: true, force: true });

    await createFolder(this.backupDir);
    console.log(`Backup OIBus: ${oibusBinaryPath} -> ${oibusBinaryBackupPath}`);
    await fs.rename(oibusBinaryPath, oibusBinaryBackupPath);

    await this.backupDataFolder(backupFolders);

    console.log(`Updating OIBus: ${oibusUpdatePath} -> ${oibusBinaryPath}`);
    await fs.rename(oibusUpdatePath, oibusBinaryPath);

    for (const file of await fs.readdir(this.updateDir)) {
      try {
        await fs.rm(path.join(this.updateDir, file), { recursive: true, force: true });
      } catch (e) {
        console.error(e);
      }
    }
    this.updated = true;
  }

  async rollback(): Promise<void> {
    const oibusPath = this.getOibusPath();
    const oibusBackupPath = this.getOibusBackupPath();

    console.log(`Rollback OIBus: ${oibusBackupPath} -> ${oibusPath}`);
    await fs.rename(oibusBackupPath, oibusPath);

    console.log(`Rollback OIBus data folder: ${path.resolve(this.backupDir, 'data-folder')} -> ${this.config}`);
    await fs.cp(path.resolve(this.backupDir, 'data-folder'), this.config, { force: true, recursive: true });

    await fs.rm(path.resolve(this.backupDir, 'data-folder'), { recursive: true, force: true });
  }

  async handleOibusStarted(): Promise<void> {
    if (this.startedTimeout) {
      clearTimeout(this.startedTimeout);
      this.startedTimeout = null;
    }

    this.updated = false;
    await fs.rm(path.resolve(this.backupDir, 'data-folder'), { recursive: true, force: true });
  }

  async backupDataFolder(backupsFolders: RegExp): Promise<void> {
    await fs.rm(path.resolve(this.backupDir, 'data-folder'), { recursive: true, force: true });
    await createFolder(path.resolve(this.backupDir, 'data-folder'));
    console.log(`Back up data folder with regex ${backupsFolders}`);
    await this.copyFilesAndDirectoriesRecursively(this.config, path.resolve(this.backupDir, 'data-folder'), backupsFolders);
  }

  async copyFilesAndDirectoriesRecursively(srcDir: string, destDir: string, pattern: RegExp): Promise<void> {
    const entries = await fs.readdir(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      // Test the full path from the based directory. For example, cache/* back up recursively all files and directory under
      // the cache folder
      if (entry.isDirectory() && pattern.test(path.resolve(entry.parentPath, entry.name).split(this.config)[1])) {
        // Only create and recurse if the directory name matches the pattern
        await fs.mkdir(destPath, { recursive: true });
        await this.copyFilesAndDirectoriesRecursively(srcPath, destPath, pattern);
      } else if (entry.isFile() && pattern.test(path.resolve(entry.parentPath, entry.name).split(this.config)[1])) {
        // Copy the file if it matches the pattern
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}
