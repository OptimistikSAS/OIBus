const NORTH_AZURE_BLOB_SETTINGS_AUTHENTICATIONS = ['sasToken', 'accessKey', 'aad'] as const
export type NorthAzureBlobSettingsAuthentication = (typeof NORTH_AZURE_BLOB_SETTINGS_AUTHENTICATIONS)[number];

const NORTH_CSV_TO_HTTP_SETTINGS_REQUEST_METHODS = ['GET', 'POST', 'PUT', 'PATCH'] as const
export type NorthCsvToHttpSettingsRequestMethod = (typeof NORTH_CSV_TO_HTTP_SETTINGS_REQUEST_METHODS)[number];

const NORTH_CSV_TO_HTTP_SETTINGS_CSV_DELIMITERS = [',', ';'] as const
export type NorthCsvToHttpSettingsCsvDelimiter = (typeof NORTH_CSV_TO_HTTP_SETTINGS_CSV_DELIMITERS)[number];

const NORTH_INFLUX_D_B_SETTINGS_PRECISIONS = ['ns', 'u', 'ms', 's', 'm', 'h'] as const
export type NorthInfluxDBSettingsPrecision = (typeof NORTH_INFLUX_D_B_SETTINGS_PRECISIONS)[number];

const NORTH_MQTT_SETTINGS_QOSS = ['0', '1', '2'] as const
export type NorthMqttSettingsQos = (typeof NORTH_MQTT_SETTINGS_QOSS)[number];

const NORTH_O_I_CONNECT_SETTINGS_AUTHENTICATION_TYPES = ['none', 'basic', 'bearer', 'api-key'] as const
export type NorthOIConnectSettingsAuthenticationType = (typeof NORTH_O_I_CONNECT_SETTINGS_AUTHENTICATION_TYPES)[number];

export interface NorthOIConnectSettingsAuthentication {
  type: NorthOIConnectSettingsAuthenticationType;
  username: string;
  password: string;
  token: string;
  apiKeyHeader: string;
  apiKey: string;
}

interface BaseNorthSettings {}

export interface NorthAmazonS3Settings extends BaseNorthSettings {
  bucket: string;
  region: string;
  folder: string;
  accessKey: string;
  secretKey: string;
  proxyId: string;
}

export interface NorthAzureBlobSettings extends BaseNorthSettings {
  account: string;
  container: string;
  authentication: NorthAzureBlobSettingsAuthentication;
  sasToken: string;
  accessKey: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface NorthConsoleSettings extends BaseNorthSettings {
  verbose: boolean;
}

export interface NorthCsvToHttpSettings extends BaseNorthSettings {
  applicativeHostUrl: string;
  requestMethod: NorthCsvToHttpSettingsRequestMethod;
  bodyMaxLength: number;
  acceptUnconvertedRows: boolean;
  csvDelimiter: NorthCsvToHttpSettingsCsvDelimiter;
  proxyId: string;
}

export interface NorthFileWriterSettings extends BaseNorthSettings {
  outputFolder: string;
  prefix: string;
  suffix: string;
}

export interface NorthInfluxDBSettings extends BaseNorthSettings {
  host: string;
  database: string;
  username: string;
  password: string;
  timestampPathInDataValue: string;
  precision: NorthInfluxDBSettingsPrecision;
  regExp: string;
  measurement: string;
  tags: string;
  useDataKeyValue: boolean;
  keyParentValue: string;
}

export interface NorthMongoDBSettings extends BaseNorthSettings {
  host: string;
  database: string;
  username: string;
  password: string;
  regExp: string;
  collection: string;
  indexFields: string;
  createCollection: boolean;
  timestampKey: string;
  useDataKeyValue: boolean;
  keyParentValue: string;
  timestampPathInDataValue: string;
}

export interface NorthMqttSettings extends BaseNorthSettings {
  url: string;
  qos: NorthMqttSettingsQos;
  username: string;
  password: string;
  certFile: string;
  keyFile: string;
  caFile: string;
  rejectUnauthorized: boolean;
  regExp: string;
  topic: string;
  useDataKeyValue: boolean;
  keyParentValue: string;
}

export interface NorthOIAnalyticsSettings extends BaseNorthSettings {
  host: string;
  accessKey: string;
  secretKey: string;
  timeout: number;
  proxyId: string;
  acceptUnauthorized: boolean;
}

export interface NorthOIConnectSettings extends BaseNorthSettings {
  host: string;
  acceptUnauthorized: boolean;
  valuesEndpoint: string;
  fileEndpoint: string;
  timeout: number;
  proxyId: string;
  authentication: NorthOIConnectSettingsAuthentication;
}

export interface NorthTimescaleDBSettings extends BaseNorthSettings {
  username: string;
  password: string;
  host: string;
  database: string;
  regExp: string;
  table: string;
  optFields: string;
  timestampPathInDataValue: string;
  useDataKeyValue: boolean;
  keyParentValue: string;
}

export interface NorthWatsySettings extends BaseNorthSettings {
  MQTTUrl: string;
  port: number;
  username: string;
  password: string;
  applicativeHostUrl: string;
  secretKey: string;
}

export type NorthSettings =
  | NorthAmazonS3Settings
  | NorthAzureBlobSettings
  | NorthConsoleSettings
  | NorthCsvToHttpSettings
  | NorthFileWriterSettings
  | NorthInfluxDBSettings
  | NorthMongoDBSettings
  | NorthMqttSettings
  | NorthOIAnalyticsSettings
  | NorthOIConnectSettings
  | NorthTimescaleDBSettings
  | NorthWatsySettings

