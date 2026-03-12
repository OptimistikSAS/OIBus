import { Knex } from 'knex';
import fs from 'node:fs/promises';
import path from 'node:path';
import { filesExists, getCommandLineArguments } from '../../service/utils';
import { Instant } from '../../../shared/model/types';

const { configFile } = getCommandLineArguments();

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
  const rootFolders = await fs.readdir(DATA_FOLDER_PATH);
  const cacheFolders = await fs.readdir(CACHE_FOLDER_PATH);
  const errorFolders = await fs.readdir(ERROR_FOLDER_PATH);
  const archiveFolders = await fs.readdir(ARCHIVE_FOLDER_PATH);
  await removeSouthErrorAndArchiveFolders(
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
  try {
    const metadataFiles = await fs.readdir(path.join(folder, METADATA_FOLDER));
    const newContentFiles: Array<string> = [];
    for (const metadataFile of metadataFiles) {
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
        newContentFiles.push(filenameWithoutExtension);
      } catch (error: unknown) {
        console.error(`Error while migrating file "${metadataFile}": ${(error as Error).message}`);
        if (await filesExists(path.join(folder, CONTENT_FOLDER, metadataFile))) {
          await fs.rm(path.join(folder, CONTENT_FOLDER, metadataFile), { recursive: true }).catch(e => console.error(e));
        }
        if (await filesExists(path.join(folder, CONTENT_FOLDER, filenameWithoutExtension))) {
          await fs.rm(path.join(folder, CONTENT_FOLDER, filenameWithoutExtension), { recursive: true }).catch(e => console.error(e));
        }
        if (await filesExists(path.join(folder, METADATA_FOLDER, metadataFile))) {
          await fs.rm(path.join(folder, METADATA_FOLDER, metadataFile), { recursive: true }).catch(e => console.error(e));
        }
        if (await filesExists(path.join(folder, METADATA_FOLDER, filenameWithoutExtension))) {
          await fs.rm(path.join(folder, METADATA_FOLDER, filenameWithoutExtension), { recursive: true }).catch(e => console.error(e));
        }
      }
    }
    const contentFiles = await fs.readdir(path.join(folder, CONTENT_FOLDER));
    console.info(`Removing unlinked content files`);
    for (const contentFile of contentFiles) {
      if (!newContentFiles.includes(contentFile)) {
        await fs.rm(path.join(folder, CONTENT_FOLDER, contentFile)).catch(e => console.error(e));
      }
    }
  } catch (error: unknown) {
    console.error(`Error while migrating folder ${folder}: ${(error as Error).message}`);
  }
}

async function removeSouthErrorAndArchiveFolders(errorFolders: Array<string>, archiveFolders: Array<string>): Promise<void> {
  console.info(`Removing "south-" folders from  ${ERROR_FOLDER_PATH}`);
  for (const folder of errorFolders) {
    try {
      await fs.rm(path.join(ERROR_FOLDER_PATH, folder), { recursive: true, force: true });
    } catch (error: unknown) {
      console.error(`Error while removing error folder ${folder}: ${(error as Error).message}`);
    }
  }

  console.info(`Removing "south-" folders from  ${ARCHIVE_FOLDER_PATH}`);
  for (const folder of archiveFolders) {
    try {
      await fs.rm(path.join(ARCHIVE_FOLDER_PATH, folder), { recursive: true, force: true });
    } catch (error: unknown) {
      console.error(`Error while removing archive folder ${folder}: ${(error as Error).message}`);
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
