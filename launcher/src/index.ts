import path from 'node:path';
import minimist from 'minimist';

import Launcher from './launcher';

const workDir = path.resolve(__dirname, 'binaries');
const updateDir = path.resolve(__dirname, 'update');
const backupDir = path.resolve(__dirname, 'backup');

const args = minimist(process.argv.slice(2));
const { config = './', check = false } = args;

const launcher = new Launcher(workDir, updateDir, backupDir, path.resolve(config), check);
launcher.start();

let stopping = false;
// Catch Ctrl+C and properly stop OIBus and the Launcher
process.on('SIGINT', () => {
  if (stopping) {
    return;
  }

  console.info('SIGINT (Ctrl+C) received. Stopping everything.');
  stopping = true;

  launcher.stop();
});
