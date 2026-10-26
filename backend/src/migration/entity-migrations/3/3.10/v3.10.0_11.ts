import { Knex } from 'knex';

// The configuration changes are shared with the config upgrade of the same version (applied to imported configurations)
import { resolveSouthItemLink, toOIAnalyticsItemFileOptions } from '../../../../service/config-transfer/config-upgrades/3.10/v3.10.0';
import { generateRandomId } from '../../../../service/utils';

const TRANSFORMERS_TABLE = 'transformers';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const GROUP_ITEMS_TABLE = 'group_items';
const NORTH_TRANSFORMERS_TABLE = 'north_transformers';
const NORTH_TRANSFORMERS_ITEMS_TABLE = 'north_transformers_items';
const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';
const HISTORY_QUERY_TRANSFORMERS_TABLE = 'history_query_transformers';
const HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE = 'history_query_transformers_items';

interface Item {
  id: string;
  settings: Record<string, unknown>;
  groupId: string | null;
}

/**
 * The South OIAnalytics sends record lists instead of CSV files (see `convertOIAnalyticsSouths` in the config upgrade):
 * for each of its items sent as is (through the file transformer) to a North or by a history query, a
 * record-list-to-file transformer writes the same CSV file. Its links to the transformers reading files are removed,
 * and its items lose their `serialization` settings.
 */
export async function up(knex: Knex): Promise<void> {
  const souths: Array<{ id: string }> = await knex(SOUTH_CONNECTORS_TABLE).select('id').where('type', 'oianalytics');
  const historyQueries: Array<{ id: string }> = await knex(HISTORY_QUERIES_TABLE).select('id').where('south_type', 'oianalytics');
  if (souths.length === 0 && historyQueries.length === 0) return;

  const transformers: Array<{ id: string; type: string; function_name: string | null; input_type: string }> = await knex(
    TRANSFORMERS_TABLE
  ).select('id', 'type', 'function_name', 'input_type');
  const readsFiles = (transformerId: string) => transformers.find(transformer => transformer.id === transformerId)?.input_type === 'file';
  const sendsAsIs = (transformerId: string | undefined) =>
    transformers.some(
      transformer => transformer.id === transformerId && transformer.type === 'standard' && transformer.function_name === 'file'
    );
  let recordListToFileId = transformers.find(
    transformer => transformer.type === 'standard' && transformer.function_name === 'record-list-to-file'
  )?.id;
  const recordListToFile = async (): Promise<string> => (recordListToFileId ??= await insertRecordListToFile(knex));

  for (const south of souths) {
    const items = withSerialization(
      await knex(SOUTH_ITEMS_TABLE)
        .leftJoin(GROUP_ITEMS_TABLE, `${GROUP_ITEMS_TABLE}.item_id`, `${SOUTH_ITEMS_TABLE}.id`)
        .select(`${SOUTH_ITEMS_TABLE}.id as id`, `${SOUTH_ITEMS_TABLE}.settings as settings`, `${GROUP_ITEMS_TABLE}.group_id as groupId`)
        .where(`${SOUTH_ITEMS_TABLE}.connector_id`, south.id)
    );
    if (items.length === 0) continue;
    const links: Array<{ id: string; north_id: string; transformer_id: string; source_south_group_id: string | null }> = await knex(
      NORTH_TRANSFORMERS_TABLE
    )
      .select('id', 'north_id', 'transformer_id', 'source_south_group_id')
      .where({ source_type: 'south', source_south_south_id: south.id })
      .orderBy('rowid');
    const linkItems: Array<{ id: string; item_id: string; excluded: number | boolean }> = links.length
      ? await knex(NORTH_TRANSFORMERS_ITEMS_TABLE)
          .select('id', 'item_id', 'excluded')
          .whereIn(
            'id',
            links.map(link => link.id)
          )
      : [];
    for (const northId of [...new Set(links.map(link => link.north_id))]) {
      const northLinks = links
        .filter(link => link.north_id === northId)
        .map(link => ({
          link,
          groupId: link.source_south_group_id,
          itemIds: linkItems.filter(row => row.id === link.id && !row.excluded).map(row => row.item_id),
          excludedItemIds: linkItems.filter(row => row.id === link.id && row.excluded).map(row => row.item_id)
        }));
      for (const item of items) {
        if (!sendsAsIs(resolveSouthItemLink(northLinks, item.id, item.groupId)?.link.transformer_id)) continue;
        const id = generateRandomId(6);
        await knex(NORTH_TRANSFORMERS_TABLE).insert({
          id,
          north_id: northId,
          transformer_id: await recordListToFile(),
          options: JSON.stringify(toOIAnalyticsItemFileOptions(item.settings.serialization as Record<string, unknown>)),
          source_type: 'south',
          source_south_south_id: south.id
        });
        await knex(NORTH_TRANSFORMERS_ITEMS_TABLE).insert({ id, item_id: item.id, excluded: false });
      }
    }
    await removeLinks(
      knex,
      NORTH_TRANSFORMERS_TABLE,
      NORTH_TRANSFORMERS_ITEMS_TABLE,
      links.filter(link => readsFiles(link.transformer_id)).map(link => link.id)
    );
    await removeSerialization(knex, SOUTH_ITEMS_TABLE, items);
  }

  for (const historyQuery of historyQueries) {
    const items = withSerialization(await knex(HISTORY_ITEMS_TABLE).select('id', 'settings').where('history_id', historyQuery.id));
    if (items.length === 0) continue;
    const links: Array<{ id: string; transformer_id: string }> = await knex(HISTORY_QUERY_TRANSFORMERS_TABLE)
      .select('id', 'transformer_id')
      .where('history_id', historyQuery.id)
      .orderBy('rowid');
    const linkItems: Array<{ id: string; item_id: string }> = links.length
      ? await knex(HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE)
          .select('id', 'item_id')
          .whereIn(
            'id',
            links.map(link => link.id)
          )
      : [];
    const historyLinks = links.map(link => ({
      link,
      groupId: null,
      itemIds: linkItems.filter(row => row.id === link.id).map(row => row.item_id),
      excludedItemIds: []
    }));
    for (const item of items) {
      if (!sendsAsIs(resolveSouthItemLink(historyLinks, item.id, null)?.link.transformer_id)) continue;
      const id = generateRandomId(6);
      await knex(HISTORY_QUERY_TRANSFORMERS_TABLE).insert({
        id,
        history_id: historyQuery.id,
        transformer_id: await recordListToFile(),
        options: JSON.stringify(toOIAnalyticsItemFileOptions(item.settings.serialization as Record<string, unknown>))
      });
      await knex(HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE).insert({ id, item_id: item.id });
    }
    await removeLinks(
      knex,
      HISTORY_QUERY_TRANSFORMERS_TABLE,
      HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE,
      links.filter(link => readsFiles(link.transformer_id)).map(link => link.id)
    );
    await removeSerialization(knex, HISTORY_ITEMS_TABLE, items);
  }
}

/** The items still having their `serialization` settings */
function withSerialization(rows: Array<{ id: string; settings: string; groupId?: string | null }>): Array<Item> {
  return rows
    .map(row => ({ id: row.id, settings: JSON.parse(row.settings) as Record<string, unknown>, groupId: row.groupId ?? null }))
    .filter(item => item.settings.serialization !== undefined);
}

async function removeSerialization(knex: Knex, table: string, items: Array<Item>): Promise<void> {
  for (const item of items) {
    const { serialization: _serialization, ...settings } = item.settings;
    await knex(table)
      .where('id', item.id)
      .update({ settings: JSON.stringify(settings) });
  }
}

async function removeLinks(knex: Knex, linksTable: string, itemsTable: string, ids: Array<string>): Promise<void> {
  if (ids.length === 0) return;
  await knex(itemsTable).whereIn('id', ids).del();
  await knex(linksTable).whereIn('id', ids).del();
}

async function insertRecordListToFile(knex: Knex): Promise<string> {
  const id = generateRandomId(6);
  await knex(TRANSFORMERS_TABLE).insert({
    id,
    type: 'standard',
    function_name: 'record-list-to-file',
    input_type: 'record-list',
    output_type: 'file',
    created_by: 'system',
    updated_by: 'system'
  });
  return id;
}

export async function down(): Promise<void> {
  return;
}
