import fs from 'node:fs/promises';
import path from 'node:path';

import { Knex } from 'knex';
import { DateTime } from 'luxon';

import { PREFIXING_NORTH_TYPES } from '../../../../service/config-transfer/config-upgrades/4.0/v4.0.0';
import { filesExists, getCommandLineArguments } from '../../../../service/utils';

const { configFile } = getCommandLineArguments();

const CONTENT_FOLDER = 'content';
const METADATA_FOLDER = 'metadata';

const DATA_FOLDER_PATH = path.resolve(configFile);

/**
 * Converts the content still waiting in a North cache (or kept in its error and archive folders) to the 4.0.0 content
 * types, each file going through these conversions in order:
 *  1. The `time-values` content type is replaced by `record-list`: the time values are converted into point records
 *     (`{ pointId, timestamp, value, ...extras }`), so the North connectors can still send them. The OIAnalytics North
 *     no longer accepts record lists, and only accepts `oianalytics` content in the compact format: in its caches, the
 *     time values and the `oianalytics` content (an array of time values, as the OIAnalytics transformers and custom
 *     transformers produced it) are converted to the compact format. The values without point or timestamp, which
 *     cannot be sent, are dropped, and a file left without value is removed.
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
    console.info(`Converted ${converted} cached file(s) to the 4.0.0 content types and names`);
  }
  await restrictKeyMaterial(DATA_FOLDER_PATH);
}

/**
 * OIBus now creates its configuration and its crypto database for the user running it only (its private key, in certs/,
 * moves to the certificate store of oibus.db). Those created before are restricted once, here: afterwards, their permissions are left to the administrator. Only on Linux
 * and macOS, Windows ignoring these modes (its installers restrict the data folder with ACLs). A failure is reported
 * without stopping the migration: OIBus keeps working with the current permissions.
 */
export async function restrictKeyMaterial(dataFolder: string): Promise<void> {
  if (process.platform === 'win32') return;
  const restrictions: Array<[string, number]> = [
    ['oibus.db', 0o600],
    ['crypto.db', 0o600]
  ];
  for (const [file, mode] of restrictions) {
    try {
      await fs.chmod(path.resolve(dataFolder, file), mode);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Could not restrict the access to ${file}: ${(error as Error).message}`);
      }
    }
  }
}

/** A time value as cached before 4.0.0: the value and its extra fields (e.g. the quality) nested in `data`. */
interface NestedPointValue {
  pointId: string;
  timestamp: string;
  data: { value: string | number; [field: string]: string | number };
}

/** The values to send to OIAnalytics, in the compact format of its `/time-values/compact` endpoints */
interface CompactTimeValues {
  timestamps: Array<string>;
  values: Array<unknown>;
  references: Array<string>;
}

/** A time value of an array cached for OIAnalytics: nested, or a point record */
interface ArrayTimeValue {
  pointId?: string | number | null;
  timestamp?: string | null;
  value?: unknown;
  data?: { value?: unknown };
}

const toPointRecord = ({ pointId, timestamp, data }: NestedPointValue) => ({ pointId, timestamp, ...data });

/** The values of an array cached for OIAnalytics that can be sent (with a point and a timestamp), in the compact format */
function toCompactTimeValues(values: Array<ArrayTimeValue>): CompactTimeValues {
  const sendable = values.filter(value => value.pointId !== null && value.pointId !== undefined && value.timestamp);
  return {
    timestamps: sendable.map(value => value.timestamp!),
    values: sendable.map(value => value.value ?? value.data?.value ?? null),
    references: sendable.map(value => String(value.pointId))
  };
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
        numberOfElement: number;
      };
      let { contentType, contentSize, numberOfElement } = metadata;

      if (northType === 'oianalytics' && (contentType === 'time-values' || contentType === 'oianalytics')) {
        const cached = JSON.parse(await fs.readFile(contentPath, 'utf-8')) as Array<ArrayTimeValue> | CompactTimeValues;
        if (Array.isArray(cached)) {
          const compact = toCompactTimeValues(cached);
          if (compact.references.length === 0) {
            await fs.rm(contentPath, { force: true });
            await fs.rm(metadataPath);
            converted++;
            continue;
          }
          const content = JSON.stringify(compact);
          await fs.writeFile(contentPath, content);
          contentSize = Buffer.byteLength(content);
          numberOfElement = compact.references.length;
        }
        contentType = 'oianalytics';
      } else if (contentType === 'time-values') {
        const values = JSON.parse(await fs.readFile(contentPath, 'utf-8')) as Array<NestedPointValue>;
        const content = JSON.stringify(values.map(toPointRecord));
        await fs.writeFile(contentPath, content);
        contentType = 'record-list';
        contentSize = Buffer.byteLength(content);
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

      if (
        contentType === metadata.contentType &&
        contentFile === metadata.contentFile &&
        contentSize === metadata.contentSize &&
        numberOfElement === metadata.numberOfElement
      ) {
        continue;
      }
      await fs.writeFile(metadataPath, JSON.stringify({ ...metadata, contentFile, contentType, contentSize, numberOfElement }));
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
