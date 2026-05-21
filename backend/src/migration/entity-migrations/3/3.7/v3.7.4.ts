import { Knex } from 'knex';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const HISTORY_QUERIES_TABLE = 'history_queries';
const HISTORY_ITEMS_TABLE = 'history_items';

interface SouthOPCUAItemSettings {
  nodeId: string;
  mode: 'ha' | 'da';
  haMode?: {
    aggregate: 'raw' | 'average' | 'minimum' | 'maximum' | 'count';
    resampling?: 'none' | '1s' | '10s' | '30s' | '1min' | '1h' | '1d';
  };
  timestampOrigin?: 'oibus' | 'point' | 'server';
}

export async function up(knex: Knex): Promise<void> {
  await updateOPCUAItemHA(knex);
}

async function updateOPCUAItemHA(knex: Knex): Promise<void> {
  const oldSouth: Array<{
    id: string;
    type: string;
  }> = await knex(SOUTH_CONNECTORS_TABLE).select('id', 'type', 'settings').where('type', 'opcua');
  for (const connector of oldSouth) {
    const oldItems: Array<{
      id: string;
      settings: string;
    }> = await knex(SOUTH_ITEMS_TABLE).select('id', 'settings').where('connector_id', connector.id);
    for (const item of oldItems) {
      const oldSettings = JSON.parse(item.settings) as SouthOPCUAItemSettings;

      const newSettings: SouthOPCUAItemSettings = {
        ...oldSettings,
        haMode: oldSettings.mode === 'ha' ? oldSettings.haMode : undefined,
        timestampOrigin: oldSettings.mode === 'da' ? oldSettings.timestampOrigin : undefined
      };
      await knex(SOUTH_ITEMS_TABLE)
        .update({ settings: JSON.stringify(newSettings) })
        .where('id', item.id);
    }
  }

  const oldHistories: Array<{
    id: string;
    south_type: string;
  }> = await knex(HISTORY_QUERIES_TABLE).select('id', 'south_type', 'south_settings').where('south_type', 'opcua');
  for (const history of oldHistories) {
    const oldItems: Array<{
      id: string;
      settings: string;
    }> = await knex(HISTORY_ITEMS_TABLE).select('id', 'settings').where('history_id', history.id);
    for (const item of oldItems) {
      const oldSettings = JSON.parse(item.settings) as SouthOPCUAItemSettings;

      const newSettings: SouthOPCUAItemSettings = {
        ...oldSettings,
        haMode: oldSettings.mode === 'ha' ? oldSettings.haMode : undefined,
        timestampOrigin: oldSettings.mode === 'da' ? oldSettings.timestampOrigin : undefined
      };
      await knex(HISTORY_ITEMS_TABLE)
        .update({ settings: JSON.stringify(newSettings) })
        .where('id', item.id);
    }
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
