import path from 'node:path';
import minimist from 'minimist';

import Launcher from './launcher';
import UserRepository from './user.repository';
import { parseBooleanOption, removeLauncherOnlyArguments } from './utils';

const workDir = path.resolve(process.cwd(), 'binaries');
const updateDir = path.resolve(process.cwd(), 'update');
const backupDir = path.resolve(process.cwd(), 'backup');

let launcher: Launcher | null = null;

const main = async (): Promise<void> => {
  const args = minimist(process.argv.slice(2), {
    boolean: ['version'],
    string: ['config', 'reset-password']
  });
  const { config = './', version = false } = args;
  const resetPassword = parseBooleanOption(args['reset-password']);
  const resolvedConfig = path.resolve(config);

  if (resetPassword) {
    try {
      const repository = new UserRepository(path.resolve(resolvedConfig, 'oibus.db'));
      await repository.resetAdmin();
      console.info('Admin user reset to default credentials.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to reset admin user: ${message}`);
      process.exitCode = 1;
    }
    return;
  }

  const sanitizedArgs = removeLauncherOnlyArguments(process.argv.slice(1));
  launcher = new Launcher(workDir, updateDir, backupDir, resolvedConfig, version, sanitizedArgs);
  launcher.start();
};

void main();

let stopping = false;
// Catch Ctrl+C and properly stop OIBus and the Launcher
process.on('SIGINT', () => {
  if (stopping) {
    return;
  }

  console.info('SIGINT (Ctrl+C) received. Stopping everything.');
  stopping = true;

  launcher?.stop();
});
