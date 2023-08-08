import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ChildProcessWithoutNullStreams } from 'child_process';
import * as os from 'os';

const STARTED_DELAY = 30000;

export default class Launcher {
  private updated: boolean = false;
  private startedTimeout: NodeJS.Timeout | null = null;

  constructor(
    private workDir: string,
    private updateDir: string,
    private backupDir: string,
    private config: string,
    private check: boolean
  ) {}

  private child: ChildProcessWithoutNullStreams | null = null;
  private stopping = false;

  start(): void {
    const oibusPath = this.getOibusPath();

    if (this.checkForUpdate() && !this.check) {
      this.update();
    }

    const args = ['--config', this.config];
    if (this.check) {
      args.push('--check');
    }
    console.log(`Starting OIBus: ${oibusPath} ${args.join(' ')}`);
    this.child = spawn(oibusPath, args, { cwd: this.workDir });

    this.child.stdout.on('data', data => {
      console.info(`OIBus stdout: "${data.toString()}"`);
    });

    this.child.stderr.on('data', data => {
      console.error(`OIBus stderr: "${data.toString()}"`);
    });

    this.child.on('close', code => {
      console.info(`OIBus closed with code: ${code}`);

      if (this.updated) {
        this.updated = false;
        this.stop();
        this.rollback();
        this.start();

        return;
      }

      if (this.check) {
        console.info('OIBus launcher started in check mode. Exiting process.');
        process.exit();
      }
      if (!this.stopping) {
        this.start();
      }
    });

    this.child.on('error', error => {
      console.error(`Failed to start OIBus: "${error.message}"`);
    });

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
    return path.resolve(this.updateDir, this.getOibusExecutable());
  }

  getOibusBackupPath(): string {
    return path.resolve(this.backupDir, this.getOibusExecutable());
  }

  checkForUpdate(): boolean {
    const oibusUpdatePath = this.getOibusUpdatePath();
    console.log(`Checking for OIBus update: ${oibusUpdatePath}`);
    return fs.existsSync(oibusUpdatePath);
  }

  update(): void {
    const oibusUpdatePath = this.getOibusUpdatePath();
    const oibusPath = this.getOibusPath();
    const oibusBackupPath = this.getOibusBackupPath();

    console.log(`Backup OIBus: ${oibusPath} -> ${oibusBackupPath}`);
    fs.renameSync(oibusPath, oibusBackupPath);

    console.log(`Updating OIBus: ${oibusUpdatePath} -> ${oibusPath}`);
    fs.renameSync(oibusUpdatePath, oibusPath);

    this.updated = true;
  }

  rollback(): void {
    const oibusPath = this.getOibusPath();
    const oibusBackupPath = this.getOibusBackupPath();

    console.log(`Rollback OIBus: ${oibusBackupPath} -> ${oibusPath}`);
    fs.renameSync(oibusBackupPath, oibusPath);
  }

  handleOibusStarted(): void {
    if (this.startedTimeout) {
      clearTimeout(this.startedTimeout);
      this.startedTimeout = null;
    }

    this.updated = false;
  }
}
