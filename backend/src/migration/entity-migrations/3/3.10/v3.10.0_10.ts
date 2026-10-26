import { Knex } from 'knex';

// The configuration changes are shared with the config upgrade of the same version (applied to imported configurations)
import {
  FILE_WRITER_REMOVED_DATA_TYPES,
  toFileWriterFileToFileOptions
} from '../../../../service/config-transfer/config-upgrades/3.10/v3.10.0';
import { generateRandomId } from '../../../../service/utils';

const TRANSFORMERS_TABLE = 'transformers';
const NORTH_CONNECTORS_TABLE = 'north_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';
const LINK_TABLES = [
  { owners: NORTH_CONNECTORS_TABLE, typeColumn: 'type', links: 'north_transformers', items: 'north_transformers_items', owner: 'north_id' },
  {
    owners: HISTORY_QUERIES_TABLE,
    typeColumn: 'north_type',
    links: 'history_query_transformers',
    items: 'history_query_transformers_items',
    owner: 'history_id'
  }
];

/**
 * The North File Writer only writes files (see `convertFileWriterLinks` in the config upgrade): its file-to-record-list
 * links write the rows of the file in a JSON file through file-to-file instead, and its links to the custom
 * transformers sending records or setpoints are removed. The records and setpoints still waiting in its caches are
 * turned into files by the 3.10.0_2 data folder migration.
 */
export async function up(knex: Knex): Promise<void> {
  const transformers: Array<{ id: string; type: string; function_name: string | null; output_type: string }> = await knex(
    TRANSFORMERS_TABLE
  ).select('id', 'type', 'function_name', 'output_type');
  const removedTypeTransformers = transformers.filter(transformer => FILE_WRITER_REMOVED_DATA_TYPES.includes(transformer.output_type));
  if (removedTypeTransformers.length === 0) return;

  let fileToFileId = transformers.find(transformer => transformer.type === 'standard' && transformer.function_name === 'file-to-file')?.id;
  let removed = 0;
  for (const table of LINK_TABLES) {
    const ownerIds = (await knex(table.owners).select('id').where(table.typeColumn, 'file-writer')).map((row: { id: string }) => row.id);
    if (ownerIds.length === 0) continue;
    const links: Array<{ id: string; transformer_id: string; options: string | null }> = await knex(table.links)
      .select('id', 'transformer_id', 'options')
      .whereIn(table.owner, ownerIds)
      .whereIn(
        'transformer_id',
        removedTypeTransformers.map(transformer => transformer.id)
      );
    for (const link of links) {
      const transformer = removedTypeTransformers.find(candidate => candidate.id === link.transformer_id)!;
      if (transformer.type === 'standard' && transformer.function_name === 'file-to-record-list') {
        fileToFileId ??= await insertFileToFile(knex);
        const options = toFileWriterFileToFileOptions(link.options ? (JSON.parse(link.options) as Record<string, unknown>) : {});
        await knex(table.links)
          .where('id', link.id)
          .update({ transformer_id: fileToFileId, options: JSON.stringify(options) });
      } else {
        await knex(table.items).where('id', link.id).del();
        await knex(table.links).where('id', link.id).del();
        removed++;
      }
    }
  }
  if (removed > 0) {
    console.info(`Removed ${removed} link(s) of File Writer North connectors to transformers sending records or setpoints`);
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
