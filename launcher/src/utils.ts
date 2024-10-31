import fs from 'node:fs/promises';
import path from 'node:path';
import { version } from '../package.json';

export const replaceConfigArgumentWithAbsolutePath = (args: Array<string>, absoluteConfigPath: string): Array<string> => {
  const foundIndex = args.findIndex(element => element === '--config');
  // Find the index of the target element
  const targetIndex = args.indexOf('--config');

  if (targetIndex !== -1) {
    // Insert the new element after the target element
    args[foundIndex + 1] = absoluteConfigPath;
  }
  args.push('--launcherVersion');
  args.push(version);
  return args;
};

/**
 * Method to return a delayed promise.
 */
export const delay = async (timeout: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, timeout);
  });

/**
 * Create a folder if it does not exist
 */
export const createFolder = async (folder: string): Promise<void> => {
  const folderPath = path.resolve(folder);
  try {
    await fs.stat(folderPath);
  } catch {
    await fs.mkdir(folderPath, { recursive: true });
  }
};

/**
 * Check if a file exists in async way
 */
export const filesExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.stat(filePath);
  } catch {
    return false;
  }
  return true;
};
