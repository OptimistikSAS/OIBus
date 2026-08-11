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

// The SQL-family souths reworked to emit 'record-list' content instead of pre-serialized CSV.
// south-odbc and south-oledb are intentionally excluded (their CSV building happens in an external
// .NET agent, outside this refactor's scope).
const SQL_SOUTH_TYPES = ['mysql', 'postgresql', 'mssql', 'oracle', 'sqlite'];

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

interface OldSqlItemSettings {
  dateTimeFields?: Array<OldDateTimeField> | null;
  serialization?: OldSerialization;
  [key: string]: unknown;
}

/**
 * SQL-family souths (mysql/postgresql/mssql/oracle/sqlite) stopped serializing rows into CSV
 * themselves — they now emit `record-list` content (raw rows) and rely on a north-side
 * `record-list-to-csv` transformer to do the CSV encoding that `item.settings.serialization` used
 * to do inline. This migration:
 *
 *  1. Rewrites every affected item's settings: `dateTimeFields` + `serialization` are replaced by a
 *     single `trackingInstant` (mirroring south-rest's own trackingInstant shape), used only to
 *     compute the incremental query cursor. The CSV-rendering config itself (filename, delimiter,
 *     compression, per-column datetime formatting) moves to a transformer.
 *  2. For every enabled north connector (content fans out to all of them, unconditionally — see
 *     `DataStreamEngine.addContent`) and every affected item, preserves today's behavior by
 *     attaching a `record-list-to-csv` transformer, scoped to that one item, carrying the old
 *     per-item CSV settings as its options — but only where doing so doesn't override a
 *     deliberate user choice:
 *       - No transformer currently resolves for that (north, item) → attach one (today the north
 *         silently receives the pre-built CSV file untouched; after this migration, without a
 *         transformer it would receive a raw JSON dump instead of the SQL south's actual CSV text).
 *       - The resolved transformer is 'iso' (pure passthrough) → attach one anyway: passthrough only
 *         behaved like the old CSV export because the south itself already produced CSV bytes; now
 *         that the south emits raw records, 'iso' alone would leak them through unrendered.
 *       - The resolved transformer is 'ignore' → leave it, it's still a deliberate "drop this" choice.
 *       - Any other transformer (csv-to-mqtt, csv-to-time-values, json-to-csv, custom, ...) → leave it
 *         untouched; it was configured against the old CSV/'any' shape and needs a human to re-check
 *         it against the new record-list shape — an edge case explicitly left for manual follow-up.
 *  3. The same two steps for history queries against `history_items`/`history_query_transformers(_items)`
 *     — history queries route through the exact same transformer resolution machinery (they build a
 *     real `NorthConnector` under the hood), just without a south-item-group concept.
 *
 * Not reversible: once dateTimeFields/serialization are folded into per-item transformer rows (or an
 * existing 'iso' row is shadowed by a new item-level one), the original settings shape can't be
 * reconstructed from that state alone.
 */
export async function up(knex: Knex): Promise<void> {
  const recordListToCsvTransformerId = await ensureRecordListToCsvTransformer(knex);

  const enabledNorthIds = (await knex(NORTH_CONNECTORS_TABLE).select('id').where('enabled', true)).map(n => n.id as string);

  for (const southType of SQL_SOUTH_TYPES) {
    const souths: Array<{ id: string }> = await knex(SOUTH_CONNECTORS_TABLE).select('id').where('type', southType);
    for (const south of souths) {
      await migrateSouthConnectorItems(knex, south.id, enabledNorthIds, recordListToCsvTransformerId);
    }
  }

  await migrateHistoryQueries(knex, recordListToCsvTransformerId);
}

export async function down(_knex: Knex): Promise<void> {
  // Not reversible - see the module doc comment above.
  return;
}

/**
 * Ensures a single, shared 'record-list-to-csv' row exists in the transformers catalog (same
 * idempotent check-then-insert pattern as `createDefaultTransformers` in 3.8.0's migration) so the
 * `north_transformers`/`history_query_transformers` rows inserted below have something to reference.
 * Can't rely on `TransformerRepository`'s own startup seeding — that runs after migrations.
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
function toNewItemSettings(oldSettings: OldSqlItemSettings): Record<string, unknown> {
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
 * reference one — the original code rendered all of them) becomes a `datetimeFields` entry sharing
 * the item's old `outputTimestampFormat`/`outputTimezone`.
 */
function buildTransformerOptions(oldSettings: OldSqlItemSettings): Record<string, unknown> {
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
    datetimeFields: (oldSettings.dateTimeFields ?? []).map(field => ({
      fieldName: field.fieldName,
      input: {
        type: field.type,
        timezone: field.timezone ?? null,
        format: field.format ?? null,
        locale: field.locale ?? null
      },
      outputTimestampFormat: serialization?.outputTimestampFormat ?? 'yyyy-MM-dd HH:mm:ss.SSS',
      outputTimezone: serialization?.outputTimezone ?? 'UTC'
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
  enabledNorthIds: Array<string>,
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
    const oldSettings: OldSqlItemSettings = JSON.parse(item.settings);
    settingsUpdates.push({ id: item.id, settings: JSON.stringify(toNewItemSettings(oldSettings)) });

    const transformerOptions = buildTransformerOptions(oldSettings);
    const groupId = groupIdByItemId.get(item.id) ?? null;

    for (const northId of enabledNorthIds) {
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
 * Same treatment as `migrateSouthConnectorItems`, for history queries. A history query has exactly
 * one implicit south (its own `south_type`/`south_settings`) and no south-item-group concept, so
 * resolution is item-level vs. history-level fallback only - no group level.
 */
async function migrateHistoryQueries(knex: Knex, recordListToCsvTransformerId: string): Promise<void> {
  const historyQueries: Array<{ id: string }> = await knex(HISTORY_QUERIES_TABLE).select('id').whereIn('south_type', SQL_SOUTH_TYPES);
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
      const oldSettings: OldSqlItemSettings = JSON.parse(item.settings);
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
