import { Knex } from 'knex';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';

interface OldSouthOPCUAItemSettings {
  nodeId: string;
  mode: 'ha' | 'da';
  haMode?: {
    aggregate: 'raw' | 'average' | 'minimum' | 'maximum' | 'count';
    resampling?: 'none' | '1s' | '10s' | '30s' | '1min' | '1h' | '1d';
  } | null;
}

interface NewSouthOPCUAItemSettings {
  nodeId: string;
  mode: 'ha' | 'da';
  haMode?: {
    aggregate: 'raw' | 'average' | 'minimum' | 'maximum' | 'count';
    resampling?: 'none' | '1s' | '10s' | '30s' | '1min' | '1h' | '1d';
  } | null;
  timestampOrigin: 'oibus' | 'point' | 'server';
}

export async function up(knex: Knex): Promise<void> {
  await updateSouthOPCUAItemSettings(knex);
}

async function updateSouthOPCUAItemSettings(knex: Knex) {
  const oldSouth: Array<{
    id: string;
    type: string;
  }> = await knex(SOUTH_CONNECTORS_TABLE).select('id', 'type', 'settings').where('type', 'opcua');

  for (const connector of oldSouth) {
    const items: Array<{
      id: string;
      settings: string;
    }> = await knex(SOUTH_ITEMS_TABLE).select('id', 'settings').where('connector_id', connector.id);
    for (const item of items) {
      const oldItemSettings: OldSouthOPCUAItemSettings = JSON.parse(item.settings);
      if (oldItemSettings.mode === 'da') {
        const newItemSettings: NewSouthOPCUAItemSettings = {
          ...oldItemSettings,
          timestampOrigin: 'oibus'
        };
        await knex(SOUTH_ITEMS_TABLE)
          .update({ settings: JSON.stringify(newItemSettings) })
          .where('id', item.id);
      }
    }
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
