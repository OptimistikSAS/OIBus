import fs from 'node:fs/promises';
import path from 'node:path';

import { Knex } from 'knex';

import { filesExists, getCommandLineArguments } from '../../../../service/utils';

const { configFile } = getCommandLineArguments();

const METADATA_FOLDER = 'metadata';

const DATA_FOLDER_PATH = path.resolve(configFile);

/**
 * The `any` content type is renamed `file`: the metadata of the files still waiting in a North cache (or kept in its
 * error and archive folders) is updated, the content itself being unchanged.
 *
 * Targets the `cache`, `error` and `archive` folders of:
 *   - north-<id>/          (North connectors)
 *   - history-<id>/north/  (history queries)
 */
export async function up(_knex: Knex): Promise<void> {
  let renamed = 0;
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
        renamed += await renameAnyContentType(path.join(rootPath, folder));
      } else if (folder.startsWith('history-')) {
        renamed += await renameAnyContentType(path.join(rootPath, folder, 'north'));
      }
    }
  }
  if (renamed > 0) {
    console.info(`Renamed the content type of ${renamed} cached file(s) from "any" to "file"`);
  }
}

async function renameAnyContentType(folder: string): Promise<number> {
  const metadataFolder = path.join(folder, METADATA_FOLDER);
  if (!(await filesExists(metadataFolder))) return 0;

  let renamed = 0;
  for (const filename of await fs.readdir(metadataFolder)) {
    const metadataPath = path.join(metadataFolder, filename);
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8')) as { contentType: string };
      if (metadata.contentType !== 'any') continue;
      await fs.writeFile(metadataPath, JSON.stringify({ ...metadata, contentType: 'file' }));
      renamed++;
    } catch (error: unknown) {
      console.error(`Error while renaming the content type of "${metadataPath}": ${(error as Error).message}`);
    }
  }
  return renamed;
}

export async function down(): Promise<void> {
  return;
}
