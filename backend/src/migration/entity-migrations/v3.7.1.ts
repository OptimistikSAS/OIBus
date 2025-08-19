import { Knex } from 'knex';
import { Timezone } from '../../../shared/model/types';

const HISTORY_QUERIES_TABLE = 'history_queries';
const SOUTH_CONNECTORS_TABLE = 'south_connectors';
const SOUTH_ITEMS_TABLE = 'south_items';
const NORTH_CONNECTORS_TABLE = 'north_connectors';

interface OldSouthOPCUASettings {
  throttling: {
    maxReadInterval: number;
    readDelay: number;
    overlap: number;
    maxInstantPerItem: boolean;
  };
  sharedConnection: boolean;
  url: string;
  keepSessionAlive: boolean;
  readTimeout: number;
  retryInterval: number;
  securityMode: 'none' | 'sign' | 'sign-and-encrypt';
  securityPolicy?:
    | 'none'
    | 'basic128'
    | 'basic192'
    | 'basic192-rsa15'
    | 'basic256-rsa15'
    | 'basic256-sha256'
    | 'aes128-sha256-rsa-oaep'
    | 'pub-sub-aes-128-ctr'
    | 'pub-sub-aes-256-ctr';
  authentication: {
    type: 'none' | 'basic' | 'cert';
    username?: string;
    password?: string | null;
    certFilePath?: string;
    keyFilePath?: string;
  };
}

interface NewSouthOPCUASettings {
  throttling: {
    maxReadInterval: number;
    readDelay: number;
    overlap: number;
    maxInstantPerItem: boolean;
  };
  sharedConnection: {
    connectorType: 'north' | 'south';
    connectorId: string;
  } | null;
  readTimeout: number;
  maxNumberOfMessages: number;
  flushMessageTimeout: number;
  retryInterval: number;
  connectionSettings: {
    url: string;
    keepSessionAlive: boolean;
    securityMode: 'none' | 'sign' | 'sign-and-encrypt';
    securityPolicy?:
      | 'none'
      | 'basic128'
      | 'basic192'
      | 'basic192-rsa15'
      | 'basic256-rsa15'
      | 'basic256-sha256'
      | 'aes128-sha256-rsa-oaep'
      | 'pub-sub-aes-128-ctr'
      | 'pub-sub-aes-256-ctr';
    authentication: {
      type: 'none' | 'basic' | 'cert';
      username?: string;
      password?: string | null;
      certFilePath?: string;
      keyFilePath?: string;
    };
  };
}

interface OldNorthOPCUASettings {
  url: string;
  keepSessionAlive: boolean;
  retryInterval: number;
  securityMode: 'none' | 'sign' | 'sign-and-encrypt';
  securityPolicy?:
    | 'none'
    | 'basic128'
    | 'basic192'
    | 'basic192-rsa15'
    | 'basic256-rsa15'
    | 'basic256-sha256'
    | 'aes128-sha256-rsa-oaep'
    | 'pub-sub-aes-128-ctr'
    | 'pub-sub-aes-256-ctr';
  authentication: {
    type: 'none' | 'basic' | 'cert';
    username?: string;
    password?: string | null;
    certFilePath?: string;
    keyFilePath?: string;
  };
}

interface NewNorthOPCUASettings {
  sharedConnection: {
    connectorType: 'north' | 'south';
    connectorId: string;
  } | null;
  retryInterval: number;
  connectionSettings: {
    url: string;
    keepSessionAlive: boolean;
    securityMode: 'none' | 'sign' | 'sign-and-encrypt';
    securityPolicy?:
      | 'none'
      | 'basic128'
      | 'basic192'
      | 'basic192-rsa15'
      | 'basic256-rsa15'
      | 'basic256-sha256'
      | 'aes128-sha256-rsa-oaep'
      | 'pub-sub-aes-128-ctr'
      | 'pub-sub-aes-256-ctr';
    authentication: {
      type: 'none' | 'basic' | 'cert';
      username?: string;
      password?: string | null;
      certFilePath?: string;
      keyFilePath?: string;
    };
  };
}

interface OldNorthMQTTSettings {
  url: string;
  qos: '0' | '1' | '2';
  persistent?: boolean;
  authentication: {
    type: 'none' | 'basic' | 'cert';
    username?: string;
    password?: string | null;
    certFilePath?: string;
    keyFilePath?: string | null;
    caFilePath?: string | null;
  };
  rejectUnauthorized: boolean;
  reconnectPeriod: number;
  connectTimeout: number;
}

interface NewNorthMQTTSettings {
  sharedConnection: {
    connectorType: 'north' | 'south';
    connectorId: string;
  } | null;
  retryInterval: number;
  connectionSettings?: {
    url: string;
    persistent?: boolean;
    authentication: {
      type: 'none' | 'basic' | 'cert';
      username?: string;
      password?: string | null;
      certFilePath?: string;
      keyFilePath?: string | null;
      caFilePath?: string | null;
    };
    rejectUnauthorized: boolean;
    connectTimeout: number;
  };
}

interface OldSouthMQTTSettings {
  url: string;
  qos: '0' | '1' | '2';
  persistent?: boolean;
  authentication: {
    type: 'none' | 'basic' | 'cert';
    username?: string;
    password?: string | null;
    certFilePath?: string;
    keyFilePath?: string | null;
    caFilePath?: string | null;
  };
  rejectUnauthorized: boolean;
  reconnectPeriod: number;
  connectTimeout: number;
  maxNumberOfMessages: number;
  flushMessageTimeout: number;
}

interface NewSouthMQTTSettings {
  readTimeout: number;
  maxNumberOfMessages: number;
  flushMessageTimeout: number;
  sharedConnection: {
    connectorType: 'north' | 'south';
    connectorId: string;
  } | null;
  retryInterval: number;
  connectionSettings?: {
    url: string;
    persistent?: boolean;
    authentication: {
      type: 'none' | 'basic' | 'cert';
      username?: string;
      password?: string | null;
      certFilePath?: string;
      keyFilePath?: string | null;
      caFilePath?: string | null;
    };
    rejectUnauthorized: boolean;
    connectTimeout: number;
  };
}

interface OldSouthMQTTItemSettings {
  topic: string;
  valueType: 'number' | 'string' | 'json';
  jsonPayload?: {
    useArray: boolean;
    dataArrayPath?: string | null;
    valuePath: string;
    pointIdOrigin: 'oibus' | 'payload';
    pointIdPath?: string | null;
    timestampOrigin: 'oibus' | 'payload';
    timestampPayload?: {
      timestampPath: string;
      timestampType: 'string' | 'iso-string' | 'unix-epoch' | 'unix-epoch-ms';
      timestampFormat?: string;
      timezone?: Timezone;
    } | null;
    otherFields: Array<{ name: string; path: string }> | null;
  } | null;
}

interface NewSouthMQTTItemSettings {
  topic: string;
  qos: '0' | '1' | '2';
  valueType: 'number' | 'string' | 'json';
  jsonPayload?: {
    useArray: boolean;
    dataArrayPath?: string | null;
    valuePath: string;
    pointIdOrigin: 'oibus' | 'payload';
    pointIdPath?: string | null;
    timestampOrigin: 'oibus' | 'payload';
    timestampPayload?: {
      timestampPath: string;
      timestampType: 'string' | 'iso-string' | 'unix-epoch' | 'unix-epoch-ms';
      timestampFormat?: string;
      timezone?: Timezone;
    } | null;
    otherFields: Array<{ name: string; path: string }> | null;
  } | null;
}

export async function up(knex: Knex): Promise<void> {
  await updateOPCUAConnectors(knex);
  await updateMQTTConnectors(knex);
}

async function updateMQTTConnectors(knex: Knex) {
  const oldSouth: Array<{
    id: string;
    type: string;
    settings: string;
  }> = await knex(SOUTH_CONNECTORS_TABLE).select('id', 'type', 'settings').where('type', 'mqtt');
  for (const connector of oldSouth) {
    const oldSettings: OldSouthMQTTSettings = JSON.parse(connector.settings);
    const newSettings: NewSouthMQTTSettings = {
      readTimeout: 10_000,
      maxNumberOfMessages: oldSettings.maxNumberOfMessages,
      flushMessageTimeout: oldSettings.flushMessageTimeout,
      sharedConnection: null,
      retryInterval: oldSettings.reconnectPeriod,
      connectionSettings: {
        url: oldSettings.url,
        persistent: oldSettings.persistent || false,
        authentication: oldSettings.authentication,
        rejectUnauthorized: oldSettings.rejectUnauthorized,
        connectTimeout: oldSettings.connectTimeout
      }
    };
    await knex(SOUTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
      .where('id', connector.id);

    const items: Array<{
      id: string;
      settings: string;
    }> = await knex(SOUTH_ITEMS_TABLE).select('id', 'settings').where('connector_id', connector.id);
    for (const item of items) {
      const oldItemSettings: OldSouthMQTTItemSettings = JSON.parse(item.settings);

      const newItemSettings: NewSouthMQTTItemSettings = {
        ...oldItemSettings,
        qos: oldSettings.qos
      };
      await knex(SOUTH_ITEMS_TABLE)
        .update({ settings: JSON.stringify(newItemSettings) })
        .where('id', item.id);
    }
  }

  const oldNorth: Array<{
    id: string;
    type: string;
    settings: string;
  }> = await knex(NORTH_CONNECTORS_TABLE).select('id', 'type', 'settings').where('type', 'mqtt');
  for (const connector of oldNorth) {
    const oldSettings: OldNorthMQTTSettings = JSON.parse(connector.settings);
    const newSettings: NewNorthMQTTSettings = {
      sharedConnection: null,
      retryInterval: oldSettings.reconnectPeriod,
      connectionSettings: {
        url: oldSettings.url,
        persistent: oldSettings.persistent || false,
        authentication: oldSettings.authentication,
        rejectUnauthorized: oldSettings.rejectUnauthorized,
        connectTimeout: oldSettings.connectTimeout
      }
    };
    await knex(NORTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
      .where('id', connector.id);
  }
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
      retryInterval: oldSettings.retryInterval,
      connectionSettings: {
        url: oldSettings.url,
        keepSessionAlive: oldSettings.keepSessionAlive,
        securityMode: oldSettings.securityMode,
        securityPolicy: oldSettings.securityPolicy,
        authentication: oldSettings.authentication
      }
    };
    await knex(SOUTH_CONNECTORS_TABLE)
      .update({ settings: JSON.stringify(newSettings) })
      .where('id', connector.id);
  }

  const oldNorth: Array<{
    id: string;
    type: string;
    settings: string;
  }> = await knex(NORTH_CONNECTORS_TABLE).select('id', 'type', 'settings').where('type', 'opcua');
  for (const connector of oldNorth) {
    const oldSettings: OldNorthOPCUASettings = JSON.parse(connector.settings);
    const newSettings: NewNorthOPCUASettings = {
      sharedConnection: null,
      retryInterval: oldSettings.retryInterval,
      connectionSettings: {
        url: oldSettings.url,
        keepSessionAlive: oldSettings.keepSessionAlive,
        securityMode: oldSettings.securityMode,
        securityPolicy: oldSettings.securityPolicy,
        authentication: oldSettings.authentication
      }
    };
    await knex(NORTH_CONNECTORS_TABLE)
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
      retryInterval: oldSettings.retryInterval,
      connectionSettings: {
        url: oldSettings.url,
        keepSessionAlive: oldSettings.keepSessionAlive,
        securityMode: oldSettings.securityMode,
        securityPolicy: oldSettings.securityPolicy,
        authentication: oldSettings.authentication
      }
    };
    await knex(HISTORY_QUERIES_TABLE)
      .update({ south_settings: JSON.stringify(newSettings) })
      .where('id', history.id);
  }

  const oldNorthHistorySettings: Array<{
    id: string;
    north_type: string;
    north_settings: string;
  }> = await knex(HISTORY_QUERIES_TABLE).select('id', 'north_type', 'north_settings').where('north_type', 'opcua');
  for (const history of oldNorthHistorySettings) {
    const oldSettings: OldNorthOPCUASettings = JSON.parse(history.north_settings);
    const newSettings: NewNorthOPCUASettings = {
      sharedConnection: null,
      retryInterval: oldSettings.retryInterval,
      connectionSettings: {
        url: oldSettings.url,
        keepSessionAlive: oldSettings.keepSessionAlive,
        securityMode: oldSettings.securityMode,
        securityPolicy: oldSettings.securityPolicy,
        authentication: oldSettings.authentication
      }
    };
    await knex(HISTORY_QUERIES_TABLE)
      .update({ north_settings: JSON.stringify(newSettings) })
      .where('id', history.id);
  }
}

export async function down(_knex: Knex): Promise<void> {
  return;
}
