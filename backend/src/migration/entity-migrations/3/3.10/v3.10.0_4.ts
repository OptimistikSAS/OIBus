import { Knex } from 'knex';

// The configuration changes are shared with the config upgrade of the same version (applied to imported configurations)
import {
  RECORD_LIST_TO_CSV_FUNCTION_NAME,
  TIME_VALUES_TRANSFORMER_REPLACEMENTS,
  toRecordListTransformerOptions
} from '../../../../service/config-transfer/config-upgrades/3.10/v3.10.0';

const TRANSFORMERS_TABLE = 'transformers';
const TRANSFORMER_LINK_TABLES = ['north_transformers', 'history_query_transformers'];

/**
 * The `time-values` data type is replaced by `record-list`: the point-based souths send point records
 * (`{ pointId, timestamp, value, ...extras }`).
 *
 *  1. Custom transformers taking or producing time values now take or produce record lists (their code must read the
 *     flat records instead of `data.value`).
 *  2. Each standard transformer taking or producing time values is replaced by its record-list counterpart: renamed in
 *     place, or merged into the replacement when it already exists (time-values-to-csv into record-list-to-csv), its
 *     links' options being converted (see `toRecordListTransformerOptions`).
 *  3. The existing record-list-to-csv links keep every field (the new `keepOtherFields` option).
 *
 * The time values still waiting in the North caches are converted by the 3.10.0 data folder migration.
 */
export async function up(knex: Knex): Promise<void> {
  await knex(TRANSFORMERS_TABLE).where({ type: 'custom', input_type: 'time-values' }).update({ input_type: 'record-list' });
  await knex(TRANSFORMERS_TABLE).where({ type: 'custom', output_type: 'time-values' }).update({ output_type: 'record-list' });

  const recordListToCsv: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
    .where({ type: 'standard', function_name: RECORD_LIST_TO_CSV_FUNCTION_NAME })
    .first('id');
  if (recordListToCsv) {
    await updateLinkOptions(knex, recordListToCsv.id, recordListToCsv.id, options =>
      options.keepOtherFields === undefined ? { ...options, keepOtherFields: true } : options
    );
  }

  for (const [oldFunctionName, replacement] of Object.entries(TIME_VALUES_TRANSFORMER_REPLACEMENTS)) {
    const oldTransformer: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
      .where({ type: 'standard', function_name: oldFunctionName })
      .first('id');
    if (!oldTransformer) continue;

    const existingReplacement: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
      .where({ type: 'standard', function_name: replacement.functionName })
      .first('id');
    const replacementId = existingReplacement?.id ?? oldTransformer.id;
    if (!existingReplacement) {
      await knex(TRANSFORMERS_TABLE).where('id', oldTransformer.id).update({
        function_name: replacement.functionName,
        input_type: replacement.inputType,
        output_type: replacement.outputType
      });
    }
    await updateLinkOptions(knex, oldTransformer.id, replacementId, options => toRecordListTransformerOptions(oldFunctionName, options));
    if (existingReplacement) {
      await knex(TRANSFORMERS_TABLE).where('id', oldTransformer.id).del();
    }
  }
}

/** Moves the North and history query links of a transformer to another one, converting their options. */
async function updateLinkOptions(
  knex: Knex,
  transformerId: string,
  newTransformerId: string,
  convert: (options: Record<string, unknown>) => Record<string, unknown>
): Promise<void> {
  for (const table of TRANSFORMER_LINK_TABLES) {
    const links: Array<{ id: string; options: string | null }> = await knex(table)
      .select('id', 'options')
      .where('transformer_id', transformerId);
    for (const link of links) {
      const options = convert(link.options ? (JSON.parse(link.options) as Record<string, unknown>) : {});
      await knex(table)
        .where('id', link.id)
        .update({ transformer_id: newTransformerId, options: JSON.stringify(options) });
    }
  }
}

export async function down(): Promise<void> {
  return;
}
