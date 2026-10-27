import fs from 'node:fs/promises';
import path from 'node:path';

import { Knex } from 'knex';

import { filesExists, getCommandLineArguments } from '../../../../service/utils';

const { configFile } = getCommandLineArguments();

const METADATA_FOLDER = 'metadata';

const DATA_FOLDER_PATH = path.resolve(configFile);

/**
 * The setpoints sent by OIAnalytics are records: the setpoints still waiting in the caches (or kept in the error and
 * archive folders) become record lists, their content (a JSON array of `{ reference, value }`) being kept as it is.
 *
 * Targets the `cache`, `error` and `archive` folders of:
 *   - north-<id>/          (North connectors)
 *   - history-<id>/north/  (history queries)
 */
export async function up(_knex: Knex): Promise<void> {
  let converted = 0;
  for (const root of ['cache', 'error', 'archive']) {
    const rootPath = path.resolve(DATA_FOLDER_PATH, root);
    let folders: Array<string> = [];
    try {
      folders = await fs.readdir(rootPath);
    } catch {
      continue;
    }
    for (const folder of folders) {
      if (folder.startsWith('north-')) {
        converted += await convertToRecordLists(path.join(rootPath, folder));
      } else if (folder.startsWith('history-')) {
        converted += await convertToRecordLists(path.join(rootPath, folder, 'north'));
      }
    }
  }
  if (converted > 0) {
    console.info(`Converted ${converted} cached setpoint file(s) into record lists`);
  }
}

async function convertToRecordLists(folder: string): Promise<number> {
  const metadataFolder = path.join(folder, METADATA_FOLDER);
  if (!(await filesExists(metadataFolder))) return 0;

  let converted = 0;
  for (const filename of await fs.readdir(metadataFolder)) {
    const metadataPath = path.join(metadataFolder, filename);
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8')) as { contentType: string };
      if (metadata.contentType !== 'setpoint') continue;
      await fs.writeFile(metadataPath, JSON.stringify({ ...metadata, contentType: 'record-list' }));
      converted++;
    } catch (error: unknown) {
      console.error(`Error while converting the cached file "${metadataPath}": ${(error as Error).message}`);
    }
  }
  return converted;
}

export async function down(): Promise<void> {
  return;
}
