import { Knex } from 'knex';

// The configuration changes are shared with the config upgrade of the same version (applied to imported configurations)
import {
  RECORD_LIST_TO_OIANALYTICS_FUNCTION_NAME,
  toGroupedOIAnalyticsOptions
} from '../../../../service/config-transfer/config-upgrades/3.10/v3.10.0';

const TRANSFORMERS_TABLE = 'transformers';
const TRANSFORMER_LINK_TABLES = ['north_transformers', 'history_query_transformers'];

/**
 * The options of the record-list-to-oianalytics transformers are grouped by part of the OIAnalytics payload: the
 * reference, the timestamp and the value (see `toGroupedOIAnalyticsOptions`).
 */
export async function up(knex: Knex): Promise<void> {
  const transformer: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
    .where({ type: 'standard', function_name: RECORD_LIST_TO_OIANALYTICS_FUNCTION_NAME })
    .first('id');
  if (!transformer) return;
  for (const table of TRANSFORMER_LINK_TABLES) {
    const links: Array<{ id: string; options: string | null }> = await knex(table)
      .select('id', 'options')
      .where('transformer_id', transformer.id);
    for (const link of links) {
      const options = toGroupedOIAnalyticsOptions(link.options ? (JSON.parse(link.options) as Record<string, unknown>) : {});
      await knex(table)
        .where('id', link.id)
        .update({ options: JSON.stringify(options) });
    }
  }
}

export async function down(): Promise<void> {
  return;
}
