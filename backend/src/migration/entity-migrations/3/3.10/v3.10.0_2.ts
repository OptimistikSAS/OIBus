import { Knex } from 'knex';

// The configuration change is shared with the config upgrade of the same version (applied to imported configurations)
import { RAW_RESAMPLING_SOUTH_TYPES, toNoneResamplingItemSettings } from '../../../../service/config-transfer/config-upgrades/3.10/v3.10.0';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';

/**
 * The OPC UA (`haMode.resampling`) and OPC (`resampling`) item manifests defaulted the resampling to 'raw', which is not
 * one of its selectable values ('none', '1s', ...). Items saved with that default are moved to 'none', which is what
 * 'raw' already meant at runtime.
 */
export async function up(knex: Knex): Promise<void> {
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

export async function down(_knex: Knex): Promise<void> {
  return;
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
