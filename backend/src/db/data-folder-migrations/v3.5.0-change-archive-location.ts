import { Knex } from 'knex';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createFolder, getCommandLineArguments } from '../../../src/service/utils';

const { configFile } = getCommandLineArguments();

const DATA_FOLDER = path.resolve(configFile);
const CACHE_FOLDER = `${DATA_FOLDER}/cache`;
const ARCHIVE_FOLDER = `${DATA_FOLDER}/archive`;
const ERROR_FOLDER = `${DATA_FOLDER}/error`;

export async function up(_knex: Knex): Promise<void> {
  log('Started migrating archive location');

  // Create new folders
  await createFolder(ARCHIVE_FOLDER);
  log('Created archive folder');

  await createFolder(ERROR_FOLDER);
  log('Created error folder');

  await refactorDataStream();
  await refactorHistoryQuery();

  log('Finished migrating archive location');
  process.exit();
}

export async function down(): Promise<void> {
  return;
}

async function refactorDataStream() {
  const baseFolder = path.join(CACHE_FOLDER, 'data-stream');
  const exists = await folderExists(baseFolder);

  log(`Folder cache/data-stream ${exists ? 'exists' : 'does not exist, skipping'}`);
  if (!exists) {
    return;
  }

  // 1. Refactor cache folder
  const northFolders = await getNorthFolders(baseFolder);

  // Move values to new location
  for (const northFolderName of northFolders) {
    const northFolder = path.join(baseFolder, northFolderName);
    log(`Processing "values" folder for: ${northFolderName}`);

    const sourcePath = path.join(northFolder, 'values');
    const destPath = path.join(northFolder, 'time-values');

    try {
      await moveFolder(sourcePath, destPath);
    } catch (error) {
      log(`Error removing folder ${northFolderName}/values:`, error);
    }

    log(`Finished processing "values" folders for: ${northFolderName}`);
  }

  // 2. Refactor error folder
  for (const northFolderName of northFolders) {
    const northFolder = path.join(baseFolder, northFolderName);
    log(`Processing "values-error" and "files-error" folders for: ${northFolderName}`);

    // Move north folders
    for (const [oldName, newName] of [
      ['values-errors', 'values'],
      ['files-errors', 'files']
    ]) {
      const sourcePath = path.join(northFolder, oldName);
      const destPath = path.join(ERROR_FOLDER, 'data-stream', northFolderName, newName);

      try {
        await moveFolder(sourcePath, destPath);
      } catch (error) {
        log(`Error moving folder ${northFolderName}/${oldName}:`, error);
      }
    }
  }

  // 3. Refactor archive folder
  for (const northFolderName of northFolders) {
    log(`Processing "archive" folder for: ${northFolderName}`);

    const sourcePath = path.join(baseFolder, northFolderName, 'archive');
    const destPath = path.join(ARCHIVE_FOLDER, 'data-stream', northFolderName, 'files');

    try {
      await moveFolder(sourcePath, destPath);
    } catch (error) {
      log(`Error moving folder ${northFolderName}/archive:`, error);
    }

    log(`Finished processing archive folder for: ${northFolderName}`);
  }
}

async function refactorHistoryQuery() {
  const baseFolder = path.join(CACHE_FOLDER, 'history-query');
  const exists = await folderExists(baseFolder);

  log(`Folder cache/history-query ${exists ? 'exists' : 'does not exist, skipping'}`);
  if (!exists) {
    return;
  }

  // 1. Refactor cache folder
  const historyFolders = await getHistoryFolders(baseFolder);

  // Move values to new location
  for (const historyFolderName of historyFolders) {
    const historyFolder = path.join(baseFolder, historyFolderName, 'north');
    log(`Processing "values" folder for: ${historyFolderName}`);

    const sourcePath = path.join(historyFolder, 'values');
    const destPath = path.join(historyFolder, 'time-values');

    try {
      await moveFolder(sourcePath, destPath);
    } catch (error) {
      log(`Error removing folder ${historyFolderName}/north/values:`, error);
    }

    log(`Finished processing "values" folders for: ${historyFolderName}`);
  }

  // 2. Refactor error folder
  for (const historyFolderName of historyFolders) {
    const historyFolder = path.join(baseFolder, historyFolderName, 'north');
    log(`Processing "values-error" and "files-error" folders for: ${historyFolderName}`);

    // Move north folders
    for (const [oldName, newName] of [
      ['values-errors', 'values'],
      ['files-errors', 'files']
    ]) {
      const sourcePath = path.join(historyFolder, oldName);
      const destPath = path.join(ERROR_FOLDER, 'history-query', historyFolderName, 'north', newName);

      try {
        await moveFolder(sourcePath, destPath);
      } catch (error) {
        log(`Error moving folder ${historyFolderName}/north/${oldName}:`, error);
      }
    }
  }

  // 3. Refactor archive folder
  for (const historyFolderName of historyFolders) {
    log(`Processing "archive" folder for: ${historyFolderName}`);

    const sourcePath = path.join(baseFolder, historyFolderName, 'north', 'archive');
    const destPath = path.join(ARCHIVE_FOLDER, 'history-query', historyFolderName, 'north', 'files');

    try {
      await moveFolder(sourcePath, destPath);
    } catch (error) {
      log(`Error moving folder ${historyFolderName}/north/archive:`, error);
    }

    log(`Finished processing archive folder for: ${historyFolderName}`);
  }
}

// Helpers

function log(...message: any[]) {
  console.log('[FolderStructureMigration] ', ...message);
}

/**
 * @throws {Error}
 */
async function moveFolder(sourcePath: string, destPath: string) {
  if (await folderExists(sourcePath)) {
    await moveContents(sourcePath, destPath);
    await fs.rmdir(sourcePath);
  }
}

async function folderExists(folderPath: string): Promise<boolean> {
  try {
    await fs.access(folderPath);
    return true;
  } catch {
    return false;
  }
}

async function getNorthFolders(baseFolder: string): Promise<string[]> {
  const entries = await fs.readdir(baseFolder);
  return entries.filter(entry => entry.startsWith('north-'));
}

async function getHistoryFolders(baseFolder: string): Promise<string[]> {
  const entries = await fs.readdir(baseFolder);
  return entries.filter(entry => entry.startsWith('history-'));
}

async function moveContents(sourcePath: string, destPath: string, depth = 1): Promise<void> {
  const entries = await fs.readdir(sourcePath, { withFileTypes: true });
  await createFolder(destPath);

  console.log(`${'\t'.repeat(depth - 1)}Moving contents (${sourcePath} -> ${destPath})`);

  for (const entry of entries) {
    const sourceItemPath = path.join(sourcePath, entry.name);
    const destItemPath = path.join(destPath, entry.name);

    if (entry.isDirectory()) {
      await moveContents(sourceItemPath, destItemPath);
      // Remove the source directory after moving its contents
      await fs.rmdir(sourceItemPath);
    } else {
      await fs.rename(sourceItemPath, destItemPath);
      console.log(`${'\t'.repeat(depth)}Moved ${sourceItemPath} -> ${destItemPath}`);
    }
  }
}
