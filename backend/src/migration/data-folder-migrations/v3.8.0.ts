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

export async function up(_knex: Knex): Promise<void> {
  // TODO: remove south from error and archive
  // TODO: refactor files to match metadata and content file names
  // TODO: cleanup opcua ?
}

export async function down(): Promise<void> {
  return;
}
