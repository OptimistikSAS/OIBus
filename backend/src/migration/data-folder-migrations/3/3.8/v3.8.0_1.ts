import { Knex } from 'knex';
import fs from 'node:fs/promises';
import path from 'node:path';
import { filesExists, getCommandLineArguments } from '../../../../service/utils';

const { configFile } = getCommandLineArguments();

const DATA_FOLDER_PATH = path.resolve(configFile);
const CACHE_FOLDER_PATH = path.resolve(DATA_FOLDER_PATH, 'cache');

/**
 * Remove the legacy `cache/<id>/opcua/` PKI tree (own/, rejected/, trusted/, issuers/).
 *
 * Pre-3.8 OIBus called `initOPCUACertificateFolders` at OPC-UA connector start, which
 * created a full PKI folder structure inside the connector's cache folder and copied
 * the OIBus cert/key into `opcua/own/`. From 3.8 the OPC-UA connectors load the cert
 * + key directly into memory (`InMemoryCertificateKeyPairProvider`), so the on-disk
 * tree is dead weight.
 *
 * Targets:
 *   - cache/north-<id>/opcua/         (north OPC-UA connectors)
 *   - cache/history-<id>/north/opcua/ (history queries with an OPC-UA north)
 *
 * South OPC-UA cache folders are not handled here — the v3.8.0 data-folder migration
 * already drops every `cache/south-*` folder wholesale (the south cache structure
 * changed in 3.8 too), so any south opcua/ trees are removed alongside their parent.
 */
export async function up(_knex: Knex): Promise<void> {
  let cacheFolders: Array<string> = [];
  try {
    cacheFolders = await fs.readdir(CACHE_FOLDER_PATH);
  } catch (error: unknown) {
    console.error(`Error while reading cache folder: ${(error as Error).message}`);
    return;
  }

  let removed = 0;
  for (const folder of cacheFolders) {
    let target: string | null = null;
    if (folder.startsWith('north-')) {
      target = path.join(CACHE_FOLDER_PATH, folder, 'opcua');
    } else if (folder.startsWith('history-')) {
      target = path.join(CACHE_FOLDER_PATH, folder, 'north', 'opcua');
    }
    if (!target) continue;

    if (await filesExists(target)) {
      try {
        await fs.rm(target, { recursive: true, force: true });
        removed++;
        /* c8 ignore next 3 - fs.rm with {recursive,force} never throws in tests */
      } catch (error: unknown) {
        console.error(`Error while removing legacy OPCUA folder "${target}": ${(error as Error).message}`);
      }
    }
  }

  if (removed > 0) {
    console.info(`Removed ${removed} legacy "opcua/" subfolder(s) from ${CACHE_FOLDER_PATH}`);
  }
}

export async function down(): Promise<void> {
  return;
}
