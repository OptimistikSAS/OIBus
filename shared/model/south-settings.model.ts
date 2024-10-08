// DO NOT EDIT THIS BY HAND!
// This file is auto-generated by the script located backend/src/settings-interface.generator.ts
// To update the typescript model run npm run generate-settings-interface on the backend project

import { Timezone } from './types';

export type SouthADSSettingsEnumAsText = 'Text' | 'Integer';

export type SouthADSSettingsBoolAsText = 'Text' | 'Integer';

export type SouthModbusSettingsAddressOffset = 'Modbus' | 'JBus';

export type SouthModbusSettingsEndianness = 'Big Endian' | 'Little Endian';

export type SouthModbusItemSettingsDataDataType =
  | 'UInt16'
  | 'Int16'
  | 'UInt32'
  | 'Int32'
  | 'BigUInt64'
  | 'BigInt64'
  | 'Float'
  | 'Double'
  | 'Bit';

export type SouthModbusItemSettingsModbusType = 'coil' | 'discreteInput' | 'inputRegister' | 'holdingRegister';

export type SouthMQTTSettingsAuthenticationType = 'none' | 'basic' | 'cert';

export type SouthMQTTSettingsQos = '0' | '1' | '2';

export type SouthMQTTItemSettingsJsonPayloadTimestampPayloadTimestampType = 'string' | 'iso-string' | 'unix-epoch' | 'unix-epoch-ms';

export type SouthMQTTItemSettingsJsonPayloadPointIdOrigin = 'oibus' | 'payload';

export type SouthMQTTItemSettingsJsonPayloadTimestampOrigin = 'oibus' | 'payload';

export type SouthMQTTItemSettingsValueType = 'number' | 'string' | 'json';

export type SouthMSSQLItemSettingsDateTimeFieldsType =
  | 'string'
  | 'Date'
  | 'DateTime'
  | 'DateTime2'
  | 'DateTimeOffset'
  | 'SmallDateTime'
  | 'iso-string'
  | 'unix-epoch'
  | 'unix-epoch-ms';

export type SouthMSSQLItemSettingsSerializationType = 'csv';

export type SouthMSSQLItemSettingsSerializationDelimiter =
  | 'DOT'
  | 'SEMI_COLON'
  | 'COLON'
  | 'COMMA'
  | 'NON_BREAKING_SPACE'
  | 'SLASH'
  | 'TAB'
  | 'PIPE';

export type SouthMySQLItemSettingsDateTimeFieldsType = 'string' | 'iso-string' | 'unix-epoch' | 'unix-epoch-ms';

export type SouthMySQLItemSettingsSerializationType = 'csv';

export type SouthMySQLItemSettingsSerializationDelimiter =
  | 'DOT'
  | 'SEMI_COLON'
  | 'COLON'
  | 'COMMA'
  | 'NON_BREAKING_SPACE'
  | 'SLASH'
  | 'TAB'
  | 'PIPE';

export type SouthODBCItemSettingsDateTimeFieldsType = 'string' | 'iso-string' | 'unix-epoch' | 'unix-epoch-ms';

export type SouthODBCItemSettingsSerializationType = 'csv';

export type SouthODBCItemSettingsSerializationDelimiter =
  | 'DOT'
  | 'SEMI_COLON'
  | 'COLON'
  | 'COMMA'
  | 'NON_BREAKING_SPACE'
  | 'SLASH'
  | 'TAB'
  | 'PIPE';

export type SouthOIAnalyticsSettingsSpecificSettingsAuthentication = 'basic' | 'aad-client-secret' | 'aad-certificate';

export type SouthOIAnalyticsItemSettingsSerializationType = 'csv';

export type SouthOIAnalyticsItemSettingsSerializationDelimiter =
  | 'DOT'
  | 'SEMI_COLON'
  | 'COLON'
  | 'COMMA'
  | 'NON_BREAKING_SPACE'
  | 'SLASH'
  | 'TAB'
  | 'PIPE';

export type SouthOLEDBItemSettingsDateTimeFieldsType = 'string' | 'iso-string' | 'unix-epoch' | 'unix-epoch-ms';

export type SouthOLEDBItemSettingsSerializationType = 'csv';

export type SouthOLEDBItemSettingsSerializationDelimiter =
  | 'DOT'
  | 'SEMI_COLON'
  | 'COLON'
  | 'COMMA'
  | 'NON_BREAKING_SPACE'
  | 'SLASH'
  | 'TAB'
  | 'PIPE';

export type SouthOPCHDAItemSettingsAggregate =
  | 'raw'
  | 'interpolative'
  | 'total'
  | 'average'
  | 'time-average'
  | 'count'
  | 'stdev'
  | 'minimum-actual-time'
  | 'minimum'
  | 'maximum-actual-time'
  | 'maximum'
  | 'start'
  | 'end'
  | 'delta'
  | 'reg-slope'
  | 'reg-const'
  | 'reg-dev'
  | 'variance'
  | 'range'
  | 'duration-good'
  | 'duration-bad'
  | 'percent-good'
  | 'percent-bad'
  | 'worst-quality'
  | 'annotations';

export type SouthOPCHDAItemSettingsResampling = 'none' | '1s' | '10s' | '30s' | '1min' | '1h' | '1d';

export type SouthOPCUASettingsAuthenticationType = 'none' | 'basic' | 'cert';

export type SouthOPCUASettingsSecurityMode = 'None' | 'Sign' | 'SignAndEncrypt';

export type SouthOPCUASettingsSecurityPolicy =
  | 'None'
  | 'Basic128'
  | 'Basic192'
  | 'Basic256'
  | 'Basic128Rsa15'
  | 'Basic192Rsa15'
  | 'Basic256Rsa15'
  | 'Basic256Sha256'
  | 'Aes128_Sha256_RsaOaep'
  | 'PubSub_Aes128_CTR'
  | 'PubSub_Aes256_CTR';

export type SouthOPCUAItemSettingsHaModeAggregate = 'raw' | 'average' | 'minimum' | 'maximum' | 'count';

export type SouthOPCUAItemSettingsHaModeResampling = 'none' | '1s' | '10s' | '30s' | '1min' | '1h' | '1d';

export type SouthOPCUAItemSettingsMode = 'HA' | 'DA';

export type SouthOracleItemSettingsDateTimeFieldsType = 'string' | 'iso-string' | 'unix-epoch' | 'unix-epoch-ms';

export type SouthOracleItemSettingsSerializationType = 'csv';

export type SouthOracleItemSettingsSerializationDelimiter =
  | 'DOT'
  | 'SEMI_COLON'
  | 'COLON'
  | 'COMMA'
  | 'NON_BREAKING_SPACE'
  | 'SLASH'
  | 'TAB'
  | 'PIPE';

export type SouthPIItemSettingsType = 'pointId' | 'pointQuery';

export type SouthPostgreSQLItemSettingsDateTimeFieldsType =
  | 'string'
  | 'iso-string'
  | 'unix-epoch'
  | 'unix-epoch-ms'
  | 'timestamp'
  | 'timestamptz';

export type SouthPostgreSQLItemSettingsSerializationType = 'csv';

export type SouthPostgreSQLItemSettingsSerializationDelimiter =
  | 'DOT'
  | 'SEMI_COLON'
  | 'COLON'
  | 'COMMA'
  | 'NON_BREAKING_SPACE'
  | 'SLASH'
  | 'TAB'
  | 'PIPE';

export type SouthSFTPSettingsAuthentication = 'password' | 'private-key';

export type SouthSlimsItemSettingsDateTimeFieldsType = 'string' | 'iso-string' | 'unix-epoch' | 'unix-epoch-ms';

export type SouthSlimsItemSettingsSerializationType = 'csv';

export type SouthSlimsItemSettingsSerializationDelimiter =
  | 'DOT'
  | 'SEMI_COLON'
  | 'COLON'
  | 'COMMA'
  | 'NON_BREAKING_SPACE'
  | 'SLASH'
  | 'TAB'
  | 'PIPE';

export type SouthSQLiteItemSettingsDateTimeFieldsType = 'string' | 'iso-string' | 'unix-epoch' | 'unix-epoch-ms';

export type SouthSQLiteItemSettingsSerializationType = 'csv';

export type SouthSQLiteItemSettingsSerializationDelimiter =
  | 'DOT'
  | 'SEMI_COLON'
  | 'COLON'
  | 'COMMA'
  | 'NON_BREAKING_SPACE'
  | 'SLASH'
  | 'TAB'
  | 'PIPE';

export interface SouthADSSettingsStructureFiltering {
  name: string;
  fields: string;
}

export interface SouthMQTTSettingsAuthentication {
  type: SouthMQTTSettingsAuthenticationType;
  username?: string;
  password?: string | null;
  certFilePath?: string;
  keyFilePath?: string | null;
  caFilePath?: string | null;
}

export interface SouthOIAnalyticsSettingsSpecificSettings {
  host: string;
  acceptUnauthorized: boolean;
  authentication: SouthOIAnalyticsSettingsSpecificSettingsAuthentication;
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

export interface SouthOPCUASettingsAuthentication {
  type: SouthOPCUASettingsAuthenticationType;
  username?: string;
  password?: string | null;
  certFilePath?: string;
  keyFilePath?: string | null;
}

export interface SouthADSSettings {
  netId: string;
  port: number;
  routerAddress: string | null;
  routerTcpPort: number | null;
  clientAmsNetId: string | null;
  clientAdsPort: number | null;
  retryInterval: number;
  plcName: string | null;
  enumAsText: SouthADSSettingsEnumAsText;
  boolAsText: SouthADSSettingsBoolAsText;
  structureFiltering: Array<SouthADSSettingsStructureFiltering> | null;
}

export interface SouthFolderScannerSettings {
  inputFolder: string;
  compression: boolean;
}

export interface SouthModbusSettings {
  host: string;
  port: number;
  retryInterval: number;
  slaveId: number;
  addressOffset: SouthModbusSettingsAddressOffset;
  endianness: SouthModbusSettingsEndianness;
  swapBytesInWords: boolean;
  swapWordsInDWords: boolean;
}

export interface SouthMQTTSettings {
  url: string;
  qos: SouthMQTTSettingsQos;
  persistent?: boolean;
  authentication: SouthMQTTSettingsAuthentication;
  rejectUnauthorized: boolean;
  reconnectPeriod: number;
  connectTimeout: number;
}

export interface SouthMSSQLSettings {
  host: string;
  port: number;
  connectionTimeout: number;
  database: string;
  username: string | null;
  password: string | null;
  domain: string | null;
  encryption: boolean;
  trustServerCertificate: boolean;
  requestTimeout: number;
}

export interface SouthMySQLSettings {
  host: string;
  port: number;
  connectionTimeout: number;
  database: string;
  username: string | null;
  password: string | null;
}

export interface SouthODBCSettings {
  remoteAgent: boolean;
  agentUrl?: string;
  connectionTimeout: number;
  retryInterval: number;
  connectionString: string;
  password: string | null;
  requestTimeout?: number;
}

export interface SouthOIAnalyticsSettings {
  useOiaModule: boolean;
  timeout: number;
  specificSettings?: SouthOIAnalyticsSettingsSpecificSettings | null;
}

export interface SouthOLEDBSettings {
  agentUrl: string;
  connectionTimeout: number;
  retryInterval: number;
  connectionString: string;
  requestTimeout: number;
}

export interface SouthOPCHDASettings {
  agentUrl: string;
  retryInterval: number;
  host: string;
  serverName: string;
}

export interface SouthOPCUASettings {
  url: string;
  keepSessionAlive: boolean;
  readTimeout: number;
  retryInterval: number;
  securityMode: SouthOPCUASettingsSecurityMode;
  securityPolicy?: SouthOPCUASettingsSecurityPolicy | null;
  authentication: SouthOPCUASettingsAuthentication;
}

export interface SouthOracleSettings {
  thickMode: boolean;
  oracleClient?: string;
  host: string;
  port: number;
  connectionTimeout: number;
  database: string;
  username: string | null;
  password: string | null;
}

export interface SouthPISettings {
  agentUrl: string;
  retryInterval: number;
}

export interface SouthPostgreSQLSettings {
  host: string;
  port: number;
  connectionTimeout: number;
  database: string;
  username: string | null;
  password: string | null;
  requestTimeout: number;
}

export interface SouthSFTPSettings {
  host: string;
  port: number;
  authentication: SouthSFTPSettingsAuthentication;
  username: string | null;
  password?: string | null;
  privateKey?: string;
  passphrase?: string | null;
  compression: boolean;
}

export interface SouthSlimsSettings {
  url: string;
  port: number;
  acceptUnauthorized: boolean;
  timeout: number;
  username: string;
  password: string | null;
  useProxy: boolean;
  proxyUrl?: string;
  proxyUsername?: string | null;
  proxyPassword?: string | null;
}

export interface SouthSQLiteSettings {
  databasePath: string;
}

export type SouthSettings =
  | SouthADSSettings
  | SouthFolderScannerSettings
  | SouthModbusSettings
  | SouthMQTTSettings
  | SouthMSSQLSettings
  | SouthMySQLSettings
  | SouthODBCSettings
  | SouthOIAnalyticsSettings
  | SouthOLEDBSettings
  | SouthOPCHDASettings
  | SouthOPCUASettings
  | SouthOracleSettings
  | SouthPISettings
  | SouthPostgreSQLSettings
  | SouthSFTPSettings
  | SouthSlimsSettings
  | SouthSQLiteSettings;

export interface SouthModbusItemSettingsData {
  dataType: SouthModbusItemSettingsDataDataType;
  bitIndex?: number;
  multiplierCoefficient: number;
}

export interface SouthMQTTItemSettingsJsonPayloadTimestampPayload {
  timestampPath: string;
  timestampType: SouthMQTTItemSettingsJsonPayloadTimestampPayloadTimestampType;
  timezone?: Timezone;
  timestampFormat?: string;
}

export interface SouthMQTTItemSettingsJsonPayloadOtherFields {
  name: string;
  path: string;
}

export interface SouthMQTTItemSettingsJsonPayload {
  useArray: boolean;
  dataArrayPath?: string | null;
  pointIdOrigin: SouthMQTTItemSettingsJsonPayloadPointIdOrigin;
  timestampOrigin: SouthMQTTItemSettingsJsonPayloadTimestampOrigin;
  valuePath: string;
  pointIdPath?: string | null;
  timestampPayload?: SouthMQTTItemSettingsJsonPayloadTimestampPayload | null;
  otherFields: Array<SouthMQTTItemSettingsJsonPayloadOtherFields> | null;
}

export interface SouthMSSQLItemSettingsDateTimeFields {
  fieldName: string;
  useAsReference: boolean;
  type: SouthMSSQLItemSettingsDateTimeFieldsType;
  timezone?: Timezone;
  format?: string;
  locale?: string;
}

export interface SouthMSSQLItemSettingsSerialization {
  type: SouthMSSQLItemSettingsSerializationType;
  filename: string;
  delimiter: SouthMSSQLItemSettingsSerializationDelimiter;
  compression: boolean;
  outputTimestampFormat: string;
  outputTimezone: Timezone;
}

export interface SouthMySQLItemSettingsDateTimeFields {
  fieldName: string;
  useAsReference: boolean;
  type: SouthMySQLItemSettingsDateTimeFieldsType;
  timezone?: Timezone;
  format?: string;
  locale?: string;
}

export interface SouthMySQLItemSettingsSerialization {
  type: SouthMySQLItemSettingsSerializationType;
  filename: string;
  delimiter: SouthMySQLItemSettingsSerializationDelimiter;
  compression: boolean;
  outputTimestampFormat: string;
  outputTimezone: Timezone;
}

export interface SouthODBCItemSettingsDateTimeFields {
  fieldName: string;
  useAsReference: boolean;
  type: SouthODBCItemSettingsDateTimeFieldsType;
  timezone?: Timezone;
  format?: string;
  locale?: string;
}

export interface SouthODBCItemSettingsSerialization {
  type: SouthODBCItemSettingsSerializationType;
  filename: string;
  delimiter: SouthODBCItemSettingsSerializationDelimiter;
  compression: boolean;
  outputTimestampFormat: string;
  outputTimezone: Timezone;
}

export interface SouthOIAnalyticsItemSettingsQueryParams {
  key: string;
  value: string;
}

export interface SouthOIAnalyticsItemSettingsSerialization {
  type: SouthOIAnalyticsItemSettingsSerializationType;
  filename: string;
  delimiter: SouthOIAnalyticsItemSettingsSerializationDelimiter;
  compression: boolean;
  outputTimestampFormat: string;
  outputTimezone: Timezone;
}

export interface SouthOLEDBItemSettingsDateTimeFields {
  fieldName: string;
  useAsReference: boolean;
  type: SouthOLEDBItemSettingsDateTimeFieldsType;
  timezone?: Timezone;
  format?: string;
  locale?: string;
}

export interface SouthOLEDBItemSettingsSerialization {
  type: SouthOLEDBItemSettingsSerializationType;
  filename: string;
  delimiter: SouthOLEDBItemSettingsSerializationDelimiter;
  compression: boolean;
  outputTimestampFormat: string;
  outputTimezone: Timezone;
}

export interface SouthOPCUAItemSettingsHaMode {
  aggregate: SouthOPCUAItemSettingsHaModeAggregate;
  resampling?: SouthOPCUAItemSettingsHaModeResampling;
}

export interface SouthOracleItemSettingsDateTimeFields {
  fieldName: string;
  useAsReference: boolean;
  type: SouthOracleItemSettingsDateTimeFieldsType;
  timezone?: Timezone;
  format?: string;
  locale?: string;
}

export interface SouthOracleItemSettingsSerialization {
  type: SouthOracleItemSettingsSerializationType;
  filename: string;
  delimiter: SouthOracleItemSettingsSerializationDelimiter;
  compression: boolean;
  outputTimestampFormat: string;
  outputTimezone: Timezone;
}

export interface SouthPostgreSQLItemSettingsDateTimeFields {
  fieldName: string;
  useAsReference: boolean;
  type: SouthPostgreSQLItemSettingsDateTimeFieldsType;
  timezone?: Timezone;
  format?: string;
  locale?: string;
}

export interface SouthPostgreSQLItemSettingsSerialization {
  type: SouthPostgreSQLItemSettingsSerializationType;
  filename: string;
  delimiter: SouthPostgreSQLItemSettingsSerializationDelimiter;
  compression: boolean;
  outputTimestampFormat: string;
  outputTimezone: Timezone;
}

export interface SouthSlimsItemSettingsQueryParams {
  key: string;
  value: string;
}

export interface SouthSlimsItemSettingsDateTimeFields {
  fieldName: string;
  useAsReference: boolean;
  type: SouthSlimsItemSettingsDateTimeFieldsType;
  timezone?: Timezone;
  format?: string;
  locale?: string;
}

export interface SouthSlimsItemSettingsSerialization {
  type: SouthSlimsItemSettingsSerializationType;
  filename: string;
  delimiter: SouthSlimsItemSettingsSerializationDelimiter;
  compression: boolean;
  outputTimestampFormat: string;
  outputTimezone: Timezone;
}

export interface SouthSQLiteItemSettingsDateTimeFields {
  fieldName: string;
  useAsReference: boolean;
  type: SouthSQLiteItemSettingsDateTimeFieldsType;
  timezone?: Timezone;
  format?: string;
  locale?: string;
}

export interface SouthSQLiteItemSettingsSerialization {
  type: SouthSQLiteItemSettingsSerializationType;
  filename: string;
  delimiter: SouthSQLiteItemSettingsSerializationDelimiter;
  compression: boolean;
  outputTimestampFormat: string;
  outputTimezone: Timezone;
}

export interface SouthADSItemSettings {
  address: string;
}

export interface SouthFolderScannerItemSettings {
  regex: string;
  minAge: number;
  preserveFiles: boolean;
  ignoreModifiedDate?: boolean;
}

export interface SouthModbusItemSettings {
  address: string;
  modbusType: SouthModbusItemSettingsModbusType;
  data?: SouthModbusItemSettingsData;
}

export interface SouthMQTTItemSettings {
  topic: string;
  valueType: SouthMQTTItemSettingsValueType;
  jsonPayload?: SouthMQTTItemSettingsJsonPayload | null;
}

export interface SouthMSSQLItemSettings {
  query: string;
  dateTimeFields: Array<SouthMSSQLItemSettingsDateTimeFields> | null;
  serialization: SouthMSSQLItemSettingsSerialization;
}

export interface SouthMySQLItemSettings {
  query: string;
  requestTimeout: number;
  dateTimeFields: Array<SouthMySQLItemSettingsDateTimeFields> | null;
  serialization: SouthMySQLItemSettingsSerialization;
}

export interface SouthODBCItemSettings {
  query: string;
  dateTimeFields: Array<SouthODBCItemSettingsDateTimeFields> | null;
  serialization: SouthODBCItemSettingsSerialization;
}

export interface SouthOIAnalyticsItemSettings {
  endpoint: string;
  queryParams: Array<SouthOIAnalyticsItemSettingsQueryParams> | null;
  serialization: SouthOIAnalyticsItemSettingsSerialization;
}

export interface SouthOLEDBItemSettings {
  query: string;
  dateTimeFields: Array<SouthOLEDBItemSettingsDateTimeFields> | null;
  serialization: SouthOLEDBItemSettingsSerialization;
}

export interface SouthOPCHDAItemSettings {
  nodeId: string;
  aggregate: SouthOPCHDAItemSettingsAggregate;
  resampling?: SouthOPCHDAItemSettingsResampling;
}

export interface SouthOPCUAItemSettings {
  nodeId: string;
  mode: SouthOPCUAItemSettingsMode;
  haMode?: SouthOPCUAItemSettingsHaMode | null;
}

export interface SouthOracleItemSettings {
  query: string;
  requestTimeout: number;
  dateTimeFields: Array<SouthOracleItemSettingsDateTimeFields> | null;
  serialization: SouthOracleItemSettingsSerialization;
}

export interface SouthPIItemSettings {
  type: SouthPIItemSettingsType;
  piPoint?: string;
  piQuery?: string;
}

export interface SouthPostgreSQLItemSettings {
  query: string;
  dateTimeFields: Array<SouthPostgreSQLItemSettingsDateTimeFields> | null;
  serialization: SouthPostgreSQLItemSettingsSerialization;
}

export interface SouthSFTPItemSettings {
  remoteFolder: string;
  regex: string;
  minAge: number;
  preserveFiles: boolean;
  ignoreModifiedDate?: boolean;
}

export interface SouthSlimsItemSettings {
  endpoint: string;
  body: string | null;
  queryParams: Array<SouthSlimsItemSettingsQueryParams> | null;
  dateTimeFields: Array<SouthSlimsItemSettingsDateTimeFields> | null;
  serialization: SouthSlimsItemSettingsSerialization;
}

export interface SouthSQLiteItemSettings {
  query: string;
  dateTimeFields: Array<SouthSQLiteItemSettingsDateTimeFields> | null;
  serialization: SouthSQLiteItemSettingsSerialization;
}

export type SouthItemSettings =
  | SouthADSItemSettings
  | SouthFolderScannerItemSettings
  | SouthModbusItemSettings
  | SouthMQTTItemSettings
  | SouthMSSQLItemSettings
  | SouthMySQLItemSettings
  | SouthODBCItemSettings
  | SouthOIAnalyticsItemSettings
  | SouthOLEDBItemSettings
  | SouthOPCHDAItemSettings
  | SouthOPCUAItemSettings
  | SouthOracleItemSettings
  | SouthPIItemSettings
  | SouthPostgreSQLItemSettings
  | SouthSFTPItemSettings
  | SouthSlimsItemSettings
  | SouthSQLiteItemSettings;
