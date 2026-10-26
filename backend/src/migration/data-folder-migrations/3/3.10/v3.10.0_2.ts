import fs from 'node:fs/promises';
import path from 'node:path';

import { Knex } from 'knex';

import { filesExists, getCommandLineArguments } from '../../../../service/utils';

const { configFile } = getCommandLineArguments();

const METADATA_FOLDER = 'metadata';

const DATA_FOLDER_PATH = path.resolve(configFile);

/**
 * The North File Writer only writes files: the records and setpoints still waiting in its caches (or kept in its error
 * and archive folders) become files, their content (a JSON array) being written as it is.
 *
 * Targets the `cache`, `error` and `archive` folders of:
 *   - north-<id>/          (File Writer North connectors)
 *   - history-<id>/north/  (history queries writing files)
 */
export async function up(knex: Knex): Promise<void> {
  const northIds = await selectIds(knex, 'north_connectors', 'type');
  const historyQueryIds = await selectIds(knex, 'history_queries', 'north_type');
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
      if (folder.startsWith('north-') && northIds.has(folder.slice('north-'.length))) {
        converted += await convertToFiles(path.join(rootPath, folder));
      } else if (folder.startsWith('history-') && historyQueryIds.has(folder.slice('history-'.length))) {
        converted += await convertToFiles(path.join(rootPath, folder, 'north'));
      }
    }
  }
  if (converted > 0) {
    console.info(`Converted ${converted} cached record list or setpoint file(s) of File Writer North connectors into files`);
  }
}

/** The ids of the File Writer North connectors (or history queries); none when the table does not exist yet. */
async function selectIds(knex: Knex, table: string, typeColumn: string): Promise<Set<string>> {
  try {
    const rows: Array<{ id: string }> = await knex(table).select('id').where(typeColumn, 'file-writer');
    return new Set(rows.map(row => row.id));
  } catch {
    return new Set();
  }
}

async function convertToFiles(folder: string): Promise<number> {
  const metadataFolder = path.join(folder, METADATA_FOLDER);
  if (!(await filesExists(metadataFolder))) return 0;

  let converted = 0;
  for (const filename of await fs.readdir(metadataFolder)) {
    const metadataPath = path.join(metadataFolder, filename);
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8')) as { contentType: string };
      if (metadata.contentType !== 'record-list' && metadata.contentType !== 'setpoint') continue;
      await fs.writeFile(metadataPath, JSON.stringify({ ...metadata, contentType: 'file' }));
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
