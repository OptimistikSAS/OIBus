import { Knex } from 'knex';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEM_GROUPS_TABLE = 'south_item_groups';
const SOUTH_ITEMS_TABLE = 'south_items';

// "IoT family" south connector types: OPC UA, Modbus, ADS, OPC classic, S7 and MQTT. These connectors
// forward every value they read/receive straight into the cache with no built-in deduplication, so they
// are the only ones for which a per-item caching strategy is meaningful. Mirrors
// IOT_FAMILY_SOUTH_TYPES in shared/model/south-connector.model.ts.
const IOT_FAMILY_SOUTH_TYPES = ['opcua', 'modbus', 'ads', 'opc', 's7', 'mqtt'];

export async function up(knex: Knex): Promise<void> {
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

  // Only IoT-family south connectors get a default caching strategy; every other south type keeps
  // caching_strategy NULL (the field is meaningless outside the IoT family).
  const iotFamilyConnectorIds = knex(SOUTH_CONNECTORS_TABLE).select('id').whereIn('type', IOT_FAMILY_SOUTH_TYPES);
  await knex(SOUTH_ITEM_GROUPS_TABLE).whereIn('south_id', iotFamilyConnectorIds).update({ caching_strategy: 'allValues' });
  await knex(SOUTH_ITEMS_TABLE).whereIn('connector_id', iotFamilyConnectorIds).update({ caching_strategy: 'allValues' });
}

export async function down(knex: Knex): Promise<void> {
  // Use native SQLite `DROP COLUMN` (single in-place metadata change, available since SQLite 3.35) instead
  // of knex's `dropColumn()`, which rebuilds the table via CREATE + COPY + DROP TABLE + RENAME. The rebuild's
  // `DROP TABLE` step fails with a FOREIGN KEY constraint error here because `group_items` and
  // `north_transformers_items` hold live rows referencing `south_item_groups`/`south_items`, and SQLite
  // refuses to drop a table that still has other tables pointing into it while `foreign_keys` is enabled.
  await knex.raw(`ALTER TABLE ${SOUTH_ITEM_GROUPS_TABLE} DROP COLUMN caching_strategy`);
  await knex.raw(`ALTER TABLE ${SOUTH_ITEMS_TABLE} DROP COLUMN caching_strategy`);
  await knex.raw(`ALTER TABLE ${SOUTH_ITEMS_TABLE} DROP COLUMN threshold_type`);
  await knex.raw(`ALTER TABLE ${SOUTH_ITEMS_TABLE} DROP COLUMN threshold`);
  await knex.raw(`ALTER TABLE ${SOUTH_ITEMS_TABLE} DROP COLUMN range_low`);
  await knex.raw(`ALTER TABLE ${SOUTH_ITEMS_TABLE} DROP COLUMN range_high`);
  await knex.raw(`ALTER TABLE ${SOUTH_ITEMS_TABLE} DROP COLUMN max_caching_interval`);
}
