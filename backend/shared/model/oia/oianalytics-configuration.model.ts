import { CertificateDTO } from '../api/certificate.model';
import { EngineSettingsCommandDTO } from '../api/engine.model';
import { HistoryQueryCommandDTO } from '../api/history-query.model';
import { IPFilterCommandDTO } from '../api/ip-filter.model';
import { NorthConnectorCommandDTO } from '../api/north-connector.model';
import { ScanModeCommandDTO } from '../api/scan-mode.model';
import { SouthConnectorCommandDTO } from '../api/south-connector.model';
import { CustomTransformerCommandDTO } from '../api/transformer.model';
import { UserCommandDTO } from '../api/user.model';
import { OIBusObjectAttribute } from '../connector/form.model';
import { RegistrationCommandPermissions } from '../domain/engine.model';

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
    commandPermissions: RegistrationCommandPermissions;
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
