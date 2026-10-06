import { EngineSettingsCommandDTO } from './engine.model';
import { NorthConnectorCommandDTO } from './north-connector.model';
import { SouthConnectorCommandDTO } from './south-connector.model';
import { CertificateDTO } from './certificate.model';
import { UserCommandDTO } from './user.model';
import { IPFilterCommandDTO } from './ip-filter.model';
import { ScanModeCommandDTO } from './scan-mode.model';
import { HistoryQueryCommandDTO } from './history-query.model';
import { CustomTransformerCommandDTO } from './transformer.model';
import { OIBusObjectAttribute } from './form.model';

/*
 * Configuration DTOs OIBus sends to OIAnalytics in its `full-config` and `history-queries` messages.
 * They are also the format of a config export file (see `config-transfer.model.ts`).
 */

interface BaseAuditFields {
  oIBusInternalId: string;
  oIBusCreatedBy: string;
  oIBusUpdatedBy: string;
  oIBusCreatedAt: string;
  oIBusUpdatedAt: string;
}

export interface OIAnalyticsScanModeCommandDTO extends BaseAuditFields {
  settings: ScanModeCommandDTO;
}

export interface OIAnalyticsIPFilterCommandDTO extends BaseAuditFields {
  settings: IPFilterCommandDTO;
}

export interface OIAnalyticsCertificateCommandDTO extends BaseAuditFields {
  settings: Omit<CertificateDTO, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>;
}

export interface OIAnalyticsUserCommandDTO extends BaseAuditFields {
  settings: UserCommandDTO;
}

interface StandardTransformerCommandDTO {
  type: 'standard';
  functionName: string;
  inputType: string;
  outputType: string;
}

export interface OIAnalyticsTransformerCommandDTO {
  oIBusInternalId: string;
  type: 'custom' | 'standard';
  settings: Omit<CustomTransformerCommandDTO | StandardTransformerCommandDTO, 'type'>;
  manifest: OIBusObjectAttribute;
}

export interface OIAnalyticsRegistrationCommandDTO extends BaseAuditFields {
  publicKey: string;
  settings: {
    commandRefreshInterval: number;
    commandRetryInterval: number;
    messageRetryInterval: number;
    commandPermissions: {
      updateVersion: boolean;
      restartEngine: boolean;
      regenerateCipherKeys: boolean;
      updateEngineSettings: boolean;
      updateRegistrationSettings: boolean;
      createScanMode: boolean;
      updateScanMode: boolean;
      deleteScanMode: boolean;
      createIpFilter: boolean;
      updateIpFilter: boolean;
      deleteIpFilter: boolean;
      createCertificate: boolean;
      updateCertificate: boolean;
      deleteCertificate: boolean;
      createHistoryQuery: boolean;
      updateHistoryQuery: boolean;
      deleteHistoryQuery: boolean;
      createOrUpdateHistoryItemsFromCsv: boolean;
      createSouth: boolean;
      updateSouth: boolean;
      deleteSouth: boolean;
      createOrUpdateSouthItemsFromCsv: boolean;
      createNorth: boolean;
      updateNorth: boolean;
      deleteNorth: boolean;
    };
  };
}

export interface OIAnalyticsEngineCommandDTO extends BaseAuditFields {
  name: string;
  softwareVersion: string;
  launcherVersion: string;
  architecture: string;
  operatingSystem: string;
  dataFolder: string;
  binaryFolder: string;
  ignoreIpFilters: boolean;
  ignoreRemoteUpdate: boolean;
  settings: EngineSettingsCommandDTO;
}

/**
 * The connector's configuration workflows are part of `settings` (see `SouthConnectorCommandDTO`). Each
 * item additionally carries `createdByWorkflowId`/`disabledReason` (like its `oIBus*` audit fields), so
 * the workflow owning it survives a config export/import.
 */
export interface OIAnalyticsSouthCommandDTO extends BaseAuditFields {
  type: string;
  settings: SouthConnectorCommandDTO;
}

export interface OIAnalyticsNorthCommandDTO extends BaseAuditFields {
  type: string;
  settings: NorthConnectorCommandDTO;
}

export interface OIBusFullConfigurationCommandDTO {
  engine: OIAnalyticsEngineCommandDTO;
  registration: OIAnalyticsRegistrationCommandDTO;
  scanModes: Array<OIAnalyticsScanModeCommandDTO>;
  ipFilters: Array<OIAnalyticsIPFilterCommandDTO>;
  certificates: Array<OIAnalyticsCertificateCommandDTO>;
  southConnectors: Array<OIAnalyticsSouthCommandDTO>;
  northConnectors: Array<OIAnalyticsNorthCommandDTO>;
  users: Array<OIAnalyticsUserCommandDTO>;
  transformers: Array<OIAnalyticsTransformerCommandDTO>;
}

export interface OIBusHistoryQueriesCommandDTO {
  historyQueries: Array<{
    oIBusInternalId: string;
    oIBusCreatedBy: string;
    oIBusUpdatedBy: string;
    oIBusCreatedAt: string;
    oIBusUpdatedAt: string;
    settings: HistoryQueryCommandDTO;
  }>;
}
