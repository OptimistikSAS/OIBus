import { Knex } from 'knex';
import {
  SouthOPCUASettingsAuthentication,
  SouthOPCUASettingsSecurityMode,
  SouthOPCUASettingsSecurityPolicy
} from '../../../shared/model/south-settings.model';

const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const HISTORY_QUERIES_TABLE = 'history_queries';

export interface OldSouthOPCUASettings {
  url: string;
  keepSessionAlive: boolean;
  retryInterval: number;
  securityMode: SouthOPCUASettingsSecurityMode;
  securityPolicy?: SouthOPCUASettingsSecurityPolicy | null;
  authentication: SouthOPCUASettingsAuthentication;
}

export interface NewSouthOPCUASettings {
  url: string;
  keepSessionAlive: boolean;
  retryInterval: number;
  readTimeout: number;
  securityMode: SouthOPCUASettingsSecurityMode;
  securityPolicy?: SouthOPCUASettingsSecurityPolicy | null;
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
