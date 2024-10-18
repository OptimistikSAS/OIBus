import { Knex } from 'knex';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';
const REGISTRATIONS_TABLE = 'registrations';
const COMMANDS_TABLE = 'commands';

export interface OldSouthOracleSettings {
  host: string;
  port: number;
  connectionTimeout: number;
  database: string;
  username: string | null;
  password: string | null;
}

export interface NewSouthOracleSettings {
  thickMode: boolean;
  oracleClient?: string;
  host: string;
  port: number;
  connectionTimeout: number;
  database: string;
  username: string | null;
  password: string | null;
}

export async function up(knex: Knex): Promise<void> {
  await updateSouthOracleSettings(knex);
  await updateOracleHistoryQueries(knex);
}

async function updateSouthOracleSettings(knex: Knex): Promise<void> {
  const oldSouthSettings: Array<{ id: string; settings: string }> = await knex(SOUTH_CONNECTORS_TABLE)
    .select('id', 'settings')
    .where('type', 'oracle');

  for (const { id, settings } of oldSouthSettings) {
    const newSettings: NewSouthOracleSettings = {
      ...(JSON.parse(settings) as OldSouthOracleSettings),
      thickMode: false,
      oracleClient: ''
    };
    await knex(SOUTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
      .where('id', id);
  }
}

async function updateOracleHistoryQueries(knex: Knex): Promise<void> {
  const oldSouthSettings: Array<{ id: string; settings: string }> = await knex(HISTORY_QUERIES_TABLE)
    .select('id', 'south_settings as settings')
    .where('south_type', 'oracle');

  for (const { id, settings } of oldSouthSettings) {
    const newSettings: NewSouthOracleSettings = {
      ...(JSON.parse(settings) as OldSouthOracleSettings),
      thickMode: false,
      oracleClient: ''
    };
    await knex(HISTORY_QUERIES_TABLE)
      .update({ south_settings: JSON.stringify(newSettings) })
      .where('id', id);
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
