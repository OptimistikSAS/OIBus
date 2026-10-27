import { Knex } from 'knex';

// The configuration changes are shared with the config upgrade of the same version (applied to imported configurations)
import {
  SETPOINT_TRANSFORMER_REPLACEMENTS,
  toSetpointTransformerOptions
} from '../../../../service/config-transfer/config-upgrades/3.10/v3.10.0';

const TRANSFORMERS_TABLE = 'transformers';
const TRANSFORMER_LINK_TABLES = ['north_transformers', 'history_query_transformers'];

/**
 * The setpoints sent by OIAnalytics are records, `{ reference, value }` (see `mergeSetpointsIntoRecordLists` in the
 * config upgrade):
 *  - the setpoint transformers are replaced by the record-list ones (see `SETPOINT_TRANSFORMER_REPLACEMENTS`): each is
 *    renamed in place, or merged into its replacement when it already exists, the options of its links being converted
 *    (see `toSetpointTransformerOptions`);
 *  - the custom transformers reading or writing setpoints read or write records;
 *  - the record-list-to-mqtt links without payload publish the whole record, as before.
 * The setpoints still waiting in the caches become records with the 3.10.0_3 data folder migration.
 */
export async function up(knex: Knex): Promise<void> {
  for (const [oldFunctionName, newFunctionName] of Object.entries(SETPOINT_TRANSFORMER_REPLACEMENTS)) {
    const oldTransformer: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
      .where({ type: 'standard', function_name: oldFunctionName })
      .first('id');
    if (!oldTransformer) continue;

    const existingReplacement: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
      .where({ type: 'standard', function_name: newFunctionName })
      .first('id');
    const replacementId = existingReplacement?.id ?? oldTransformer.id;
    if (!existingReplacement) {
      await knex(TRANSFORMERS_TABLE).where('id', oldTransformer.id).update({ function_name: newFunctionName, input_type: 'record-list' });
    }
    for (const table of TRANSFORMER_LINK_TABLES) {
      const links: Array<{ id: string; options: string | null }> = await knex(table)
        .select('id', 'options')
        .where('transformer_id', oldTransformer.id);
      for (const link of links) {
        const options = toSetpointTransformerOptions(
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

  await knex(TRANSFORMERS_TABLE).where({ type: 'custom', input_type: 'setpoint' }).update({ input_type: 'record-list' });
  await knex(TRANSFORMERS_TABLE).where({ type: 'custom', output_type: 'setpoint' }).update({ output_type: 'record-list' });

  const recordListToMqtt: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
    .where({ type: 'standard', function_name: 'record-list-to-mqtt' })
    .first('id');
  if (!recordListToMqtt) return;
  for (const table of TRANSFORMER_LINK_TABLES) {
    const links: Array<{ id: string; options: string | null }> = await knex(table)
      .select('id', 'options')
      .where('transformer_id', recordListToMqtt.id);
    for (const link of links) {
      const options = link.options ? (JSON.parse(link.options) as Record<string, unknown>) : {};
      if (options.payload !== undefined) continue;
      await knex(table)
        .where('id', link.id)
        .update({ options: JSON.stringify({ ...options, payload: 'record' }) });
    }
  }
}

export async function down(): Promise<void> {
  return;
}
