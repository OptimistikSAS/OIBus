import { Knex } from 'knex';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';

interface SouthSettingsWithThrottling {
  [key: string]: string | number | boolean | object;
  throttling: {
    maxReadInterval: number;
    readDelay: number;
    overlap: number;
    maxInstantPerItem: boolean;
  };
}

export async function up(knex: Knex): Promise<void> {
  await updateMaxInstantPerItemBooleanType(knex);
}

async function updateMaxInstantPerItemBooleanType(knex: Knex): Promise<void> {
  const oldSouth: Array<{
    id: string;
    type: string;
    settings: string;
  }> = await knex(SOUTH_CONNECTORS_TABLE).select('id', 'type', 'settings').whereIn('type', ['opc', 'opcua', 'osisoft-pi']);

  for (const connector of oldSouth) {
    const oldSettings = JSON.parse(connector.settings) as SouthSettingsWithThrottling;
    const newSettings: SouthSettingsWithThrottling = {
      ...oldSettings,
      throttling: { ...oldSettings.throttling, maxInstantPerItem: Boolean(oldSettings.throttling.maxInstantPerItem) }
    };
    await knex(SOUTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
      .where('id', connector.id);
  }

  const oldHistories: Array<{
    id: string;
    south_type: string;
    south_settings: string;
  }> = await knex(HISTORY_QUERIES_TABLE).select('id', 'south_type', 'south_settings').whereIn('south_type', ['opc', 'opcua', 'osisoft-pi']);

  for (const history of oldHistories) {
    const oldSettings = JSON.parse(history.south_settings) as SouthSettingsWithThrottling;
    const newSettings: SouthSettingsWithThrottling = {
      ...oldSettings,
      throttling: { ...oldSettings.throttling, maxInstantPerItem: Boolean(oldSettings.throttling.maxInstantPerItem) }
    };
    await knex(HISTORY_QUERIES_TABLE)
      .update({ south_settings: JSON.stringify(newSettings) })
      .where('id', history.id);
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
