import { Knex } from 'knex';
import {
  SouthOPCUASettingsConnectionSettingsAuthentication,
  SouthOPCUASettingsConnectionSettingsSecurityMode,
  SouthOPCUASettingsConnectionSettingsSecurityPolicy,
  SouthOPCUASettingsThrottling
} from '../../../shared/model/south-settings.model';
import { SharedConnection } from '../../../shared/model/engine.model';

const HISTORY_QUERIES_TABLE = 'history_queries';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';

interface OldSouthOPCUASettings {
  throttling: SouthOPCUASettingsThrottling;
  sharedConnection: boolean;
  url: string;
  keepSessionAlive: boolean;
  readTimeout: number;
  retryInterval: number;
  securityMode: SouthOPCUASettingsConnectionSettingsSecurityMode;
  securityPolicy?: SouthOPCUASettingsConnectionSettingsSecurityPolicy;
  authentication: SouthOPCUASettingsConnectionSettingsAuthentication;
}

interface NewSouthOPCUASettings {
  throttling: SouthOPCUASettingsThrottling;
  sharedConnection: SharedConnection | null;
  readTimeout: number;
  maxNumberOfMessages: number;
  flushMessageTimeout: number;
  connectionSettings: {
    url: string;
    keepSessionAlive: boolean;
    retryInterval: number;
    securityMode: SouthOPCUASettingsConnectionSettingsSecurityMode;
    securityPolicy?: SouthOPCUASettingsConnectionSettingsSecurityPolicy;
    authentication: SouthOPCUASettingsConnectionSettingsAuthentication;
  };
}

export async function up(knex: Knex): Promise<void> {
  await updateOPCUAConnectors(knex);
}

async function updateOPCUAConnectors(knex: Knex) {
  const oldSouth: Array<{
    id: string;
    type: string;
    settings: string;
  }> = await knex(SOUTH_CONNECTORS_TABLE).select('id', 'type', 'settings').where('type', 'opcua');

  for (const connector of oldSouth) {
    const oldSettings: OldSouthOPCUASettings = JSON.parse(connector.settings);
    const newSettings: NewSouthOPCUASettings = {
      flushMessageTimeout: 1_000,
      maxNumberOfMessages: 1_000,
      throttling: oldSettings.throttling,
      sharedConnection: null,
      readTimeout: oldSettings.readTimeout,
      connectionSettings: {
        url: oldSettings.url,
        keepSessionAlive: oldSettings.keepSessionAlive,
        retryInterval: oldSettings.retryInterval,
        securityMode: oldSettings.securityMode,
        securityPolicy: oldSettings.securityPolicy,
        authentication: oldSettings.authentication
      }
    };
    await knex(SOUTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
      .where('id', connector.id);
  }

  const oldSouthHistorySettings: Array<{
    id: string;
    south_type: string;
    south_settings: string;
  }> = await knex(HISTORY_QUERIES_TABLE).select('id', 'south_type', 'south_settings').where('south_type', 'opcua');

  for (const history of oldSouthHistorySettings) {
    const oldSettings: OldSouthOPCUASettings = JSON.parse(history.south_settings);
    const newSettings: NewSouthOPCUASettings = {
      flushMessageTimeout: 1_000,
      maxNumberOfMessages: 1_000,
      throttling: oldSettings.throttling,
      sharedConnection: null,
      readTimeout: oldSettings.readTimeout,
      connectionSettings: {
        url: oldSettings.url,
        keepSessionAlive: oldSettings.keepSessionAlive,
        retryInterval: oldSettings.retryInterval,
        securityMode: oldSettings.securityMode,
        securityPolicy: oldSettings.securityPolicy,
        authentication: oldSettings.authentication
      }
    };
    await knex(HISTORY_QUERIES_TABLE)
      .update({ south_settings: JSON.stringify(newSettings) })
      .where('id', history.id);
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
