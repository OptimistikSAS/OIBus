import { Knex } from 'knex';
import { generateRandomId } from '../../../../service/utils';

const TRANSFORMERS_TABLE = 'transformers';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const SOUTH_ITEM_GROUPS_TABLE = 'south_item_groups';
const GROUP_ITEMS_TABLE = 'group_items';
const NORTH_CONNECTORS_TABLE = 'north_connectors';
const NORTH_TRANSFORMERS_TABLE = 'north_transformers';
const NORTH_TRANSFORMERS_ITEMS_TABLE = 'north_transformers_items';
const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';
const HISTORY_QUERY_TRANSFORMERS_TABLE = 'history_query_transformers';
const HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE = 'history_query_transformers_items';

interface OldDateTimeField {
  fieldName: string;
  useAsReference: boolean;
  type: string;
  timezone?: string | null;
  format?: string | null;
  locale?: string | null;
}

interface OldSerialization {
  type: 'csv';
  filename: string;
  delimiter: string;
  compression: boolean;
  outputTimestampFormat: string;
  outputTimezone: string;
}

interface OldOdbcItemSettings {
  dateTimeFields?: Array<OldDateTimeField> | null;
  serialization?: OldSerialization;
  [key: string]: unknown;
}

/**
 * The ODBC south connector no longer supports connecting through the Windows OIBus Agent: it now
 * always uses the local `odbc` driver, the same code path `remoteAgent: false` already used. The
 * `remoteAgent`/`agentUrl` toggle is gone, and `retryInterval`/`requestTimeout` go with it since they
 * only existed to configure the agent's reconnect loop and HTTP read timeout — the local driver path
 * doesn't use either.
 *
 * Connectors that had `remoteAgent: true` lose the ability to reach their ODBC agent after this
 * migration and must be reconfigured with a driver installed locally (or reachable through a locally
 * configured DSN), same as any other ODBC connector.
 *
 * On top of that, south-odbc gets the same 'record-list' rework the other SQL-family souths already
 * got in v3.10.0_2 (which explicitly excluded odbc/oledb, deferring odbc to this migration): it stops
 * serializing rows into CSV itself and now emits `record-list` content, relying on a north-side
 * `record-list-to-csv` transformer to do the CSV encoding that `item.settings.serialization` used to
 * do inline. See v3.10.0_2's module doc comment for the full rationale — the same two steps
 * (item settings rewrite + per-item transformer attachment, for both south connectors and history
 * queries) are applied here, scoped to odbc only.
 *
 * Not reversible: once the agent settings are dropped and dateTimeFields/serialization are folded
 * into per-item transformer rows (or an existing 'iso' row is shadowed by a new item-level one), the
 * original settings shape can't be reconstructed from that state alone.
 */
export async function up(knex: Knex): Promise<void> {
  await stripAgentSettings(knex, SOUTH_CONNECTORS_TABLE, 'settings', 'type');
  await stripAgentSettings(knex, HISTORY_QUERIES_TABLE, 'south_settings', 'south_type');

  const recordListToCsvTransformerId = await ensureRecordListToCsvTransformer(knex);
  const northIds = (await knex(NORTH_CONNECTORS_TABLE).select('id')).map(n => n.id as string);

  const souths: Array<{ id: string }> = await knex(SOUTH_CONNECTORS_TABLE).select('id').where('type', 'odbc');
  for (const south of souths) {
    await migrateSouthConnectorItems(knex, south.id, northIds, recordListToCsvTransformerId);
  }

  await migrateHistoryQueries(knex, recordListToCsvTransformerId);
}

export async function down(_knex: Knex): Promise<void> {
  return;
}

async function stripAgentSettings(knex: Knex, table: string, settingsColumn: string, typeColumn: string): Promise<void> {
  const rows: Array<{ id: string; settings: string }> = await knex(table)
    .select('id', `${settingsColumn} as settings`)
    .where(typeColumn, 'odbc');
  if (rows.length === 0) return;

  const updates = rows.map(({ id, settings }) => {
    const {
      remoteAgent: _remoteAgent,
      agentUrl: _agentUrl,
      retryInterval: _retryInterval,
      requestTimeout: _requestTimeout,
      ...rest
    } = JSON.parse(settings) as Record<string, unknown>;
    return { id, settings: JSON.stringify(rest) };
  });

  await bulkUpdateSettings(knex, table, settingsColumn, updates);
}

/**
 * Ensures a single, shared 'record-list-to-csv' row exists in the transformers catalog (same
 * idempotent check-then-insert pattern as `createDefaultTransformers` in 3.8.0's migration), reusing
 * the row v3.10.0_2 already created for the other SQL-family souths if this runs after it.
 */
async function ensureRecordListToCsvTransformer(knex: Knex): Promise<string> {
  const existing = await knex(TRANSFORMERS_TABLE).select('id').where('function_name', 'record-list-to-csv').first();
  if (existing) return existing.id as string;

  const id = generateRandomId(6);
  await knex(TRANSFORMERS_TABLE).insert({
    id,
    type: 'standard',
    function_name: 'record-list-to-csv',
    input_type: 'record-list',
    output_type: 'any',
    created_by: 'system',
    updated_by: 'system'
  });
  return id;
}

/**
 * Converts one item's old settings in place: drops `dateTimeFields`/`serialization`, adds
 * `trackingInstant` derived from whichever dateTimeFields entry (if any) had `useAsReference: true`.
 */
function toNewItemSettings(oldSettings: OldOdbcItemSettings): Record<string, unknown> {
  const { dateTimeFields: _dateTimeFields, serialization: _serialization, ...rest } = oldSettings;
  const referenceField = oldSettings.dateTimeFields?.find(field => field.useAsReference) ?? null;
  return {
    ...rest,
    trackingInstant: referenceField
      ? {
          trackInstant: true,
          fieldName: referenceField.fieldName,
          dateTimeInput: {
            type: referenceField.type,
            timezone: referenceField.timezone ?? null,
            format: referenceField.format ?? null,
            locale: referenceField.locale ?? null
          }
        }
      : { trackInstant: false }
  };
}

/**
 * Builds the options for a `record-list-to-csv` transformer that reproduces one item's old CSV
 * output: same filename/delimiter/compression, and every old dateTimeFields entry (not just the
 * reference one — the original code rendered all of them) becomes a `fields` entry with
 * `dataType: 'datetime'`, sharing the item's old `outputTimestampFormat`/`outputTimezone`. Columns
 * with no entry in `fields` pass through unchanged, same as before.
 */
function buildTransformerOptions(oldSettings: OldOdbcItemSettings): Record<string, unknown> {
  const serialization = oldSettings.serialization;
  return {
    filename: serialization?.filename ?? '@CurrentDate.csv',
    encoding: 'UTF_8',
    header: true,
    compression: serialization?.compression ?? false,
    delimiter: serialization?.delimiter ?? 'COMMA',
    newline: 'LF',
    quoteChar: 'NONE',
    escapeChar: 'DOUBLE_QUOTE',
    nullValue: '',
    fields: (oldSettings.dateTimeFields ?? []).map(field => ({
      fieldName: field.fieldName,
      columnName: null,
      dataType: 'datetime',
      fieldProcess: null,
      datetimeSettings: {
        inputType: field.type,
        inputTimezone: field.timezone ?? null,
        inputFormat: field.format ?? null,
        inputLocale: field.locale ?? null,
        outputType: 'string',
        outputTimezone: serialization?.outputTimezone ?? 'UTC',
        outputFormat: serialization?.outputTimestampFormat ?? 'yyyy-MM-dd HH:mm:ss.SSS',
        outputLocale: null
      }
    }))
  };
}

/**
 * Writes each `{ id, settings }` pair via chunked `UPDATE ... SET settings = CASE id WHEN ? THEN ? ...
 * END WHERE id IN (...)` statements — the house pattern for bulk-rewriting many rows' JSON settings
 * (see 3.8.0's `bulkUpdateSettings`), instead of one UPDATE per row.
 */
async function bulkUpdateSettings(
  knex: Knex,
  table: string,
  settingsColumn: string,
  updates: Array<{ id: string; settings: string }>
): Promise<void> {
  for (const batch of chunk(updates, 100)) {
    const caseSql = batch.map(() => 'when ? then ?').join(' ');
    const caseBindings = batch.flatMap(u => [u.id, u.settings]);
    await knex(table)
      .whereIn(
        'id',
        batch.map(u => u.id)
      )
      .update({ [settingsColumn]: knex.raw(`case id ${caseSql} end`, caseBindings) });
  }
}

function chunk<T>(array: Array<T>, size: number): Array<Array<T>> {
  const chunks: Array<Array<T>> = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

interface ExistingTransformerRow {
  id: string;
  north_id: string;
  source_south_group_id: string | null;
  function_name: string;
}

/**
 * Replicates `NorthConnector.rebuildTransformerCache()`'s item → group → south-level priority
 * lookup, built once from the pre-migration `north_transformers`/`north_transformers_items` rows
 * scoped to `southId`, across every north (instead of one DB round-trip per (north, item) pair).
 */
async function buildTransformerLookup(
  knex: Knex,
  southId: string
): Promise<{
  itemLevel: Map<string, ExistingTransformerRow>;
  groupLevel: Map<string, ExistingTransformerRow>;
  southLevel: Map<string, ExistingTransformerRow>;
}> {
  const existingRows: Array<ExistingTransformerRow> = await knex(`${NORTH_TRANSFORMERS_TABLE} as nt`)
    .join(`${TRANSFORMERS_TABLE} as t`, 't.id', 'nt.transformer_id')
    .where('nt.source_south_south_id', southId)
    .select('nt.id', 'nt.north_id', 'nt.source_south_group_id', 't.function_name');

  const itemLinks: Array<{ id: string; item_id: string }> = existingRows.length
    ? await knex(NORTH_TRANSFORMERS_ITEMS_TABLE)
        .select('id', 'item_id')
        .whereIn(
          'id',
          existingRows.map(r => r.id)
        )
        .whereNotNull('item_id')
    : [];
  const itemIdsByRowId = new Map<string, Array<string>>();
  for (const link of itemLinks) {
    if (!itemIdsByRowId.has(link.id)) itemIdsByRowId.set(link.id, []);
    itemIdsByRowId.get(link.id)!.push(link.item_id);
  }

  const itemLevel = new Map<string, ExistingTransformerRow>();
  const groupLevel = new Map<string, ExistingTransformerRow>();
  const southLevel = new Map<string, ExistingTransformerRow>();
  for (const row of existingRows) {
    if (row.source_south_group_id) {
      const key = `${row.north_id}\0${row.source_south_group_id}`;
      if (!groupLevel.has(key)) groupLevel.set(key, row);
      continue;
    }
    const linkedItemIds = itemIdsByRowId.get(row.id) ?? [];
    if (linkedItemIds.length > 0) {
      for (const itemId of linkedItemIds) {
        const key = `${row.north_id}\0${itemId}`;
        if (!itemLevel.has(key)) itemLevel.set(key, row);
      }
    } else {
      if (!southLevel.has(row.north_id)) southLevel.set(row.north_id, row);
    }
  }
  return { itemLevel, groupLevel, southLevel };
}

async function migrateSouthConnectorItems(
  knex: Knex,
  southId: string,
  northIds: Array<string>,
  recordListToCsvTransformerId: string
): Promise<void> {
  const items: Array<{ id: string; settings: string }> = await knex(SOUTH_ITEMS_TABLE)
    .select('id', 'settings')
    .where('connector_id', southId);
  if (items.length === 0) return;

  const groupMemberships: Array<{ item_id: string; group_id: string }> = await knex(`${GROUP_ITEMS_TABLE} as gi`)
    .join(`${SOUTH_ITEM_GROUPS_TABLE} as sig`, 'sig.id', 'gi.group_id')
    .where('sig.south_id', southId)
    .select('gi.item_id', 'gi.group_id');
  const groupIdByItemId = new Map(groupMemberships.map(g => [g.item_id, g.group_id]));

  const { itemLevel, groupLevel, southLevel } = await buildTransformerLookup(knex, southId);

  const settingsUpdates: Array<{ id: string; settings: string }> = [];
  const newTransformerRows: Array<Record<string, unknown>> = [];
  const newTransformerItemLinks: Array<{ id: string; item_id: string }> = [];

  for (const item of items) {
    const oldSettings: OldOdbcItemSettings = JSON.parse(item.settings);
    settingsUpdates.push({ id: item.id, settings: JSON.stringify(toNewItemSettings(oldSettings)) });

    const transformerOptions = buildTransformerOptions(oldSettings);
    const groupId = groupIdByItemId.get(item.id) ?? null;

    for (const northId of northIds) {
      const resolved =
        itemLevel.get(`${northId}\0${item.id}`) ??
        (groupId ? groupLevel.get(`${northId}\0${groupId}`) : undefined) ??
        southLevel.get(northId);

      // No transformer at all, or a bare passthrough that only "worked" because the south used to
      // hand it pre-built CSV bytes -> attach a record-list-to-csv transformer for this item.
      // 'ignore' and any other configured transformer are left as a deliberate choice.
      if (resolved && resolved.function_name !== 'iso') continue;

      const id = generateRandomId(6);
      newTransformerRows.push({
        id,
        north_id: northId,
        transformer_id: recordListToCsvTransformerId,
        options: JSON.stringify(transformerOptions),
        source_type: 'south',
        source_api_data_source_id: null,
        source_south_south_id: southId,
        source_south_group_id: null
      });
      newTransformerItemLinks.push({ id, item_id: item.id });
    }
  }

  await bulkUpdateSettings(knex, SOUTH_ITEMS_TABLE, 'settings', settingsUpdates);
  if (newTransformerRows.length > 0) {
    await knex.batchInsert(NORTH_TRANSFORMERS_TABLE, newTransformerRows, 100);
    await knex.batchInsert(NORTH_TRANSFORMERS_ITEMS_TABLE, newTransformerItemLinks, 100);
  }
}

/**
 * Same treatment as `migrateSouthConnectorItems`, for history queries whose south is odbc. A history
 * query has exactly one implicit south (its own `south_type`/`south_settings`) and no south-item-group
 * concept, so resolution is item-level vs. history-level fallback only - no group level.
 */
async function migrateHistoryQueries(knex: Knex, recordListToCsvTransformerId: string): Promise<void> {
  const historyQueries: Array<{ id: string }> = await knex(HISTORY_QUERIES_TABLE).select('id').where('south_type', 'odbc');
  if (historyQueries.length === 0) return;

  const settingsUpdates: Array<{ id: string; settings: string }> = [];
  const newTransformerRows: Array<Record<string, unknown>> = [];
  const newTransformerItemLinks: Array<{ id: string; item_id: string }> = [];

  for (const historyQuery of historyQueries) {
    const items: Array<{ id: string; settings: string }> = await knex(HISTORY_ITEMS_TABLE)
      .select('id', 'settings')
      .where('history_id', historyQuery.id);
    if (items.length === 0) continue;

    const existingRows: Array<{ id: string; function_name: string }> = await knex(`${HISTORY_QUERY_TRANSFORMERS_TABLE} as ht`)
      .join(`${TRANSFORMERS_TABLE} as t`, 't.id', 'ht.transformer_id')
      .where('ht.history_id', historyQuery.id)
      .select('ht.id', 't.function_name');
    const itemLinks: Array<{ id: string; item_id: string }> = existingRows.length
      ? await knex(HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE)
          .select('id', 'item_id')
          .whereIn(
            'id',
            existingRows.map(r => r.id)
          )
      : [];
    const itemIdsByRowId = new Map<string, Array<string>>();
    for (const link of itemLinks) {
      if (!itemIdsByRowId.has(link.id)) itemIdsByRowId.set(link.id, []);
      itemIdsByRowId.get(link.id)!.push(link.item_id);
    }
    const itemLevel = new Map<string, { id: string; function_name: string }>();
    let historyLevel: { id: string; function_name: string } | undefined;
    for (const row of existingRows) {
      const linkedItemIds = itemIdsByRowId.get(row.id) ?? [];
      if (linkedItemIds.length > 0) {
        for (const itemId of linkedItemIds) {
          if (!itemLevel.has(itemId)) itemLevel.set(itemId, row);
        }
      } else if (!historyLevel) {
        historyLevel = row;
      }
    }

    for (const item of items) {
      const oldSettings: OldOdbcItemSettings = JSON.parse(item.settings);
      settingsUpdates.push({ id: item.id, settings: JSON.stringify(toNewItemSettings(oldSettings)) });

      const resolved = itemLevel.get(item.id) ?? historyLevel;
      if (resolved && resolved.function_name !== 'iso') continue;

      const id = generateRandomId(6);
      newTransformerRows.push({
        id,
        history_id: historyQuery.id,
        transformer_id: recordListToCsvTransformerId,
        options: JSON.stringify(buildTransformerOptions(oldSettings))
      });
      newTransformerItemLinks.push({ id, item_id: item.id });
    }
  }

  await bulkUpdateSettings(knex, HISTORY_ITEMS_TABLE, 'settings', settingsUpdates);
  if (newTransformerRows.length > 0) {
    await knex.batchInsert(HISTORY_QUERY_TRANSFORMERS_TABLE, newTransformerRows, 100);
    await knex.batchInsert(HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE, newTransformerItemLinks, 100);
  }
}
