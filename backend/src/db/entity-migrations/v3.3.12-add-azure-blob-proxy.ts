import { Knex } from 'knex';
import { NorthAzureBlobSettingsAuthentication } from '../../../../shared/model/north-settings.model';

const NORTH_CONNECTORS_TABLE = 'north_connectors';

interface OldNorthAzureBlobSettings {
  account: string;
  container: string;
  path: string | null;
  authentication: NorthAzureBlobSettingsAuthentication;
  sasToken?: string | null;
  accessKey?: string | null;
  tenantId?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
}

interface NewNorthAzureBlobSettings {
  useCustomUrl: boolean;
  account?: string;
  customUrl?: string;
  container: string;
  path: string | null;
  authentication: NorthAzureBlobSettingsAuthentication;
  sasToken?: string | null;
  accessKey?: string | null;
  tenantId?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  useProxy: boolean;
  proxyUrl?: string;
  proxyUsername?: string | null;
  proxyPassword?: string | null;
}

export async function up(knex: Knex): Promise<void> {
  await updateNorthAzureBlob(knex);
}

async function updateNorthAzureBlob(knex: Knex) {
  const azureBlobConnectors: Array<{ id: string; settings: string }> = await knex(NORTH_CONNECTORS_TABLE)
    .select('id', 'settings')
    .where('type', 'azure-blob');

  for (const connector of azureBlobConnectors) {
    const oldSettings: OldNorthAzureBlobSettings = JSON.parse(connector.settings);
    const newSettings: NewNorthAzureBlobSettings = {
      ...oldSettings,
      useProxy: false,
      useCustomUrl: false,
      customUrl: ''
    };
    await knex(NORTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
      .where('id', connector.id);
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
