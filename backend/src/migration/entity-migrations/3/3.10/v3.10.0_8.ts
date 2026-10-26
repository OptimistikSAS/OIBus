import { Knex } from 'knex';

// The configuration changes are shared with the config upgrade of the same version (applied to imported configurations)
import { FILE_TRANSFORMER_REPLACEMENTS, toFileTransformerOptions } from '../../../../service/config-transfer/config-upgrades/3.10/v3.10.0';

const TRANSFORMERS_TABLE = 'transformers';
const TRANSFORMER_LINK_TABLES = ['north_transformers', 'history_query_transformers'];

/**
 * The csv-to-mqtt, csv-to-record-list and json-to-oianalytics transformers are replaced by file-to-mqtt,
 * file-to-record-list and file-to-oianalytics ones, reading both CSV and JSON files (see `FILE_TRANSFORMER_REPLACEMENTS`):
 * each is renamed in place, or merged into its replacement when it already exists, the options of its links being
 * converted (see `toFileTransformerOptions`).
 */
export async function up(knex: Knex): Promise<void> {
  for (const [oldFunctionName, newFunctionName] of Object.entries(FILE_TRANSFORMER_REPLACEMENTS)) {
    const oldTransformer: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
      .where({ type: 'standard', function_name: oldFunctionName })
      .first('id');
    if (!oldTransformer) continue;

    const existingReplacement: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
      .where({ type: 'standard', function_name: newFunctionName })
      .first('id');
    const replacementId = existingReplacement?.id ?? oldTransformer.id;
    if (!existingReplacement) {
      await knex(TRANSFORMERS_TABLE).where('id', oldTransformer.id).update({ function_name: newFunctionName });
    }
    for (const table of TRANSFORMER_LINK_TABLES) {
      const links: Array<{ id: string; options: string | null }> = await knex(table)
        .select('id', 'options')
        .where('transformer_id', oldTransformer.id);
      for (const link of links) {
        const options = toFileTransformerOptions(
          oldFunctionName,
          link.options ? (JSON.parse(link.options) as Record<string, unknown>) : {}
        );
        await knex(table)
          .where('id', link.id)
          .update({ transformer_id: replacementId, options: JSON.stringify(options) });
      }
    }
    if (existingReplacement) {
      await knex(TRANSFORMERS_TABLE).where('id', oldTransformer.id).del();
    }
  }
}

export async function down(): Promise<void> {
  return;
}
