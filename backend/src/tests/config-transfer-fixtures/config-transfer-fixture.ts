import path from 'node:path';
import { Database } from 'better-sqlite3';
import { createAuditServiceMock } from '../utils/test-utils';
import EngineRepository from '../../repository/config/engine.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import IpFilterRepository from '../../repository/config/ip-filter.repository';
import CertificateRepository from '../../repository/config/certificate.repository';
import UserRepository from '../../repository/config/user.repository';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import HistoryQueryRepository from '../../repository/config/history-query.repository';
import TransformerRepository from '../../repository/config/transformer.repository';
import ConfigurationWorkflowRepository from '../../repository/config/configuration-workflow.repository';
import OIAnalyticsRegistrationRepository from '../../repository/config/oianalytics-registration.repository';
import ConfigTransferBuilderService from '../../service/config-transfer/config-transfer-builder.service';
import ConfigTransferService from '../../service/config-transfer/config-transfer.service';
import EncryptionService from '../../service/encryption.service';
import OIAnalyticsRegistrationService from '../../service/oia/oianalytics-registration.service';
import { ConfigExportDTO, OIBusConfigurationDTO } from '../../../shared/model/config-transfer.model';

/**
 * Frozen config-transfer fixtures, one folder per released OIBus version, each holding:
 *  - `oibus.sql`: a dump of a reference config database at that version (`dumpSqliteDatabase`)
 *  - `export.json`: the configuration export that version produced from that very database
 *
 * They feed the differential test (`config-upgrades.differential.spec.ts`), which proves that the
 * config upgrade chain brings every past export to what the entity migrations bring its database to.
 * Generated at release time with `npm run generate:config-transfer-fixture` (see `generate-fixture.ts`).
 *
 * The 3.9 fixtures predate config export: they were generated from the v3.9.0 and v3.9.3 checkouts, as
 * OIAnalytics would produce them from the full-config and history-queries messages those versions send
 * (their `OIAnalyticsMessageService`), from the same test data plus the upgrade cases the 3.10.0 step
 * handles (SQL items with their CSV serialization resolved at item, group and south level, OIAnalytics
 * transformers, and on 3.9.0 an OPC UA item with an empty timestampOrigin). Being frozen, they are
 * never regenerated.
 */
export const CONFIG_TRANSFER_FIXTURES_DIR = path.resolve(__dirname);

/**
 * Exports the configuration of a config database with the real repositories and builder, as the export
 * endpoint does. The engine section describes the host that runs it (folders, OS…), so it is replaced
 * by fixed values to keep a committed fixture machine-independent.
 */
export function exportConfigDatabase(database: Database, oibusVersion: string): ConfigExportDTO {
  const auditService = createAuditServiceMock();
  const engineRepository = new EngineRepository(database, auditService, oibusVersion);
  const registrationRepository = new OIAnalyticsRegistrationRepository(database, auditService);
  const builder = new ConfigTransferBuilderService(
    engineRepository,
    new ScanModeRepository(database, auditService),
    new IpFilterRepository(database, auditService),
    new CertificateRepository(database, auditService),
    new UserRepository(database, auditService),
    new SouthConnectorRepository(database, auditService),
    new NorthConnectorRepository(database, auditService),
    new HistoryQueryRepository(database, auditService),
    new TransformerRepository(database, auditService),
    new ConfigurationWorkflowRepository(database, auditService),
    new EncryptionService(),
    false,
    false
  );
  const registrationService = { getRegistrationSettings: () => registrationRepository.get() } as unknown as OIAnalyticsRegistrationService;
  const file = new ConfigTransferService(builder, engineRepository, registrationService).exportConfiguration();
  return {
    ...file,
    oibusVersion,
    exportedAt: '2026-01-01T00:00:00.000Z',
    config: {
      ...file.config,
      engine: {
        ...file.config.engine,
        softwareVersion: oibusVersion,
        launcherVersion: oibusVersion,
        architecture: 'x64',
        operatingSystem: 'linux',
        dataFolder: '/oibus/data',
        binaryFolder: '/oibus/bin'
      }
    }
  };
}

/**
 * The part of a configuration an import reads, normalized for comparing two of them:
 *  - the engine and the registration are informational only, so they are left out;
 *  - standard transformers are only ever matched by function name on import (their ids differ between
 *    installs, and a later version may seed more of them), so they are set aside, and transformer
 *    links reference them by function name;
 *  - transformer links created by a migration or an upgrade step get a random id, so link ids are
 *    ignored and links are sorted; of the items a history query link applies to, only what an import
 *    reads (id, name, enabled) is kept.
 */
export function importedPart(config: OIBusConfigurationDTO): {
  config: Omit<OIBusConfigurationDTO, 'engine' | 'registration'>;
  standardTransformers: Array<{ id: string; functionName: string }>;
} {
  const { engine: _engine, registration: _registration, transformers, ...rest } = config;
  const standardTransformers = transformers
    .filter(transformer => transformer.type === 'standard')
    .map(transformer => ({
      id: transformer.oIBusInternalId,
      functionName: (transformer.settings as unknown as { functionName: string }).functionName
    }));
  const reference = (transformerId: string): string =>
    standardTransformers.find(transformer => transformer.id === transformerId)?.functionName ?? transformerId;
  const normalizeLinks = <T extends { id: string; transformerId: string }>(links: Array<T>): Array<T> =>
    links
      .map(({ id: _id, ...link }) => ({ ...link, transformerId: reference(link.transformerId) }) as unknown as T)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    config: {
      ...rest,
      transformers: transformers.filter(transformer => transformer.type === 'custom'),
      northConnectors: rest.northConnectors.map(north => ({
        ...north,
        settings: { ...north.settings, transformers: normalizeLinks(north.settings.transformers) }
      })),
      historyQueries: rest.historyQueries.map(historyQuery => ({
        ...historyQuery,
        settings: {
          ...historyQuery.settings,
          northTransformers: normalizeLinks(
            historyQuery.settings.northTransformers.map(link => ({
              ...link,
              items: link.items.map(item => ({ id: item.id, name: item.name, enabled: item.enabled }))
            }))
          )
        }
      }))
    },
    standardTransformers
  };
}
