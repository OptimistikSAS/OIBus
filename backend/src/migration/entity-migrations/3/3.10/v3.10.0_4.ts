import { Knex } from 'knex';

// The configuration changes are shared with the config upgrade of the same version (applied to imported configurations)
import {
  defaultRecordListToOIAnalyticsOptions,
  POINT_SOUTH_TYPES,
  RECORD_LIST_TO_CSV_FUNCTION_NAME,
  RECORD_LIST_TO_OIANALYTICS_FUNCTION_NAME,
  TIME_VALUES_TRANSFORMER_REPLACEMENTS,
  toRecordListTransformerOptions
} from '../../../../service/config-transfer/config-upgrades/3.10/v3.10.0';
import { generateRandomId } from '../../../../service/utils';

const TRANSFORMERS_TABLE = 'transformers';
const NORTH_CONNECTORS_TABLE = 'north_connectors';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const NORTH_TRANSFORMERS_TABLE = 'north_transformers';
const NORTH_TRANSFORMERS_ITEMS_TABLE = 'north_transformers_items';
const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_QUERY_TRANSFORMERS_TABLE = 'history_query_transformers';
const HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE = 'history_query_transformers_items';
const TRANSFORMER_LINK_TABLES = [NORTH_TRANSFORMERS_TABLE, HISTORY_QUERY_TRANSFORMERS_TABLE];

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
 *  4. The OIAnalytics North no longer accepts time values (nor record lists): the values of the point-based souths it
 *     received without transformer, or through 'iso', now go through a record-list-to-oianalytics transformer. Each
 *     'iso' link of a point-based south (or history query) to an OIAnalytics North becomes one, and one is added at the
 *     south (or history query) level when there is none.
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

  await addOIAnalyticsTransformers(knex);
}

async function addOIAnalyticsTransformers(knex: Knex): Promise<void> {
  const oiaNorths: Array<{ id: string }> = await knex(NORTH_CONNECTORS_TABLE).select('id').where('type', 'oianalytics');
  const pointSouths: Array<{ id: string }> = await knex(SOUTH_CONNECTORS_TABLE).select('id').whereIn('type', POINT_SOUTH_TYPES);
  const oiaHistoryQueries: Array<{ id: string }> = await knex(HISTORY_QUERIES_TABLE)
    .select('id')
    .where('north_type', 'oianalytics')
    .whereIn('south_type', POINT_SOUTH_TYPES);
  if ((oiaNorths.length === 0 || pointSouths.length === 0) && oiaHistoryQueries.length === 0) return;

  const oiaTransformerId = await ensureStandardTransformer(knex, RECORD_LIST_TO_OIANALYTICS_FUNCTION_NAME, 'record-list', 'oianalytics');
  const isoTransformer: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
    .where({ type: 'standard', function_name: 'iso' })
    .first('id');
  const options = JSON.stringify(defaultRecordListToOIAnalyticsOptions());

  for (const north of oiaNorths) {
    for (const south of pointSouths) {
      const links: Array<{ id: string; transformer_id: string; source_south_group_id: string | null }> = await knex(
        NORTH_TRANSFORMERS_TABLE
      )
        .select('id', 'transformer_id', 'source_south_group_id')
        .where({ north_id: north.id, source_south_south_id: south.id });
      const linkIdsWithItems = await linkIdsHavingItems(knex, NORTH_TRANSFORMERS_ITEMS_TABLE, links);
      const isoLinks = links.filter(link => link.transformer_id === isoTransformer?.id).map(link => link.id);
      if (isoLinks.length > 0) {
        await knex(NORTH_TRANSFORMERS_TABLE).whereIn('id', isoLinks).update({ transformer_id: oiaTransformerId, options });
      }
      if (!links.some(link => !link.source_south_group_id && !linkIdsWithItems.has(link.id))) {
        await knex(NORTH_TRANSFORMERS_TABLE).insert({
          id: generateRandomId(6),
          north_id: north.id,
          transformer_id: oiaTransformerId,
          options,
          source_type: 'south',
          source_api_data_source_id: null,
          source_south_south_id: south.id,
          source_south_group_id: null
        });
      }
    }
  }

  for (const historyQuery of oiaHistoryQueries) {
    const links: Array<{ id: string; transformer_id: string }> = await knex(HISTORY_QUERY_TRANSFORMERS_TABLE)
      .select('id', 'transformer_id')
      .where('history_id', historyQuery.id);
    const linkIdsWithItems = await linkIdsHavingItems(knex, HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE, links);
    const isoLinks = links.filter(link => link.transformer_id === isoTransformer?.id).map(link => link.id);
    if (isoLinks.length > 0) {
      await knex(HISTORY_QUERY_TRANSFORMERS_TABLE).whereIn('id', isoLinks).update({ transformer_id: oiaTransformerId, options });
    }
    if (!links.some(link => !linkIdsWithItems.has(link.id))) {
      await knex(HISTORY_QUERY_TRANSFORMERS_TABLE).insert({
        id: generateRandomId(6),
        history_id: historyQuery.id,
        transformer_id: oiaTransformerId,
        options
      });
    }
  }
}

/** The ids of the links scoped to some items. */
async function linkIdsHavingItems(knex: Knex, itemsTable: string, links: Array<{ id: string }>): Promise<Set<string>> {
  if (links.length === 0) return new Set();
  const rows: Array<{ id: string }> = await knex(itemsTable)
    .distinct('id')
    .whereIn(
      'id',
      links.map(link => link.id)
    );
  return new Set(rows.map(row => row.id));
}

/** The id of a standard transformer, created when missing (the startup seeding runs after the migrations). */
async function ensureStandardTransformer(knex: Knex, functionName: string, inputType: string, outputType: string): Promise<string> {
  const existing: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
    .where({ type: 'standard', function_name: functionName })
    .first('id');
  if (existing) return existing.id;
  const id = generateRandomId(6);
  await knex(TRANSFORMERS_TABLE).insert({
    id,
    type: 'standard',
    function_name: functionName,
    input_type: inputType,
    output_type: outputType,
    created_by: 'system',
    updated_by: 'system'
  });
  return id;
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
