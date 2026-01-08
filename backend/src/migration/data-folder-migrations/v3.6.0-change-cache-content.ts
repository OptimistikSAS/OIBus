import { Knex } from 'knex';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createFolder, generateRandomId, getCommandLineArguments } from '../../service/utils';
import { OIBusTimeValue } from '../../../shared/model/engine.model';
import { DateTime } from 'luxon';
import { Instant } from '../../../shared/model/types';

const { configFile } = getCommandLineArguments();

const CONTENT_FOLDER = 'content';
const METADATA_FOLDER = 'metadata';

const DATA_FOLDER_PATH = path.resolve(configFile);
const CACHE_FOLDER_PATH = path.resolve(DATA_FOLDER_PATH, 'cache');
const ARCHIVE_FOLDER_PATH = path.resolve(DATA_FOLDER_PATH, 'archive');
const ERROR_FOLDER_PATH = path.resolve(DATA_FOLDER_PATH, 'error');

interface CacheMetadata {
  contentFile: string;
  contentSize: number;
  numberOfElement: number;
  createdAt: Instant;
  contentType: string;
  source: string | null;
  options: Record<string, string | number>;
}

export async function up(_knex: Knex): Promise<void> {
  console.info(`[FolderStructureMigration] - Refactoring ${CACHE_FOLDER_PATH}`);
  await refactorCacheStructure(CACHE_FOLDER_PATH);
  console.info(`[FolderStructureMigration] - Refactoring ${ARCHIVE_FOLDER_PATH}`);
  await refactorCacheStructure(ARCHIVE_FOLDER_PATH);
  console.info(`[FolderStructureMigration] - Refactoring ${ERROR_FOLDER_PATH}`);
  await refactorCacheStructure(ERROR_FOLDER_PATH);

  console.info('[FolderStructureMigration] - Finished migrating to cache content');
}

export async function down(): Promise<void> {
  return;
}

async function refactorCacheStructure(folderPath: string) {
  const northFolderNames = await getNorthFolderNames(folderPath);
  for (const northFolderName of northFolderNames) {
    await refactorNorthFolder(path.join(folderPath, northFolderName));
  }

  const historyFolderNames = await getHistoryFolderNames(folderPath);
  for (const historyFolderName of historyFolderNames) {
    await refactorNorthFolder(path.join(folderPath, historyFolderName, 'north'));
  }
}

async function refactorNorthFolder(northFolderPath: string) {
  console.info(`[FolderStructureMigration] - Start migrating cache ${northFolderPath}`);

  const metadataFolder = path.join(northFolderPath, METADATA_FOLDER);
  const contentFolder = path.join(northFolderPath, CONTENT_FOLDER);
  await createFolder(metadataFolder);
  await createFolder(contentFolder);

  const fileSourceNorthFolderPath = path.join(northFolderPath, 'files');
  if (await folderExists(fileSourceNorthFolderPath)) {
    const cacheFiles = await fs.readdir(fileSourceNorthFolderPath);
    for (const file of cacheFiles) {
      const sourcePath = path.join(fileSourceNorthFolderPath, file);
      try {
        const contentTargetPath = path.join(contentFolder, file);

        // Create a metadata file
        const randomId = generateRandomId(10);
        const fileStat = await fs.stat(sourcePath);
        const metadata: CacheMetadata = {
          contentFile: file,
          contentSize: fileStat.size,
          numberOfElement: 0,
          createdAt: DateTime.fromMillis(fileStat.ctimeMs).toUTC().toISO()!,
          contentType: 'any',
          source: 'south',
          options: {}
        };
        await fs.rename(sourcePath, contentTargetPath);
        await fs.writeFile(path.join(metadataFolder, `${randomId}.json`), JSON.stringify(metadata), {
          encoding: 'utf8',
          flag: 'w'
        });
      } catch (error: unknown) {
        console.error(`Error while reading raw file "${sourcePath}": ${(error as Error).message}`);
      }
    }
  }

  const timeValuesSourceNorthFolderPath = path.join(northFolderPath, 'time-values');

  if (await folderExists(timeValuesSourceNorthFolderPath)) {
    const cacheTimeValues = await fs.readdir(timeValuesSourceNorthFolderPath);
    for (const file of cacheTimeValues) {
      const sourcePath = path.join(timeValuesSourceNorthFolderPath, file);
      try {
        const randomId = generateRandomId(10);
        const contentTargetPath = path.join(contentFolder, `${randomId}.json`);
        const metadataTargetPath = path.join(metadataFolder, `${randomId}.json`);
        const fileStat = await fs.stat(sourcePath);
        const metadata: CacheMetadata = {
          contentFile: `${randomId}.json`,
          contentSize: fileStat.size,
          numberOfElement: 0,
          createdAt: DateTime.fromMillis(fileStat.ctimeMs).toUTC().toISO()!,
          contentType: 'time-values',
          source: 'south',
          options: {}
        };

        const fileContentString = await fs.readFile(sourcePath, { encoding: 'utf-8' });
        const jsonElements: Array<OIBusTimeValue> = JSON.parse(fileContentString) as Array<OIBusTimeValue>;
        metadata.numberOfElement = jsonElements.length;
        await fs.rename(sourcePath, contentTargetPath);
        await fs.writeFile(metadataTargetPath, JSON.stringify(metadata), {
          encoding: 'utf8',
          flag: 'w'
        });
      } catch (error: unknown) {
        console.error(`Error while reading time-values file "${sourcePath}": ${(error as Error).message}`);
      }
    }
  }

  // 3. Remove data-stream folder
  console.info(`Removing ${fileSourceNorthFolderPath}`);
  await fs.rm(fileSourceNorthFolderPath, { recursive: true, force: true });
  console.info(`Removing ${timeValuesSourceNorthFolderPath}`);
  await fs.rm(timeValuesSourceNorthFolderPath, { recursive: true, force: true });
}

async function getNorthFolderNames(baseFolder: string): Promise<Array<string>> {
  const entries = await fs.readdir(baseFolder);
  return entries.filter(entry => entry.startsWith('north-'));
}

async function getHistoryFolderNames(baseFolder: string): Promise<Array<string>> {
  const entries = await fs.readdir(baseFolder);
  return entries.filter(entry => entry.startsWith('history-'));
}

async function folderExists(folderPath: string): Promise<boolean> {
  try {
    await fs.access(folderPath);
    return true;
  } catch {
    return false;
  }
}
