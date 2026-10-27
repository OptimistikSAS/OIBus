import fs from 'node:fs/promises';
import path from 'node:path';

import { Knex } from 'knex';
import { DateTime } from 'luxon';

import { PREFIXING_NORTH_TYPES } from '../../../../service/config-transfer/config-upgrades/3.10/v3.10.0';
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
 *  5. The North File Writer and SFTP no longer add their prefix and suffix to the name of the files they send (their
 *     transformers do): the files in their caches are renamed as they would have sent them.
 *
 * Targets the `cache`, `error` and `archive` folders of:
 *   - north-<id>/          (North connectors)
 *   - history-<id>/north/  (history queries)
 */
export async function up(knex: Knex): Promise<void> {
  const norths = await selectNorths(knex, 'north_connectors', 'type', 'settings');
  const historyQueryNorths = await selectNorths(knex, 'history_queries', 'north_type', 'north_settings');
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
        converted += await convertCachedContent(path.join(rootPath, folder), norths.get(folder.slice('north-'.length)));
      } else if (folder.startsWith('history-')) {
        converted += await convertCachedContent(
          path.join(rootPath, folder, 'north'),
          historyQueryNorths.get(folder.slice('history-'.length))
        );
      }
    }
  }
  if (converted > 0) {
    console.info(`Converted ${converted} cached file(s) to the 3.10.0 content types and names`);
  }
}

interface CachingNorth {
  type: string;
  name: string;
  settings: { prefix?: string | null; suffix?: string | null };
}

/** The North connectors (or the Norths of the history queries) by id; none when the table does not exist yet. */
async function selectNorths(knex: Knex, table: string, typeColumn: string, settingsColumn: string): Promise<Map<string, CachingNorth>> {
  try {
    const rows: Array<{ id: string; type: string; name: string; settings: string | null }> = await knex(table).select(
      'id',
      `${typeColumn} as type`,
      'name',
      `${settingsColumn} as settings`
    );
    return new Map(rows.map(row => [row.id, { type: row.type, name: row.name, settings: row.settings ? JSON.parse(row.settings) : {} }]));
  } catch {
    return new Map();
  }
}

/**
 * The name a North File Writer or SFTP gave to a file, adding its prefix and suffix (`@CurrentDate` being the time of the
 * migration, and `@ConnectorName` the name of the North)
 */
function prefixedFilename(contentFile: string, north: CachingNorth): string {
  const { prefix, suffix } = north.settings;
  if (!PREFIXING_NORTH_TYPES.includes(north.type) || (!prefix && !suffix)) return contentFile;
  const nowDate = DateTime.now().toUTC().toFormat('yyyy_MM_dd_HH_mm_ss_SSS');
  const resolve = (value: string | null | undefined) =>
    (value || '').replace('@CurrentDate', nowDate).replace('@ConnectorName', north.name);
  const { name, ext } = path.parse(contentFile);
  return `${resolve(prefix)}${name}${resolve(suffix)}${ext}`;
}

async function convertCachedContent(folder: string, north: CachingNorth | undefined): Promise<number> {
  const northType = north?.type;
  const metadataFolder = path.join(folder, METADATA_FOLDER);
  if (!(await filesExists(metadataFolder))) return 0;

  let converted = 0;
  for (const filename of await fs.readdir(metadataFolder)) {
    const metadataPath = path.join(metadataFolder, filename);
    const contentPath = path.join(folder, CONTENT_FOLDER, filename);
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8')) as {
        contentFile: string;
        contentType: string;
        contentSize: number;
      };
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

      const contentFile = north ? prefixedFilename(metadata.contentFile, north) : metadata.contentFile;

      if (contentType === metadata.contentType && contentFile === metadata.contentFile) continue;
      await fs.writeFile(metadataPath, JSON.stringify({ ...metadata, contentFile, contentType, contentSize }));
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
