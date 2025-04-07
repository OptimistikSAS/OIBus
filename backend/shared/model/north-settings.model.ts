// DO NOT EDIT THIS BY HAND!
// This file is auto-generated by the script located backend/src/settings-interface.generator.ts
// To update the typescript model run npm run generate-settings-interface on the backend project

export const NORTH_AZURE_BLOB_SETTINGS_AUTHENTICATIONS = ['access-key', 'sas-token', 'aad', 'external'] as const;
export type NorthAzureBlobSettingsAuthentication = (typeof NORTH_AZURE_BLOB_SETTINGS_AUTHENTICATIONS)[number];

export const NORTH_MODBUS_SETTINGS_ADDRESS_OFFSETS = ['modbus', 'jbus'] as const;
export type NorthModbusSettingsAddressOffset = (typeof NORTH_MODBUS_SETTINGS_ADDRESS_OFFSETS)[number];

export const NORTH_MODBUS_SETTINGS_ENDIANNESSS = ['big-endian', 'little-endian'] as const;
export type NorthModbusSettingsEndianness = (typeof NORTH_MODBUS_SETTINGS_ENDIANNESSS)[number];

export const NORTH_M_Q_T_T_SETTINGS_AUTHENTICATION_TYPES = ['none', 'basic', 'cert'] as const;
export type NorthMQTTSettingsAuthenticationType = (typeof NORTH_M_Q_T_T_SETTINGS_AUTHENTICATION_TYPES)[number];

export const NORTH_M_Q_T_T_SETTINGS_QOSS = ['0', '1', '2'] as const;
export type NorthMQTTSettingsQos = (typeof NORTH_M_Q_T_T_SETTINGS_QOSS)[number];

export const NORTH_O_I_ANALYTICS_SETTINGS_SPECIFIC_SETTINGS_AUTHENTICATIONS = ['basic', 'aad-client-secret', 'aad-certificate'] as const;
export type NorthOIAnalyticsSettingsSpecificSettingsAuthentication =
  (typeof NORTH_O_I_ANALYTICS_SETTINGS_SPECIFIC_SETTINGS_AUTHENTICATIONS)[number];

export const NORTH_O_P_C_U_A_SETTINGS_AUTHENTICATION_TYPES = ['none', 'basic', 'cert'] as const;
export type NorthOPCUASettingsAuthenticationType = (typeof NORTH_O_P_C_U_A_SETTINGS_AUTHENTICATION_TYPES)[number];

export const NORTH_O_P_C_U_A_SETTINGS_SECURITY_MODES = ['none', 'sign', 'sign-and-encrypt'] as const;
export type NorthOPCUASettingsSecurityMode = (typeof NORTH_O_P_C_U_A_SETTINGS_SECURITY_MODES)[number];

export const NORTH_O_P_C_U_A_SETTINGS_SECURITY_POLICYS = [
  'none',
  'basic128',
  'basic192',
  'basic192-rsa15',
  'basic256-rsa15',
  'basic256-sha256',
  'aes128-sha256-rsa-oaep',
  'pub-sub-aes-128-ctr',
  'pub-sub-aes-256-ctr'
] as const;
export type NorthOPCUASettingsSecurityPolicy = (typeof NORTH_O_P_C_U_A_SETTINGS_SECURITY_POLICYS)[number];

export const NORTH_R_E_S_T_SETTINGS_AUTH_TYPES = ['basic', 'bearer'] as const;
export type NorthRESTSettingsAuthType = (typeof NORTH_R_E_S_T_SETTINGS_AUTH_TYPES)[number];

export const NORTH_S_F_T_P_SETTINGS_AUTHENTICATIONS = ['password', 'private-key'] as const;
export type NorthSFTPSettingsAuthentication = (typeof NORTH_S_F_T_P_SETTINGS_AUTHENTICATIONS)[number];

export interface NorthMQTTSettingsAuthentication {
  type: NorthMQTTSettingsAuthenticationType;
  username?: string;
  password?: string | null;
  certFilePath?: string;
  keyFilePath?: string | null;
  caFilePath?: string | null;
}

export interface NorthOIAnalyticsSettingsSpecificSettings {
  host: string;
  acceptUnauthorized: boolean;
  authentication: NorthOIAnalyticsSettingsSpecificSettingsAuthentication;
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

export interface NorthOPCUASettingsAuthentication {
  type: NorthOPCUASettingsAuthenticationType;
  username?: string;
  password?: string | null;
  certFilePath?: string;
  keyFilePath?: string | null;
}

export interface NorthRESTSettingsQueryParams {
  key: string;
  value: string;
}

export interface NorthAmazonS3Settings {
  bucket: string;
  region: string;
  folder: string;
  accessKey: string;
  secretKey: string | null;
  useProxy: boolean;
  proxyUrl?: string;
  proxyUsername?: string | null;
  proxyPassword?: string | null;
}

export interface NorthAzureBlobSettings {
  useADLS: boolean;
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

export interface NorthConsoleSettings {
  verbose: boolean;
}

export interface NorthFileWriterSettings {
  outputFolder: string;
  prefix: string | null;
  suffix: string | null;
}

export interface NorthModbusSettings {
  host: string;
  port: number;
  retryInterval: number;
  slaveId: number;
  addressOffset: NorthModbusSettingsAddressOffset;
  endianness: NorthModbusSettingsEndianness;
  swapBytesInWords: boolean;
  swapWordsInDWords: boolean;
}

export interface NorthMQTTSettings {
  url: string;
  qos: NorthMQTTSettingsQos;
  persistent?: boolean;
  authentication: NorthMQTTSettingsAuthentication;
  rejectUnauthorized: boolean;
  reconnectPeriod: number;
  connectTimeout: number;
}

export interface NorthOIAnalyticsSettings {
  useOiaModule: boolean;
  timeout: number;
  compress: boolean;
  specificSettings?: NorthOIAnalyticsSettingsSpecificSettings | null;
}

export interface NorthOPCUASettings {
  url: string;
  keepSessionAlive: boolean;
  readTimeout: number;
  retryInterval: number;
  securityMode: NorthOPCUASettingsSecurityMode;
  securityPolicy?: NorthOPCUASettingsSecurityPolicy | null;
  authentication: NorthOPCUASettingsAuthentication;
}

export interface NorthRESTSettings {
  endpoint: string;
  testPath: string;
  timeout: number;
  authType: NorthRESTSettingsAuthType;
  bearerAuthToken?: string | null;
  basicAuthUsername?: string;
  basicAuthPassword?: string | null;
  queryParams: Array<NorthRESTSettingsQueryParams> | null;
  useProxy: boolean;
  proxyUrl?: string;
  proxyUsername?: string | null;
  proxyPassword?: string | null;
}

export interface NorthSFTPSettings {
  host: string;
  port: number;
  authentication: NorthSFTPSettingsAuthentication;
  username: string | null;
  password?: string | null;
  privateKey?: string;
  passphrase?: string | null;
  remoteFolder: string;
  prefix: string | null;
  suffix: string | null;
}

export type NorthSettings =
  | NorthAmazonS3Settings
  | NorthAzureBlobSettings
  | NorthConsoleSettings
  | NorthFileWriterSettings
  | NorthModbusSettings
  | NorthMQTTSettings
  | NorthOIAnalyticsSettings
  | NorthOPCUASettings
  | NorthRESTSettings
  | NorthSFTPSettings;
