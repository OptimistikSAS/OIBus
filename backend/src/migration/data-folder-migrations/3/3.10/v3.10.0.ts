import fs from 'node:fs/promises';
import path from 'node:path';

import { Knex } from 'knex';

import { filesExists, getCommandLineArguments, NestedPointValue, toPointRecord } from '../../../../service/utils';

const { configFile } = getCommandLineArguments();

const CONTENT_FOLDER = 'content';
const METADATA_FOLDER = 'metadata';

const DATA_FOLDER_PATH = path.resolve(configFile);

/**
 * Converts the content still waiting in a North cache (or kept in its error and archive folders) to the 3.10.0 content
 * types, each file going through these conversions in order:
 *  1. The `time-values` content type is replaced by `record-list`: the time values are converted into point records
 *     (`{ pointId, timestamp, value, ...extras }`), so the North connectors can still send them. The OIAnalytics North
 *     no longer accepts record lists: in its caches, the time values become `oianalytics` content, which it still
 *     accepts in this (legacy array) format.
 *  2. The `any` content type is renamed `file`, the content itself being unchanged.
 *  3. The North File Writer only writes files: the records and setpoints in its caches become files, their content (a
 *     JSON array) being written as it is.
 *  4. The setpoints sent by OIAnalytics are records: the setpoints become record lists, their content (a JSON array of
 *     `{ reference, value }`) being kept as it is.
 *
 * Targets the `cache`, `error` and `archive` folders of:
 *   - north-<id>/          (North connectors)
 *   - history-<id>/north/  (history queries)
 */
export async function up(knex: Knex): Promise<void> {
  const northTypes = await selectTypes(knex, 'north_connectors', 'type');
  const historyQueryNorthTypes = await selectTypes(knex, 'history_queries', 'north_type');
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
        converted += await convertCachedContent(path.join(rootPath, folder), northTypes.get(folder.slice('north-'.length)));
      } else if (folder.startsWith('history-')) {
        converted += await convertCachedContent(
          path.join(rootPath, folder, 'north'),
          historyQueryNorthTypes.get(folder.slice('history-'.length))
        );
      }
    }
  }
  if (converted > 0) {
    console.info(`Converted ${converted} cached file(s) to the 3.10.0 content types`);
  }
}

/** The North types of the North connectors (or history queries) by id; none when the table does not exist yet. */
async function selectTypes(knex: Knex, table: string, typeColumn: string): Promise<Map<string, string>> {
  try {
    const rows: Array<{ id: string; type: string }> = await knex(table).select('id', `${typeColumn} as type`);
    return new Map(rows.map(row => [row.id, row.type]));
  } catch {
    return new Map();
  }
}

async function convertCachedContent(folder: string, northType: string | undefined): Promise<number> {
  const metadataFolder = path.join(folder, METADATA_FOLDER);
  if (!(await filesExists(metadataFolder))) return 0;

  let converted = 0;
  for (const filename of await fs.readdir(metadataFolder)) {
    const metadataPath = path.join(metadataFolder, filename);
    const contentPath = path.join(folder, CONTENT_FOLDER, filename);
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8')) as { contentType: string; contentSize: number };
      let { contentType, contentSize } = metadata;

      if (contentType === 'time-values') {
        if (northType === 'oianalytics') {
          contentType = 'oianalytics';
        } else {
          const values = JSON.parse(await fs.readFile(contentPath, 'utf-8')) as Array<NestedPointValue>;
          const content = JSON.stringify(values.map(toPointRecord));
          await fs.writeFile(contentPath, content);
          contentType = 'record-list';
          contentSize = Buffer.byteLength(content);
        }
      }
      if (contentType === 'any') {
        contentType = 'file';
      }
      if (northType === 'file-writer' && (contentType === 'record-list' || contentType === 'setpoint')) {
        contentType = 'file';
      }
      if (contentType === 'setpoint') {
        contentType = 'record-list';
      }

      if (contentType === metadata.contentType) continue;
      await fs.writeFile(metadataPath, JSON.stringify({ ...metadata, contentType, contentSize }));
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
