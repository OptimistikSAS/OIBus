import { Instant } from './types';
import { OIBusFullConfigurationCommandDTO, OIBusHistoryQueriesCommandDTO } from '../../src/service/oia/oianalytics.model';

/**
 * The configuration itself: every section of the `full-config` message OIBus sends to OIAnalytics,
 * plus the `historyQueries` of its `history-queries` message, side by side. Using the OIAnalytics
 * DTOs as-is means a file produced by OIAnalytics (from the messages it received) and a file exported
 * by OIBus share one format.
 */
export type OIBusConfigurationDTO = OIBusFullConfigurationCommandDTO & OIBusHistoryQueriesCommandDTO;

/**
 * A full, secret-free, portable snapshot of an OIBus instance's configuration, produced by the config
 * export endpoint (or by OIAnalytics) and consumed by the config import endpoint.
 */
export interface ConfigExportDTO {
  /**
   * Version of the OIBus the configuration comes from (for a file produced by OIAnalytics, the
   * version of the OIBus that sent the messages, not of OIAnalytics). Drives which config upgrades
   * an import applies, and an import is rejected when it is newer than the importing instance.
   */
  oibusVersion: string;
  /** Informational only — never read by the import. */
  exportedAt: Instant;
  config: OIBusConfigurationDTO;
}

export interface ConfigImportResponseDTO {
  /** `oibusVersion` of the imported file. */
  fromVersion: string;
  /** Version of the OIBus instance the configuration was upgraded to and imported into. */
  toVersion: string;
  appliedUpgrades: Array<{ version: string; description: string }>;
  warnings: Array<string>;
}

/**
 * One entity/field that failed post-upgrade validation during a config import. Shared between the
 * backend (which builds these inside `ConfigImportError`) and the frontend (which renders them so a
 * rejected import is actionable instead of a single opaque message).
 */
export interface ConfigImportEntityValidationError {
  scope: string;
  entityId?: string;
  entityName?: string;
  message: string;
}
