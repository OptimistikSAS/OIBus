import { Knex } from 'knex';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createFolder, getCommandLineArguments } from '../../service/utils';

const { configFile } = getCommandLineArguments();

const DATA_FOLDER_PATH = path.resolve(configFile);
const CACHE_FOLDER_PATH = path.resolve(DATA_FOLDER_PATH, 'cache');
const ARCHIVE_FOLDER_PATH = path.resolve(DATA_FOLDER_PATH, 'archive');
const ERROR_FOLDER_PATH = path.resolve(DATA_FOLDER_PATH, 'error');

export async function up(_knex: Knex): Promise<void> {
  console.info('\n[FolderStructureMigration]', 'Started migrating archive location');

  await createFolder(ARCHIVE_FOLDER_PATH);
  console.info('[FolderStructureMigration]', 'Created archive folder');

  await createFolder(ERROR_FOLDER_PATH);
  console.info('[FolderStructureMigration]', 'Created error folder');

  console.info('[FolderStructureMigration]', 'Refactoring data stream');
  await refactorDataStream();

  console.info('[FolderStructureMigration]', 'Refactoring history query');
  await refactorHistoryQuery();

  console.info('[FolderStructureMigration]', 'Finished migrating archive location\n');
}

export async function down(): Promise<void> {
  return;
}

async function refactorDataStream() {
  const dataStreamFolderPath = path.join(CACHE_FOLDER_PATH, 'data-stream');
  const exists = await folderExists(dataStreamFolderPath);

  console.info(`Folder /cache/data-stream ${exists ? 'exists' : 'does not exist, skipping'}`);
  if (!exists) {
    return;
  }

  // 1. Move North folders
  const northFolderNames = await getNorthFolderNames(dataStreamFolderPath);

  for (const northFolderName of northFolderNames) {
    let sourceNorthFolderPath = path.join(dataStreamFolderPath, northFolderName);

    // a. handling /cache/data-stream/north-id -> /cache/north-id
    console.info(`\nMoving folder /cache/data-stream/${northFolderName} -> /cache/${northFolderName}`);
    const destNorthFolderPath = path.join(CACHE_FOLDER_PATH, northFolderName);
    await moveFolder(sourceNorthFolderPath, destNorthFolderPath);
    sourceNorthFolderPath = destNorthFolderPath;

    // b. handling /cache/north-id/values        -> /cache/north-id/time-values
    //             /cache/north-id/values-errors -> /errors/north-id/time-values
    console.info(`\nMoving folder /cache/${northFolderName}/values -> /cache/${northFolderName}/time-values`);
    await moveFolder(path.join(sourceNorthFolderPath, 'values'), path.join(sourceNorthFolderPath, 'time-values'));

    console.info(`\nMoving folder /cache/${northFolderName}/values-errors -> /errors/${northFolderName}/time-values`);
    await moveFolder(path.join(sourceNorthFolderPath, 'values-errors'), path.join(ERROR_FOLDER_PATH, northFolderName, 'time-values'));

    // c. handling /cache/north-id/files-errors -> /errors/north-id/files
    console.info(`\nMoving folder /cache/${northFolderName}/files-errors -> /errors/${northFolderName}/files`);
    await moveFolder(path.join(sourceNorthFolderPath, 'files-errors'), path.join(ERROR_FOLDER_PATH, northFolderName, 'files'));

    // d. handling /cache/north-id/archive -> /archive/north-id/files
    console.info(`\nMoving folder /cache/${northFolderName}/archive -> /archive/${northFolderName}/files`);
    await moveFolder(path.join(sourceNorthFolderPath, 'archive'), path.join(ARCHIVE_FOLDER_PATH, northFolderName, 'files'));
  }

  // 2. Move South folders
  const southFolderNames = await getSouthFolderNames(dataStreamFolderPath);

  for (const southFolderName of southFolderNames) {
    const sourceSouthFolderPath = path.join(dataStreamFolderPath, southFolderName);

    // a. handling /cache/data-stream/south-id -> /cache/south-id
    console.info(`\nMoving folder /cache/data-stream/${southFolderName} -> /cache/${southFolderName}`);
    const destSouthFolderPath = path.join(CACHE_FOLDER_PATH, southFolderName);
    await moveFolder(sourceSouthFolderPath, destSouthFolderPath);
  }

  // 3. Remove data-stream folder
  console.info('\nRemoving /cache/data-stream\n');
  await fs.rm(dataStreamFolderPath, { recursive: true, force: true });
}

async function refactorHistoryQuery() {
  const historyQueryFolderPath = path.join(CACHE_FOLDER_PATH, 'history-query');
  const exists = await folderExists(historyQueryFolderPath);

  console.info(`Folder /cache/history-query ${exists ? 'exists' : 'does not exist, skipping'}`);
  if (!exists) {
    return;
  }

  const historyFolderNames = await getHistoryFolders(historyQueryFolderPath);

  // 1. Move History Query North folders
  // South folders remain unchanged
  for (const historyFolderName of historyFolderNames) {
    let sourceHistoryFolderPath = path.join(historyQueryFolderPath, historyFolderName);

    // a. handling /cache/history-query/history-id -> /cache/history-id
    console.info(`\nMoving folder /cache/history-query/${historyFolderName} -> /cache/${historyFolderName}`);
    const destHistoryFolderPath = path.join(CACHE_FOLDER_PATH, historyFolderName);
    await moveFolder(sourceHistoryFolderPath, destHistoryFolderPath);
    sourceHistoryFolderPath = destHistoryFolderPath;

    // b. handling /cache/history-id/north/values        -> /cache/history-id/north/time-values
    //             /cache/history-id/north/values-errors -> /errors/history-id/north/time-values
    console.info(`\nMoving folder /cache/${historyFolderName}/north/values -> /cache/${historyFolderName}/north/time-values`);
    await moveFolder(path.join(sourceHistoryFolderPath, 'north', 'values'), path.join(sourceHistoryFolderPath, 'north', 'time-values'));

    console.info(`\nMoving folder /cache/${historyFolderName}/north/values-errors -> /errors/${historyFolderName}/north/time-values`);
    await moveFolder(
      path.join(sourceHistoryFolderPath, 'north', 'values-errors'),
      path.join(ERROR_FOLDER_PATH, historyFolderName, 'north', 'time-values')
    );

    // c. handling /cache/history-id/north/files-errors -> /errors/history-id/north/files
    console.info(`\nMoving folder /cache/${historyFolderName}/north/files-errors -> /errors/${historyFolderName}/north/files`);
    await moveFolder(
      path.join(sourceHistoryFolderPath, 'north', 'files-errors'),
      path.join(ERROR_FOLDER_PATH, historyFolderName, 'north', 'files')
    );

    // d. handling /cache/history-id/north/archive -> /archive/history-id/north/files
    console.info(`\nMoving folder /cache/${historyFolderName}/north/archive -> /archive/${historyFolderName}/north/files`);
    await moveFolder(
      path.join(sourceHistoryFolderPath, 'north', 'archive'),
      path.join(ARCHIVE_FOLDER_PATH, historyFolderName, 'north', 'files')
    );
  }

  // 3. Remove history-query folder
  console.info('\nRemoving /cache/history-query\n');
  await fs.rm(historyQueryFolderPath, { recursive: true, force: true });
}

// Helpers

/**
 * Moves the contents from sourcePath to destPath, then deletes sourcePath
 * @throws {Error}
 */
async function moveFolder(sourcePath: string, destPath: string) {
  if (await folderExists(sourcePath)) {
    await moveContents(sourcePath, destPath);
    await fs.rm(sourcePath, { recursive: true, force: true });
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

async function getNorthFolderNames(baseFolder: string): Promise<Array<string>> {
  const entries = await fs.readdir(baseFolder);
  return entries.filter(entry => entry.startsWith('north-'));
}

async function getSouthFolderNames(baseFolder: string): Promise<Array<string>> {
  const entries = await fs.readdir(baseFolder);
  return entries.filter(entry => entry.startsWith('south-'));
}

async function getHistoryFolders(baseFolder: string): Promise<Array<string>> {
  const entries = await fs.readdir(baseFolder);
  return entries.filter(entry => entry.startsWith('history-'));
}

async function moveContents(sourcePath: string, destPath: string, depth = 1): Promise<void> {
  const entries = await fs.readdir(sourcePath, { withFileTypes: true });
  await createFolder(destPath);

  console.info(`${'\t'.repeat(depth - 1)}Moving contents ${shortenPath(sourcePath)} -> ${shortenPath(destPath)}`);

  for (const entry of entries) {
    const sourceItemPath = path.join(sourcePath, entry.name);
    const destItemPath = path.join(destPath, entry.name);

    if (entry.isDirectory()) {
      await moveContents(sourceItemPath, destItemPath);
      // Remove the source directory after moving its contents
      await fs.rm(sourceItemPath, { recursive: true, force: true });
    } else {
      await fs.rename(sourceItemPath, destItemPath);
      console.info(`${'\t'.repeat(depth)}Moved ${shortenPath(sourceItemPath)} -> ${shortenPath(destItemPath)}`);
    }
  }
}

function shortenPath(path: string) {
  return path.startsWith(DATA_FOLDER_PATH) ? path.slice(DATA_FOLDER_PATH.length) : path;
}
