import { ScanModeDTO } from "./scan-mode.model";
import { Timezone } from './types';

const SOUTH_A_D_S_SETTINGS_ENUM_AS_TEXTS = ['Text', 'Integer'] as const
export type SouthADSSettingsEnumAsText = (typeof SOUTH_A_D_S_SETTINGS_ENUM_AS_TEXTS)[number];

const SOUTH_A_D_S_SETTINGS_BOOL_AS_TEXTS = ['Text', 'Integer'] as const
export type SouthADSSettingsBoolAsText = (typeof SOUTH_A_D_S_SETTINGS_BOOL_AS_TEXTS)[number];

const SOUTH_MODBUS_SETTINGS_ADDRESS_OFFSETS = ['Modbus', 'JBus'] as const
export type SouthModbusSettingsAddressOffset = (typeof SOUTH_MODBUS_SETTINGS_ADDRESS_OFFSETS)[number];

const SOUTH_MODBUS_SETTINGS_ENDIANNESSS = ['Big Endian', 'Little Endian'] as const
export type SouthModbusSettingsEndianness = (typeof SOUTH_MODBUS_SETTINGS_ENDIANNESSS)[number];

const SOUTH_MODBUS_ITEM_SETTINGS_MODBUS_TYPES = ['coil', 'discreteInput', 'inputRegister', 'holdingRegister'] as const
export type SouthModbusItemSettingsModbusType = (typeof SOUTH_MODBUS_ITEM_SETTINGS_MODBUS_TYPES)[number];

const SOUTH_MODBUS_ITEM_SETTINGS_DATA_TYPES = ['UInt16', 'Int16', 'UInt32', 'Int32', 'BigUInt64', 'BigInt64', 'Float', 'Double'] as const
export type SouthModbusItemSettingsDataType = (typeof SOUTH_MODBUS_ITEM_SETTINGS_DATA_TYPES)[number];

const SOUTH_M_Q_T_T_SETTINGS_AUTHENTICATION_TYPES = ['none', 'basic', 'cert'] as const
export type SouthMQTTSettingsAuthenticationType = (typeof SOUTH_M_Q_T_T_SETTINGS_AUTHENTICATION_TYPES)[number];

const SOUTH_M_Q_T_T_SETTINGS_QOSS = ['0', '1', '2'] as const
export type SouthMQTTSettingsQos = (typeof SOUTH_M_Q_T_T_SETTINGS_QOSS)[number];

const SOUTH_M_Q_T_T_SETTINGS_TIMESTAMP_ORIGINS = ['payload', 'oibus'] as const
export type SouthMQTTSettingsTimestampOrigin = (typeof SOUTH_M_Q_T_T_SETTINGS_TIMESTAMP_ORIGINS)[number];

const SOUTH_M_S_S_Q_L_ITEM_SETTINGS_DATE_TIME_FIELDS_TYPES = ['string', 'Date', 'DateTime', 'DateTime2', 'DateTimeOffset', 'SmallDateTime', 'iso-string', 'unix-epoch', 'unix-epoch-ms'] as const
export type SouthMSSQLItemSettingsDateTimeFieldsType = (typeof SOUTH_M_S_S_Q_L_ITEM_SETTINGS_DATE_TIME_FIELDS_TYPES)[number];

const SOUTH_M_S_S_Q_L_ITEM_SETTINGS_SERIALIZATION_TYPES = ['csv', 'json'] as const
export type SouthMSSQLItemSettingsSerializationType = (typeof SOUTH_M_S_S_Q_L_ITEM_SETTINGS_SERIALIZATION_TYPES)[number];

const SOUTH_M_S_S_Q_L_ITEM_SETTINGS_SERIALIZATION_DELIMITERS = ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'] as const
export type SouthMSSQLItemSettingsSerializationDelimiter = (typeof SOUTH_M_S_S_Q_L_ITEM_SETTINGS_SERIALIZATION_DELIMITERS)[number];

const SOUTH_MY_S_Q_L_ITEM_SETTINGS_DATE_TIME_FIELDS_TYPES = ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms'] as const
export type SouthMySQLItemSettingsDateTimeFieldsType = (typeof SOUTH_MY_S_Q_L_ITEM_SETTINGS_DATE_TIME_FIELDS_TYPES)[number];

const SOUTH_MY_S_Q_L_ITEM_SETTINGS_SERIALIZATION_TYPES = ['csv', 'json'] as const
export type SouthMySQLItemSettingsSerializationType = (typeof SOUTH_MY_S_Q_L_ITEM_SETTINGS_SERIALIZATION_TYPES)[number];

const SOUTH_MY_S_Q_L_ITEM_SETTINGS_SERIALIZATION_DELIMITERS = ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'] as const
export type SouthMySQLItemSettingsSerializationDelimiter = (typeof SOUTH_MY_S_Q_L_ITEM_SETTINGS_SERIALIZATION_DELIMITERS)[number];

const SOUTH_O_D_B_C_ITEM_SETTINGS_DATE_TIME_FIELDS_TYPES = ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms'] as const
export type SouthODBCItemSettingsDateTimeFieldsType = (typeof SOUTH_O_D_B_C_ITEM_SETTINGS_DATE_TIME_FIELDS_TYPES)[number];

const SOUTH_O_D_B_C_ITEM_SETTINGS_SERIALIZATION_TYPES = ['csv', 'json'] as const
export type SouthODBCItemSettingsSerializationType = (typeof SOUTH_O_D_B_C_ITEM_SETTINGS_SERIALIZATION_TYPES)[number];

const SOUTH_O_D_B_C_ITEM_SETTINGS_SERIALIZATION_DELIMITERS = ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'] as const
export type SouthODBCItemSettingsSerializationDelimiter = (typeof SOUTH_O_D_B_C_ITEM_SETTINGS_SERIALIZATION_DELIMITERS)[number];

const SOUTH_O_I_CONNECT_SETTINGS_AUTHENTICATION_TYPES = ['none', 'basic', 'bearer', 'api-key'] as const
export type SouthOIConnectSettingsAuthenticationType = (typeof SOUTH_O_I_CONNECT_SETTINGS_AUTHENTICATION_TYPES)[number];

const SOUTH_O_I_CONNECT_ITEM_SETTINGS_SERIALIZATION_TYPES = ['csv', 'json'] as const
export type SouthOIConnectItemSettingsSerializationType = (typeof SOUTH_O_I_CONNECT_ITEM_SETTINGS_SERIALIZATION_TYPES)[number];

const SOUTH_O_I_CONNECT_ITEM_SETTINGS_SERIALIZATION_DELIMITERS = ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'] as const
export type SouthOIConnectItemSettingsSerializationDelimiter = (typeof SOUTH_O_I_CONNECT_ITEM_SETTINGS_SERIALIZATION_DELIMITERS)[number];

const SOUTH_O_I_CONNECT_ITEM_SETTINGS_REQUEST_METHODS = ['GET', 'POST', 'PUT', 'PATCH'] as const
export type SouthOIConnectItemSettingsRequestMethod = (typeof SOUTH_O_I_CONNECT_ITEM_SETTINGS_REQUEST_METHODS)[number];

const SOUTH_O_I_CONNECT_ITEM_SETTINGS_PAYLOAD_PARSERS = ['raw', 'oianalytics-time-values', 'slims'] as const
export type SouthOIConnectItemSettingsPayloadParser = (typeof SOUTH_O_I_CONNECT_ITEM_SETTINGS_PAYLOAD_PARSERS)[number];

const SOUTH_O_P_C_H_D_A_SETTINGS_LOG_LEVELS = ['trace', 'debug', 'info', 'warning', 'error'] as const
export type SouthOPCHDASettingsLogLevel = (typeof SOUTH_O_P_C_H_D_A_SETTINGS_LOG_LEVELS)[number];

const SOUTH_O_P_C_H_D_A_ITEM_SETTINGS_AGGREGATES = ['Raw', 'Average', 'Minimum', 'Maximum', 'Count'] as const
export type SouthOPCHDAItemSettingsAggregate = (typeof SOUTH_O_P_C_H_D_A_ITEM_SETTINGS_AGGREGATES)[number];

const SOUTH_O_P_C_H_D_A_ITEM_SETTINGS_RESAMPLINGS = ['None', 'Second', '10 Seconds', '30 Seconds', 'Minute', 'Hour', 'Day'] as const
export type SouthOPCHDAItemSettingsResampling = (typeof SOUTH_O_P_C_H_D_A_ITEM_SETTINGS_RESAMPLINGS)[number];

const SOUTH_O_P_C_U_A_D_A_SETTINGS_AUTHENTICATION_TYPES = ['none', 'basic', 'cert'] as const
export type SouthOPCUADASettingsAuthenticationType = (typeof SOUTH_O_P_C_U_A_D_A_SETTINGS_AUTHENTICATION_TYPES)[number];

const SOUTH_O_P_C_U_A_D_A_SETTINGS_SECURITY_MODES = ['None', 'Sign', 'SignAndEncrypt'] as const
export type SouthOPCUADASettingsSecurityMode = (typeof SOUTH_O_P_C_U_A_D_A_SETTINGS_SECURITY_MODES)[number];

const SOUTH_O_P_C_U_A_D_A_SETTINGS_SECURITY_POLICYS = ['None', 'Basic128', 'Basic192', 'Basic256', 'Basic128Rsa15', 'Basic192Rsa15', 'Basic256Rsa15', 'Basic256Sha256', 'Aes128_Sha256_RsaOaep', 'PubSub_Aes128_CTR', 'PubSub_Aes256_CTR'] as const
export type SouthOPCUADASettingsSecurityPolicy = (typeof SOUTH_O_P_C_U_A_D_A_SETTINGS_SECURITY_POLICYS)[number];

const SOUTH_O_P_C_U_A_H_A_SETTINGS_AUTHENTICATION_TYPES = ['none', 'basic', 'cert'] as const
export type SouthOPCUAHASettingsAuthenticationType = (typeof SOUTH_O_P_C_U_A_H_A_SETTINGS_AUTHENTICATION_TYPES)[number];

const SOUTH_O_P_C_U_A_H_A_SETTINGS_SECURITY_MODES = ['None', 'Sign', 'SignAndEncrypt'] as const
export type SouthOPCUAHASettingsSecurityMode = (typeof SOUTH_O_P_C_U_A_H_A_SETTINGS_SECURITY_MODES)[number];

const SOUTH_O_P_C_U_A_H_A_SETTINGS_SECURITY_POLICYS = ['None', 'Basic128', 'Basic192', 'Basic256', 'Basic128Rsa15', 'Basic192Rsa15', 'Basic256Rsa15', 'Basic256Sha256', 'Aes128_Sha256_RsaOaep', 'PubSub_Aes128_CTR', 'PubSub_Aes256_CTR'] as const
export type SouthOPCUAHASettingsSecurityPolicy = (typeof SOUTH_O_P_C_U_A_H_A_SETTINGS_SECURITY_POLICYS)[number];

const SOUTH_O_P_C_U_A_H_A_ITEM_SETTINGS_AGGREGATES = ['Raw', 'Average', 'Minimum', 'Maximum', 'Count'] as const
export type SouthOPCUAHAItemSettingsAggregate = (typeof SOUTH_O_P_C_U_A_H_A_ITEM_SETTINGS_AGGREGATES)[number];

const SOUTH_O_P_C_U_A_H_A_ITEM_SETTINGS_RESAMPLINGS = ['None', 'Second', '10 Seconds', '30 Seconds', 'Minute', 'Hour', 'Day'] as const
export type SouthOPCUAHAItemSettingsResampling = (typeof SOUTH_O_P_C_U_A_H_A_ITEM_SETTINGS_RESAMPLINGS)[number];

const SOUTH_ORACLE_ITEM_SETTINGS_DATE_TIME_FIELDS_TYPES = ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms'] as const
export type SouthOracleItemSettingsDateTimeFieldsType = (typeof SOUTH_ORACLE_ITEM_SETTINGS_DATE_TIME_FIELDS_TYPES)[number];

const SOUTH_ORACLE_ITEM_SETTINGS_SERIALIZATION_TYPES = ['csv', 'json'] as const
export type SouthOracleItemSettingsSerializationType = (typeof SOUTH_ORACLE_ITEM_SETTINGS_SERIALIZATION_TYPES)[number];

const SOUTH_ORACLE_ITEM_SETTINGS_SERIALIZATION_DELIMITERS = ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'] as const
export type SouthOracleItemSettingsSerializationDelimiter = (typeof SOUTH_ORACLE_ITEM_SETTINGS_SERIALIZATION_DELIMITERS)[number];

const SOUTH_POSTGRE_S_Q_L_ITEM_SETTINGS_DATE_TIME_FIELDS_TYPES = ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms', 'timestamp', 'timestamptz'] as const
export type SouthPostgreSQLItemSettingsDateTimeFieldsType = (typeof SOUTH_POSTGRE_S_Q_L_ITEM_SETTINGS_DATE_TIME_FIELDS_TYPES)[number];

const SOUTH_POSTGRE_S_Q_L_ITEM_SETTINGS_SERIALIZATION_TYPES = ['csv', 'json'] as const
export type SouthPostgreSQLItemSettingsSerializationType = (typeof SOUTH_POSTGRE_S_Q_L_ITEM_SETTINGS_SERIALIZATION_TYPES)[number];

const SOUTH_POSTGRE_S_Q_L_ITEM_SETTINGS_SERIALIZATION_DELIMITERS = ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'] as const
export type SouthPostgreSQLItemSettingsSerializationDelimiter = (typeof SOUTH_POSTGRE_S_Q_L_ITEM_SETTINGS_SERIALIZATION_DELIMITERS)[number];

const SOUTH_S_Q_LITE_ITEM_SETTINGS_DATE_TIME_FIELDS_TYPES = ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms'] as const
export type SouthSQLiteItemSettingsDateTimeFieldsType = (typeof SOUTH_S_Q_LITE_ITEM_SETTINGS_DATE_TIME_FIELDS_TYPES)[number];

const SOUTH_S_Q_LITE_ITEM_SETTINGS_SERIALIZATION_TYPES = ['csv', 'json'] as const
export type SouthSQLiteItemSettingsSerializationType = (typeof SOUTH_S_Q_LITE_ITEM_SETTINGS_SERIALIZATION_TYPES)[number];

const SOUTH_S_Q_LITE_ITEM_SETTINGS_SERIALIZATION_DELIMITERS = ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'] as const
export type SouthSQLiteItemSettingsSerializationDelimiter = (typeof SOUTH_S_Q_LITE_ITEM_SETTINGS_SERIALIZATION_DELIMITERS)[number];

export interface SouthMQTTSettingsAuthentication {
  type: SouthMQTTSettingsAuthenticationType;
  username: string;
  password: string;
  certFilePath: string;
  keyFilePath: string;
  caFilePath: string;
}

export interface SouthOIConnectSettingsAuthentication {
  type: SouthOIConnectSettingsAuthenticationType;
  username: string;
  password: string;
  token: string;
  apiKeyHeader: string;
  apiKey: string;
}

export interface SouthOPCUADASettingsAuthentication {
  type: SouthOPCUADASettingsAuthenticationType;
  username: string;
  password: string;
  certFilePath: string;
  keyFilePath: string;
}

export interface SouthOPCUAHASettingsAuthentication {
  type: SouthOPCUAHASettingsAuthenticationType;
  username: string;
  password: string;
  certFilePath: string;
  keyFilePath: string;
}

interface BaseSouthSettings {}

export interface SouthADSSettings extends BaseSouthSettings {
  netId: string;
  port: number;
  routerAddress: string;
  routerTcpPort: number;
  clientAmsNetId: string;
  clientAdsPort: number;
  retryInterval: number;
  plcName: string;
  enumAsText: SouthADSSettingsEnumAsText;
  boolAsText: SouthADSSettingsBoolAsText;
}

export interface SouthFolderScannerSettings extends BaseSouthSettings {
  inputFolder: string;
  minAge: number;
  preserveFiles: boolean;
  ignoreModifiedDate: boolean;
  compression: boolean;
}

export interface SouthModbusSettings extends BaseSouthSettings {
  host: string;
  port: number;
  slaveId: number;
  retryInterval: number;
  addressOffset: SouthModbusSettingsAddressOffset;
  endianness: SouthModbusSettingsEndianness;
  swapBytesInWords: boolean;
  swapWordsInDWords: boolean;
}

export interface SouthMQTTSettings extends BaseSouthSettings {
  url: string;
  qos: SouthMQTTSettingsQos;
  persistent: boolean;
  authentication: SouthMQTTSettingsAuthentication;
  rejectUnauthorized: boolean;
  reconnectPeriod: number;
  connectTimeout: number;
  dataArrayPath: string;
  valuePath: string;
  pointIdPath: string;
  qualityPath: string;
  timestampOrigin: SouthMQTTSettingsTimestampOrigin;
  timestampPath: string;
  timestampFormat: string;
  timestampTimezone: Timezone;
}

export interface SouthMSSQLSettings extends BaseSouthSettings {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  domain: string;
  encryption: boolean;
  trustServerCertificate: boolean;
  connectionTimeout: number;
  requestTimeout: number;
}

export interface SouthMySQLSettings extends BaseSouthSettings {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  connectionTimeout: number;
  requestTimeout: number;
}

export interface SouthODBCSettings extends BaseSouthSettings {
  driverPath: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  connectionTimeout: number;
  trustServerCertificate: boolean;
}

export interface SouthOIConnectSettings extends BaseSouthSettings {
  url: string;
  port: number;
  acceptSelfSigned: boolean;
  authentication: SouthOIConnectSettingsAuthentication;
}

export interface SouthOPCHDASettings extends BaseSouthSettings {
  agentFilename: string;
  tcpPort: number;
  logLevel: SouthOPCHDASettingsLogLevel;
  host: string;
  serverName: string;
  readTimeout: number;
  retryInterval: number;
  maxReturnValues: number;
}

export interface SouthOPCUADASettings extends BaseSouthSettings {
  url: string;
  keepSessionAlive: boolean;
  readTimeout: number;
  retryInterval: number;
  securityMode: SouthOPCUADASettingsSecurityMode;
  securityPolicy: SouthOPCUADASettingsSecurityPolicy;
  authentication: SouthOPCUADASettingsAuthentication;
}

export interface SouthOPCUAHASettings extends BaseSouthSettings {
  url: string;
  keepSessionAlive: boolean;
  readTimeout: number;
  retryInterval: number;
  securityMode: SouthOPCUAHASettingsSecurityMode;
  securityPolicy: SouthOPCUAHASettingsSecurityPolicy;
  authentication: SouthOPCUAHASettingsAuthentication;
}

export interface SouthOracleSettings extends BaseSouthSettings {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  connectionTimeout: number;
  requestTimeout: number;
}

export interface SouthPostgreSQLSettings extends BaseSouthSettings {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  connectionTimeout: number;
  requestTimeout: number;
}

export interface SouthSQLiteSettings extends BaseSouthSettings {
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
  | SouthOIConnectSettings
  | SouthOPCHDASettings
  | SouthOPCUADASettings
  | SouthOPCUAHASettings
  | SouthOracleSettings
  | SouthPostgreSQLSettings
  | SouthSQLiteSettings

export interface SouthMSSQLItemSettingsDateTimeFields {
  fieldName: string;
  useAsReference: boolean;
  type: SouthMSSQLItemSettingsDateTimeFieldsType;
  timezone: Timezone;
  format: string;
  locale: string;
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
  timezone: Timezone;
  format: string;
  locale: string;
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
  timezone: Timezone;
  format: string;
  locale: string;
}

export interface SouthODBCItemSettingsSerialization {
  type: SouthODBCItemSettingsSerializationType;
  filename: string;
  delimiter: SouthODBCItemSettingsSerializationDelimiter;
  compression: boolean;
  outputTimestampFormat: string;
  outputTimezone: Timezone;
}

export interface SouthOIConnectItemSettingsSerialization {
  type: SouthOIConnectItemSettingsSerializationType;
  filename: string;
  delimiter: SouthOIConnectItemSettingsSerializationDelimiter;
  compression: boolean;
  outputTimestampFormat: string;
  outputTimezone: Timezone;
}

export interface SouthOracleItemSettingsDateTimeFields {
  fieldName: string;
  useAsReference: boolean;
  type: SouthOracleItemSettingsDateTimeFieldsType;
  timezone: Timezone;
  format: string;
  locale: string;
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
  timezone: Timezone;
  format: string;
  locale: string;
}

export interface SouthPostgreSQLItemSettingsSerialization {
  type: SouthPostgreSQLItemSettingsSerializationType;
  filename: string;
  delimiter: SouthPostgreSQLItemSettingsSerializationDelimiter;
  compression: boolean;
  outputTimestampFormat: string;
  outputTimezone: Timezone;
}

export interface SouthSQLiteItemSettingsDateTimeFields {
  fieldName: string;
  useAsReference: boolean;
  type: SouthSQLiteItemSettingsDateTimeFieldsType;
  timezone: Timezone;
  format: string;
  locale: string;
}

export interface SouthSQLiteItemSettingsSerialization {
  type: SouthSQLiteItemSettingsSerializationType;
  filename: string;
  delimiter: SouthSQLiteItemSettingsSerializationDelimiter;
  compression: boolean;
  outputTimestampFormat: string;
  outputTimezone: Timezone;
}

interface BaseSouthItemSettings {
  id: string;
  name: string;
  scanMode: ScanModeDTO;
}

export interface SouthADSItemSettings extends BaseSouthItemSettings {
}

export interface SouthFolderScannerItemSettings extends BaseSouthItemSettings {
  regex: string;
}

export interface SouthModbusItemSettings extends BaseSouthItemSettings {
  address: string;
  modbusType: SouthModbusItemSettingsModbusType;
  dataType: SouthModbusItemSettingsDataType;
  multiplierCoefficient: number;
}

export interface SouthMQTTItemSettings extends BaseSouthItemSettings {
  topic: string;
}

export interface SouthMSSQLItemSettings extends BaseSouthItemSettings {
  query: string;
  dateTimeFields: Array<SouthMSSQLItemSettingsDateTimeFields>;
  serialization: SouthMSSQLItemSettingsSerialization;
}

export interface SouthMySQLItemSettings extends BaseSouthItemSettings {
  query: string;
  dateTimeFields: Array<SouthMySQLItemSettingsDateTimeFields>;
  serialization: SouthMySQLItemSettingsSerialization;
}

export interface SouthODBCItemSettings extends BaseSouthItemSettings {
  query: string;
  dateTimeFields: Array<SouthODBCItemSettingsDateTimeFields>;
  serialization: SouthODBCItemSettingsSerialization;
}

export interface SouthOIConnectItemSettings extends BaseSouthItemSettings {
  requestMethod: SouthOIConnectItemSettingsRequestMethod;
  endpoint: string;
  payloadParser: SouthOIConnectItemSettingsPayloadParser;
  requestTimeout: number;
  body: string;
  timestampFormat: string;
  timezone: Timezone;
  locale: string;
  serialization: SouthOIConnectItemSettingsSerialization;
}

export interface SouthOPCHDAItemSettings extends BaseSouthItemSettings {
  aggregate: SouthOPCHDAItemSettingsAggregate;
  resampling: SouthOPCHDAItemSettingsResampling;
  nodeId: string;
}

export interface SouthOPCUADAItemSettings extends BaseSouthItemSettings {
  nodeId: string;
}

export interface SouthOPCUAHAItemSettings extends BaseSouthItemSettings {
  aggregate: SouthOPCUAHAItemSettingsAggregate;
  resampling: SouthOPCUAHAItemSettingsResampling;
  nodeId: string;
}

export interface SouthOracleItemSettings extends BaseSouthItemSettings {
  query: string;
  dateTimeFields: Array<SouthOracleItemSettingsDateTimeFields>;
  serialization: SouthOracleItemSettingsSerialization;
}

export interface SouthPostgreSQLItemSettings extends BaseSouthItemSettings {
  query: string;
  dateTimeFields: Array<SouthPostgreSQLItemSettingsDateTimeFields>;
  serialization: SouthPostgreSQLItemSettingsSerialization;
}

export interface SouthSQLiteItemSettings extends BaseSouthItemSettings {
  query: string;
  dateTimeFields: Array<SouthSQLiteItemSettingsDateTimeFields>;
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
  | SouthOIConnectItemSettings
  | SouthOPCHDAItemSettings
  | SouthOPCUADAItemSettings
  | SouthOPCUAHAItemSettings
  | SouthOracleItemSettings
  | SouthPostgreSQLItemSettings
  | SouthSQLiteItemSettings