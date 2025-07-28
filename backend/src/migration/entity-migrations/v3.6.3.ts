import { Knex } from 'knex';
import { SouthOPCUAItemSettingsHaMode, SouthOPCUAItemSettingsMode } from '../../../shared/model/south-settings.model';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';

interface OldSouthOPCUAItemSettings {
  nodeId: string;
  mode: SouthOPCUAItemSettingsMode;
  haMode?: SouthOPCUAItemSettingsHaMode | null;
}

interface NewSouthOPCUAItemSettings {
  nodeId: string;
  mode: SouthOPCUAItemSettingsMode;
  haMode?: SouthOPCUAItemSettingsHaMode | null;
  timestampOrigin: string;
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
