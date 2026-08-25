import { Instant } from './types';
import { OIBusFullConfigurationCommandDTO, OIBusHistoryQueriesCommandDTO } from '../../src/service/oia/oianalytics.model';

/**
 * A full, secret-free, portable snapshot of an OIBus instance's configuration, produced by the
 * config export endpoint and consumed by the config import endpoint. History queries are kept as
 * a peer field rather than nested inside `fullConfiguration`, mirroring how the two are built and
 * sent to OIAnalytics as separate messages.
 */
export interface ConfigExportEnvelopeDTO {
  formatVersion: number;
  oibusVersion: string;
  exportedAt: Instant;
  fullConfiguration: OIBusFullConfigurationCommandDTO;
  historyQueries: OIBusHistoryQueriesCommandDTO;
}

export interface ConfigImportResponseDTO {
  appliedUpgrades: Array<{ scope: string; version: string; entityId?: string }>;
  warnings: Array<string>;
}
