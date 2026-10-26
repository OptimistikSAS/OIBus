import { Knex } from 'knex';

// The configuration changes are shared with the config upgrade of the same version (applied to imported configurations)
import { COMPRESSED_FILE_OPTIONS, COMPRESSING_SOUTH_TYPES } from '../../../../service/config-transfer/config-upgrades/3.10/v3.10.0';
import { generateRandomId } from '../../../../service/utils';

const TRANSFORMERS_TABLE = 'transformers';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const NORTH_TRANSFORMERS_TABLE = 'north_transformers';
const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_QUERY_TRANSFORMERS_TABLE = 'history_query_transformers';

/**
 * The folder scanner, FTP and SFTP South connectors no longer compress their files (see `moveCompressionToNorths` in the
 * config upgrade): when they did, their files sent as they are (through the file transformer) are compressed by a
 * file-to-file transformer instead. The `compression` setting is removed.
 */
export async function up(knex: Knex): Promise<void> {
  const souths: Array<{ id: string; settings: string }> = await knex(SOUTH_CONNECTORS_TABLE)
    .select('id', 'settings')
    .whereIn('type', COMPRESSING_SOUTH_TYPES);
  const historyQueries: Array<{ id: string; south_settings: string }> = await knex(HISTORY_QUERIES_TABLE)
    .select('id', 'south_settings')
    .whereIn('south_type', COMPRESSING_SOUTH_TYPES);

  const transformers: Array<{ id: string; type: string; function_name: string | null }> = await knex(TRANSFORMERS_TABLE).select(
    'id',
    'type',
    'function_name'
  );
  const fileId = transformers.find(transformer => transformer.type === 'standard' && transformer.function_name === 'file')?.id;
  let fileToFileId = transformers.find(transformer => transformer.type === 'standard' && transformer.function_name === 'file-to-file')?.id;
  const compressedLink = async () => ({
    transformer_id: (fileToFileId ??= await insertFileToFile(knex)),
    options: JSON.stringify(COMPRESSED_FILE_OPTIONS)
  });

  for (const south of souths) {
    const { compression, ...settings } = JSON.parse(south.settings) as Record<string, unknown>;
    if (compression === undefined) continue;
    await knex(SOUTH_CONNECTORS_TABLE)
      .where('id', south.id)
      .update({ settings: JSON.stringify(settings) });
    if (compression !== true || !fileId) continue;
    await knex(NORTH_TRANSFORMERS_TABLE)
      .where({ source_type: 'south', source_south_south_id: south.id, transformer_id: fileId })
      .update(await compressedLink());
  }
  for (const historyQuery of historyQueries) {
    const { compression, ...settings } = JSON.parse(historyQuery.south_settings) as Record<string, unknown>;
    if (compression === undefined) continue;
    await knex(HISTORY_QUERIES_TABLE)
      .where('id', historyQuery.id)
      .update({ south_settings: JSON.stringify(settings) });
    if (compression !== true || !fileId) continue;
    await knex(HISTORY_QUERY_TRANSFORMERS_TABLE)
      .where({ history_id: historyQuery.id, transformer_id: fileId })
      .update(await compressedLink());
  }
}

async function insertFileToFile(knex: Knex): Promise<string> {
  const id = generateRandomId(6);
  await knex(TRANSFORMERS_TABLE).insert({
    id,
    type: 'standard',
    function_name: 'file-to-file',
    input_type: 'file',
    output_type: 'file',
    created_by: 'system',
    updated_by: 'system'
  });
  return id;
}

export async function down(): Promise<void> {
  return;
}
