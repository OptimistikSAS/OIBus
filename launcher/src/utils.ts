import fs from 'node:fs/promises';
import path from 'node:path';
import { version } from '../package.json';

export const replaceConfigArgumentWithAbsolutePath = (argumentsList: Array<string>, absoluteConfigPath: string): Array<string> => {
  const args = [...argumentsList];
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

export const removeLauncherOnlyArguments = (args: Array<string>): Array<string> => {
  const filteredArgs: Array<string> = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--reset-password' || argument.startsWith('--reset-password=')) {
      if (argument === '--reset-password') {
        const possibleValue = args[index + 1];
        if (possibleValue !== undefined && !possibleValue.startsWith('--')) {
          index += 1;
        }
      }
      continue;
    }

    filteredArgs.push(argument);
  }
  return filteredArgs;
};

/**
 * Parse a boolean option from various input types
 */
export const parseBooleanOption = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return false;
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
