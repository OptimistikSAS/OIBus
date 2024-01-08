import { Knex } from 'knex';
import { REGISTRATIONS_TABLE } from '../../repository/registration.repository';
import { LOG_LEVELS, REGISTRATION_STATUS } from '../../../../shared/model/engine.model';
import { NORTH_CONNECTORS_TABLE } from '../../repository/north-connector.repository';
import { COMMANDS_TABLE } from '../../repository/command.repository';
import { OIBUS_COMMAND_STATUS, OIBUS_COMMAND_TYPES } from '../../../../shared/model/command.model';
import CreateTableBuilder = Knex.CreateTableBuilder;
import { SOUTH_CONNECTORS_TABLE } from '../../repository/south-connector.repository';
import { HISTORY_QUERIES_TABLE } from '../../repository/history-query.repository';
import { ENGINES_TABLE } from '../../repository/engine.repository';

const NORTH_OIANALYTICS_SETTINGS_AUTHENTICATIONS = ['basic', 'aad-client-secret', 'aad-certificate'] as const;
export type NorthOIAnalyticsSettingsAuthentication = (typeof NORTH_OIANALYTICS_SETTINGS_AUTHENTICATIONS)[number];

interface OldNorthOIAnalyticsSettings {
  host: string;
  acceptUnauthorized: boolean;
  timeout: number;
  authentication: NorthOIAnalyticsSettingsAuthentication;
  accessKey?: string;
  secretKey?: string | null;
  tenantId?: string | null;
  clientId?: string;
  clientSecret?: string | null;
  certificateId?: string | null;
  scope?: string | null;
  useProxy: boolean;
  proxyUrl?: string;
  proxyUsername?: string | null;
  proxyPassword?: string | null;
}

interface NewNorthOIAnalyticsSettings {
  useOiaModule: boolean;
  timeout: number;
  specificSettings: {
    host: string;
    acceptUnauthorized: boolean;
    authentication: NorthOIAnalyticsSettingsAuthentication;
    accessKey?: string;
    secretKey?: string | null;
    tenantId?: string | null;
    clientId?: string;
    clientSecret?: string | null;
    certificateId?: string | null;
    scope?: string | null;
    useProxy: boolean;
    proxyUrl?: string;
    proxyUsername?: string | null;
    proxyPassword?: string | null;
  };
}

interface OldSouthOIAnalyticsSettings {
  host: string;
  acceptUnauthorized: boolean;
  timeout: number;
  accessKey: string;
  secretKey: string | null;
  useProxy: boolean;
  proxyUrl?: string;
  proxyUsername?: string | null;
  proxyPassword?: string | null;
}

interface NewSouthOIAnalyticsSettings {
  useOiaModule: boolean;
  timeout: number;
  specificSettings: {
    host: string;
    acceptUnauthorized: boolean;
    authentication: NorthOIAnalyticsSettingsAuthentication;
    accessKey?: string;
    secretKey?: string | null;
    tenantId?: string | null;
    clientId?: string;
    clientSecret?: string | null;
    certificateId?: string | null;
    scope?: string | null;
    useProxy: boolean;
    proxyUrl?: string;
    proxyUsername?: string | null;
    proxyPassword?: string | null;
  };
}

export async function up(knex: Knex): Promise<void> {
  await createRegistrationTable(knex);
  await createCommandTable(knex);
  await updateNorthOIAnalyticsConnectors(knex);
  await updateSouthOIAnalyticsConnectors(knex);
  await updateOIAnalyticsHistoryQueries(knex);
  await updateEngineLogSettings(knex);
}

function createDefaultEntityFields(table: CreateTableBuilder): void {
  table.uuid('id').primary();
  table.timestamps(false, true);
}

async function createRegistrationTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(REGISTRATIONS_TABLE, table => {
    createDefaultEntityFields(table);
    table.string('host').notNullable().unique();
    table.boolean('use_proxy').defaultTo(false);
    table.string('proxy_url');
    table.string('proxy_username');
    table.string('proxy_password');
    table.string('accept_unauthorized');
    table.string('activation_code').unique();
    table.string('check_url').unique();
    table.string('activation_date');
    table.string('activation_expiration_date');
    table.string('token');
    table.enum('status', REGISTRATION_STATUS).notNullable().defaultTo('NOT_REGISTERED');
  });
}

async function createCommandTable(knex: Knex): Promise<void> {
  await knex.schema.createTable(COMMANDS_TABLE, table => {
    createDefaultEntityFields(table);
    table.enum('type', OIBUS_COMMAND_TYPES).notNullable();
    table.enum('status', OIBUS_COMMAND_STATUS).notNullable();
    table.string('retrieved_date');
    table.string('completed_date');
    table.string('result');
    table.string('version');
  });
}

async function updateNorthOIAnalyticsConnectors(knex: Knex): Promise<void> {
  const oldNorthSettings: Array<{ id: string; settings: OldNorthOIAnalyticsSettings }> = await knex(NORTH_CONNECTORS_TABLE)
    .select('id', 'settings')
    .where('type', 'oianalytics');

  for (const { id, settings } of oldNorthSettings) {
    const newSettings: NewNorthOIAnalyticsSettings = {
      useOiaModule: false,
      timeout: settings.timeout,
      specificSettings: {
        host: settings.host,
        acceptUnauthorized: settings.acceptUnauthorized,
        authentication: settings.authentication,
        accessKey: settings.accessKey || undefined,
        secretKey: settings.secretKey || undefined,
        tenantId: settings.tenantId || undefined,
        clientId: settings.clientId || undefined,
        clientSecret: settings.clientSecret || undefined,
        certificateId: settings.certificateId || undefined,
        scope: settings.scope || undefined,
        useProxy: settings.useProxy || false,
        proxyUrl: settings.proxyUrl,
        proxyUsername: settings.proxyUsername,
        proxyPassword: settings.proxyPassword
      }
    };
    await knex(NORTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
      .where('id', id);
  }
}

async function updateSouthOIAnalyticsConnectors(knex: Knex): Promise<void> {
  const oldSouthSettings: Array<{ id: string; settings: OldSouthOIAnalyticsSettings }> = await knex(SOUTH_CONNECTORS_TABLE)
    .select('id', 'settings')
    .where('type', 'oianalytics');

  for (const { id, settings } of oldSouthSettings) {
    const newSettings: NewSouthOIAnalyticsSettings = {
      useOiaModule: false,
      timeout: settings.timeout,
      specificSettings: {
        host: settings.host,
        acceptUnauthorized: settings.acceptUnauthorized,
        authentication: 'basic',
        accessKey: settings.accessKey || undefined,
        secretKey: settings.secretKey || undefined,
        tenantId: undefined,
        clientId: undefined,
        clientSecret: undefined,
        certificateId: undefined,
        scope: undefined,
        useProxy: settings.useProxy || false,
        proxyUrl: settings.proxyUrl,
        proxyUsername: settings.proxyUsername,
        proxyPassword: settings.proxyPassword
      }
    };
    await knex(SOUTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
      .where('id', id);
  }
}

async function updateOIAnalyticsHistoryQueries(knex: Knex): Promise<void> {
  const oldNorthSettings: Array<{ id: string; settings: OldNorthOIAnalyticsSettings }> = await knex(HISTORY_QUERIES_TABLE)
    .select('id', 'north_settings as settings')
    .where('north_type', 'oianalytics');

  const oldSouthSettings: Array<{ id: string; settings: OldSouthOIAnalyticsSettings }> = await knex(HISTORY_QUERIES_TABLE)
    .select('id', 'south_settings as settings')
    .where('south_type', 'oianalytics');

  for (const { id, settings } of oldNorthSettings) {
    const newSettings: NewNorthOIAnalyticsSettings = {
      useOiaModule: false,
      timeout: settings.timeout,
      specificSettings: {
        host: settings.host,
        acceptUnauthorized: settings.acceptUnauthorized,
        authentication: settings.authentication,
        accessKey: settings.accessKey || undefined,
        secretKey: settings.secretKey || undefined,
        tenantId: settings.tenantId || undefined,
        clientId: settings.clientId || undefined,
        clientSecret: settings.clientSecret || undefined,
        certificateId: settings.certificateId || undefined,
        scope: settings.scope || undefined,
        useProxy: settings.useProxy || false,
        proxyUrl: settings.proxyUrl,
        proxyUsername: settings.proxyUsername,
        proxyPassword: settings.proxyPassword
      }
    };
    await knex(HISTORY_QUERIES_TABLE)
      .update({ north_settings: JSON.stringify(newSettings) })
      .where('id', id);
  }

  for (const { id, settings } of oldSouthSettings) {
    const newSettings: NewSouthOIAnalyticsSettings = {
      useOiaModule: false,
      timeout: settings.timeout,
      specificSettings: {
        host: settings.host,
        acceptUnauthorized: settings.acceptUnauthorized,
        authentication: 'basic',
        accessKey: settings.accessKey || undefined,
        secretKey: settings.secretKey || undefined,
        tenantId: undefined,
        clientId: undefined,
        clientSecret: undefined,
        certificateId: undefined,
        scope: undefined,
        useProxy: settings.useProxy || false,
        proxyUrl: settings.proxyUrl,
        proxyUsername: settings.proxyUsername,
        proxyPassword: settings.proxyPassword
      }
    };
    await knex(HISTORY_QUERIES_TABLE)
      .update({ south_settings: JSON.stringify(newSettings) })
      .where('id', id);
  }
}

async function updateEngineLogSettings(knex: Knex): Promise<void> {
  await knex.schema.table(ENGINES_TABLE, table => {
    table.enum('log_oia_level', LOG_LEVELS).notNullable().defaultTo('silent');
    // TODO: simplify pino-loki
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable(REGISTRATIONS_TABLE);
  await knex.schema.dropTable(COMMANDS_TABLE);
}
