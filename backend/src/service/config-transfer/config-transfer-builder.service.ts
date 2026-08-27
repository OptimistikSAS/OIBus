import { getOIBusInfo } from '../utils';
import EncryptionService from '../encryption.service';
import {
  OIAnalyticsCertificateCommandDTO,
  OIAnalyticsEngineCommandDTO,
  OIAnalyticsIPFilterCommandDTO,
  OIAnalyticsNorthCommandDTO,
  OIAnalyticsRegistrationCommandDTO,
  OIAnalyticsScanModeCommandDTO,
  OIAnalyticsSouthCommandDTO,
  OIAnalyticsTransformerCommandDTO,
  OIAnalyticsUserCommandDTO,
  OIBusFullConfigurationCommandDTO,
  OIBusHistoryQueriesCommandDTO
} from '../oia/oianalytics.model';
import EngineRepository from '../../repository/config/engine.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import { southManifestList } from '../south-manifests';
import { northManifestList } from '../north-manifests';
import IpFilterRepository from '../../repository/config/ip-filter.repository';
import CertificateRepository from '../../repository/config/certificate.repository';
import UserRepository from '../../repository/config/user.repository';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';
import HistoryQueryRepository from '../../repository/config/history-query.repository';
import TransformerRepository from '../../repository/config/transformer.repository';
import { getStandardManifest } from '../transformer.service';
import { OIBusObjectAttribute } from '../../../shared/model/form.model';
import { HistoryQueryCommandDTO } from '../../../shared/model/history-query.model';
import { Language } from '../../../shared/model/types';

/**
 * The shape `NorthConnectorEntity['caching']` and `HistoryQueryEntity['caching']` both share —
 * used by `buildCachingCommand` so the north-connector and history-query builders don't each hand-map
 * the same four fields out of a `caching` entity.
 */
interface CachingEntity {
  trigger: { scanMode: { id: string }; numberOfElements: number; numberOfFiles: number };
  throttling: { runMinDelay: number; maxSize: number; maxNumberOfElements: number };
  error: { retryInterval: number; retryCount: number; retentionDuration: number };
  archive: { enabled: boolean; retentionDuration: number };
}

/**
 * Builds the full-configuration and history-queries DTOs used both by the OIAnalytics sync
 * message service and by the config export/import feature. This service has no OIAnalytics
 * connectivity of its own — it only reads from the local repositories.
 */
export default class ConfigTransferBuilderService {
  constructor(
    private engineRepository: EngineRepository,
    private scanModeRepository: ScanModeRepository,
    private ipFilterRepository: IpFilterRepository,
    private certificateRepository: CertificateRepository,
    private userRepository: UserRepository,
    private southRepository: SouthConnectorRepository,
    private northRepository: NorthConnectorRepository,
    private historyQueryRepository: HistoryQueryRepository,
    private transformerRepository: TransformerRepository,
    private encryptionService: EncryptionService,
    private readonly ignoreIpFilters: boolean,
    private readonly ignoreRemoteUpdate: boolean
  ) {}

  buildFullConfiguration(registration: OIAnalyticsRegistration): OIBusFullConfigurationCommandDTO {
    return {
      engine: this.createEngineCommand(),
      registration: this.createRegistrationCommand(registration),
      scanModes: this.createScanModesCommand(),
      ipFilters: this.createIPFiltersCommand(),
      certificates: this.createCertificatesCommand(),
      southConnectors: this.createSouthConnectorsCommand(),
      northConnectors: this.createNorthConnectorsCommand(),
      users: this.createUsersCommand(),
      transformers: this.createTransformersCommand()
    };
  }

  buildHistoryQueriesConfiguration(): OIBusHistoryQueriesCommandDTO {
    const historyQueries = this.historyQueryRepository.findAllHistoriesFull();
    return {
      historyQueries: historyQueries.map(historyQuery => {
        const southManifest = southManifestList.find(manifest => manifest.id === historyQuery.southType)!;
        const itemSettingsManifest = southManifest.items.rootAttribute.attributes.find(
          attribute => attribute.key === 'settings'
        )! as OIBusObjectAttribute;
        const northManifest = northManifestList.find(manifest => manifest.id === historyQuery.northType)!;
        const result = {
          oIBusInternalId: historyQuery.id,
          oIBusCreatedBy: historyQuery.createdBy,
          oIBusUpdatedBy: historyQuery.updatedBy,
          oIBusCreatedAt: historyQuery.createdAt,
          oIBusUpdatedAt: historyQuery.updatedAt,
          settings: {
            name: historyQuery.name,
            description: historyQuery.description,
            status: historyQuery.status,
            southType: historyQuery.southType,
            southSettings: this.encryptionService.filterSecrets(historyQuery.southSettings, southManifest.settings),
            queryTimeRange: {
              startTime: historyQuery.queryTimeRange.startTime,
              endTime: historyQuery.queryTimeRange.endTime,
              maxReadInterval: historyQuery.queryTimeRange.maxReadInterval,
              readDelay: historyQuery.queryTimeRange.readDelay
            },
            northType: historyQuery.northType,
            northSettings: this.encryptionService.filterSecrets(historyQuery.northSettings, northManifest.settings),
            caching: this.buildCachingCommand(historyQuery.caching),
            items: historyQuery.items.map(item => ({
              id: item.id,
              oIBusCreatedBy: item.createdBy,
              oIBusUpdatedBy: item.updatedBy,
              oIBusCreatedAt: item.createdAt,
              oIBusUpdatedAt: item.updatedAt,
              name: item.name,
              enabled: item.enabled,
              settings: this.encryptionService.filterSecrets(item.settings, itemSettingsManifest)
            })),
            northTransformers: historyQuery.northTransformers.map(transformerWithOptions => ({
              id: transformerWithOptions.id,
              transformerId: transformerWithOptions.transformer.id,
              options: transformerWithOptions.options,
              items: transformerWithOptions.items
            }))
          }
        };
        // Type assertion is safe because we know the southType and northType match the settings at runtime
        return result as {
          oIBusInternalId: string;
          oIBusCreatedBy: string;
          oIBusUpdatedBy: string;
          oIBusCreatedAt: string;
          oIBusUpdatedAt: string;
          settings: HistoryQueryCommandDTO;
        };
      })
    };
  }

  private createEngineCommand(): OIAnalyticsEngineCommandDTO {
    const engine = this.engineRepository.get()!;
    const info = getOIBusInfo(engine, this.ignoreIpFilters, this.ignoreRemoteUpdate);
    return {
      oIBusInternalId: engine.id,
      oIBusCreatedBy: engine.createdBy,
      oIBusUpdatedBy: engine.updatedBy,
      oIBusCreatedAt: engine.createdAt,
      oIBusUpdatedAt: engine.updatedAt,
      name: engine.general.name,
      softwareVersion: engine.version,
      launcherVersion: engine.launcherVersion,
      architecture: info.architecture,
      operatingSystem: info.operatingSystem,
      dataFolder: info.dataDirectory,
      binaryFolder: info.binaryDirectory,
      ignoreIpFilters: info.ignoreIpFilters,
      ignoreRemoteUpdate: info.ignoreRemoteUpdate,
      settings: {
        auditRetentionDuration: engine.auditRetentionDuration,
        general: {
          name: engine.general.name
        },
        webServer: {
          port: engine.webServer.port,
          authTokenDuration: engine.webServer.authTokenDuration
        },
        proxyServer: {
          enabled: engine.proxyServer.enabled,
          port: engine.proxyServer.port,
          username: engine.proxyServer.username,
          password: null,
          forward: {
            enabled: engine.proxyServer.forward.enabled,
            url: engine.proxyServer.forward.url,
            username: engine.proxyServer.forward.username,
            password: null
          }
        },
        logger: {
          auditRetentionDuration: engine.auditRetentionDuration,
          console: {
            level: engine.logger.console.level
          },
          file: {
            level: engine.logger.file.level,
            maxFileSize: engine.logger.file.maxFileSize,
            numberOfFiles: engine.logger.file.numberOfFiles
          },
          database: {
            level: engine.logger.database.level,
            maxNumberOfLogs: engine.logger.database.maxNumberOfLogs
          },
          loki: {
            level: engine.logger.loki.level,
            interval: engine.logger.loki.interval,
            address: engine.logger.loki.address,
            username: engine.logger.loki.username,
            password: ''
          },
          oia: {
            level: engine.logger.oia.level,
            interval: engine.logger.oia.interval
          },
          syslog: {
            level: engine.logger.syslog.level,
            host: engine.logger.syslog.host,
            port: engine.logger.syslog.port,
            protocol: engine.logger.syslog.protocol
          }
        }
      }
    };
  }

  private createRegistrationCommand(registration: OIAnalyticsRegistration): OIAnalyticsRegistrationCommandDTO {
    return {
      oIBusInternalId: registration.id,
      oIBusCreatedBy: registration.createdBy,
      oIBusUpdatedBy: registration.updatedBy,
      oIBusCreatedAt: registration.createdAt,
      oIBusUpdatedAt: registration.updatedAt,
      publicKey: registration.publicCipherKey || '',
      settings: {
        commandRefreshInterval: registration.commandRefreshInterval,
        commandRetryInterval: registration.commandRetryInterval,
        messageRetryInterval: registration.messageRetryInterval,
        commandPermissions: registration.commandPermissions
      }
    };
  }

  private createScanModesCommand(): Array<OIAnalyticsScanModeCommandDTO> {
    const scanModes = this.scanModeRepository.findAll();
    return scanModes.map(scanMode => ({
      oIBusInternalId: scanMode.id,
      oIBusCreatedBy: scanMode.createdBy,
      oIBusUpdatedBy: scanMode.updatedBy,
      oIBusCreatedAt: scanMode.createdAt,
      oIBusUpdatedAt: scanMode.updatedAt,
      settings: {
        name: scanMode.name,
        description: scanMode.description,
        type: scanMode.type,
        cron: scanMode.cron,
        interval: scanMode.interval,
        activationWindow: scanMode.activationWindow
      }
    }));
  }

  private createIPFiltersCommand(): Array<OIAnalyticsIPFilterCommandDTO> {
    const ipFilters = this.ipFilterRepository.list();
    return ipFilters.map(ipFilter => ({
      oIBusInternalId: ipFilter.id,
      oIBusCreatedBy: ipFilter.createdBy,
      oIBusUpdatedBy: ipFilter.updatedBy,
      oIBusCreatedAt: ipFilter.createdAt,
      oIBusUpdatedAt: ipFilter.updatedAt,
      settings: {
        description: ipFilter.description,
        address: ipFilter.address
      }
    }));
  }

  private createCertificatesCommand(): Array<OIAnalyticsCertificateCommandDTO> {
    const certificates = this.certificateRepository.list();
    return certificates.map(certificate => ({
      oIBusInternalId: certificate.id,
      oIBusCreatedBy: certificate.createdBy,
      oIBusUpdatedBy: certificate.updatedBy,
      oIBusCreatedAt: certificate.createdAt,
      oIBusUpdatedAt: certificate.updatedAt,
      settings: {
        name: certificate.name,
        description: certificate.description,
        publicKey: certificate.publicKey,
        certificate: certificate.certificate,
        certificateChain: certificate.certificateChain,
        expiry: certificate.expiry
      }
    }));
  }

  private createUsersCommand(): Array<OIAnalyticsUserCommandDTO> {
    const users = this.userRepository.list();
    return users.map(user => ({
      oIBusInternalId: user.id,
      oIBusCreatedBy: user.createdBy,
      oIBusUpdatedBy: user.updatedBy,
      oIBusCreatedAt: user.createdAt,
      oIBusUpdatedAt: user.updatedAt,
      settings: {
        login: user.login,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        language: user.language as Language,
        timezone: user.timezone
      }
    }));
  }

  /** Shared by `buildHistoryQueriesConfiguration` and `createNorthConnectorsCommand` — see `CachingEntity`. */
  private buildCachingCommand(caching: CachingEntity): {
    trigger: { scanModeId: string; scanModeName: null; numberOfElements: number; numberOfFiles: number };
    throttling: { runMinDelay: number; maxSize: number; maxNumberOfElements: number };
    error: { retryInterval: number; retryCount: number; retentionDuration: number };
    archive: { enabled: boolean; retentionDuration: number };
  } {
    return {
      trigger: {
        scanModeId: caching.trigger.scanMode.id,
        scanModeName: null,
        numberOfElements: caching.trigger.numberOfElements,
        numberOfFiles: caching.trigger.numberOfFiles
      },
      throttling: { ...caching.throttling },
      error: { ...caching.error },
      archive: { ...caching.archive }
    };
  }

  private createSouthConnectorsCommand(): Array<OIAnalyticsSouthCommandDTO> {
    // `findAllSouthFull` fetches every connector's base row in one query instead of a light list
    // re-hydrated one `findSouthById` round-trip per connector (mirrors `createNorthConnectorsCommand`
    // below).
    const souths = this.southRepository.findAllSouthFull();
    return souths.map(south => {
      const manifest = southManifestList.find(manifest => manifest.id === south.type)!;
      const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
        attribute => attribute.key === 'settings'
      )! as OIBusObjectAttribute;
      const result = {
        oIBusInternalId: south.id,
        oIBusCreatedBy: south.createdBy,
        oIBusUpdatedBy: south.updatedBy,
        oIBusCreatedAt: south.createdAt,
        oIBusUpdatedAt: south.updatedAt,
        type: south.type,
        settings: {
          type: south.type,
          name: south.name,
          description: south.description,
          enabled: south.enabled,
          settings: this.encryptionService.filterSecrets(south.settings, manifest.settings),
          items: south.items.map(item => ({
            id: item.id,
            oIBusCreatedBy: item.createdBy,
            oIBusUpdatedBy: item.updatedBy,
            oIBusCreatedAt: item.createdAt,
            oIBusUpdatedAt: item.updatedAt,
            name: item.name,
            enabled: item.enabled,
            scanModeId: item.scanMode?.id || null,
            scanModeName: null,
            groupId: item.group?.id || null,
            groupName: null,
            settings: this.encryptionService.filterSecrets(item.settings, itemSettingsManifest),
            syncWithGroup: item.syncWithGroup,
            maxReadInterval: item.maxReadInterval,
            readDelay: item.readDelay,
            startTimeOffset: item.startTimeOffset,
            endTimeOffset: item.endTimeOffset,
            recoveryStrategy: item.recoveryStrategy
          })),
          groups: south.groups.map(group => ({
            id: group.id,
            standardSettings: {
              name: group.name,
              scanModeId: group.scanMode.id
            },
            historySettings: {
              startTimeOffset: group.startTimeOffset,
              endTimeOffset: group.endTimeOffset,
              maxReadInterval: group.maxReadInterval,
              readDelay: group.readDelay,
              recoveryStrategy: group.recoveryStrategy
            }
          }))
        }
      };
      // Type assertion is safe because we know the type field matches the settings and items at runtime
      return result as OIAnalyticsSouthCommandDTO;
    });
  }

  private createNorthConnectorsCommand(): Array<OIAnalyticsNorthCommandDTO> {
    // `findAllNorthFull` fetches every column (including caching/transformers) in the same query
    // instead of a light list re-hydrated one `findNorthById` round-trip per connector.
    const norths = this.northRepository.findAllNorthFull();
    return norths.map(north => {
      const manifest = northManifestList.find(manifest => manifest.id === north.type)!;
      const result = {
        oIBusInternalId: north.id,
        oIBusCreatedBy: north.createdBy,
        oIBusUpdatedBy: north.updatedBy,
        oIBusCreatedAt: north.createdAt,
        oIBusUpdatedAt: north.updatedAt,
        type: north.type,
        settings: {
          type: north.type,
          name: north.name,
          description: north.description,
          enabled: north.enabled,
          settings: this.encryptionService.filterSecrets(north.settings, manifest.settings),
          caching: this.buildCachingCommand(north.caching),
          transformers: north.transformers.map(transformerWithOptions => ({
            id: transformerWithOptions.id,
            transformerId: transformerWithOptions.transformer.id,
            source: {
              type: transformerWithOptions.source.type,
              southId: transformerWithOptions.source.type === 'south' ? transformerWithOptions.source.south.id : undefined,
              groupId:
                transformerWithOptions.source.type === 'south' && transformerWithOptions.source.group
                  ? transformerWithOptions.source.group.id
                  : undefined,
              items:
                transformerWithOptions.source.type === 'south'
                  ? transformerWithOptions.source.items.map(item => ({ id: item.id, name: item.name, enabled: item.enabled }))
                  : undefined,
              dataSourceId: transformerWithOptions.source.type === 'oibus-api' ? transformerWithOptions.source.dataSourceId : undefined
            },
            options: transformerWithOptions.options
          }))
        }
      };
      // Type assertion is safe because we know the type field matches the settings at runtime
      return result as unknown as OIAnalyticsNorthCommandDTO;
    });
  }

  private createTransformersCommand(): Array<OIAnalyticsTransformerCommandDTO> {
    const transformers = this.transformerRepository.list();
    return transformers.map(transformer => {
      if (transformer.type === 'standard') {
        return {
          oIBusInternalId: transformer.id,
          type: transformer.type,
          settings: {
            functionName: transformer.functionName,
            inputType: transformer.inputType,
            outputType: transformer.outputType
          },
          manifest: getStandardManifest(transformer.functionName)
        };
      } else {
        return {
          oIBusInternalId: transformer.id,
          oIBusCreatedBy: transformer.createdBy,
          oIBusUpdatedBy: transformer.updatedBy,
          oIBusCreatedAt: transformer.createdAt,
          oIBusUpdatedAt: transformer.updatedAt,
          type: transformer.type,
          settings: {
            name: transformer.name,
            description: transformer.description,
            inputType: transformer.inputType,
            language: transformer.language,
            timeout: transformer.timeout,
            outputType: transformer.outputType,
            customCode: transformer.customCode
          },
          manifest: transformer.customManifest
        };
      }
    });
  }
}
