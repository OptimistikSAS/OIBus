import { Knex } from 'knex';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';

interface SouthOPCUASettingsAuthentication {
  type: 'none' | 'basic' | 'cert';
  username?: string;
  password?: string | null;
  certFilePath?: string;
  keyFilePath?: string;
}

export interface OldSouthOPCUASettings {
  url: string;
  keepSessionAlive: boolean;
  retryInterval: number;
  securityMode: 'none' | 'sign' | 'sign-and-encrypt';
  securityPolicy?:
    | 'none'
    | 'basic128'
    | 'basic192'
    | 'basic256'
    | 'basic128-rsa15'
    | 'basic192-rsa15'
    | 'basic256-rsa15'
    | 'basic256-sha256'
    | 'aes128-sha256-rsa-oaep'
    | 'pub-sub-aes-128-ctr'
    | 'pub-sub-aes-256-ctr'
    | null;
  authentication: SouthOPCUASettingsAuthentication;
}

export interface NewSouthOPCUASettings {
  url: string;
  keepSessionAlive: boolean;
  retryInterval: number;
  readTimeout: number;
  securityMode: 'none' | 'sign' | 'sign-and-encrypt';
  securityPolicy?:
    | 'none'
    | 'basic128'
    | 'basic192'
    | 'basic256'
    | 'basic128-rsa15'
    | 'basic192-rsa15'
    | 'basic256-rsa15'
    | 'basic256-sha256'
    | 'aes128-sha256-rsa-oaep'
    | 'pub-sub-aes-128-ctr'
    | 'pub-sub-aes-256-ctr'
    | null;
  authentication: SouthOPCUASettingsAuthentication;
}

export async function up(knex: Knex): Promise<void> {
  await updateOPCUASettings(knex);
  await updateOPCUAHistoryQueries(knex);
}

async function updateOPCUASettings(knex: Knex) {
  const oldSouthSettings: Array<{ id: string; settings: string }> = await knex(SOUTH_CONNECTORS_TABLE)
    .select('id', 'settings')
    .where('type', 'opcua');

  for (const { id, settings } of oldSouthSettings) {
    const newSettings: NewSouthOPCUASettings = {
      ...(JSON.parse(settings) as OldSouthOPCUASettings),
      readTimeout: 15000
    };
    await knex(SOUTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
      .where('id', id);
  }
}

async function updateOPCUAHistoryQueries(knex: Knex): Promise<void> {
  const oldSouthSettings: Array<{ id: string; settings: string }> = await knex(HISTORY_QUERIES_TABLE)
    .select('id', 'south_settings as settings')
    .where('south_type', 'opcua');

  for (const { id, settings } of oldSouthSettings) {
    const newSettings: NewSouthOPCUASettings = {
      ...(JSON.parse(settings) as OldSouthOPCUASettings),
      readTimeout: 15000
    };
    await knex(HISTORY_QUERIES_TABLE)
      .update({ south_settings: JSON.stringify(newSettings) })
      .where('id', id);
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
