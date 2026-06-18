import { Knex } from 'knex';

const TRANSFORMERS_TABLE = 'transformers';
const NORTH_TRANSFORMERS_TABLE = 'north_transformers';
const HISTORY_QUERY_TRANSFORMERS_TABLE = 'history_query_transformers';

/**
 * Fix transformer instances that were left with null options after the v3.8.0 migration.
 *
 * In v3.7, the `precision` option for `time-values-to-oianalytics` did not exist, so old
 * transformer instances had options = NULL in the database.  The v3.8.0 migration copied
 * these nulls as-is into the new schema.  The frontend form requires `precision` (REQUIRED
 * validator, defaultValue 'ms'), so saving a north connector with such a transformer failed
 * until the user manually opened and re-saved the transformer modal.
 *
 * Similarly, `migrateCsvTransformerOptions` in v3.8.0 only processed rows where options
 * was NOT NULL — instances that had never had options set were silently skipped, leaving
 * them with null options and missing required CSV fields.
 *
 * Finally, `migrateSubscriptionsToTransformers` in v3.8.0 inserted the `iso` transformer
 * with `options: null` for every subscription that had no prior transformation rule. The
 * `iso` (and `ignore`) transformers have no configurable options, but the backend still
 * rejects `null` options as an invalid object, so creating/duplicating/saving a north
 * connector or history query carrying such a transformer failed. Any instance still left
 * with null options after the specific fixes above is given an empty options object.
 */
export async function up(knex: Knex): Promise<void> {
  await fixOIAnalyticsTransformerOptions(knex);
  await fixCsvTransformerOptions(knex);
  await fixRemainingNullOptions(knex);
}

/**
 * Catch-all: any transformer instance still carrying null options (e.g. the `iso`/`ignore`
 * transformers, which have no options) gets a valid empty options object. Runs last so the
 * transformer-specific defaults above take precedence.
 */
async function fixRemainingNullOptions(knex: Knex): Promise<void> {
  for (const table of [NORTH_TRANSFORMERS_TABLE, HISTORY_QUERY_TRANSFORMERS_TABLE]) {
    await knex(table).whereNull('options').update({ options: '{}' });
  }
}

async function fixOIAnalyticsTransformerOptions(knex: Knex): Promise<void> {
  const transformer: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
    .select('id')
    .where('function_name', 'time-values-to-oianalytics')
    .first();

  if (!transformer) return;

  const defaultOptions = JSON.stringify({ precision: 'ms' });

  for (const table of [NORTH_TRANSFORMERS_TABLE, HISTORY_QUERY_TRANSFORMERS_TABLE]) {
    await knex(table).whereNull('options').andWhere('transformer_id', transformer.id).update({ options: defaultOptions });
  }
}

async function fixCsvTransformerOptions(knex: Knex): Promise<void> {
  const csvTransformers: Array<{ id: string; function_name: string }> = await knex(TRANSFORMERS_TABLE)
    .select('id', 'function_name')
    .whereIn('function_name', ['json-to-csv', 'time-values-to-csv']);

  if (csvTransformers.length === 0) return;

  const transformerFunctionName = new Map(csvTransformers.map(t => [t.id, t.function_name]));
  const transformerIds = csvTransformers.map(t => t.id);

  for (const table of [NORTH_TRANSFORMERS_TABLE, HISTORY_QUERY_TRANSFORMERS_TABLE]) {
    const instances: Array<{ id: string; transformer_id: string }> = await knex(table)
      .select('id', 'transformer_id')
      .whereIn('transformer_id', transformerIds)
      .whereNull('options');

    for (const instance of instances) {
      const options: Record<string, unknown> = {
        encoding: 'UTF_8',
        quoteChar: 'DOUBLE_QUOTE',
        escapeChar: 'DOUBLE_QUOTE',
        newline: 'DEFAULT',
        header: true
      };

      if (transformerFunctionName.get(instance.transformer_id) === 'time-values-to-csv') {
        options.pointIdProcess = null;
      } else {
        // json-to-csv: fields is an empty array by default (no mapping rows yet)
        options.fields = [];
      }

      await knex(table)
        .where('id', instance.id)
        .update({ options: JSON.stringify(options) });
    }
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
