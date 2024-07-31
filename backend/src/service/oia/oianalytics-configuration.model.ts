export interface OIBusCryptoSettingsCommandDTO {
  algorithm: string;
  secretKey: string;
  initVector: string;
}

export interface OIBusScanModeCommandDTO {
  oIBusInternalId: string;
  name: string;
  settings: any;
}

export interface OIBusEngineCommandDTO {
  oIBusInternalId: string;
  name: string;
  softwareVersion: string;
  architecture: string;
  operatingSystem: string;
  settings: any;
}

export interface OIBusSouthCommandDTO {
  oIBusInternalId: string;
  type: string;
  name: string;
  settings: any;
}

export interface OIBusNorthCommandDTO {
  oIBusInternalId: string;
  type: string;
  name: string;
  settings: any;
}

export interface OIBusFullConfigurationCommandDTO {
  engine: OIBusEngineCommandDTO | null;
  cryptoSettings: OIBusCryptoSettingsCommandDTO | null;
  scanModes: Array<OIBusScanModeCommandDTO>;
  southConnectors: Array<OIBusSouthCommandDTO>;
  northConnectors: Array<OIBusNorthCommandDTO>;
}
