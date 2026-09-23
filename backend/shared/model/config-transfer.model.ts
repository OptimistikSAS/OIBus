import { Instant } from './types';
import { OIBusFullConfigurationCommandDTO, OIBusHistoryQueriesCommandDTO } from '../../src/service/oia/oianalytics.model';

/**
 * A full, secret-free, portable snapshot of an OIBus instance's configuration, produced by the
 * config export endpoint and consumed by the config import endpoint. History queries are kept as
 * a peer field rather than nested inside `fullConfiguration`, mirroring how the two are built and
 * sent to OIAnalytics as separate messages.
 *
 * `oibusVersion` is the only version stamp: it tells the importing instance which settings upgrades
 * to apply (every registry entry newer than it), and an import is rejected when it is newer than the
 * importing instance itself.
 */
export interface ConfigExportEnvelopeDTO {
  oibusVersion: string;
  exportedAt: Instant;
  fullConfiguration: OIBusFullConfigurationCommandDTO;
  historyQueries: OIBusHistoryQueriesCommandDTO;
}

export interface ConfigImportResponseDTO {
  appliedUpgrades: Array<{ scope: string; version: string; entityId?: string }>;
  warnings: Array<string>;
}

/**
 * One entity/field that failed post-upgrade manifest validation during a config import. Shared
 * between the backend (which builds these inside `ConfigImportError`) and the frontend (which
 * renders them so a rejected import is actionable instead of a single opaque message).
 */
export interface ConfigImportEntityValidationError {
  scope: string;
  entityId?: string;
  entityName?: string;
  message: string;
}
