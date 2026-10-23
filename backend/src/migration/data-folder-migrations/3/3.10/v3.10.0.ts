import fs from 'node:fs/promises';
import path from 'node:path';

import { Knex } from 'knex';

import { filesExists, getCommandLineArguments, NestedPointValue, toPointRecord } from '../../../../service/utils';

const { configFile } = getCommandLineArguments();

const CONTENT_FOLDER = 'content';
const METADATA_FOLDER = 'metadata';

const DATA_FOLDER_PATH = path.resolve(configFile);

/**
 * The `time-values` content type is replaced by `record-list`: the time values still waiting in a North cache (or kept
 * in its error and archive folders) are converted into point records (`{ pointId, timestamp, value, ...extras }`), so
 * the North connectors can still send them. The OIAnalytics North no longer accepts record lists: in its caches, the
 * time values become `oianalytics` content, which it still accepts in this (legacy array) format.
 *
 * Targets the `cache`, `error` and `archive` folders of:
 *   - north-<id>/          (North connectors)
 *   - history-<id>/north/  (history queries)
 */
export async function up(knex: Knex): Promise<void> {
  const oiaNorthIds = await selectIds(knex, 'north_connectors', 'type');
  const oiaHistoryQueryIds = await selectIds(knex, 'history_queries', 'north_type');
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
        converted += await convertTimeValues(path.join(rootPath, folder), oiaNorthIds.has(folder.slice('north-'.length)));
      } else if (folder.startsWith('history-')) {
        converted += await convertTimeValues(path.join(rootPath, folder, 'north'), oiaHistoryQueryIds.has(folder.slice('history-'.length)));
      }
    }
  }
  if (converted > 0) {
    console.info(`Converted ${converted} cached time-values file(s) into record lists`);
  }
}

/** The ids of the North connectors (or history queries) sending to OIAnalytics; none when the table does not exist yet. */
async function selectIds(knex: Knex, table: string, typeColumn: string): Promise<Set<string>> {
  try {
    const rows: Array<{ id: string }> = await knex(table).select('id').where(typeColumn, 'oianalytics');
    return new Set(rows.map(row => row.id));
  } catch {
    return new Set();
  }
}

async function convertTimeValues(folder: string, toOIAnalytics: boolean): Promise<number> {
  const metadataFolder = path.join(folder, METADATA_FOLDER);
  if (!(await filesExists(metadataFolder))) return 0;

  let converted = 0;
  for (const filename of await fs.readdir(metadataFolder)) {
    const metadataPath = path.join(metadataFolder, filename);
    const contentPath = path.join(folder, CONTENT_FOLDER, filename);
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8')) as { contentType: string; contentSize: number };
      if (metadata.contentType !== 'time-values') continue;

      if (toOIAnalytics) {
        await fs.writeFile(metadataPath, JSON.stringify({ ...metadata, contentType: 'oianalytics' }));
      } else {
        const values = JSON.parse(await fs.readFile(contentPath, 'utf-8')) as Array<NestedPointValue>;
        const content = JSON.stringify(values.map(toPointRecord));
        await fs.writeFile(contentPath, content);
        await fs.writeFile(
          metadataPath,
          JSON.stringify({ ...metadata, contentType: 'record-list', contentSize: Buffer.byteLength(content) })
        );
      }
      converted++;
    } catch (error: unknown) {
      console.error(`Error while converting cached time values "${contentPath}": ${(error as Error).message}`);
    }
  }
  return converted;
}

export async function down(): Promise<void> {
  return;
}
