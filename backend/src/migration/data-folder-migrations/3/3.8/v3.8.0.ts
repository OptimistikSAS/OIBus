import { Knex } from 'knex';
import fs from 'node:fs/promises';
import path from 'node:path';
import { filesExists, getCommandLineArguments } from '../../../../service/utils';

const { configFile } = getCommandLineArguments();

type Instant = string;

const CONTENT_FOLDER = 'content';
const METADATA_FOLDER = 'metadata';

const DATA_FOLDER_PATH = path.resolve(configFile);
const CACHE_FOLDER_PATH = path.resolve(DATA_FOLDER_PATH, 'cache');
const ARCHIVE_FOLDER_PATH = path.resolve(DATA_FOLDER_PATH, 'archive');
const ERROR_FOLDER_PATH = path.resolve(DATA_FOLDER_PATH, 'error');

export interface CacheMetadata {
  contentFile: string;
  contentSize: number;
  numberOfElement: number;
  createdAt: Instant;
  contentType: string;
}

export async function up(_knex: Knex): Promise<void> {
  let rootFolders: Array<string> = [];
  try {
    rootFolders = await fs.readdir(DATA_FOLDER_PATH);
  } catch (error: unknown) {
    console.error(`Error while reading root folder: ${(error as Error).message}`);
  }

  let cacheFolders: Array<string> = [];
  try {
    cacheFolders = await fs.readdir(CACHE_FOLDER_PATH);
  } catch (error: unknown) {
    console.error(`Error while reading cache folder: ${(error as Error).message}`);
  }
  let errorFolders: Array<string> = [];
  try {
    errorFolders = await fs.readdir(ERROR_FOLDER_PATH);
  } catch (error: unknown) {
    console.error(`Error while reading error folder: ${(error as Error).message}`);
  }
  let archiveFolders: Array<string> = [];
  try {
    archiveFolders = await fs.readdir(ARCHIVE_FOLDER_PATH);
  } catch (error: unknown) {
    console.error(`Error while reading archive folder: ${(error as Error).message}`);
  }

  await removeLegacySouthFolders(
    cacheFolders.filter(name => name.startsWith('south-')),
    errorFolders.filter(name => name.startsWith('south-')),
    archiveFolders.filter(name => name.startsWith('south-'))
  );

  const northCacheFolders = cacheFolders.filter(folder => folder.startsWith('north-'));
  const northErrorFolders = errorFolders.filter(folder => folder.startsWith('north-'));
  const northArchiveFolders = archiveFolders.filter(folder => folder.startsWith('north-'));
  const historyCacheFolders = cacheFolders.filter(folder => folder.startsWith('history-'));
  const historyErrorFolders = errorFolders.filter(folder => folder.startsWith('history-'));
  const historyArchiveFolders = archiveFolders.filter(folder => folder.startsWith('history-'));

  for (const folder of northCacheFolders) {
    await refactorNorthContent(path.join(CACHE_FOLDER_PATH, folder));
  }
  for (const folder of northErrorFolders) {
    await refactorNorthContent(path.join(ERROR_FOLDER_PATH, folder));
  }
  for (const folder of northArchiveFolders) {
    await refactorNorthContent(path.join(ARCHIVE_FOLDER_PATH, folder));
  }
  for (const folder of historyCacheFolders) {
    await refactorNorthContent(path.join(CACHE_FOLDER_PATH, folder, 'north'));
  }
  for (const folder of historyErrorFolders) {
    await refactorNorthContent(path.join(ERROR_FOLDER_PATH, folder, 'north'));
  }
  for (const folder of historyArchiveFolders) {
    await refactorNorthContent(path.join(ARCHIVE_FOLDER_PATH, folder, 'north'));
  }

  // Cleanup opcua legacy tests folder
  await removeOPCUATestFolders(rootFolders.filter(folder => folder.startsWith('opcua-')));
}

async function refactorNorthContent(folder: string): Promise<void> {
  console.info(`Refactoring folder "${folder}"`);
  let migrated = 0;
  let errored = 0;
  let orphansRemoved = 0;
  try {
    const metadataFiles = await fs.readdir(path.join(folder, METADATA_FOLDER));
    const newContentFiles = new Set<string>();
    for (const metadataFile of metadataFiles) {
      // A metadata file without ".json" extension is the output of a previous
      // (interrupted) run that already migrated this entry. Preserve it so
      // the orphan-cleanup pass below does not delete its content file.
      if (!metadataFile.endsWith('.json')) {
        newContentFiles.add(metadataFile);
        continue;
      }
      const filenameWithoutExtension = path.parse(metadataFile).name;
      try {
        const metadata: CacheMetadata = JSON.parse(
          await fs.readFile(path.join(folder, METADATA_FOLDER, metadataFile), { encoding: 'utf8' })
        );
        await fs.rename(
          path.join(folder, CONTENT_FOLDER, metadata.contentFile),
          path.join(folder, CONTENT_FOLDER, filenameWithoutExtension)
        );
        await fs.rename(path.join(folder, METADATA_FOLDER, metadataFile), path.join(folder, METADATA_FOLDER, filenameWithoutExtension));
        newContentFiles.add(filenameWithoutExtension);
        migrated++;
      } catch (error: unknown) {
        errored++;
        console.error(`Error while migrating file "${metadataFile}": ${(error as Error).message}`);
        // Roll back any partial rename and discard the broken metadata.
        // The "remove unlinked content files" pass below will catch any content orphan.
        if (await filesExists(path.join(folder, CONTENT_FOLDER, filenameWithoutExtension))) {
          await fs.rm(path.join(folder, CONTENT_FOLDER, filenameWithoutExtension)).catch(e => console.error(e));
        }
        if (await filesExists(path.join(folder, METADATA_FOLDER, metadataFile))) {
          await fs.rm(path.join(folder, METADATA_FOLDER, metadataFile)).catch(e => console.error(e));
        }
        if (await filesExists(path.join(folder, METADATA_FOLDER, filenameWithoutExtension))) {
          await fs.rm(path.join(folder, METADATA_FOLDER, filenameWithoutExtension)).catch(e => console.error(e));
        }
      }
    }
    const contentFiles = await fs.readdir(path.join(folder, CONTENT_FOLDER));
    for (const contentFile of contentFiles) {
      if (!newContentFiles.has(contentFile)) {
        await fs.rm(path.join(folder, CONTENT_FOLDER, contentFile)).catch(e => console.error(e));
        orphansRemoved++;
      }
    }
    console.info(
      `Folder "${folder}" migration done: ${migrated} migrated, ${errored} errored, ${orphansRemoved} orphan content files removed`
    );
  } catch (error: unknown) {
    console.error(`Error while migrating folder ${folder}: ${(error as Error).message}`);
  }
}

async function removeLegacySouthFolders(
  cacheFolders: Array<string>,
  errorFolders: Array<string>,
  archiveFolders: Array<string>
): Promise<void> {
  // In 3.8 the south no longer keeps its own per-connector cache/error/archive folders.
  // Drop them outright; any data still inside is unreachable from the new runtime.
  const groups: ReadonlyArray<readonly [string, string, ReadonlyArray<string>]> = [
    ['cache', CACHE_FOLDER_PATH, cacheFolders],
    ['error', ERROR_FOLDER_PATH, errorFolders],
    ['archive', ARCHIVE_FOLDER_PATH, archiveFolders]
  ];
  for (const [label, baseFolder, folders] of groups) {
    if (folders.length === 0) continue;
    console.info(`Removing ${folders.length} legacy "south-" folder(s) from ${baseFolder}`);
    for (const folder of folders) {
      try {
        await fs.rm(path.join(baseFolder, folder), { recursive: true, force: true });
      } catch (error: unknown) {
        console.error(`Error while removing ${label} folder ${folder}: ${(error as Error).message}`);
      }
    }
  }
}

async function removeOPCUATestFolders(opcuaFolders: Array<string>): Promise<void> {
  console.info(`Removing "opcua-" folders from  ${DATA_FOLDER_PATH}`);
  for (const folder of opcuaFolders) {
    try {
      await fs.rm(path.join(DATA_FOLDER_PATH, folder), { recursive: true, force: true });
    } catch (error: unknown) {
      console.error(`Error while removing opcua folder ${folder}: ${(error as Error).message}`);
    }
  }
}

export async function down(): Promise<void> {
  return;
}
