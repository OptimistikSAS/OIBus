import { Knex } from 'knex';

// The configuration changes are shared with the config upgrade of the same version (applied to imported configurations)
import {
  FILE_PASSTHROUGH,
  IGNORE_FUNCTION_NAME,
  ISO_FUNCTION_NAME,
  Passthrough,
  passthroughFor,
  planRouting,
  planSourceRouting,
  RoutingLink,
  SETPOINT_PASSTHROUGH,
  southContentType
} from '../../../../service/config-transfer/config-upgrades/3.10/passthrough-transformers';
import { generateRandomId } from '../../../../service/utils';

const TRANSFORMERS_TABLE = 'transformers';
const NORTH_CONNECTORS_TABLE = 'north_connectors';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const GROUP_ITEMS_TABLE = 'group_items';
const NORTH_TRANSFORMERS_TABLE = 'north_transformers';
const NORTH_TRANSFORMERS_ITEMS_TABLE = 'north_transformers_items';
const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';
const HISTORY_QUERY_TRANSFORMERS_TABLE = 'history_query_transformers';
const HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE = 'history_query_transformers_items';

interface NorthLinkRow {
  id: string;
  transformer_id: string;
  source_type: string;
  source_api_data_source_id: string | null;
  source_south_south_id: string | null;
  source_south_group_id: string | null;
}

/**
 * The 'iso' and 'ignore' standard transformers are removed: a North now drops the data no transformer is configured
 * for. The links are changed to keep routing the data as before (see `passthrough-transformers.ts`):
 *  - the data a North received as is, without transformer or through 'iso', goes through the passthrough of its content
 *    type ('file', 'record-list-to-json' or 'setpoint-to-json'), at the south level for the data without transformer;
 *  - the files of the OIBus API go through a 'file' transformer applying to every data source, unless the North ignored
 *    some of them;
 *  - the items configured with 'ignore' are left out of the North transformers they fell back to (applying to their
 *    group or to their whole south), flagged as excluded items of these transformers; the history query transformers,
 *    which cannot leave items out, are narrowed to the list of the other items.
 */
export async function up(knex: Knex): Promise<void> {
  // A North transformer applying to all the items of a south, or of a group, can leave some items out
  await knex.schema.alterTable(NORTH_TRANSFORMERS_ITEMS_TABLE, table => {
    table.boolean('excluded').notNullable().defaultTo(false);
  });

  const standardTransformers: Array<{ id: string; function_name: string }> = await knex(TRANSFORMERS_TABLE)
    .select('id', 'function_name')
    .where('type', 'standard');
  const functionNames = new Map(standardTransformers.map(transformer => [transformer.id, transformer.function_name]));
  const passthroughIds = new Map<string, string>();
  const passthroughId = async (passthrough: Passthrough): Promise<string> => {
    let id = passthroughIds.get(passthrough.functionName);
    if (!id) {
      id = await ensureStandardTransformer(knex, passthrough);
      passthroughIds.set(passthrough.functionName, id);
    }
    return id;
  };

  const southItems = groupBy<{ connector_id: string; id: string }>(
    await knex(SOUTH_ITEMS_TABLE).select('connector_id', 'id'),
    row => row.connector_id
  );
  const groupItems = groupBy<{ group_id: string; item_id: string }>(
    await knex(GROUP_ITEMS_TABLE).select('group_id', 'item_id'),
    row => row.group_id
  );
  const souths: Array<{ id: string; type: string }> = await knex(SOUTH_CONNECTORS_TABLE).select('id', 'type');
  const norths: Array<{ id: string; type: string }> = await knex(NORTH_CONNECTORS_TABLE).select('id', 'type');

  for (const north of norths) {
    const links: Array<NorthLinkRow> = await knex(NORTH_TRANSFORMERS_TABLE)
      .select('id', 'transformer_id', 'source_type', 'source_api_data_source_id', 'source_south_south_id', 'source_south_group_id')
      .where('north_id', north.id);
    const linkItems = groupBy<{ id: string; item_id: string | null }>(
      await knex(NORTH_TRANSFORMERS_ITEMS_TABLE)
        .select('id', 'item_id')
        .whereIn(
          'id',
          links.map(link => link.id)
        ),
      row => row.id
    );

    for (const south of souths) {
      const routingLinks: Array<RoutingLink> = links
        .filter(link => link.source_type === 'south' && link.source_south_south_id === south.id)
        .map(link => ({
          id: link.id,
          functionName: functionNames.get(link.transformer_id),
          itemIds: (linkItems.get(link.id) ?? []).filter(row => row.item_id).map(row => row.item_id!),
          groupItemIds: link.source_south_group_id ? (groupItems.get(link.source_south_group_id) ?? []).map(row => row.item_id) : undefined
        }));
      const contentType = southContentType(south.type);
      const defaultPassthrough = passthroughFor(contentType, north.type, false);
      const isoPassthrough = passthroughFor(contentType, north.type, true);
      const plan = planRouting(
        routingLinks,
        (southItems.get(south.id) ?? []).map(row => row.id),
        defaultPassthrough !== undefined,
        isoPassthrough !== undefined,
        true
      );

      await removeLinks(knex, NORTH_TRANSFORMERS_TABLE, NORTH_TRANSFORMERS_ITEMS_TABLE, plan.removed);
      if (plan.toPassthrough.length > 0) {
        await knex(NORTH_TRANSFORMERS_TABLE)
          .whereIn('id', plan.toPassthrough)
          .update({ transformer_id: await passthroughId(isoPassthrough!), options: '{}' });
      }
      // Only the links listing items are narrowed: they keep listing some of them
      for (const [id, itemIds] of plan.narrowed) {
        await setLinkItems(knex, NORTH_TRANSFORMERS_ITEMS_TABLE, id, itemIds);
      }
      for (const [id, itemIds] of plan.excluded) {
        await excludeLinkItems(knex, id, itemIds);
      }
      if (plan.added) {
        const id = generateRandomId(6);
        await knex(NORTH_TRANSFORMERS_TABLE).insert({
          ...northLink(id, north.id, await passthroughId(defaultPassthrough!), 'south'),
          source_south_south_id: south.id
        });
        await setLinkItems(knex, NORTH_TRANSFORMERS_ITEMS_TABLE, id, plan.added.itemIds);
        await excludeLinkItems(knex, id, plan.added.excludedItemIds);
      }
    }

    // OIBus API: each data source is routed by its first link, the others by the new link applying to every data source
    const apiLinks = groupBy(
      links.filter(link => link.source_type === 'oibus-api'),
      link => link.source_api_data_source_id ?? ''
    );
    const filePassthrough = passthroughFor('any', north.type, true);
    let ignoresDataSources = false;
    for (const dataSourceLinks of apiLinks.values()) {
      const plan = planSourceRouting(
        dataSourceLinks.map(link => ({ id: link.id, functionName: functionNames.get(link.transformer_id) })),
        filePassthrough !== undefined
      );
      ignoresDataSources ||= plan.ignored;
      await removeLinks(knex, NORTH_TRANSFORMERS_TABLE, NORTH_TRANSFORMERS_ITEMS_TABLE, plan.removed);
      if (plan.toPassthrough) {
        await knex(NORTH_TRANSFORMERS_TABLE)
          .where('id', plan.toPassthrough)
          .update({ transformer_id: await passthroughId(FILE_PASSTHROUGH), options: '{}' });
      }
    }
    if (filePassthrough && !ignoresDataSources) {
      await knex(NORTH_TRANSFORMERS_TABLE).insert(
        northLink(generateRandomId(6), north.id, await passthroughId(FILE_PASSTHROUGH), 'oibus-api')
      );
    }

    // OIAnalytics setpoints
    const setpointLinks = links.filter(link => link.source_type === 'oianalytics-setpoint');
    const setpointPassthrough = passthroughFor('setpoint', north.type, true);
    const setpointPlan = planSourceRouting(
      setpointLinks.map(link => ({ id: link.id, functionName: functionNames.get(link.transformer_id) })),
      setpointPassthrough !== undefined
    );
    await removeLinks(knex, NORTH_TRANSFORMERS_TABLE, NORTH_TRANSFORMERS_ITEMS_TABLE, setpointPlan.removed);
    if (setpointPlan.toPassthrough) {
      await knex(NORTH_TRANSFORMERS_TABLE)
        .where('id', setpointPlan.toPassthrough)
        .update({ transformer_id: await passthroughId(SETPOINT_PASSTHROUGH), options: '{}' });
    }
    if (setpointLinks.length === 0 && setpointPassthrough) {
      await knex(NORTH_TRANSFORMERS_TABLE).insert(
        northLink(generateRandomId(6), north.id, await passthroughId(SETPOINT_PASSTHROUGH), 'oianalytics-setpoint')
      );
    }
  }

  const historyQueries: Array<{ id: string; south_type: string; north_type: string }> = await knex(HISTORY_QUERIES_TABLE).select(
    'id',
    'south_type',
    'north_type'
  );
  for (const historyQuery of historyQueries) {
    const links: Array<{ id: string; transformer_id: string }> = await knex(HISTORY_QUERY_TRANSFORMERS_TABLE)
      .select('id', 'transformer_id')
      .where('history_id', historyQuery.id);
    const linkItems = groupBy<{ id: string; item_id: string }>(
      await knex(HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE)
        .select('id', 'item_id')
        .whereIn(
          'id',
          links.map(link => link.id)
        ),
      row => row.id
    );
    const itemIds = (await knex(HISTORY_ITEMS_TABLE).select('id').where('history_id', historyQuery.id)).map(row => row.id as string);
    const contentType = southContentType(historyQuery.south_type);
    const defaultPassthrough = passthroughFor(contentType, historyQuery.north_type, false);
    const isoPassthrough = passthroughFor(contentType, historyQuery.north_type, true);
    const plan = planRouting(
      links.map(link => ({
        id: link.id,
        functionName: functionNames.get(link.transformer_id),
        itemIds: (linkItems.get(link.id) ?? []).map(row => row.item_id)
      })),
      itemIds,
      defaultPassthrough !== undefined,
      isoPassthrough !== undefined,
      false
    );

    await removeLinks(knex, HISTORY_QUERY_TRANSFORMERS_TABLE, HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE, plan.removed);
    if (plan.toPassthrough.length > 0) {
      await knex(HISTORY_QUERY_TRANSFORMERS_TABLE)
        .whereIn('id', plan.toPassthrough)
        .update({ transformer_id: await passthroughId(isoPassthrough!), options: '{}' });
    }
    for (const [id, narrowedItemIds] of plan.narrowed) {
      await setLinkItems(knex, HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE, id, narrowedItemIds);
    }
    if (plan.added) {
      const id = generateRandomId(6);
      await knex(HISTORY_QUERY_TRANSFORMERS_TABLE).insert({
        id,
        history_id: historyQuery.id,
        transformer_id: await passthroughId(defaultPassthrough!),
        options: '{}'
      });
      await setLinkItems(knex, HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE, id, plan.added.itemIds);
    }
  }

  // The links left to 'iso' and 'ignore' were never used (e.g. their south was deleted)
  const removedTransformerIds = standardTransformers
    .filter(transformer => transformer.function_name === ISO_FUNCTION_NAME || transformer.function_name === IGNORE_FUNCTION_NAME)
    .map(transformer => transformer.id);
  for (const [linksTable, itemsTable] of [
    [NORTH_TRANSFORMERS_TABLE, NORTH_TRANSFORMERS_ITEMS_TABLE],
    [HISTORY_QUERY_TRANSFORMERS_TABLE, HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE]
  ]) {
    const leftLinks = await knex(linksTable).select('id').whereIn('transformer_id', removedTransformerIds);
    await removeLinks(
      knex,
      linksTable,
      itemsTable,
      leftLinks.map(link => link.id as string)
    );
  }
  await knex(TRANSFORMERS_TABLE).whereIn('id', removedTransformerIds).del();
}

function northLink(id: string, northId: string, transformerId: string, sourceType: string) {
  return {
    id,
    north_id: northId,
    transformer_id: transformerId,
    options: '{}',
    source_type: sourceType,
    source_api_data_source_id: null,
    source_south_south_id: null,
    source_south_group_id: null
  };
}

function groupBy<T>(rows: Array<T>, key: (row: T) => string): Map<string, Array<T>> {
  const groups = new Map<string, Array<T>>();
  for (const row of rows) {
    const group = groups.get(key(row));
    if (group) {
      group.push(row);
    } else {
      groups.set(key(row), [row]);
    }
  }
  return groups;
}

async function removeLinks(knex: Knex, linksTable: string, itemsTable: string, ids: Array<string>): Promise<void> {
  if (ids.length === 0) return;
  await knex(itemsTable).whereIn('id', ids).del();
  await knex(linksTable).whereIn('id', ids).del();
}

/** Scopes a link to a list of items (to the whole source when the list is empty) */
async function setLinkItems(knex: Knex, itemsTable: string, id: string, itemIds: Array<string>): Promise<void> {
  await knex(itemsTable).where('id', id).del();
  await knex.batchInsert(
    itemsTable,
    itemIds.map(itemId => ({ id, item_id: itemId })),
    100
  );
}

/** Leaves items out of a North link applying to a group or to a whole south */
async function excludeLinkItems(knex: Knex, id: string, itemIds: Array<string>): Promise<void> {
  await knex.batchInsert(
    NORTH_TRANSFORMERS_ITEMS_TABLE,
    itemIds.map(itemId => ({ id, item_id: itemId, excluded: true })),
    100
  );
}

/** The id of a standard transformer, created when missing (the startup seeding runs after the migrations). */
async function ensureStandardTransformer(knex: Knex, passthrough: Passthrough): Promise<string> {
  const existing: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
    .where({ type: 'standard', function_name: passthrough.functionName })
    .first('id');
  if (existing) return existing.id;
  const id = generateRandomId(6);
  await knex(TRANSFORMERS_TABLE).insert({
    id,
    type: 'standard',
    function_name: passthrough.functionName,
    input_type: passthrough.inputType,
    output_type: passthrough.outputType,
    created_by: 'system',
    updated_by: 'system'
  });
  return id;
}

export async function down(): Promise<void> {
  return;
}
