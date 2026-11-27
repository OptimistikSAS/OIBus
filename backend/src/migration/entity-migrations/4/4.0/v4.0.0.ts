import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import argon2 from 'argon2';
import Database from 'better-sqlite3';
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
} from '../../../../service/config-transfer/config-upgrades/4.0/passthrough-transformers';
import {
  buildRecordListToCsvOptions,
  COMPRESSED_FILE_OPTIONS,
  COMPRESSING_SOUTH_TYPES,
  defaultRecordListToOIAnalyticsOptions,
  FIELD_PROCESS_FUNCTION_NAMES,
  FILE_AS_IS_OPTIONS,
  FILE_AS_IS_REPLACEMENT,
  FILE_OUTPUT_TRANSFORMER_REPLACEMENTS,
  FILE_TRANSFORMER_REPLACEMENTS,
  FILE_WRITER_REMOVED_DATA_TYPES,
  FILENAME_FUNCTION_NAMES,
  HISTORY_SOUTH_TYPES,
  IOT_FAMILY_SOUTH_TYPES,
  ITEM_REQUEST_TIMEOUT_SOUTH_TYPES,
  keepsResolvedTransformer,
  MAX_PARALLEL_RUN_SOUTH_TYPES,
  OIANALYTICS_TRANSFORMER_FUNCTION_NAMES,
  OldSqlItemSettings,
  POINT_SOUTH_TYPES,
  PREFIXING_NORTH_TYPES,
  RAW_RESAMPLING_SOUTH_TYPES,
  RECORD_LIST_TO_CSV_FUNCTION_NAME,
  RECORD_LIST_TO_OIANALYTICS_FUNCTION_NAME,
  resolveSouthItemLink,
  SETPOINT_TRANSFORMER_REPLACEMENTS,
  SQL_SOUTH_TYPES,
  TIME_VALUES_TRANSFORMER_REPLACEMENTS,
  toCertificateValidation,
  toDatabaseSouthSettings,
  toFieldProcessOperations,
  toFileDataType,
  toFileOutputTransformerOptions,
  toFileTransformerOptions,
  toFileWriterFileToFileOptions,
  toGroupedOIAnalyticsOptions,
  toLocalOleDbSettings,
  toNewSqlItemSettings,
  toNoneResamplingItemSettings,
  toOIAnalyticsItemFileOptions,
  toOPCUANorthSettings,
  toOPCUASouthSettings,
  toRecordListTransformerOptions,
  toServerTrust,
  toSetpointTransformerOptions,
  usesRemoteAgent,
  withItemRequestTimeout,
  withoutOdbcAgentSettings,
  withoutOpcAgentSettings,
  withoutPiAgentSettings,
  withoutUserCertificateFiles,
  withPiValueFilter,
  withPrefixAndSuffix
} from '../../../../service/config-transfer/config-upgrades/4.0/v4.0.0';
import { generateRandomId } from '../../../../service/utils';

const SCAN_MODES_TABLE = 'scan_modes';
const CERTIFICATES_TABLE = 'certificates';
const REGISTRATIONS_TABLE = 'registrations';
const COMMANDS_TABLE = 'commands';
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
const TRANSFORMER_LINK_TABLES = [NORTH_TRANSFORMERS_TABLE, HISTORY_QUERY_TRANSFORMERS_TABLE];
const AUDIT_LOGS_TABLE = 'audit_logs';
const ENGINES_TABLE = 'engines';
const CONFIGURATION_WORKFLOWS_TABLE = 'configuration_workflows';
const WORKFLOW_RUNS_TABLE = 'workflow_runs';
const ITEM_POINT_METADATA_TABLE = 'item_point_metadata';
const USERS_TABLE = 'users';
const OIANALYTICS_MESSAGE_TABLE = 'oianalytics_messages';

/**
 * 4.0.0 bundles several features and fixes, each applied by a step below, in this order (the steps exported for the
 * spec, which tests each of them on what the previous ones leave). Most data steps mirror a function of the config
 * upgrade of the same version, applied to imported configurations.
 */
export const STEPS: Array<(knex: Knex) => Promise<void>> = [
  addScanModeSchedulingAndCertificateChain,
  moveSqlSerializationToTransformers,
  addAuditTrail,
  addConfigurationWorkflows,
  addCachingStrategies,
  addOIAnalyticsReferenceProcess,
  reworkRegistrationPermissions,
  replaceRawResampling,
  addHttpsSettings,
  addContentEndpointSetting,
  replaceTimeValuesByRecordLists,
  replaceIsoAndIgnoreTransformers,
  groupOIAnalyticsOptions,
  renameAnyDataType,
  replaceCsvAndJsonReaders,
  replaceCsvAndJsonWriters,
  convertFileWriterLinks,
  convertOIAnalyticsSouths,
  moveCompressionToNorths,
  mergeSetpointsIntoRecordLists,
  replaceFileTransformer,
  moveFilenamePrefixAndSuffixToTransformers,
  addOPCUATimeoutsAndSubscriptionSettings,
  addItemAndWorkflowDescriptions,
  addEmptyIntervalStrategies,
  addDatabaseConnectionSettings,
  convertFieldProcessesToOperations,
  removeOdbcAgentSettings,
  removeOpcAgentSettings,
  useLocalOleDbDriver,
  removePiAgentSettings,
  addErrorAndArchiveMaxSizes,
  addEngineDescription,
  addRegistrationTokenRefresh,
  encryptSecretsWithAesGcm,
  flagDefaultPasswords,
  moveOPCUACertificateToStore,
  removeOPCUAUserCertificateFiles,
  addServerTrust,
  addTrustedCertificates,
  useTrustedCertificates
];

export async function up(knex: Knex): Promise<void> {
  for (const step of STEPS) {
    await step(knex);
  }
}

/**
 * Removes the tables and columns added by the migration. The data steps are not reversible: once converted, the
 * previous configuration cannot be rebuilt from the new one.
 *
 * Uses native SQLite `DROP COLUMN` (single in-place metadata change, available since SQLite 3.35) instead of knex's
 * `dropColumn()`, which rebuilds the table via CREATE + COPY + DROP TABLE + RENAME. The rebuild's `DROP TABLE` step fails
 * with a FOREIGN KEY constraint error when other tables hold live rows referencing the table (e.g. `group_items` and
 * `north_transformers_items` referencing `south_item_groups`/`south_items`, or the `scan_mode_id` of the items
 * referencing `scan_modes`), as SQLite refuses to drop a table that other tables still point into while `foreign_keys`
 * is enabled.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    table.boolean('accept_unauthorized').defaultTo(false);
  });
  await knex(REGISTRATIONS_TABLE).where('certificate_validation', 'trusted').update({ accept_unauthorized: 1 });
  await dropColumns(knex, REGISTRATIONS_TABLE, ['certificate_validation', 'trusted_certificate_id']);
  await dropColumns(knex, SOUTH_CONNECTORS_TABLE, ['server_trust']);
  await dropColumns(knex, NORTH_CONNECTORS_TABLE, ['server_trust']);
  await dropColumns(knex, HISTORY_QUERIES_TABLE, ['south_server_trust', 'north_server_trust']);
  await dropColumns(knex, USERS_TABLE, ['must_change_password']);
  await dropColumns(knex, REGISTRATIONS_TABLE, [
    'refresh_token',
    'token_expiration_date',
    'refresh_token_expiration_date',
    'previous_private_key',
    'cipher_key_rotation_date'
  ]);
  await dropColumns(knex, ENGINES_TABLE, ['description']);
  for (const table of [NORTH_CONNECTORS_TABLE, HISTORY_QUERIES_TABLE]) {
    await dropColumns(knex, table, ['caching_error_max_size', 'caching_archive_max_size']);
  }
  await dropColumns(knex, SOUTH_ITEM_GROUPS_TABLE, ['empty_interval_strategy']);
  await dropColumns(knex, SOUTH_ITEMS_TABLE, ['empty_interval_strategy']);
  await dropColumns(knex, SOUTH_ITEMS_TABLE, ['description']);
  await dropColumns(knex, HISTORY_ITEMS_TABLE, ['description']);
  await dropColumns(knex, NORTH_TRANSFORMERS_ITEMS_TABLE, ['excluded']);
  await dropColumns(knex, ENGINES_TABLE, ['enable_content_endpoint']);
  await dropColumns(knex, ENGINES_TABLE, [
    'https_enabled',
    'https_certificate_source',
    'https_certificate_id',
    'https_certificate_path',
    'https_private_key_path'
  ]);
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    for (const column of FORMER_PERMISSION_COLUMNS) {
      table.boolean(column);
    }
  });
  // A former permission gathered by several permissions is only granted when all of them are
  await knex(REGISTRATIONS_TABLE).update(
    Object.fromEntries(
      FORMER_PERMISSION_COLUMNS.map(formerColumn => [
        formerColumn,
        knex.raw(
          `CASE WHEN ${REGISTRATION_PERMISSIONS.filter(({ formerColumns }) => formerColumns.includes(formerColumn))
            .map(({ column }) => `${column} = 1`)
            .join(' AND ')} THEN 1 ELSE 0 END`
        )
      ])
    )
  );
  await dropColumns(
    knex,
    REGISTRATIONS_TABLE,
    REGISTRATION_PERMISSIONS.map(({ column }) => column)
  );

  await dropColumns(knex, SOUTH_ITEM_GROUPS_TABLE, ['caching_strategy']);
  await dropColumns(knex, SOUTH_ITEMS_TABLE, [
    'caching_strategy',
    'threshold_type',
    'threshold',
    'range_low',
    'range_high',
    'max_caching_interval'
  ]);

  await dropColumns(knex, OIANALYTICS_MESSAGE_TABLE, ['workflow_run_id', 'payload']);
  await knex.schema.dropTableIfExists(ITEM_POINT_METADATA_TABLE);
  await knex.schema.dropTableIfExists(WORKFLOW_RUNS_TABLE);
  await dropColumns(knex, SOUTH_ITEMS_TABLE, ['created_by_workflow_id', 'disabled_reason']);
  await knex.schema.dropTableIfExists(CONFIGURATION_WORKFLOWS_TABLE);

  await knex.schema.dropTableIfExists(AUDIT_LOGS_TABLE);
  await dropColumns(knex, ENGINES_TABLE, ['audit_retention_duration']);

  await dropColumns(knex, SCAN_MODES_TABLE, ['type', 'interval', 'activation_window']);
  await dropColumns(knex, CERTIFICATES_TABLE, ['certificate_chain', 'kind']);
}

async function dropColumns(knex: Knex, table: string, columns: Array<string>): Promise<void> {
  for (const column of columns) {
    await knex.raw(`ALTER TABLE "${table}" DROP COLUMN "${column}"`);
  }
}

/**
 * Scan modes gain a second scheduling mechanism: besides a cron expression they can now tick on a fixed interval. Every
 * scan mode created before this migration was cron-driven, so `type` is backfilled to 'cron' and `interval` stays null
 * — behavior is unchanged after upgrading.
 *
 * `activation_window` is a new optional gate (JSON: an absolute date range and/or a recurring day-of-week + time-of-day
 * rule with its IANA timezone) evaluated on every tick. Null means "always active", which is the pre-existing behavior,
 * so nothing is backfilled.
 *
 * The columns are added nullable and then backfilled rather than declared NOT NULL: SQLite cannot add a NOT NULL column
 * to a populated table without a default, and the repository is the only write path, so it enforces the invariant
 * instead.
 *
 * Also adds certificate_chain to certificates, holding a PEM bundle of intermediate/root CAs supplied when importing an
 * externally-issued certificate. Null for self-signed certificates generated by OIBus.
 */
export async function addScanModeSchedulingAndCertificateChain(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SCAN_MODES_TABLE, table => {
    table.string('type');
    table.string('interval');
    table.string('activation_window');
  });

  // Includes the reserved 'subscription' row, whose empty cron is never scheduled anyway.
  await knex(SCAN_MODES_TABLE).update({ type: 'cron' });

  await knex.schema.alterTable(CERTIFICATES_TABLE, t => {
    t.string('certificate_chain').nullable();
  });
}

/**
 * SQL-family souths (mysql/postgresql/mssql/oracle/sqlite/odbc/oledb) stopped serializing rows into CSV themselves —
 * they now emit `record-list` content (raw rows) and rely on a north-side `record-list-to-csv` transformer to do the CSV
 * encoding that `item.settings.serialization` used to do inline. This step:
 *
 *  1. Rewrites every affected item's settings: `dateTimeFields` + `serialization` are replaced by a single
 *     `trackingInstant` (mirroring south-rest's own trackingInstant shape), used only to compute the incremental query
 *     cursor. The CSV-rendering config itself (filename, delimiter, compression, per-column datetime formatting) moves to
 *     a transformer. Through the remote agent (OLEDB, or ODBC with `remoteAgent`), only the reference field was
 *     formatted (by the agent): it alone becomes a datetime field of the transformer (see `buildRecordListToCsvOptions`).
 *  2. For every north connector — enabled or not, so a currently-disabled one is already correctly wired up whenever
 *     it's re-enabled later; content fans out to every north connector unconditionally once enabled, see
 *     `DataStreamEngine.addContent` — and every affected item, preserves today's behavior by attaching a
 *     `record-list-to-csv` transformer, scoped to that one item, carrying the old per-item CSV settings as its options —
 *     but only where doing so doesn't override a deliberate user choice:
 *       - No transformer currently resolves for that (north, item) → attach one (today the north silently receives the
 *         pre-built CSV file untouched; after this migration, without a transformer it would receive a raw JSON dump
 *         instead of the SQL south's actual CSV text).
 *       - The resolved transformer is 'iso' (pure passthrough) → attach one anyway: passthrough only behaved like the old
 *         CSV export because the south itself already produced CSV bytes; now that the south emits raw records, 'iso'
 *         alone would leak them through unrendered.
 *       - The resolved transformer is 'ignore' → leave it, it's still a deliberate "drop this" choice.
 *       - Any other transformer (csv-to-mqtt, csv-to-time-values, json-to-csv, custom, ...) → leave it untouched; it was
 *         configured against the old CSV/'any' shape and needs a human to re-check it against the new record-list shape
 *         — an edge case explicitly left for manual follow-up.
 *  3. The same two steps for history queries against `history_items`/`history_query_transformers(_items)` — history
 *     queries route through the exact same transformer resolution machinery (they build a real `NorthConnector` under
 *     the hood), just without a south-item-group concept.
 */
export async function moveSqlSerializationToTransformers(knex: Knex): Promise<void> {
  const recordListToCsvTransformerId = await ensureStandardTransformer(knex, RECORD_LIST_TO_CSV_FUNCTION_NAME, 'record-list', 'any');

  const northIds = (await knex(NORTH_CONNECTORS_TABLE).select('id')).map(n => n.id as string);

  for (const southType of SQL_SOUTH_TYPES) {
    const souths: Array<{ id: string; settings: string }> = await knex(SOUTH_CONNECTORS_TABLE)
      .select('id', 'settings')
      .where('type', southType);
    for (const south of souths) {
      const remoteAgentSouthType = usesRemoteAgent(southType, JSON.parse(south.settings)) ? southType : null;
      await migrateSqlSouthItems(knex, south.id, northIds, recordListToCsvTransformerId, remoteAgentSouthType);
    }
  }

  await migrateSqlHistoryQueries(knex, recordListToCsvTransformerId);
}

/**
 * Writes each `{ id, settings }` pair via chunked `UPDATE ... SET settings = CASE id WHEN ? THEN ? ... END WHERE id IN
 * (...)` statements — the house pattern for bulk-rewriting many rows' JSON settings (see 3.8.0's `bulkUpdateSettings`),
 * instead of one UPDATE per row.
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
 * Replicates `NorthConnector.rebuildTransformerCache()`'s item → group → south-level priority lookup, built once from
 * the pre-migration `north_transformers`/`north_transformers_items` rows scoped to `southId`, across every north
 * (instead of one DB round-trip per (north, item) pair).
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

async function migrateSqlSouthItems(
  knex: Knex,
  southId: string,
  northIds: Array<string>,
  recordListToCsvTransformerId: string,
  remoteAgentSouthType: string | null
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
    settingsUpdates.push({ id: item.id, settings: JSON.stringify(toNewSqlItemSettings(oldSettings)) });

    const transformerOptions = buildRecordListToCsvOptions(oldSettings, remoteAgentSouthType);
    const groupId = groupIdByItemId.get(item.id) ?? null;

    for (const northId of northIds) {
      const resolved =
        itemLevel.get(`${northId}\0${item.id}`) ??
        (groupId ? groupLevel.get(`${northId}\0${groupId}`) : undefined) ??
        southLevel.get(northId);

      // No transformer at all, or a bare passthrough that only "worked" because the south used to
      // hand it pre-built CSV bytes -> attach a record-list-to-csv transformer for this item.
      // 'ignore' and any other configured transformer are left as a deliberate choice.
      if (keepsResolvedTransformer(resolved ? resolved.function_name : undefined)) continue;

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
 * Same treatment as `migrateSqlSouthItems`, for history queries. A history query has exactly one implicit south (its
 * own `south_type`/`south_settings`) and no south-item-group concept, so resolution is item-level vs. history-level
 * fallback only - no group level.
 */
async function migrateSqlHistoryQueries(knex: Knex, recordListToCsvTransformerId: string): Promise<void> {
  const historyQueries: Array<{ id: string; south_type: string; south_settings: string }> = await knex(HISTORY_QUERIES_TABLE)
    .select('id', 'south_type', 'south_settings')
    .whereIn('south_type', SQL_SOUTH_TYPES);
  if (historyQueries.length === 0) return;

  const settingsUpdates: Array<{ id: string; settings: string }> = [];
  const newTransformerRows: Array<Record<string, unknown>> = [];
  const newTransformerItemLinks: Array<{ id: string; item_id: string }> = [];

  for (const historyQuery of historyQueries) {
    const items: Array<{ id: string; settings: string }> = await knex(HISTORY_ITEMS_TABLE)
      .select('id', 'settings')
      .where('history_id', historyQuery.id);
    if (items.length === 0) continue;
    const remoteAgentSouthType = usesRemoteAgent(historyQuery.south_type, JSON.parse(historyQuery.south_settings))
      ? historyQuery.south_type
      : null;

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
      settingsUpdates.push({ id: item.id, settings: JSON.stringify(toNewSqlItemSettings(oldSettings)) });

      const resolved = itemLevel.get(item.id) ?? historyLevel;
      if (keepsResolvedTransformer(resolved ? resolved.function_name : undefined)) continue;

      const id = generateRandomId(6);
      newTransformerRows.push({
        id,
        history_id: historyQuery.id,
        transformer_id: recordListToCsvTransformerId,
        options: JSON.stringify(buildRecordListToCsvOptions(oldSettings, remoteAgentSouthType))
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

/**
 * Introduces the audit trail:
 *  1. A new `audit_logs` table recording every create/update/delete performed on an audited entity (south/north
 *     connectors, items, scan modes, users, ...). `previous_state`/`new_state` hold a JSON snapshot of the entity
 *     before/after the change — null for `CREATE` (no previous state) and `DELETE` (no new state) respectively. Indexed
 *     by `(entity_type, entity_id)` for per-entity history lookups, and by `created_at` for retention pruning and
 *     time-ranged searches.
 *  2. `engines.audit_retention_duration`, the number of days audit log rows are kept before being pruned (null/0
 *     meaning "keep forever"), backfilled to 90 on the existing row.
 */
export async function addAuditTrail(knex: Knex): Promise<void> {
  await knex.schema.createTable(AUDIT_LOGS_TABLE, table => {
    table.string('id').primary();
    table.string('entity_type').notNullable();
    table.string('entity_id').notNullable();
    table.string('action').notNullable();
    table.text('previous_state').nullable();
    table.text('new_state').nullable();
    table.string('user_id').notNullable();
    table.string('created_at').notNullable();
    table.index(['entity_type', 'entity_id']);
    table.index(['created_at']);
  });

  await knex.schema.alterTable(ENGINES_TABLE, table => {
    table.integer('audit_retention_duration').nullable();
  });

  await knex(ENGINES_TABLE).update({ audit_retention_duration: 90 });
}

/**
 * Introduces Configuration Workflows: discover a data source, then either create/update south items locally from what's
 * found, or push the raw discovered records to OIAnalytics, on demand or on a schedule.
 *
 * Adding a column with a `.references()` FK via knex's schema builder makes it rebuild the whole table (CREATE __new +
 * COPY + DROP TABLE + RENAME), and that rebuild can fail with a foreign key constraint error if some other table's live
 * FK already points into this one and would be left dangling by the intermediate DROP TABLE. Such columns are added with
 * a raw single-statement `ALTER TABLE ... ADD COLUMN` instead: adding a nullable column (even with a REFERENCES clause)
 * is an in-place metadata edit on SQLite, with no table rebuild and no DROP TABLE involved - same reasoning as the raw
 * `ALTER TABLE ... DROP COLUMN` already used in v3.9.0.ts for exactly this class of problem.
 */
export async function addConfigurationWorkflows(knex: Knex): Promise<void> {
  // `configuration_workflows`
  //
  // `south_id` is always populated (a workflow is always created from a specific south connector's context). A
  // workflow is self-scoping — it owns whatever items its own discovery creates, tracked via
  // `south_items.created_by_workflow_id` (added below — deliberately not a group, see the design note this feature was
  // built from) — there's no "targets one pre-existing item" case: local mode only ever creates/updates its own items,
  // and remote mode has no local item at all.
  //
  // `discovery_scope`, `identity_key_fields`, `field_processes`, `added_fields`, `eligibility_filter`, `item_field_mapping` and
  // `pushed_fields` are stored as JSON text
  // rather than normalized columns: they're connector-specific and open-ended (an OPC-UA root node id, a folder subtree,
  // a dedicated SQL metadata query, ...), the same way `south_items.settings` already stores connector-specific item
  // configuration as JSON.
  //
  // A workflow is exactly one of two modes, enforced at the service layer (no CHECK constraints are used anywhere in
  // this schema for that kind of invariant): `item_field_mapping` set and `push_to_oi_analytics` false (local —
  // create/update items from what's discovered), or `item_field_mapping` null and `push_to_oi_analytics` true (remote —
  // forward the eligible records to OIAnalytics on each run - only their `pushed_fields`, every field when empty - requiring
  // OIBus to be registered).
  await knex.schema.createTable(CONFIGURATION_WORKFLOWS_TABLE, table => {
    table.string('id', 36).primary();
    table.datetime('created_at').notNullable();
    table.datetime('updated_at').notNullable();
    table.string('created_by');
    table.string('updated_by');
    table.string('name').notNullable();
    table.string('south_id', 36).notNullable().references('id').inTable(SOUTH_CONNECTORS_TABLE).onDelete('CASCADE');
    table.text('discovery_scope').notNullable();
    table.text('identity_key_fields').notNullable();
    table.text('field_processes').notNullable().defaultTo('[]');
    table.text('added_fields').notNullable().defaultTo('[]');
    table.text('eligibility_filter').notNullable();
    table.text('item_field_mapping').nullable();
    table.boolean('push_to_oi_analytics').notNullable().defaultTo(false);
    table.text('pushed_fields').notNullable().defaultTo('[]');
    table.string('scan_mode_id', 36).nullable().references('id').inTable(SCAN_MODES_TABLE).onDelete('SET NULL');
    table.boolean('enabled').notNullable().defaultTo(true);
    table.unique(['south_id', 'name']);
  });

  // `south_items` ownership/disable columns
  //
  //  - `created_by_workflow_id` — the *only* ownership record for a self-scoping (multi-item) workflow's items:
  //    `ON DELETE SET NULL` so an item outlives the workflow that created it, only the ownership link is cleared. Never
  //    set by the normal item create/update path (only by workflow-specific repository methods added alongside this).
  //  - `disabled_reason` — set only when a workflow auto-disables an item because its discovery no longer finds the
  //    entry it corresponds to. A person's own manual disable (`disableItem()`) leaves this null, so the two are never
  //    confused without needing a second boolean alongside the existing `enabled` column.
  await knex.raw(
    `ALTER TABLE "${SOUTH_ITEMS_TABLE}" ADD COLUMN "created_by_workflow_id" varchar(36) REFERENCES "${CONFIGURATION_WORKFLOWS_TABLE}" ("id") ON DELETE SET NULL`
  );
  await knex.raw(`ALTER TABLE "${SOUTH_ITEMS_TABLE}" ADD COLUMN "disabled_reason" text`);

  // `workflow_runs`: the run history. One row per execution (manual or scheduled), reviewable independent of whether
  // anyone was watching. Unlike `configuration_workflows`, this table has no `AuditService` wiring: it *is* the audit
  // trail for a run, the same way `audit_logs` itself isn't audited.
  //
  // Counts mirror the run lifecycle: Retrieve produces `discovered_count` records; the workflow's `eligibility_filter`
  // narrows that to `eligible_count`. From there, only one of two count groups is ever populated, matching the
  // workflow's own exclusive local/remote mode: a local (item-creating) workflow's Act only ever touches
  // new/changed/missing ones, split into `created_count`/`updated_count`/`disabled_count`; a remote workflow instead
  // forwards every eligible record as-is, reflected in `pushed_count`. All default to 0 so a run that errors before
  // reaching a step still has well-defined counts rather than nulls.
  //
  // `payload` is the full discovered payload behind those counts - not just their summary - so a run stays fully
  // reviewable after the fact instead of only showing "what changed" in aggregate. It's a JSON blob mirroring
  // `WorkflowPreviewResultDTO`'s own `entries`/`records` shape (one populated, one empty, per the workflow's exclusive
  // mode), written once at `complete`/`fail` time - null while a run is still `RUNNING`.
  await knex.schema.createTable(WORKFLOW_RUNS_TABLE, table => {
    table.string('id', 36).primary();
    table.string('workflow_id', 36).notNullable().references('id').inTable(CONFIGURATION_WORKFLOWS_TABLE).onDelete('CASCADE');
    table.string('trigger_type').notNullable();
    table.string('status').notNullable();
    table.datetime('started_at').notNullable();
    table.datetime('completed_at').nullable();
    table.integer('discovered_count').notNullable().defaultTo(0);
    table.integer('eligible_count').notNullable().defaultTo(0);
    table.integer('created_count').notNullable().defaultTo(0);
    table.integer('updated_count').notNullable().defaultTo(0);
    table.integer('disabled_count').notNullable().defaultTo(0);
    table.integer('pushed_count').notNullable().defaultTo(0);
    table.text('payload').nullable();
    table.text('error').nullable();
    table.string('triggered_by').nullable();
    table.index(['workflow_id', 'started_at']);
  });

  // `item_point_metadata`: how a local (item-creating) workflow recognizes "the same" discovered entry across runs, one
  // row per south item it created/updated.
  //
  // `UNIQUE(workflow_id, discovered_entry_key)` is the one lookup every run's diff uses. `discovered_metadata` is the
  // previous run's snapshot of the record this row came from, compared against the new retrieval to classify it
  // new/changed/unchanged/missing, and to decide when to auto-disable the item (see `status`/`orphaned_at` below). A
  // remote (push-to-OIAnalytics) workflow never writes here at all — it has no local item to track, and forwards each
  // run's raw discovered records without diffing against anything.
  await knex.schema.createTable(ITEM_POINT_METADATA_TABLE, table => {
    table.string('id', 36).primary();
    table.string('workflow_id', 36).notNullable().references('id').inTable(CONFIGURATION_WORKFLOWS_TABLE).onDelete('CASCADE');
    table.string('south_item_id', 36).notNullable().references('id').inTable(SOUTH_ITEMS_TABLE).onDelete('CASCADE');
    table.text('discovered_entry_key').notNullable();
    table.text('discovered_metadata').notNullable();
    table.string('status').notNullable().defaultTo('active');
    table.datetime('orphaned_at').nullable();
    table.unique(['workflow_id', 'discovered_entry_key']);
    table.index(['south_item_id']);
  });

  // `oianalytics_messages` columns of a remote workflow run's own message type (`sync-metadata`), both
  // nullable since neither applies to `full-config`/`history-queries` messages:
  //  - `workflow_run_id` — which run this message carries the result of; `ON DELETE CASCADE` since a message with no
  //    run left to report on has nothing meaningful left to send.
  //  - `payload` — the message's own JSON body, built once at run time and sent verbatim. Unlike
  //    `full-config`/`history-queries` (which recompute their payload from the *current* configuration at send time —
  //    see `OIAnalyticsMessageService`'s own comment on why they don't store one), a workflow run's discovered records
  //    are a one-off snapshot that can't be recomputed later without re-running discovery, so this message type must
  //    store it directly.
  await knex.raw(
    `ALTER TABLE "${OIANALYTICS_MESSAGE_TABLE}" ADD COLUMN "workflow_run_id" varchar(36) REFERENCES "${WORKFLOW_RUNS_TABLE}" ("id") ON DELETE CASCADE`
  );
  await knex.raw(`ALTER TABLE "${OIANALYTICS_MESSAGE_TABLE}" ADD COLUMN "payload" text`);
}

/**
 * Introduces the caching-strategy feature: `south_item_groups`/`south_items` gain `caching_strategy` (plus
 * threshold/range/max-interval columns), defaulted to 'allValues' for IoT-family south connectors, for which a per-item
 * caching strategy is meaningful.
 */
export async function addCachingStrategies(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SOUTH_ITEM_GROUPS_TABLE, t => {
    t.string('caching_strategy').nullable();
  });
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, t => {
    t.string('caching_strategy').nullable();
    t.string('threshold_type').nullable();
    t.float('threshold').nullable();
    t.float('range_low').nullable();
    t.float('range_high').nullable();
    t.integer('max_caching_interval').nullable();
  });

  // Every other south type keeps caching_strategy NULL (the field is meaningless outside the IoT family).
  const iotFamilyConnectorIds = knex(SOUTH_CONNECTORS_TABLE).select('id').whereIn('type', IOT_FAMILY_SOUTH_TYPES);
  await knex(SOUTH_ITEM_GROUPS_TABLE).whereIn('south_id', iotFamilyConnectorIds).update({ caching_strategy: 'allValues' });
  await knex(SOUTH_ITEMS_TABLE).whereIn('connector_id', iotFamilyConnectorIds).update({ caching_strategy: 'allValues' });
}

/**
 * Add the new optional `referenceProcess` option (a JS expression applied to each point ID to build the OIAnalytics
 * reference) to every existing OIAnalytics transformer instance (`time-values-to-oianalytics`, `json-to-oianalytics`),
 * so that the stored options match the manifest. Null means "no process": references are sent unchanged, which is the
 * pre-existing behavior. Instances that already define the option are left untouched.
 */
export async function addOIAnalyticsReferenceProcess(knex: Knex): Promise<void> {
  const transformers: Array<{ id: string }> = await knex(TRANSFORMERS_TABLE)
    .select('id')
    .whereIn('function_name', OIANALYTICS_TRANSFORMER_FUNCTION_NAMES);
  for (const transformer of transformers) {
    await moveLinks(knex, transformer.id, transformer.id, options =>
      options.referenceProcess === undefined ? { ...options, referenceProcess: null } : options
    );
  }
}

/**
 * The permissions granted to OIAnalytics scoped by risk, with the former permissions (one per command) each one gathers.
 * `command_update_version` and `command_setpoint` keep their column.
 */
const REGISTRATION_PERMISSIONS: ReadonlyArray<{ column: string; formerColumns: ReadonlyArray<string> }> = [
  { column: 'command_operate', formerColumns: ['command_restart_engine', 'command_update_history_query'] },
  { column: 'command_configure_engine', formerColumns: ['command_update_engine_settings'] },
  {
    column: 'command_configure_data_flow',
    formerColumns: [
      'command_create_scan_mode',
      'command_update_scan_mode',
      'command_delete_scan_mode',
      'command_create_certificate',
      'command_update_certificate',
      'command_delete_certificate',
      'command_create_south',
      'command_update_south',
      'command_delete_south',
      'command_create_or_update_south_items_from_csv',
      'command_create_north',
      'command_update_north',
      'command_delete_north',
      'command_create_history_query',
      'command_update_history_query',
      'command_delete_history_query',
      'command_create_or_update_history_items_from_csv'
    ]
  },
  {
    column: 'command_configure_custom_code',
    formerColumns: [
      'command_create_custom_transformer',
      'command_update_custom_transformer',
      'command_delete_custom_transformer',
      'command_test_custom_transformer'
    ]
  },
  {
    column: 'command_manage_access',
    formerColumns: ['command_update_engine_settings', 'command_create_ip_filter', 'command_update_ip_filter', 'command_delete_ip_filter']
  },
  { column: 'command_manage_registration', formerColumns: ['command_update_registration_settings', 'command_regenerate_cipher_keys'] },
  {
    column: 'command_connect_to_data_sources',
    formerColumns: [
      'command_test_south_connection',
      'command_test_south_item',
      'command_test_north_connection',
      'command_test_history_north_connection',
      'command_test_history_south_connection',
      'command_test_history_south_item'
    ]
  },
  {
    column: 'command_manage_cache',
    formerColumns: [
      'command_search_north_cache_content',
      'command_get_north_cache_file_content',
      'command_update_north_cache_content',
      'command_search_history_cache_content',
      'command_get_history_cache_file_content',
      'command_update_history_cache_content'
    ]
  },
  // Retrieving a memory dump or the logs database is new, and may expose secrets: never granted on upgrade
  { column: 'command_diagnostics', formerColumns: [] }
];

const FORMER_PERMISSION_COLUMNS = [...new Set(REGISTRATION_PERMISSIONS.flatMap(permission => permission.formerColumns))];

/** The key of a permission in the content of a command, from its column (`command_create_south` -> `createSouth`) */
const toPermissionKey = (column: string): string =>
  column.replace(/^command_/, '').replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

/**
 * Replaces the permissions granted to OIAnalytics, one per command, by fewer permissions scoped by risk (see
 * `RegistrationCommandPermissions`). A permission is only granted when every former permission it gathers was: an OIBus
 * never grants OIAnalytics more than before the upgrade. A missing former permission (null) counts as revoked.
 *
 * The permissions sent by the update-registration-settings commands already received are converted the same way, so that
 * a command not executed yet revokes what it asked to. As OIAnalytics can only revoke a permission, a permission it did
 * not send counts as granted there.
 */
export async function reworkRegistrationPermissions(knex: Knex): Promise<void> {
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    for (const { column } of REGISTRATION_PERMISSIONS) {
      table.boolean(column);
    }
  });
  await knex(REGISTRATIONS_TABLE).update(
    Object.fromEntries(
      REGISTRATION_PERMISSIONS.map(({ column, formerColumns }) => [
        column,
        formerColumns.length > 0
          ? knex.raw(`CASE WHEN ${formerColumns.map(formerColumn => `${formerColumn} = 1`).join(' AND ')} THEN 1 ELSE 0 END`)
          : false
      ])
    )
  );
  await dropColumns(knex, REGISTRATIONS_TABLE, FORMER_PERMISSION_COLUMNS);

  const commands: Array<{ id: string; command_content: string | null }> = await knex(COMMANDS_TABLE)
    .select('id', 'command_content')
    .where('type', 'update-registration-settings');
  for (const command of commands) {
    if (!command.command_content) continue;
    const content = JSON.parse(command.command_content);
    const formerPermissions: Record<string, boolean | undefined> = content.commandPermissions ?? {};
    const isGranted = (column: string) => formerPermissions[toPermissionKey(column)] !== false;
    content.commandPermissions = {
      updateVersion: isGranted('command_update_version'),
      ...Object.fromEntries(
        REGISTRATION_PERMISSIONS.map(({ column, formerColumns }) => [toPermissionKey(column), formerColumns.every(isGranted)])
      ),
      setpoint: isGranted('command_setpoint')
    };
    await knex(COMMANDS_TABLE)
      .where('id', command.id)
      .update({ command_content: JSON.stringify(content) });
  }
}

/**
 * The OPC UA (`haMode.resampling`) and OPC (`resampling`) item manifests defaulted the resampling to 'raw', which is not
 * one of its selectable values ('none', '1s', ...). Items saved with that default are moved to 'none', which is what
 * 'raw' already meant at runtime.
 */
export async function replaceRawResampling(knex: Knex): Promise<void> {
  for (const southType of RAW_RESAMPLING_SOUTH_TYPES) {
    const southItems: Array<{ id: string; settings: string }> = await knex(SOUTH_ITEMS_TABLE)
      .join(SOUTH_CONNECTORS_TABLE, `${SOUTH_CONNECTORS_TABLE}.id`, '=', `${SOUTH_ITEMS_TABLE}.connector_id`)
      .select(`${SOUTH_ITEMS_TABLE}.id as id`, `${SOUTH_ITEMS_TABLE}.settings as settings`)
      .where(`${SOUTH_CONNECTORS_TABLE}.type`, southType);
    await updateResampling(knex, SOUTH_ITEMS_TABLE, southType, southItems);

    const historyItems: Array<{ id: string; settings: string }> = await knex(HISTORY_ITEMS_TABLE)
      .join(HISTORY_QUERIES_TABLE, `${HISTORY_QUERIES_TABLE}.id`, '=', `${HISTORY_ITEMS_TABLE}.history_id`)
      .select(`${HISTORY_ITEMS_TABLE}.id as id`, `${HISTORY_ITEMS_TABLE}.settings as settings`)
      .where(`${HISTORY_QUERIES_TABLE}.south_type`, southType);
    await updateResampling(knex, HISTORY_ITEMS_TABLE, southType, historyItems);
  }
}

async function updateResampling(
  knex: Knex,
  table: string,
  southType: string,
  items: Array<{ id: string; settings: string }>
): Promise<void> {
  for (const item of items) {
    const newSettings = toNoneResamplingItemSettings(southType, JSON.parse(item.settings));
    if (newSettings) {
      await knex(table)
        .where('id', item.id)
        .update({ settings: JSON.stringify(newSettings) });
    }
  }
}

/**
 * Add the HTTPS settings of the web server to engines: whether it serves HTTPS, and where it reads the certificate and
 * private key from (a certificate of the store, or PEM files). Existing installs keep serving HTTP.
 */
export async function addHttpsSettings(knex: Knex): Promise<void> {
  await knex.schema.alterTable(ENGINES_TABLE, t => {
    t.boolean('https_enabled').notNullable().defaultTo(false);
    t.string('https_certificate_source').notNullable().defaultTo('store');
    t.string('https_certificate_id');
    t.string('https_certificate_path');
    t.string('https_private_key_path');
  });
}

/**
 * Add the setting enabling the content endpoints of the web server (`/api/content`), through which external systems push
 * data to the Norths. It is disabled by default, but enabled on the installs already receiving data from the OIBus API:
 * the ones with a North transformer applying to it. Runs before `replaceIsoAndIgnoreTransformers`, which adds such a
 * transformer to every North.
 */
export async function addContentEndpointSetting(knex: Knex): Promise<void> {
  await knex.schema.alterTable(ENGINES_TABLE, t => {
    t.boolean('enable_content_endpoint').notNullable().defaultTo(false);
  });
  const apiLink = await knex(NORTH_TRANSFORMERS_TABLE).select('id').where('source_type', 'oibus-api').first();
  if (apiLink) {
    await knex(ENGINES_TABLE).update({ enable_content_endpoint: true });
  }
}

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
 *     south (or history query) level when there is none (see `addOIAnalyticsTransformers` in the config upgrade).
 *
 * The time values still waiting in the North caches are converted by the 4.0.0 data folder migration.
 */
export async function replaceTimeValuesByRecordLists(knex: Knex): Promise<void> {
  await knex(TRANSFORMERS_TABLE).where({ type: 'custom', input_type: 'time-values' }).update({ input_type: 'record-list' });
  await knex(TRANSFORMERS_TABLE).where({ type: 'custom', output_type: 'time-values' }).update({ output_type: 'record-list' });

  const recordListToCsv: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
    .where({ type: 'standard', function_name: RECORD_LIST_TO_CSV_FUNCTION_NAME })
    .first('id');
  if (recordListToCsv) {
    await moveLinks(knex, recordListToCsv.id, recordListToCsv.id, options =>
      options.keepOtherFields === undefined ? { ...options, keepOtherFields: true } : options
    );
  }

  for (const [oldFunctionName, replacement] of Object.entries(TIME_VALUES_TRANSFORMER_REPLACEMENTS)) {
    await replaceStandardTransformer(knex, oldFunctionName, replacement, options =>
      toRecordListTransformerOptions(oldFunctionName, options)
    );
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
    .where({ type: 'standard', function_name: ISO_FUNCTION_NAME })
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
          ...northLink(generateRandomId(6), north.id, oiaTransformerId, 'south'),
          options,
          source_south_south_id: south.id
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
 *    type ('file', 'record-list-to-json' or 'setpoint-to-json', replaced by later steps), at the south level for the data
 *    without transformer;
 *  - the files of the OIBus API go through a 'file' transformer applying to every data source, unless the North ignored
 *    some of them;
 *  - the items configured with 'ignore' are left out of the North transformers they fell back to (applying to their
 *    group or to their whole south), flagged as excluded items of these transformers; the history query transformers,
 *    which cannot leave items out, are narrowed to the list of the other items.
 */
export async function replaceIsoAndIgnoreTransformers(knex: Knex): Promise<void> {
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
      id = await ensureStandardTransformer(knex, passthrough.functionName, passthrough.inputType, passthrough.outputType);
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

/**
 * The options of the record-list-to-oianalytics transformers are grouped by part of the OIAnalytics payload: the
 * reference, the timestamp and the value (see `toGroupedOIAnalyticsOptions`).
 */
export async function groupOIAnalyticsOptions(knex: Knex): Promise<void> {
  const transformer: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
    .where({ type: 'standard', function_name: RECORD_LIST_TO_OIANALYTICS_FUNCTION_NAME })
    .first('id');
  if (!transformer) return;
  await moveLinks(knex, transformer.id, transformer.id, toGroupedOIAnalyticsOptions);
}

/**
 * The `any` data type is renamed `file` (see `toFileDataType`): the input and output types of the standard and custom
 * transformers are updated. The files still waiting in the North caches are updated by the 4.0.0 data folder
 * migration.
 */
export async function renameAnyDataType(knex: Knex): Promise<void> {
  for (const column of ['input_type', 'output_type']) {
    await knex(TRANSFORMERS_TABLE)
      .where(column, 'any')
      .update({ [column]: toFileDataType('any') });
  }
}

/**
 * The csv-to-mqtt, csv-to-record-list and json-to-oianalytics transformers are replaced by file-to-mqtt,
 * file-to-record-list and file-to-oianalytics ones, reading both CSV and JSON files (see `FILE_TRANSFORMER_REPLACEMENTS`
 * and `toFileTransformerOptions`).
 */
export async function replaceCsvAndJsonReaders(knex: Knex): Promise<void> {
  for (const [oldFunctionName, functionName] of Object.entries(FILE_TRANSFORMER_REPLACEMENTS)) {
    await replaceStandardTransformer(knex, oldFunctionName, { functionName }, options =>
      toFileTransformerOptions(oldFunctionName, options)
    );
  }
}

/**
 * The json-to-csv, record-list-to-csv and record-list-to-json transformers are replaced by file-to-file and
 * record-list-to-file ones, writing both CSV and JSON files (see `FILE_OUTPUT_TRANSFORMER_REPLACEMENTS` and
 * `toFileOutputTransformerOptions`): record-list-to-json is merged into the record-list-to-file replacing
 * record-list-to-csv.
 */
export async function replaceCsvAndJsonWriters(knex: Knex): Promise<void> {
  for (const [oldFunctionName, functionName] of Object.entries(FILE_OUTPUT_TRANSFORMER_REPLACEMENTS)) {
    await replaceStandardTransformer(knex, oldFunctionName, { functionName }, options =>
      toFileOutputTransformerOptions(oldFunctionName, options)
    );
  }
}

/** The North connectors and history queries (owning a North), with their North type, settings and transformer links */
const NORTH_LINK_OWNER_TABLES = [
  {
    owners: NORTH_CONNECTORS_TABLE,
    typeColumn: 'type',
    settingsColumn: 'settings',
    links: NORTH_TRANSFORMERS_TABLE,
    items: NORTH_TRANSFORMERS_ITEMS_TABLE,
    owner: 'north_id'
  },
  {
    owners: HISTORY_QUERIES_TABLE,
    typeColumn: 'north_type',
    settingsColumn: 'north_settings',
    links: HISTORY_QUERY_TRANSFORMERS_TABLE,
    items: HISTORY_QUERY_TRANSFORMERS_ITEMS_TABLE,
    owner: 'history_id'
  }
];

/**
 * The North File Writer only writes files (see `convertFileWriterLinks` in the config upgrade): its file-to-record-list
 * links write the rows of the file in a JSON file through file-to-file instead, and its links to the custom
 * transformers sending records or setpoints are removed. The records and setpoints still waiting in its caches are
 * turned into files by the 4.0.0 data folder migration.
 */
export async function convertFileWriterLinks(knex: Knex): Promise<void> {
  const transformers: Array<{ id: string; type: string; function_name: string | null; output_type: string }> = await knex(
    TRANSFORMERS_TABLE
  ).select('id', 'type', 'function_name', 'output_type');
  const removedTypeTransformers = transformers.filter(transformer => FILE_WRITER_REMOVED_DATA_TYPES.includes(transformer.output_type));
  if (removedTypeTransformers.length === 0) return;

  let removed = 0;
  for (const table of NORTH_LINK_OWNER_TABLES) {
    const ownerIds = (await knex(table.owners).select('id').where(table.typeColumn, 'file-writer')).map((row: { id: string }) => row.id);
    if (ownerIds.length === 0) continue;
    const links: Array<{ id: string; transformer_id: string; options: string | null }> = await knex(table.links)
      .select('id', 'transformer_id', 'options')
      .whereIn(table.owner, ownerIds)
      .whereIn(
        'transformer_id',
        removedTypeTransformers.map(transformer => transformer.id)
      );
    for (const link of links) {
      const transformer = removedTypeTransformers.find(candidate => candidate.id === link.transformer_id)!;
      if (transformer.type === 'standard' && transformer.function_name === 'file-to-record-list') {
        const options = toFileWriterFileToFileOptions(link.options ? (JSON.parse(link.options) as Record<string, unknown>) : {});
        await knex(table.links)
          .where('id', link.id)
          .update({
            transformer_id: await ensureStandardTransformer(knex, 'file-to-file', 'file', 'file'),
            options: JSON.stringify(options)
          });
      } else {
        await removeLinks(knex, table.links, table.items, [link.id]);
        removed++;
      }
    }
  }
  if (removed > 0) {
    console.info(`Removed ${removed} link(s) of File Writer North connectors to transformers sending records or setpoints`);
  }
}

interface SerializedItem {
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
export async function convertOIAnalyticsSouths(knex: Knex): Promise<void> {
  const souths: Array<{ id: string }> = await knex(SOUTH_CONNECTORS_TABLE).select('id').where('type', 'oianalytics');
  const historyQueries: Array<{ id: string }> = await knex(HISTORY_QUERIES_TABLE).select('id').where('south_type', 'oianalytics');
  if (souths.length === 0 && historyQueries.length === 0) return;

  const transformers: Array<{ id: string; type: string; function_name: string | null; input_type: string }> = await knex(
    TRANSFORMERS_TABLE
  ).select('id', 'type', 'function_name', 'input_type');
  const readsFiles = (transformerId: string) => transformers.find(transformer => transformer.id === transformerId)?.input_type === 'file';
  const sendsAsIs = (transformerId: string | undefined) =>
    transformers.some(
      transformer =>
        transformer.id === transformerId && transformer.type === 'standard' && transformer.function_name === FILE_PASSTHROUGH.functionName
    );
  const recordListToFile = () => ensureStandardTransformer(knex, 'record-list-to-file', 'record-list', 'file');

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
function withSerialization(rows: Array<{ id: string; settings: string; groupId?: string | null }>): Array<SerializedItem> {
  return rows
    .map(row => ({ id: row.id, settings: JSON.parse(row.settings) as Record<string, unknown>, groupId: row.groupId ?? null }))
    .filter(item => item.settings.serialization !== undefined);
}

async function removeSerialization(knex: Knex, table: string, items: Array<SerializedItem>): Promise<void> {
  for (const item of items) {
    const { serialization: _serialization, ...settings } = item.settings;
    await knex(table)
      .where('id', item.id)
      .update({ settings: JSON.stringify(settings) });
  }
}

/**
 * The folder scanner, FTP and SFTP South connectors no longer compress their files (see `moveCompressionToNorths` in the
 * config upgrade): when they did, their files sent as they are (through the file transformer) are compressed by a
 * file-to-file transformer instead. The `compression` setting is removed.
 */
export async function moveCompressionToNorths(knex: Knex): Promise<void> {
  const souths: Array<{ id: string; settings: string }> = await knex(SOUTH_CONNECTORS_TABLE)
    .select('id', 'settings')
    .whereIn('type', COMPRESSING_SOUTH_TYPES);
  const historyQueries: Array<{ id: string; south_settings: string }> = await knex(HISTORY_QUERIES_TABLE)
    .select('id', 'south_settings')
    .whereIn('south_type', COMPRESSING_SOUTH_TYPES);

  const file: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
    .where({ type: 'standard', function_name: FILE_PASSTHROUGH.functionName })
    .first('id');
  const compressedLink = async () => ({
    transformer_id: await ensureStandardTransformer(knex, 'file-to-file', 'file', 'file'),
    options: JSON.stringify(COMPRESSED_FILE_OPTIONS)
  });

  for (const south of souths) {
    const { compression, ...settings } = JSON.parse(south.settings) as Record<string, unknown>;
    if (compression === undefined) continue;
    await knex(SOUTH_CONNECTORS_TABLE)
      .where('id', south.id)
      .update({ settings: JSON.stringify(settings) });
    if (compression !== true || !file) continue;
    await knex(NORTH_TRANSFORMERS_TABLE)
      .where({ source_type: 'south', source_south_south_id: south.id, transformer_id: file.id })
      .update(await compressedLink());
  }
  for (const historyQuery of historyQueries) {
    const { compression, ...settings } = JSON.parse(historyQuery.south_settings) as Record<string, unknown>;
    if (compression === undefined) continue;
    await knex(HISTORY_QUERIES_TABLE)
      .where('id', historyQuery.id)
      .update({ south_settings: JSON.stringify(settings) });
    if (compression !== true || !file) continue;
    await knex(HISTORY_QUERY_TRANSFORMERS_TABLE)
      .where({ history_id: historyQuery.id, transformer_id: file.id })
      .update(await compressedLink());
  }
}

/**
 * The setpoints sent by OIAnalytics are records, `{ reference, value }` (see `mergeSetpointsIntoRecordLists` in the
 * config upgrade):
 *  - the setpoint transformers are replaced by the record-list ones (see `SETPOINT_TRANSFORMER_REPLACEMENTS` and
 *    `toSetpointTransformerOptions`);
 *  - the custom transformers reading or writing setpoints read or write records;
 *  - the record-list-to-mqtt links without payload publish the whole record, as before.
 * The setpoints still waiting in the caches become records with the 4.0.0 data folder migration.
 */
export async function mergeSetpointsIntoRecordLists(knex: Knex): Promise<void> {
  for (const [oldFunctionName, functionName] of Object.entries(SETPOINT_TRANSFORMER_REPLACEMENTS)) {
    await replaceStandardTransformer(knex, oldFunctionName, { functionName, inputType: 'record-list' }, options =>
      toSetpointTransformerOptions(oldFunctionName, options)
    );
  }

  await knex(TRANSFORMERS_TABLE).where({ type: 'custom', input_type: 'setpoint' }).update({ input_type: 'record-list' });
  await knex(TRANSFORMERS_TABLE).where({ type: 'custom', output_type: 'setpoint' }).update({ output_type: 'record-list' });

  const recordListToMqtt: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
    .where({ type: 'standard', function_name: 'record-list-to-mqtt' })
    .first('id');
  if (!recordListToMqtt) return;
  await moveLinks(knex, recordListToMqtt.id, recordListToMqtt.id, options =>
    options.payload === undefined ? { ...options, payload: 'record' } : options
  );
}

/**
 * The 'file' transformer, sending the files as they are, is replaced by file-to-file (see `FILE_AS_IS_OPTIONS` and
 * `replaceFileTransformer` in the config upgrade).
 */
export async function replaceFileTransformer(knex: Knex): Promise<void> {
  for (const [oldFunctionName, functionName] of Object.entries(FILE_AS_IS_REPLACEMENT)) {
    await replaceStandardTransformer(knex, oldFunctionName, { functionName }, () => structuredClone(FILE_AS_IS_OPTIONS));
  }
}

/**
 * The File Writer and SFTP North connectors no longer add a prefix and a suffix to the name of the files they send (see
 * `moveFilenamePrefixAndSuffixToTransformers` in the config upgrade): the `prefix` and `suffix` settings are removed, and
 * added to the filename of their file-to-file and record-list-to-file transformers. Their custom transformers name the
 * files themselves: a warning lists them. The files still waiting in their caches are renamed by the 4.0.0 data folder
 * migration.
 */
export async function moveFilenamePrefixAndSuffixToTransformers(knex: Knex): Promise<void> {
  const transformers: Array<{ id: string; type: string; function_name: string | null }> = await knex(TRANSFORMERS_TABLE).select(
    'id',
    'type',
    'function_name'
  );
  const transformerOf = (id: string) => transformers.find(transformer => transformer.id === id);
  const namesFiles = (id: string) =>
    transformerOf(id)?.type === 'standard' && FILENAME_FUNCTION_NAMES.includes(transformerOf(id)!.function_name!);

  let customLinks = 0;
  for (const table of NORTH_LINK_OWNER_TABLES) {
    const owners: Array<{ id: string; name: string; settings: string }> = await knex(table.owners)
      .select('id', 'name', `${table.settingsColumn} as settings`)
      .whereIn(table.typeColumn, PREFIXING_NORTH_TYPES);
    for (const owner of owners) {
      const { prefix, suffix, ...settings } = JSON.parse(owner.settings) as Record<string, unknown>;
      if (prefix === undefined && suffix === undefined) continue;
      await knex(table.owners)
        .where('id', owner.id)
        .update({ [table.settingsColumn]: JSON.stringify(settings) });
      if (!prefix && !suffix) continue;

      const links: Array<{ id: string; transformer_id: string; options: string | null }> = await knex(table.links)
        .select('id', 'transformer_id', 'options')
        .where(table.owner, owner.id);
      for (const link of links) {
        const options = link.options ? (JSON.parse(link.options) as Record<string, unknown>) : {};
        if (transformerOf(link.transformer_id)?.type === 'custom') customLinks++;
        if (!namesFiles(link.transformer_id) || typeof options.filename !== 'string') continue;
        options.filename = withPrefixAndSuffix(
          options.filename,
          (prefix as string | null) ?? '',
          (suffix as string | null) ?? '',
          owner.name
        );
        await knex(table.links)
          .where('id', link.id)
          .update({ options: JSON.stringify(options) });
      }
    }
  }
  if (customLinks > 0) {
    console.warn(
      `${customLinks} link(s) of File Writer and SFTP North connectors to custom transformers no longer add the prefix and suffix ` +
        'of their North to the file names: the custom transformers name the files'
    );
  }
}

/**
 * The OPC UA South and North settings gain connection (and write) timeouts, and the OPC UA South flush settings move into
 * a new `subscription` group (see `toOPCUASouthSettings` in the config upgrade), for the connectors and the history
 * queries.
 */
export async function addOPCUATimeoutsAndSubscriptionSettings(knex: Knex): Promise<void> {
  const targets = [
    { table: SOUTH_CONNECTORS_TABLE, typeColumn: 'type', settingsColumn: 'settings', convert: toOPCUASouthSettings },
    { table: HISTORY_QUERIES_TABLE, typeColumn: 'south_type', settingsColumn: 'south_settings', convert: toOPCUASouthSettings },
    { table: NORTH_CONNECTORS_TABLE, typeColumn: 'type', settingsColumn: 'settings', convert: toOPCUANorthSettings },
    { table: HISTORY_QUERIES_TABLE, typeColumn: 'north_type', settingsColumn: 'north_settings', convert: toOPCUANorthSettings }
  ];
  for (const { table, typeColumn, settingsColumn, convert } of targets) {
    const rows: Array<{ id: string; settings: string }> = await knex(table)
      .select('id', `${settingsColumn} as settings`)
      .where(typeColumn, 'opcua');
    for (const row of rows) {
      await knex(table)
        .where('id', row.id)
        .update({ [settingsColumn]: JSON.stringify(convert(JSON.parse(row.settings))) });
    }
  }
}

/**
 * The south items, the history query items and the configuration workflows gain an optional free-text description, null
 * for the existing rows.
 */
export async function addItemAndWorkflowDescriptions(knex: Knex): Promise<void> {
  for (const table of [SOUTH_ITEMS_TABLE, HISTORY_ITEMS_TABLE, CONFIGURATION_WORKFLOWS_TABLE]) {
    await knex.schema.alterTable(table, t => {
      t.text('description').nullable();
    });
  }
}

/**
 * The history items and groups gain an `empty_interval_strategy`, telling whether the tracked instant moves when a queried
 * interval returns no data. Set to 'keep' (the previous behaviour) for the south connectors supporting history queries,
 * null for the others.
 */
export async function addEmptyIntervalStrategies(knex: Knex): Promise<void> {
  await knex.schema.alterTable(SOUTH_ITEM_GROUPS_TABLE, t => {
    t.string('empty_interval_strategy').nullable();
  });
  await knex.schema.alterTable(SOUTH_ITEMS_TABLE, t => {
    t.string('empty_interval_strategy').nullable();
  });

  const historyConnectorIds = knex(SOUTH_CONNECTORS_TABLE).select('id').whereIn('type', HISTORY_SOUTH_TYPES);
  await knex(SOUTH_ITEM_GROUPS_TABLE).whereIn('south_id', historyConnectorIds).update({ empty_interval_strategy: 'keep' });
  await knex(SOUTH_ITEMS_TABLE).whereIn('connector_id', historyConnectorIds).update({ empty_interval_strategy: 'keep' });
}

/**
 * The database South settings gain a `maxParallelRun`, 1 keeping the queries sequential, and their connection settings move
 * into a `connectionSettings` group (see `toDatabaseSouthSettings` in the config upgrade), for the connectors and the
 * history queries. The request timeout of the MSSQL and PostgreSQL ones moves to their items (see `withItemRequestTimeout`).
 */
export async function addDatabaseConnectionSettings(knex: Knex): Promise<void> {
  const targets = [
    {
      table: SOUTH_CONNECTORS_TABLE,
      typeColumn: 'type',
      settingsColumn: 'settings',
      itemsTable: SOUTH_ITEMS_TABLE,
      parentColumn: 'connector_id'
    },
    {
      table: HISTORY_QUERIES_TABLE,
      typeColumn: 'south_type',
      settingsColumn: 'south_settings',
      itemsTable: HISTORY_ITEMS_TABLE,
      parentColumn: 'history_id'
    }
  ];
  for (const { table, typeColumn, settingsColumn, itemsTable, parentColumn } of targets) {
    const rows: Array<{ id: string; type: string; settings: string }> = await knex(table)
      .select('id', `${typeColumn} as type`, `${settingsColumn} as settings`)
      .whereIn(typeColumn, MAX_PARALLEL_RUN_SOUTH_TYPES);
    for (const row of rows) {
      if (ITEM_REQUEST_TIMEOUT_SOUTH_TYPES.includes(row.type)) {
        const items: Array<{ id: string; settings: string }> = await knex(itemsTable).select('id', 'settings').where(parentColumn, row.id);
        for (const item of items) {
          await knex(itemsTable)
            .where('id', item.id)
            .update({ settings: JSON.stringify(withItemRequestTimeout(JSON.parse(item.settings), JSON.parse(row.settings))) });
        }
      }
      await knex(table)
        .where('id', row.id)
        .update({ [settingsColumn]: JSON.stringify(toDatabaseSouthSettings(row.type, JSON.parse(row.settings))) });
    }
  }
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

/**
 * Replaces a standard transformer: renamed in place (with its new data types), or merged into the replacement when it
 * already exists, the options of its links being converted.
 */
async function replaceStandardTransformer(
  knex: Knex,
  oldFunctionName: string,
  replacement: { functionName: string; inputType?: string; outputType?: string },
  convertOptions: (options: Record<string, unknown>) => Record<string, unknown>
): Promise<void> {
  const oldTransformer: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
    .where({ type: 'standard', function_name: oldFunctionName })
    .first('id');
  if (!oldTransformer) return;

  const existingReplacement: { id: string } | undefined = await knex(TRANSFORMERS_TABLE)
    .where({ type: 'standard', function_name: replacement.functionName })
    .first('id');
  if (!existingReplacement) {
    const renamed: Record<string, string> = { function_name: replacement.functionName };
    if (replacement.inputType) renamed.input_type = replacement.inputType;
    if (replacement.outputType) renamed.output_type = replacement.outputType;
    await knex(TRANSFORMERS_TABLE).where('id', oldTransformer.id).update(renamed);
  }
  await moveLinks(knex, oldTransformer.id, existingReplacement?.id ?? oldTransformer.id, convertOptions);
  if (existingReplacement) {
    await knex(TRANSFORMERS_TABLE).where('id', oldTransformer.id).del();
  }
}

/** Moves the North and history query links of a transformer to another one (or to itself), converting their options. */
async function moveLinks(
  knex: Knex,
  transformerId: string,
  newTransformerId: string,
  convertOptions: (options: Record<string, unknown>) => Record<string, unknown>
): Promise<void> {
  for (const table of TRANSFORMER_LINK_TABLES) {
    const links: Array<{ id: string; options: string | null }> = await knex(table)
      .select('id', 'options')
      .where('transformer_id', transformerId);
    for (const link of links) {
      const options = convertOptions(link.options ? (JSON.parse(link.options) as Record<string, unknown>) : {});
      await knex(table)
        .where('id', link.id)
        .update({ transformer_id: newTransformerId, options: JSON.stringify(options) });
    }
  }
}

/** See `toFieldProcessOperations`: the transformers only process their fields with operations, instead of JS expressions, data types and datetime settings */
export async function convertFieldProcessesToOperations(knex: Knex): Promise<void> {
  const transformers: Array<{ id: string }> = await knex(TRANSFORMERS_TABLE)
    .select('id')
    .where('type', 'standard')
    .whereIn('function_name', FIELD_PROCESS_FUNCTION_NAMES);
  for (const transformer of transformers) {
    await moveLinks(knex, transformer.id, transformer.id, toFieldProcessOperations);
  }
}

/** See `withoutOdbcAgentSettings`, for the connectors and the history queries */
export async function removeOdbcAgentSettings(knex: Knex): Promise<void> {
  const targets = [
    { table: SOUTH_CONNECTORS_TABLE, typeColumn: 'type', settingsColumn: 'settings' },
    { table: HISTORY_QUERIES_TABLE, typeColumn: 'south_type', settingsColumn: 'south_settings' }
  ];
  for (const { table, typeColumn, settingsColumn } of targets) {
    const rows: Array<{ id: string; settings: string }> = await knex(table)
      .select('id', `${settingsColumn} as settings`)
      .where(typeColumn, 'odbc');
    await bulkUpdateSettings(
      knex,
      table,
      settingsColumn,
      rows.map(row => ({ id: row.id, settings: JSON.stringify(withoutOdbcAgentSettings(JSON.parse(row.settings))) }))
    );
  }
}

/** See `withoutOpcAgentSettings`, for the connectors and the history queries */
export async function removeOpcAgentSettings(knex: Knex): Promise<void> {
  const targets = [
    { table: SOUTH_CONNECTORS_TABLE, typeColumn: 'type', settingsColumn: 'settings' },
    { table: HISTORY_QUERIES_TABLE, typeColumn: 'south_type', settingsColumn: 'south_settings' }
  ];
  for (const { table, typeColumn, settingsColumn } of targets) {
    const rows: Array<{ id: string; settings: string }> = await knex(table)
      .select('id', `${settingsColumn} as settings`)
      .where(typeColumn, 'opc');
    await bulkUpdateSettings(
      knex,
      table,
      settingsColumn,
      rows.map(row => ({ id: row.id, settings: JSON.stringify(withoutOpcAgentSettings(JSON.parse(row.settings))) }))
    );
  }
}

/** See `toLocalOleDbSettings`, for the connectors and the history queries */
export async function useLocalOleDbDriver(knex: Knex): Promise<void> {
  const targets = [
    { table: SOUTH_CONNECTORS_TABLE, typeColumn: 'type', settingsColumn: 'settings' },
    { table: HISTORY_QUERIES_TABLE, typeColumn: 'south_type', settingsColumn: 'south_settings' }
  ];
  for (const { table, typeColumn, settingsColumn } of targets) {
    const rows: Array<{ id: string; settings: string }> = await knex(table)
      .select('id', `${settingsColumn} as settings`)
      .where(typeColumn, 'oledb');
    await bulkUpdateSettings(
      knex,
      table,
      settingsColumn,
      rows.map(row => ({ id: row.id, settings: JSON.stringify(toLocalOleDbSettings(JSON.parse(row.settings))) }))
    );
  }
}

/** See `withoutPiAgentSettings` and `withPiValueFilter`, for the connectors, the history queries and their items */
export async function removePiAgentSettings(knex: Knex): Promise<void> {
  const targets = [
    {
      table: SOUTH_CONNECTORS_TABLE,
      typeColumn: 'type',
      settingsColumn: 'settings',
      itemsTable: SOUTH_ITEMS_TABLE,
      parentColumn: 'connector_id'
    },
    {
      table: HISTORY_QUERIES_TABLE,
      typeColumn: 'south_type',
      settingsColumn: 'south_settings',
      itemsTable: HISTORY_ITEMS_TABLE,
      parentColumn: 'history_id'
    }
  ];
  for (const { table, typeColumn, settingsColumn, itemsTable, parentColumn } of targets) {
    const rows: Array<{ id: string; settings: string }> = await knex(table)
      .select('id', `${settingsColumn} as settings`)
      .where(typeColumn, 'osisoft-pi');
    await bulkUpdateSettings(
      knex,
      table,
      settingsColumn,
      rows.map(row => ({ id: row.id, settings: JSON.stringify(withoutPiAgentSettings(JSON.parse(row.settings))) }))
    );
    const items: Array<{ id: string; settings: string }> = await knex(itemsTable)
      .select('id', 'settings')
      .whereIn(
        parentColumn,
        rows.map(row => row.id)
      );
    await bulkUpdateSettings(
      knex,
      itemsTable,
      'settings',
      items.map(item => ({ id: item.id, settings: JSON.stringify(withPiValueFilter(JSON.parse(item.settings))) }))
    );
  }
}

/**
 * The cache, error and archive folders of the North connectors and history queries each get their own maximum size.
 * Before, the single `caching_throttling_cache_max_size` limited the three folders together: the error and archive
 * folders start with that same limit (see `addFolderMaxSizes` in the config upgrade of the same version).
 */
export async function addErrorAndArchiveMaxSizes(knex: Knex): Promise<void> {
  for (const table of [NORTH_CONNECTORS_TABLE, HISTORY_QUERIES_TABLE]) {
    await knex.schema.alterTable(table, builder => {
      builder.integer('caching_error_max_size').notNullable().defaultTo(0);
      builder.integer('caching_archive_max_size').notNullable().defaultTo(0);
    });
    await knex(table).update({
      caching_error_max_size: knex.ref('caching_throttling_cache_max_size'),
      caching_archive_max_size: knex.ref('caching_throttling_cache_max_size')
    });
  }
}

/**
 * The general settings of the engine gain an optional free-text description, null for the existing engine.
 */
export async function addEngineDescription(knex: Knex): Promise<void> {
  await knex.schema.alterTable(ENGINES_TABLE, t => {
    t.text('description').nullable();
  });
}

/**
 * OIAnalytics now issues a short-lived access token with a refresh token to renew it. The registration stores the
 * (encrypted) refresh token and the expiration dates of both tokens. They are null for an OIBus registered before:
 * its long-lived token is exchanged for an access and refresh token pair at startup.
 * OIBus also replaces its cipher key pair each time its refresh token would have expired: it keeps the previous private
 * key, to decrypt the secrets OIAnalytics encrypted just before, and the date of the next replacement (null replaces it
 * at the first refresh). The command regenerating the key pair is removed.
 */
export async function addRegistrationTokenRefresh(knex: Knex): Promise<void> {
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    table.text('refresh_token').nullable();
    table.string('token_expiration_date').nullable();
    table.string('refresh_token_expiration_date').nullable();
    table.text('previous_private_key').nullable();
    table.string('cipher_key_rotation_date').nullable();
  });
  // OIBus now replaces its cipher keys by itself, along with its tokens: the command regenerating them is gone
  await knex(COMMANDS_TABLE).where('type', 'regenerate-cipher-keys').delete();
}

/**
 * Secret fields of the connector settings in OIBus 4.0, by connector type. Kept here rather than read from the manifests,
 * which describe the settings of the latest version, not the ones this migration finds. No item has a secret field.
 */
const SOUTH_SECRET_FIELDS: Record<string, Array<string>> = {
  'folder-scanner': ['password'],
  sftp: ['password', 'passphrase'],
  ftp: ['password'],
  opcua: ['authentication.password'],
  mqtt: ['authentication.password'],
  mssql: ['connectionSettings.password'],
  mysql: ['connectionSettings.password'],
  oracle: ['connectionSettings.password'],
  postgresql: ['connectionSettings.password'],
  influxdb: ['connectionSettings.password', 'connectionSettings.token'],
  odbc: ['password'],
  oledb: ['password'],
  mongodb: ['password'],
  rest: ['authentication.password', 'authentication.token', 'authentication.apiValue', 'proxy.proxyPassword'],
  oianalytics: ['specificSettings.secretKey', 'specificSettings.clientSecret', 'specificSettings.proxyPassword']
};
const NORTH_SECRET_FIELDS: Record<string, Array<string>> = {
  oianalytics: ['specificSettings.secretKey', 'specificSettings.clientSecret', 'specificSettings.proxyPassword'],
  rest: ['authentication.password', 'authentication.token', 'authentication.apiValue', 'proxy.proxyPassword'],
  'file-writer': ['password'],
  sftp: ['password', 'passphrase'],
  'azure-blob': ['accessKey', 'sasToken', 'clientSecret', 'proxyPassword'],
  'aws-s3': ['secretKey', 'proxyPassword'],
  opcua: ['authentication.password'],
  mqtt: ['authentication.password'],
  'azure-data-explorer': ['clientSecret', 'proxyPassword']
};
/** Columns holding a secret, outside the connector settings */
const SECRET_COLUMNS: Array<{ table: string; columns: Array<string> }> = [
  { table: ENGINES_TABLE, columns: ['forward_proxy_password', 'log_loki_password'] },
  {
    table: REGISTRATIONS_TABLE,
    columns: ['token', 'refresh_token', 'private_key', 'previous_private_key', 'proxy_password', 'api_gateway_header_value']
  },
  { table: CERTIFICATES_TABLE, columns: ['private_key'] }
];

/**
 * Until OIBus 4.0, the secrets were encrypted with AES-256-CBC, with the same IV for all of them and no integrity check.
 * They are encrypted again with AES-256-GCM, with a random nonce each, and a key derived from the stored one (see
 * EncryptionService).
 * The key and the IV are read in crypto.db, next to oibus.db, and only when a secret is found: a new OIBus has none, and
 * may have no crypto.db yet. The crypto migration of 4.0.0, which runs after the entity migrations, then removes the IV.
 * A secret that cannot be decrypted is left as is (it could not be used either way), to be set again.
 */
export async function encryptSecretsWithAesGcm(knex: Knex): Promise<void> {
  let reEncryptWithKeys: ((value: string) => string) | null | undefined;
  const reEncrypt = async (value: string, location: string): Promise<string> => {
    if (reEncryptWithKeys === undefined) {
      reEncryptWithKeys = await loadLegacyReEncryption(knex);
    }
    if (!reEncryptWithKeys) return value;
    try {
      return reEncryptWithKeys(value);
    } catch (error: unknown) {
      console.warn(
        `Secret of ${location} not encrypted again, as it cannot be decrypted (${(error as Error).message}): it must be set again`
      );
      return value;
    }
  };

  for (const { table, columns } of SECRET_COLUMNS) {
    for (const row of await knex(table).select('id', ...columns)) {
      const changes: Record<string, string> = {};
      for (const column of columns) {
        if (!row[column]) continue;
        const value = await reEncrypt(row[column], `${table}.${column} (${row.id})`);
        if (value !== row[column]) changes[column] = value;
      }
      if (Object.keys(changes).length > 0) {
        await knex(table).where('id', row.id).update(changes);
      }
    }
  }

  const reEncryptSettings = async (
    table: string,
    typeColumn: string,
    settingsColumn: string,
    secretFields: Record<string, Array<string>>
  ) => {
    for (const row of await knex(table).select('id', typeColumn, settingsColumn)) {
      const fields = secretFields[row[typeColumn]];
      if (!fields || !row[settingsColumn]) continue;
      const settings = JSON.parse(row[settingsColumn]);
      let changed = false;
      for (const field of fields) {
        const keys = field.split('.');
        const parent = keys.slice(0, -1).reduce((object, key) => object?.[key], settings);
        const lastKey = keys[keys.length - 1];
        if (!parent || typeof parent[lastKey] !== 'string' || !parent[lastKey]) continue;
        const value = await reEncrypt(parent[lastKey], `${table}.${settingsColumn}.${field} (${row.id})`);
        if (value !== parent[lastKey]) {
          parent[lastKey] = value;
          changed = true;
        }
      }
      if (changed) {
        await knex(table)
          .where('id', row.id)
          .update({ [settingsColumn]: JSON.stringify(settings) });
      }
    }
  };
  await reEncryptSettings(SOUTH_CONNECTORS_TABLE, 'type', 'settings', SOUTH_SECRET_FIELDS);
  await reEncryptSettings(NORTH_CONNECTORS_TABLE, 'type', 'settings', NORTH_SECRET_FIELDS);
  await reEncryptSettings(HISTORY_QUERIES_TABLE, 'south_type', 'south_settings', SOUTH_SECRET_FIELDS);
  await reEncryptSettings(HISTORY_QUERIES_TABLE, 'north_type', 'north_settings', NORTH_SECRET_FIELDS);
}

/**
 * The data folder, holding oibus.db: null for an in-memory database (a test)
 */
const getDataFolder = (knex: Knex): string | null => {
  const filename: unknown = (knex.client.config.connection as { filename?: unknown } | undefined)?.filename;
  return typeof filename === 'string' && filename !== ':memory:' ? path.dirname(filename) : null;
};

/**
 * The AES-256-CBC key and IV of OIBus, in crypto.db next to oibus.db. Null when they are missing.
 */
async function readCryptoSettings(knex: Knex): Promise<{ securityKey: Buffer; initVector: Buffer } | null> {
  const engine = await knex(ENGINES_TABLE).first('id');
  const dataFolder = getDataFolder(knex);
  const cryptoDatabasePath = dataFolder ? path.resolve(dataFolder, 'crypto.db') : null;
  if (!engine || !cryptoDatabasePath || !existsSync(cryptoDatabasePath)) return null;
  const database = new Database(cryptoDatabasePath, { readonly: true });
  try {
    const columns = (database.prepare('PRAGMA table_info(crypto);').all() as Array<{ name: string }>).map(column => column.name);
    if (!columns.includes('init_vector')) return null;
    const settings = database.prepare('SELECT init_vector, security_key FROM crypto WHERE id = ?;').get(engine.id) as
      { init_vector: string; security_key: string } | undefined;
    if (!settings) return null;
    return { securityKey: Buffer.from(settings.security_key, 'base64'), initVector: Buffer.from(settings.init_vector, 'base64') };
  } finally {
    database.close();
  }
}

/**
 * Encrypt a text with AES-256-GCM, as EncryptionService does: the base64 of a random nonce, the ciphertext and the
 * authentication tag, with a key derived from the stored one
 */
const encryptWithAesGcm = (securityKey: Buffer, plainText: string): string => {
  const key = Buffer.from(crypto.hkdfSync('sha256', securityKey, Buffer.alloc(0), 'oibus-secret-encryption-aes-256-gcm', 32));
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, encrypted, cipher.getAuthTag()]).toString('base64');
};

/**
 * Return the function decrypting a secret with the AES-256-CBC key and IV and encrypting it again with AES-256-GCM. Null
 * when they are missing: the secrets can no longer be decrypted.
 */
async function loadLegacyReEncryption(knex: Knex): Promise<((value: string) => string) | null> {
  const settings = await readCryptoSettings(knex);
  if (!settings) {
    console.warn('No crypto settings to decrypt the secrets and encrypt them again: they must be set again');
    return null;
  }
  return (value: string): string => {
    const decipher = crypto.createDecipheriv('aes-256-cbc', settings.securityKey, settings.initVector);
    return encryptWithAesGcm(settings.securityKey, decipher.update(value, 'base64', 'utf8') + decipher.final('utf8'));
  };
}

/**
 * Password of the default account created at the first start, unless the init configuration sets another one.
 */
const DEFAULT_PASSWORD = 'pass';

/**
 * A user still having the default password must change it before doing anything else: flag them.
 */
export async function flagDefaultPasswords(knex: Knex): Promise<void> {
  await knex.schema.alterTable(USERS_TABLE, table => {
    table.boolean('must_change_password').notNullable().defaultTo(false);
  });
  const users: Array<{ id: string; password: string }> = await knex(USERS_TABLE).select('id', 'password');
  for (const user of users) {
    if (await argon2.verify(user.password, DEFAULT_PASSWORD).catch(() => false)) {
      await knex(USERS_TABLE).where('id', user.id).update({ must_change_password: true });
    }
  }
}

/** Name of the certificate imported in the store for the OPC UA connectors */
export const OPCUA_CERTIFICATE_NAME = 'OIBus OPC UA';

/**
 * The OPC UA connectors used the certificate of OIBus, in certs/ (whose key also signed the authentication tokens): they
 * now use a certificate of the store, selected in their settings. The certificate of OIBus is imported into the store as
 * it is, so that the OPC UA servers which trust it keep trusting OIBus, and selected by the existing OPC UA connectors
 * and history queries. The crypto migration of 4.0.0 then removes certs/, no longer used.
 */
export async function moveOPCUACertificateToStore(knex: Knex): Promise<void> {
  const dataFolder = getDataFolder(knex);
  if (!dataFolder) return;
  const certificatePath = path.resolve(dataFolder, 'certs', 'cert.pem');
  const privateKeyPath = path.resolve(dataFolder, 'certs', 'private.pem');
  if (!existsSync(certificatePath) || !existsSync(privateKeyPath)) return; // a new OIBus
  const cryptoSettings = await readCryptoSettings(knex);
  if (!cryptoSettings) {
    console.warn('No crypto settings to encrypt the private key of the OPC UA certificate: select a certificate in the OPC UA connectors');
    return;
  }

  const certificate = readFileSync(certificatePath, 'utf8');
  const x509 = new crypto.X509Certificate(certificate);
  const certificateId = generateRandomId(6);
  await knex(CERTIFICATES_TABLE).insert({
    id: certificateId,
    name: OPCUA_CERTIFICATE_NAME,
    description: 'Certificate of OIBus for the OPC UA servers, from certs/cert.pem',
    public_key: x509.publicKey.export({ type: 'spki', format: 'pem' }) as string,
    private_key: encryptWithAesGcm(cryptoSettings.securityKey, readFileSync(privateKeyPath, 'utf8')),
    certificate,
    certificate_chain: null,
    expiry: x509.validToDate.toISOString(),
    created_by: 'system',
    updated_by: 'system'
  });

  for (const [table, typeColumn, settingsColumn] of [
    [SOUTH_CONNECTORS_TABLE, 'type', 'settings'],
    [NORTH_CONNECTORS_TABLE, 'type', 'settings'],
    [HISTORY_QUERIES_TABLE, 'south_type', 'south_settings'],
    [HISTORY_QUERIES_TABLE, 'north_type', 'north_settings']
  ]) {
    for (const row of await knex(table).where(typeColumn, 'opcua').select('id', settingsColumn)) {
      const settings = JSON.parse(row[settingsColumn]);
      await knex(table)
        .where('id', row.id)
        .update({ [settingsColumn]: JSON.stringify({ ...settings, certificateId }) });
    }
  }
}

/**
 * The OPC UA connectors and history queries authenticating their user with a certificate read it from two files (paths
 * of the certificate and of its private key): they now select it in the certificate store. The files cannot be imported
 * for them (they may be anywhere, or out of reach of the migration), so their paths are removed: the certificate must be
 * imported into the store and selected again (see What's new in OIBus 4). As in the config upgrade, with
 * `withoutUserCertificateFiles`.
 */
export async function removeOPCUAUserCertificateFiles(knex: Knex): Promise<void> {
  for (const [table, typeColumn, settingsColumn] of [
    [SOUTH_CONNECTORS_TABLE, 'type', 'settings'],
    [NORTH_CONNECTORS_TABLE, 'type', 'settings'],
    [HISTORY_QUERIES_TABLE, 'south_type', 'south_settings'],
    [HISTORY_QUERIES_TABLE, 'north_type', 'north_settings']
  ]) {
    for (const row of await knex(table).where(typeColumn, 'opcua').select('id', settingsColumn)) {
      await knex(table)
        .where('id', row.id)
        .update({ [settingsColumn]: JSON.stringify(withoutUserCertificateFiles(JSON.parse(row[settingsColumn]))) });
    }
  }
}

/**
 * The connectors and history queries gain the trust in the identity of their server (a JSON object, see `ServerTrust`):
 * the identity trusted, none yet, and whether they trust the identity they receive at their first connection, as the OPC
 * UA (with a security mode other than None) and SFTP ones do, which worked without checking it. As in the config upgrade,
 * with `toServerTrust`.
 */
export async function addServerTrust(knex: Knex): Promise<void> {
  const noTrust = JSON.stringify({ identity: null, trustOnFirstUse: false });
  for (const [table, columns] of [
    [SOUTH_CONNECTORS_TABLE, ['server_trust']],
    [NORTH_CONNECTORS_TABLE, ['server_trust']],
    [HISTORY_QUERIES_TABLE, ['south_server_trust', 'north_server_trust']]
  ] as const) {
    await knex.schema.alterTable(table, builder => {
      for (const column of columns) {
        builder.text(column).notNullable().defaultTo(noTrust);
      }
    });
  }

  for (const [table, typeColumn, settingsColumn, trustColumn] of [
    [SOUTH_CONNECTORS_TABLE, 'type', 'settings', 'server_trust'],
    [NORTH_CONNECTORS_TABLE, 'type', 'settings', 'server_trust'],
    [HISTORY_QUERIES_TABLE, 'south_type', 'south_settings', 'south_server_trust'],
    [HISTORY_QUERIES_TABLE, 'north_type', 'north_settings', 'north_server_trust']
  ]) {
    for (const row of await knex(table).whereIn(typeColumn, ['opcua', 'sftp']).select('id', typeColumn, settingsColumn)) {
      await knex(table)
        .where('id', row.id)
        .update({ [trustColumn]: JSON.stringify(toServerTrust(row[typeColumn], JSON.parse(row[settingsColumn]))) });
    }
  }
}

/**
 * The certificate store gains the certificates OIBus trusts (certification authorities and certificates of servers),
 * without private key, besides the ones it presents with their private key: every certificate stored until now is one of
 * these. A trusted certificate keeps an empty private key, the column staying NOT NULL.
 */
export async function addTrustedCertificates(knex: Knex): Promise<void> {
  await knex.schema.alterTable(CERTIFICATES_TABLE, table => {
    table.string('kind').notNullable().defaultTo('key-pair');
  });
}

/**
 * The TLS connectors and history queries validate the certificate of their server against a certificate of the store
 * instead of accepting any certificate: as in the config upgrade, with `toCertificateValidation`. So does the registration
 * of OIBus with OIAnalytics, which trusts a certificate of the store when it accepted any certificate until now.
 */
export async function useTrustedCertificates(knex: Knex): Promise<void> {
  await knex.schema.alterTable(REGISTRATIONS_TABLE, table => {
    table.string('certificate_validation').notNullable().defaultTo('standard');
    table.string('trusted_certificate_id').nullable();
  });
  await knex(REGISTRATIONS_TABLE).where('accept_unauthorized', 1).update({ certificate_validation: 'trusted' });
  await dropColumns(knex, REGISTRATIONS_TABLE, ['accept_unauthorized']);

  for (const [table, typeColumn, side, settingsColumn, trustColumn] of [
    [SOUTH_CONNECTORS_TABLE, 'type', 'south', 'settings', 'server_trust'],
    [NORTH_CONNECTORS_TABLE, 'type', 'north', 'settings', 'server_trust'],
    [HISTORY_QUERIES_TABLE, 'south_type', 'south', 'south_settings', 'south_server_trust'],
    [HISTORY_QUERIES_TABLE, 'north_type', 'north', 'north_settings', 'north_server_trust']
  ] as const) {
    for (const row of await knex(table).select('id', typeColumn, settingsColumn)) {
      const converted = toCertificateValidation(row[typeColumn], side, JSON.parse(row[settingsColumn]));
      if (converted) {
        await knex(table)
          .where('id', row.id)
          .update({
            [settingsColumn]: JSON.stringify(converted.settings),
            [trustColumn]: JSON.stringify({ identity: null, trustOnFirstUse: converted.trustOnFirstUse })
          });
      }
    }
  }
}
