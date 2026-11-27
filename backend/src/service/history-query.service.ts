import { DateTime } from 'luxon';

import {
  HistoryQueryCommandDTO,
  HistoryQueryCommonDTO,
  HistoryQueryItemCommandDTO,
  HistoryQueryItemDTO,
  HistoryQueryLightDTO,
  HistoryQueryNorthTypedDTO,
  HistoryQuerySouthTypedDTO
} from '../../shared/model/api/history-query.model';
import { SouthConnectorItemTestResult, SouthExploreStartResult } from '../../shared/model/api/south-connector.model';
import { BaseEntity, GetUserInfo, Page } from '../../shared/model/common/types';
import { OIBusObjectAttribute } from '../../shared/model/connector/form.model';
import { NorthConnectorManifest, OIBusNorthType } from '../../shared/model/connector/north-manifest.model';
import { NorthSettings } from '../../shared/model/connector/north-settings.model';
import { OIBusSouthType, SouthConnectorManifest } from '../../shared/model/connector/south-manifest.model';
import { SouthItemSettings, SouthSettings } from '../../shared/model/connector/south-settings.model';
import { HistoryQueryMetrics, OIBusConnectionTestResult } from '../../shared/model/domain/engine.model';
import { HistoryQueryItemSearchParam } from '../../shared/model/domain/history-query.model';
import {
  PresentedServerIdentity,
  ServerTrust,
  ServerTrustState,
  X509ServerIdentityDetails
} from '../../shared/model/domain/server-identity.model';
import { SouthConnectorItemTestingSettings } from '../../shared/model/domain/south-connector.model';

import type DataStreamEngine from '../engine/data-stream-engine';
import { HistoryQueryEntity, HistoryQueryEntityLight, HistoryQueryItemEntity } from '../model/histor-query.model';
import { ScanMode } from '../model/scan-mode.model';
import { SouthConnectorItemEntityLight } from '../model/south-connector.model';
import { HistoryTransformerWithOptions } from '../model/transformer.model';
import { NotFoundError, OIBusValidationError } from '../model/types';
import HistoryQueryRepository from '../repository/config/history-query.repository';
import NorthConnectorRepository from '../repository/config/north-connector.repository';
import ScanModeRepository from '../repository/config/scan-mode.repository';
import SouthConnectorRepository from '../repository/config/south-connector.repository';
import LogRepository from '../repository/logs/log.repository';
import HistoryQueryMetricsRepository from '../repository/metrics/history-query-metrics.repository';
import JoiValidator from '../web-server/controllers/validators/joi.validator';
import { encryptionService } from './encryption.service';
import { toHistoryQueryItemDTO } from './history-query-item-dto.utils';
import type NorthService from './north.service';
import { northManifestList } from './north-manifests';
import type OIAnalyticsMessageService from './oia/oianalytics-message.service';
import { toScanModeDTO } from './scan-mode-dto.utils';
import {
  getCertificateStoreTrustSettings,
  retrievePresentedServerIdentity,
  retrieveServerIdentityToTrust,
  toCertificateStoreServerTrust,
  toServerTrust,
  toServerTrustDTO,
  trustFormCertificateInStore
} from './server-trust.utils';
import type SouthService from './south.service';
import { southManifestList } from './south-manifests';
import type TransformerService from './transformer.service';
import { toTransformerDTO } from './transformer.service';
import { checkScanMode, parseCsvImport, stringToBoolean } from './utils';
import { NO_SERVER_TRUST, toTrustedServerIdentity } from './utils-server-identity';

export default class HistoryQueryService {
  constructor(
    private readonly validator: JoiValidator,
    private readonly historyQueryRepository: HistoryQueryRepository,
    private readonly northConnectorRepository: NorthConnectorRepository,
    private readonly southConnectorRepository: SouthConnectorRepository,
    private readonly scanModeRepository: ScanModeRepository,
    private readonly logRepository: LogRepository,
    private readonly historyQueryMetricsRepository: HistoryQueryMetricsRepository,
    private readonly southService: SouthService,
    private readonly northService: NorthService,
    private readonly transformerService: TransformerService,
    private readonly oIAnalyticsMessageService: OIAnalyticsMessageService,
    private readonly engine: DataStreamEngine
  ) {}

  list(): Array<HistoryQueryEntityLight> {
    return this.historyQueryRepository.findAllHistoriesLight();
  }

  findById(historyId: string): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> {
    const historyQuery = this.historyQueryRepository.findHistoryById(historyId);
    if (!historyQuery) {
      throw new NotFoundError(`History query "${historyId}" not found`);
    }
    return historyQuery;
  }

  async create(
    command: HistoryQueryCommandDTO,
    retrieveSecretsFromSouth: string | undefined,
    retrieveSecretsFromNorth: string | undefined,
    retrieveSecretsFromHistoryQuery: string | undefined,
    createdBy: string
  ): Promise<HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>> {
    const northManifest = this.northService.getManifest(command.northType);
    const southManifest = this.southService.getManifest(command.southType);
    await this.validator.validateSettings(northManifest.settings, command.northSettings);
    await this.validator.validateSettings(southManifest.settings, command.southSettings);

    // Check for unique name
    const existingHistoryQueries = this.historyQueryRepository.findAllHistoriesLight();
    if (existingHistoryQueries.some(hq => hq.name === command.name)) {
      throw new OIBusValidationError(`History query name "${command.name}" already exists`);
    }
    // Check if item settings match the item schema, throw an error otherwise
    const itemSettingsManifest = southManifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    for (const item of command.items) {
      await this.validator.validateSettings(itemSettingsManifest, item.settings);
    }

    const historyQuery = {} as HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>;
    copyHistoryQueryCommandToHistoryQueryEntity(
      historyQuery,
      command,
      this.retrieveSecrets(
        retrieveSecretsFromSouth,
        retrieveSecretsFromNorth,
        retrieveSecretsFromHistoryQuery,
        southManifest,
        northManifest
      ),
      this.scanModeRepository.findAll(),
      createdBy
    );
    // A new history query, even copied from another one or from connectors, only trusts the identity its command sends: the one copied may not be the
    // identity of the server of the copy
    historyQuery.southServerTrust = toServerTrust(command.southServerTrust, null, createdBy);
    historyQuery.northServerTrust = toServerTrust(command.northServerTrust, null, createdBy);
    historyQuery.createdBy = createdBy;
    historyQuery.updatedBy = createdBy;
    for (const item of historyQuery.items) {
      item.createdBy = createdBy;
      item.updatedBy = createdBy;
    }
    const transformers = this.transformerService.findAll();
    const historyItems = new Map(historyQuery.items.map(item => [item.id, item]));
    historyQuery.northTransformers = command.northTransformers.map(transformerWithOptions => {
      const foundTransformer = transformers.find(transformer => transformer.id === transformerWithOptions.transformerId);
      if (!foundTransformer) {
        throw new Error(`Could not find OIBus transformer "${transformerWithOptions.transformerId}"`);
      }
      const items: Array<SouthConnectorItemEntityLight> = transformerWithOptions.items.map(itemLight => {
        if (itemLight.id.startsWith('temp_')) {
          return {
            id: itemLight.id,
            name: itemLight.name,
            enabled: itemLight.enabled,
            createdBy: createdBy,
            updatedBy: createdBy,
            createdAt: '',
            updatedAt: ''
          };
        }
        const item = historyItems.get(itemLight.id);
        if (!item) {
          throw new NotFoundError(`Could not find History item "${itemLight.name}" (${itemLight.id})`);
        }
        return {
          id: item.id,
          name: item.name,
          enabled: item.enabled,
          createdBy: item.createdBy,
          updatedBy: item.updatedBy,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        };
      });

      return {
        id: '',
        transformer: foundTransformer,
        options: transformerWithOptions.options,
        items: items
      };
    });

    await this.southService.saveTrustingServerCertificates(createdBy, trustCertificate => {
      this.trustFormCertificates(historyQuery, command, trustCertificate);
      this.historyQueryRepository.saveHistory(historyQuery, true);
    });
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();

    await this.engine.createHistoryQuery(historyQuery.id);
    return historyQuery;
  }

  async update(historyId: string, command: HistoryQueryCommandDTO, resetCache: boolean, updatedBy: string): Promise<void> {
    const previousSettings = this.findById(historyId);
    const northManifest = this.northService.getManifest(command.northType);
    const southManifest = this.southService.getManifest(command.southType);
    await this.validator.validateSettings(northManifest.settings, command.northSettings);
    await this.validator.validateSettings(southManifest.settings, command.southSettings);

    // Check for unique name (excluding current entity)
    if (command.name !== previousSettings.name) {
      const existingHistoryQueries = this.historyQueryRepository.findAllHistoriesLight();
      if (existingHistoryQueries.some(hq => hq.id !== historyId && hq.name === command.name)) {
        throw new OIBusValidationError(`History query name "${command.name}" already exists`);
      }
    }
    // Check if item settings match the item schema, throw an error otherwise
    const itemSettingsManifest = southManifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    for (const item of command.items) {
      await this.validator.validateSettings(itemSettingsManifest, item.settings);
    }

    const historyQuery = { id: previousSettings.id } as HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>;
    copyHistoryQueryCommandToHistoryQueryEntity(historyQuery, command, previousSettings, this.scanModeRepository.findAll(), updatedBy);
    historyQuery.createdBy = previousSettings.createdBy;
    historyQuery.updatedBy = updatedBy;
    for (const item of historyQuery.items) {
      if (!item.id) {
        item.createdBy = updatedBy;
      }
      item.updatedBy = updatedBy;
    }
    const transformers = this.transformerService.findAll();
    const historyItems = new Map(historyQuery.items.map(item => [item.id, item]));
    historyQuery.northTransformers = command.northTransformers.map(transformerWithOptions => {
      const foundTransformer = transformers.find(transformer => transformer.id === transformerWithOptions.transformerId);
      if (!foundTransformer) {
        throw new NotFoundError(`Could not find OIBus transformer "${transformerWithOptions.transformerId}"`);
      }

      const items: Array<SouthConnectorItemEntityLight> = transformerWithOptions.items.map(itemLight => {
        if (itemLight.id.startsWith('temp_')) {
          return {
            id: itemLight.id,
            name: itemLight.name,
            enabled: itemLight.enabled,
            createdBy: updatedBy,
            updatedBy: updatedBy,
            createdAt: '',
            updatedAt: ''
          };
        }

        const item = historyItems.get(itemLight.id);
        if (!item) {
          throw new NotFoundError(`Could not find History item "${itemLight.name}" (${itemLight.id})`);
        }
        return {
          id: item.id,
          name: item.name,
          enabled: item.enabled,
          createdBy: item.createdBy,
          updatedBy: item.updatedBy,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        };
      });

      return {
        id: transformerWithOptions.id,
        transformer: foundTransformer,
        options: transformerWithOptions.options,
        items
      };
    });

    await this.southService.saveTrustingServerCertificates(updatedBy, trustCertificate => {
      this.trustFormCertificates(historyQuery, command, trustCertificate);
      this.historyQueryRepository.saveHistory(historyQuery, false);
    });
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, resetCache);
  }

  async delete(historyId: string, deletedBy: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    await this.engine.deleteHistoryQuery(historyQuery);
    this.historyQueryRepository.deleteHistory(historyQuery.id, deletedBy);
    this.logRepository.deleteLogsByScopeId('history-query', historyQuery.id);
    this.historyQueryMetricsRepository.removeMetrics(historyQuery.id);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();

    this.engine.logger.info(`Deleted History query "${historyQuery.name}" (${historyQuery.id})`);
  }

  async start(historyId: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    this.historyQueryRepository.updateHistoryStatus(historyId, 'RUNNING');
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, historyQuery.status === 'FINISHED' || historyQuery.status === 'ERRORED');
  }

  async pause(historyId: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    this.historyQueryRepository.updateHistoryStatus(historyId, 'PAUSED');
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.stopHistoryQuery(historyQuery.id);
  }

  getHistoryMetric(historyId: string): HistoryQueryMetrics {
    return this.engine.getHistoryMetrics(historyId);
  }

  async testNorth(
    historyId: string,
    northType: OIBusNorthType,
    retrieveSecretsFromNorth: string | undefined,
    settingsToTest: NorthSettings,
    trustedFingerprint: string | null = null,
    // Whether the caller shows the identity of a server not trusted (otherwise, the test fails)
    withServerIdentity = false
  ): Promise<OIBusConnectionTestResult> {
    const { settings, serverTrust } = await this.northToTest(historyId, northType, retrieveSecretsFromNorth, settingsToTest);
    return await this.northService.testNorth('history', northType, settings, trustedFingerprint, serverTrust, withServerIdentity);
  }

  /** The identity the server of the North side presents with these settings, see `NorthService.retrieveServerIdentity`. */
  async retrieveNorthServerIdentity(
    historyId: string,
    northType: OIBusNorthType,
    retrieveSecretsFromNorth: string | undefined,
    settingsToTest: NorthSettings,
    trustedFingerprint: string | null = null
  ): Promise<PresentedServerIdentity | null> {
    const { settings, serverTrust } = await this.northToTest(historyId, northType, retrieveSecretsFromNorth, settingsToTest);
    return await this.northService.retrieveServerIdentity('history', northType, settings, trustedFingerprint, serverTrust);
  }

  /**
   * The north settings as edited, validated, with the secrets left blank taken from the history query - or, for a history
   * query being created, from the north connector it is created from - and the trust in the identity of their server.
   */
  private async northToTest(
    historyId: string,
    northType: OIBusNorthType,
    retrieveSecretsFromNorth: string | undefined,
    settingsToTest: NorthSettings
  ): Promise<{ settings: NorthSettings; serverTrust: ServerTrust }> {
    let northSettings: NorthSettings | null = null;
    let northServerTrust: ServerTrust | null = null;
    if (historyId !== 'create') {
      const historyQuery = this.findById(historyId);
      northSettings = historyQuery.northSettings;
      northServerTrust = historyQuery.northServerTrust;
    } else if (retrieveSecretsFromNorth) {
      const north = this.northService.findById(retrieveSecretsFromNorth);
      northSettings = north.settings;
      northServerTrust = north.serverTrust;
    }
    const northManifest = this.northService.getManifest(northType);
    await this.validator.validateSettings(northManifest.settings, settingsToTest);
    return {
      settings: encryptionService.decryptConnectorSecrets(
        encryptionService.encryptConnectorSecrets(settingsToTest, northSettings, northManifest.settings),
        northManifest.settings
      ),
      serverTrust: northServerTrust ?? NO_SERVER_TRUST
    };
  }

  async testSouth(
    historyId: string,
    southType: OIBusSouthType,
    retrieveSecretsFromSouth: string | undefined,
    settingsToTest: SouthSettings,
    trustedFingerprint: string | null = null,
    // Whether the caller shows the identity of a server not trusted (otherwise, the test fails)
    withServerIdentity = false
  ): Promise<OIBusConnectionTestResult> {
    return await this.southService.testSouth(
      'history',
      southType,
      await this.southSettingsToTest(historyId, southType, retrieveSecretsFromSouth, settingsToTest),
      trustedFingerprint,
      this.southServerTrust(historyId, retrieveSecretsFromSouth),
      withServerIdentity
    );
  }

  /** The identity the server of the South side presents with these settings, see `SouthService.retrieveServerIdentity`. */
  async retrieveSouthServerIdentity(
    historyId: string,
    southType: OIBusSouthType,
    retrieveSecretsFromSouth: string | undefined,
    settingsToTest: SouthSettings,
    trustedFingerprint: string | null = null
  ): Promise<PresentedServerIdentity | null> {
    return await this.southService.retrieveServerIdentity(
      'history',
      southType,
      await this.southSettingsToTest(historyId, southType, retrieveSecretsFromSouth, settingsToTest),
      trustedFingerprint,
      this.southServerTrust(historyId, retrieveSecretsFromSouth)
    );
  }

  async startExplore(
    historyId: string,
    southType: OIBusSouthType,
    retrieveSecretsFromSouth: string | undefined,
    settingsToTest: SouthSettings,
    trustedFingerprint: string | null = null
  ): Promise<SouthExploreStartResult> {
    return await this.southService.startExplore(
      'history',
      southType,
      await this.southSettingsToTest(historyId, southType, retrieveSecretsFromSouth, settingsToTest),
      trustedFingerprint,
      this.southServerTrust(historyId, retrieveSecretsFromSouth)
    );
  }

  /**
   * The trust of the South side of the history query in the identity of its server - or, for a history query being
   * created, of the south connector it is created from.
   */
  southServerTrust(historyId: string, retrieveSecretsFromSouth: string | undefined): ServerTrust {
    if (historyId !== 'create') {
      return this.findById(historyId).southServerTrust;
    }
    return retrieveSecretsFromSouth ? this.southService.findById(retrieveSecretsFromSouth).serverTrust : NO_SERVER_TRUST;
  }

  /**
   * The trust of a side of the history query in the identity of its server, with the identity it refused at its last
   * connection (pending, until a user trusts it).
   */
  getServerTrustState(historyId: string, side: 'south' | 'north'): ServerTrustState {
    const historyQuery = this.findById(historyId);
    let pending = null;
    try {
      pending = this.engine.getHistoryQuery(historyId).historyQuery.getServerIdentityVerifier(side).pendingIdentity;
    } catch {
      // Not in the engine
    }
    const serverTrust = side === 'south' ? historyQuery.southServerTrust : historyQuery.northServerTrust;
    if (this.trustsCertificateStore(historyQuery, side)) {
      return {
        ...toCertificateStoreServerTrust(this.getCertificateStoreTrustSettings(historyQuery, side), serverTrust, id =>
          this.southService.findCertificate(id)
        ),
        pending
      };
    }
    return { ...serverTrust, pending };
  }

  /** Whether the connector of a side trusts a certificate of the store (see `serverTrustInCertificateStore`) */
  private trustsCertificateStore(historyQuery: { southType: string; northType: string }, side: 'south' | 'north'): boolean {
    return !!this.getSideManifest(historyQuery, side).serverTrustInCertificateStore;
  }

  private getSideManifest(historyQuery: { southType: string; northType: string }, side: 'south' | 'north') {
    return side === 'south'
      ? this.southService.getManifest(historyQuery.southType as OIBusSouthType)
      : this.northService.getManifest(historyQuery.northType);
  }

  /** Where the connector of a side selects the certificate it trusts (see `getCertificateStoreTrustSettings`) */
  private getCertificateStoreTrustSettings(
    historyQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>,
    side: 'south' | 'north'
  ): Record<string, unknown> | null {
    return getCertificateStoreTrustSettings(
      this.getSideManifest(historyQuery, side),
      side === 'south' ? historyQuery.southSettings : historyQuery.northSettings
    );
  }

  /** The trust of the sides of a history query saved with identities trusted in its form (see `trustFormCertificateInStore`) */
  private trustFormCertificates(
    historyQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>,
    command: HistoryQueryCommandDTO,
    trustServerCertificate: (certificatePem: string, name: string) => { id: string }
  ): void {
    const trustCertificate = (side: 'South' | 'North') => (certificatePem: string) =>
      trustServerCertificate(certificatePem, `${historyQuery.name} ${side} server`);
    historyQuery.southServerTrust = trustFormCertificateInStore(
      this.getCertificateStoreTrustSettings(historyQuery, 'south'),
      historyQuery.southServerTrust,
      command.southServerTrust,
      this.trustsCertificateStore(historyQuery, 'south'),
      trustCertificate('South')
    );
    historyQuery.northServerTrust = trustFormCertificateInStore(
      this.getCertificateStoreTrustSettings(historyQuery, 'north'),
      historyQuery.northServerTrust,
      command.northServerTrust,
      this.trustsCertificateStore(historyQuery, 'north'),
      trustCertificate('North')
    );
  }

  /**
   * The identity the server of a side of the saved history query presents now, and how it compares with the identity
   * trusted, without connecting further (no credential is sent). `null` when the connector does not check it.
   */
  async retrieveSavedServerIdentity(historyId: string, side: 'south' | 'north'): Promise<PresentedServerIdentity | null> {
    const historyQuery = this.findById(historyId);
    return await retrievePresentedServerIdentity(
      this.buildThrowawayConnector(historyQuery, side),
      (side === 'south' ? historyQuery.southServerTrust : historyQuery.northServerTrust).identity
    );
  }

  /**
   * Trust the identity the server of a side of the history query presents, when its fingerprint is the one the user
   * reviewed, and restart the history query so that it connects with it.
   */
  async trustServerIdentity(historyId: string, side: 'south' | 'north', fingerprint: string, trustedBy: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    const connector = this.buildThrowawayConnector(historyQuery, side);
    const identity = await retrieveServerIdentityToTrust(connector, fingerprint);
    const certificate = (identity.details as X509ServerIdentityDetails).certificate;
    if (this.trustsCertificateStore(historyQuery, side) && certificate) {
      const trusted = this.southService.trustServerCertificate(
        certificate,
        `${historyQuery.name} ${side === 'south' ? 'South' : 'North'} server`,
        trustedBy
      );
      this.historyQueryRepository.trustCertificate(
        historyId,
        side,
        trusted.id,
        trustedBy,
        this.getSideManifest(historyQuery, side).serverTrustSettingsKey
      );
    } else {
      this.historyQueryRepository.updateServerTrust(
        historyId,
        side,
        { identity: toTrustedServerIdentity(identity, trustedBy, DateTime.now().toUTC().toISO()!), trustOnFirstUse: false },
        trustedBy
      );
    }
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    if (historyQuery.status === 'RUNNING') {
      await this.engine.reloadHistoryQuery(historyQuery, false);
    }
    this.engine.logger.info(
      `Server identity ${identity.fingerprint} trusted by "${trustedBy}" for the ${side === 'south' ? 'South' : 'North'} of History query "${historyQuery.name}" (${historyId})`
    );
  }

  /**
   * A connector of a side of the saved history query, not started, to retrieve the identity of its server.
   */
  private buildThrowawayConnector(
    historyQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>,
    side: 'south' | 'north'
  ) {
    return side === 'south'
      ? this.southService.buildThrowawaySouth({
          id: historyQuery.id,
          name: historyQuery.name,
          description: historyQuery.description,
          enabled: false,
          type: historyQuery.southType,
          settings: historyQuery.southSettings,
          serverTrust: historyQuery.southServerTrust,
          items: [],
          groups: [],
          createdBy: historyQuery.createdBy,
          updatedBy: historyQuery.updatedBy,
          createdAt: historyQuery.createdAt,
          updatedAt: historyQuery.updatedAt
        })
      : this.northService.buildThrowawayNorth({
          id: historyQuery.id,
          name: historyQuery.name,
          description: historyQuery.description,
          enabled: false,
          type: historyQuery.northType,
          settings: historyQuery.northSettings,
          serverTrust: historyQuery.northServerTrust,
          caching: historyQuery.caching,
          transformers: [],
          createdBy: historyQuery.createdBy,
          updatedBy: historyQuery.updatedBy,
          createdAt: historyQuery.createdAt,
          updatedAt: historyQuery.updatedAt
        });
  }

  /**
   * The south settings as edited, validated, with the secrets left blank taken from the history query - or, for a history
   * query being created, from the south connector it is created from - to test them against the data source.
   */
  async southSettingsToTest(
    historyId: string,
    southType: OIBusSouthType,
    retrieveSecretsFromSouth: string | undefined,
    settingsToTest: SouthSettings
  ): Promise<SouthSettings> {
    let southSettings: SouthSettings | null = null;
    if (historyId !== 'create') {
      const historyQuery = this.findById(historyId);
      southSettings = historyQuery.southSettings;
    } else if (retrieveSecretsFromSouth) {
      const south = this.southService.findById(retrieveSecretsFromSouth);
      southSettings = south.settings;
    }
    const southManifest = this.southService.getManifest(southType);
    await this.validator.validateSettings(southManifest.settings, settingsToTest);
    return encryptionService.decryptConnectorSecrets(
      encryptionService.encryptConnectorSecrets(settingsToTest, southSettings, southManifest.settings),
      southManifest.settings
    );
  }

  async testItem(
    historyId: string,
    southType: OIBusSouthType,
    itemName: string,
    retrieveSecretsFromSouth: string | undefined,
    southSettings: SouthSettings,
    itemSettings: SouthItemSettings,
    testingSettings: SouthConnectorItemTestingSettings,
    trustedFingerprint: string | null = null
  ): Promise<SouthConnectorItemTestResult> {
    let southSettingsFrom: SouthSettings | null = null;
    let historyName: string | undefined;
    if (historyId !== 'create') {
      const historyQuery = this.findById(historyId);
      southSettingsFrom = historyQuery.southSettings;
      historyName = historyQuery.name;
    } else if (retrieveSecretsFromSouth) {
      const south = this.southService.findById(retrieveSecretsFromSouth);
      southSettingsFrom = south.settings;
    }
    const southManifest = this.southService.getManifest(southType);
    await this.validator.validateSettings(southManifest.settings, southSettings);
    const itemSettingsManifest = southManifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    await this.validator.validateSettings(itemSettingsManifest, itemSettings);
    return await this.southService.testItem(
      'history',
      southType,
      itemName,
      encryptionService.decryptConnectorSecrets(
        encryptionService.encryptConnectorSecrets(southSettings, southSettingsFrom, southManifest.settings),
        southManifest.settings
      ),
      itemSettings,
      testingSettings,
      historyName,
      trustedFingerprint,
      this.southServerTrust(historyId, retrieveSecretsFromSouth)
    );
  }

  listItems(historyId: string): Array<HistoryQueryItemEntity<SouthItemSettings>> {
    return this.historyQueryRepository.findAllItemsForHistory(historyId);
  }

  searchItems(historyId: string, searchParams: HistoryQueryItemSearchParam): Page<HistoryQueryItemEntity<SouthItemSettings>> {
    return this.historyQueryRepository.searchItems(historyId, searchParams);
  }

  findItemById(historyId: string, itemId: string): HistoryQueryItemEntity<SouthItemSettings> {
    const item = this.historyQueryRepository.findItemById(historyId, itemId);
    if (!item) {
      throw new NotFoundError(`Item "${itemId}" not found`);
    }
    return item;
  }

  async createItem(
    historyId: string,
    command: HistoryQueryItemCommandDTO,
    createdBy: string
  ): Promise<HistoryQueryItemEntity<SouthItemSettings>> {
    const historyQuery = this.findById(historyId);
    const manifest = this.southService.getManifest(historyQuery.southType);
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    await this.validator.validateSettings(itemSettingsManifest, command.settings);

    const historyQueryItemEntity = {} as HistoryQueryItemEntity<SouthItemSettings>;
    copyHistoryQueryItemCommandToHistoryQueryItemEntity(historyQueryItemEntity, command, null, historyQuery.southType);
    historyQueryItemEntity.createdBy = createdBy;
    historyQueryItemEntity.updatedBy = createdBy;
    this.historyQueryRepository.saveItem(historyQuery.id, historyQueryItemEntity);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, false);
    return historyQueryItemEntity;
  }

  async updateItem(historyId: string, itemId: string, command: HistoryQueryItemCommandDTO, updatedBy: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    const existingItem = this.findItemById(historyId, itemId);
    const manifest = this.southService.getManifest(historyQuery.southType);
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    await this.validator.validateSettings(itemSettingsManifest, command.settings);

    const historyQueryItemEntity = { id: existingItem.id } as HistoryQueryItemEntity<SouthItemSettings>;
    copyHistoryQueryItemCommandToHistoryQueryItemEntity(historyQueryItemEntity, command, existingItem, historyQuery.southType);
    historyQueryItemEntity.createdBy = existingItem.createdBy;
    historyQueryItemEntity.updatedBy = updatedBy;
    this.historyQueryRepository.saveItem(historyQuery.id, historyQueryItemEntity);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, false);
  }

  async enableItem(historyId: string, itemId: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    const item = this.findItemById(historyId, itemId);
    this.historyQueryRepository.enableItem(item.id);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, false);
  }

  async disableItem(historyId: string, itemId: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    const item = this.findItemById(historyId, itemId);
    this.historyQueryRepository.disableItem(item.id);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, false);
  }

  async enableItems(historyId: string, itemIds: Array<string>): Promise<void> {
    const historyQuery = this.findById(historyId);

    for (const itemId of itemIds) {
      const item = this.findItemById(historyId, itemId);
      this.historyQueryRepository.enableItem(item.id);
    }

    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, false);
  }

  async deleteItem(historyId: string, itemId: string, deletedBy: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    const item = this.findItemById(historyId, itemId);
    this.historyQueryRepository.deleteItem(historyQuery.id, item.id, deletedBy);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, false);
  }

  async disableItems(historyId: string, itemIds: Array<string>): Promise<void> {
    const historyQuery = this.findById(historyId);
    for (const itemId of itemIds) {
      const item = this.findItemById(historyId, itemId);
      this.historyQueryRepository.disableItem(item.id);
    }
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, false);
  }

  async deleteItems(historyId: string, itemIds: Array<string>, deletedBy: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    for (const itemId of itemIds) {
      const item = this.findItemById(historyId, itemId);
      this.historyQueryRepository.deleteItem(historyQuery.id, item.id, deletedBy);
    }
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, false);
  }

  async deleteAllItems(historyId: string, deletedBy: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    this.historyQueryRepository.deleteAllItemsByHistory(historyId, deletedBy);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, true);
  }

  async checkImportItems(
    southType: string,
    fileContent: string,
    delimiter: string,
    existingItems: Array<Omit<HistoryQueryItemDTO, 'createdBy' | 'updatedBy'>>
  ): Promise<{
    items: Array<HistoryQueryItemDTO>;
    errors: Array<{ item: Record<string, string>; error: string }>;
  }> {
    const manifest = this.southService.getManifest(southType);
    const csvData = parseCsvImport(fileContent, delimiter);

    const validItems: Array<HistoryQueryItemDTO> = [];
    const errors: Array<{ item: Record<string, string>; error: string }> = [];
    for (const data of csvData) {
      const item: HistoryQueryItemDTO = {
        id: '',
        name: data.name,
        description: data.description || null,
        enabled: stringToBoolean(data.enabled),
        settings: {} as SouthItemSettings
      } as HistoryQueryItemDTO;
      if (existingItems.find(existingItem => existingItem.name === item.name)) {
        errors.push({
          item: data,
          error: `Item name "${data.name}" already used`
        });
        continue;
      }

      let hasSettingsError = false;
      const settings: Record<string, string | number | object | boolean | undefined> = {};
      const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
        attribute => attribute.key === 'settings'
      )! as OIBusObjectAttribute;
      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('settings_')) {
          const settingsKey = key.replace('settings_', '');
          const fieldManifest = itemSettingsManifest.attributes.find(settings => settings.key === settingsKey);
          if (!fieldManifest) {
            hasSettingsError = true;
            errors.push({
              item: data as Record<string, string>,
              error: `Settings "${settingsKey}" not accepted in manifest`
            });
            break;
          }
          if ((fieldManifest.type === 'array' || fieldManifest.type === 'object') && value) {
            settings[settingsKey] = JSON.parse(value);
          } else if (fieldManifest.type === 'boolean') {
            settings[settingsKey] = stringToBoolean(value);
          } else if (fieldManifest.type === 'number') {
            settings[settingsKey] = value ? Number(value) : undefined;
          } else {
            settings[settingsKey] = value;
          }
        }
      }
      if (hasSettingsError) continue;
      item.settings = settings as unknown as SouthItemSettings;

      try {
        await this.validator.validateSettings(itemSettingsManifest, item.settings);
        validItems.push(item);
      } catch (itemError: unknown) {
        errors.push({ item: data as Record<string, string>, error: (itemError as Error).message });
      }
    }
    return { items: validItems, errors };
  }

  async importItems(historyId: string, items: Array<HistoryQueryItemCommandDTO>, user: string, deleteItemsNotPresent = false) {
    const historyQuery = this.findById(historyId);
    const manifest = this.southService.getManifest(historyQuery.southType);
    const itemsToAdd: Array<HistoryQueryItemEntity<SouthItemSettings>> = [];
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    for (const itemCommand of items) {
      await this.validator.validateSettings(itemSettingsManifest, itemCommand.settings);
      const historyQueryItemEntity = {} as HistoryQueryItemEntity<SouthItemSettings>;
      copyHistoryQueryItemCommandToHistoryQueryItemEntity(historyQueryItemEntity, itemCommand, null, historyQuery.southType);
      historyQueryItemEntity.createdBy = user;
      historyQueryItemEntity.updatedBy = user;
      itemsToAdd.push(historyQueryItemEntity);
    }

    this.historyQueryRepository.saveAllItems(historyQuery.id, itemsToAdd, deleteItemsNotPresent, user);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.reloadHistoryQuery(historyQuery, false);
  }

  async addOrEditTransformer(historyId: string, transformerWithOptions: HistoryTransformerWithOptions, userId: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    this.historyQueryRepository.addOrEditTransformer(historyQuery.id, transformerWithOptions, userId);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.stopHistoryQuery(historyQuery.id);
  }

  async removeTransformer(historyId: string, historyTransformerId: string, userId: string): Promise<void> {
    const historyQuery = this.findById(historyId);
    this.historyQueryRepository.removeTransformer(historyTransformerId, userId);
    this.oIAnalyticsMessageService.createFullHistoryQueriesMessageIfNotPending();
    await this.engine.stopHistoryQuery(historyQuery.id);
  }

  retrieveSecrets(
    retrieveSecretsFromSouth: string | undefined,
    retrieveSecretsFromNorth: string | undefined,
    retrieveSecretsFromHistoryQuery: string | undefined,
    southManifest: SouthConnectorManifest,
    northManifest: NorthConnectorManifest
  ): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> | null {
    if (retrieveSecretsFromHistoryQuery) {
      const source = this.findById(retrieveSecretsFromHistoryQuery);
      if (source.southType !== southManifest.id) {
        throw new OIBusValidationError(
          `History query "${retrieveSecretsFromHistoryQuery}" (South type "${source.southType}") must be of the South type "${southManifest.id}"`
        );
      }
      if (source.northType !== northManifest.id) {
        throw new OIBusValidationError(
          `History query "${retrieveSecretsFromHistoryQuery}" (North type "${source.northType}") must be of the North type "${northManifest.id}"`
        );
      }
      return source;
    }
    if (retrieveSecretsFromSouth || retrieveSecretsFromNorth) {
      const source = { items: [] as Array<HistoryQueryItemEntity<SouthItemSettings>> } as HistoryQueryEntity<
        SouthSettings,
        NorthSettings,
        SouthItemSettings
      >;
      if (retrieveSecretsFromSouth) {
        const south = this.southService.findById(retrieveSecretsFromSouth);
        if (south.type !== southManifest.id) {
          throw new OIBusValidationError(
            `South connector "${retrieveSecretsFromSouth}" (type "${south.type}") must be of the type "${southManifest.id}"`
          );
        }
        source.southType = south.type;
        source.items = south.items;
        source.southSettings = south.settings;
        source.southServerTrust = south.serverTrust;
      }
      if (retrieveSecretsFromNorth) {
        const north = this.northService.findById(retrieveSecretsFromNorth);
        if (north.type !== northManifest.id) {
          throw new OIBusValidationError(
            `North connector "${retrieveSecretsFromNorth}" (type "${north.type}") must be of the type "${northManifest.id}"`
          );
        }
        source.northType = north.type;
        source.northSettings = north.settings;
        source.northServerTrust = north.serverTrust;
      }
      return source;
    }
    return null;
  }
}

const copyHistoryQueryCommandToHistoryQueryEntity = (
  historyQueryEntity: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>,
  command: HistoryQueryCommandDTO,
  currentSettings: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> | null,
  scanModes: Array<ScanMode>,
  user: string
): void => {
  const southManifest = southManifestList.find(element => element.id === command.southType)!;
  const northManifest = northManifestList.find(element => element.id === command.northType)!;
  historyQueryEntity.name = command.name;
  historyQueryEntity.southType = command.southType;
  historyQueryEntity.northType = command.northType;
  historyQueryEntity.description = command.description;
  historyQueryEntity.status = currentSettings?.status || 'PENDING';
  historyQueryEntity.queryTimeRange = {
    startTime: command.queryTimeRange.startTime,
    endTime: command.queryTimeRange.endTime,
    maxReadInterval: command.queryTimeRange.maxReadInterval,
    readDelay: command.queryTimeRange.readDelay
  };
  historyQueryEntity.northSettings = encryptionService.encryptConnectorSecrets(
    command.northSettings,
    currentSettings?.northSettings || null,
    northManifest.settings
  );
  historyQueryEntity.southSettings = encryptionService.encryptConnectorSecrets(
    command.southSettings,
    currentSettings?.southSettings || null,
    southManifest.settings
  );
  historyQueryEntity.southServerTrust = toServerTrust(command.southServerTrust, currentSettings?.southServerTrust ?? null, user);
  historyQueryEntity.northServerTrust = toServerTrust(command.northServerTrust, currentSettings?.northServerTrust ?? null, user);
  historyQueryEntity.caching = {
    trigger: {
      scanMode: checkScanMode(scanModes, command.caching.trigger.scanModeId, command.caching.trigger.scanModeName),
      numberOfElements: command.caching.trigger.numberOfElements,
      numberOfFiles: command.caching.trigger.numberOfFiles
    },
    throttling: {
      runMinDelay: command.caching.throttling.runMinDelay,
      maxSize: command.caching.throttling.maxSize,
      maxNumberOfElements: command.caching.throttling.maxNumberOfElements
    },
    error: {
      retryInterval: command.caching.error.retryInterval,
      retryCount: command.caching.error.retryCount,
      retentionDuration: command.caching.error.retentionDuration,
      maxSize: command.caching.error.maxSize
    },
    archive: {
      enabled: command.caching.archive.enabled,
      retentionDuration: command.caching.archive.retentionDuration,
      maxSize: command.caching.archive.maxSize
    }
  };
  const currentItems = new Map((currentSettings?.items ?? []).map(item => [item.id, item]));
  historyQueryEntity.items = command.items.map(itemCommand => {
    const itemEntity = { id: itemCommand.id } as HistoryQueryItemEntity<SouthItemSettings>;
    copyHistoryQueryItemCommandToHistoryQueryItemEntity(
      itemEntity,
      itemCommand,
      (itemCommand.id && currentItems.get(itemCommand.id)) || null,
      historyQueryEntity.southType
    );
    return itemEntity;
  });
};

const copyHistoryQueryItemCommandToHistoryQueryItemEntity = (
  historyQueryItemEntity: HistoryQueryItemEntity<SouthItemSettings>,
  command: HistoryQueryItemCommandDTO,
  currentSettings: HistoryQueryItemEntity<SouthItemSettings> | null,
  southType: string
): void => {
  const southManifest = southManifestList.find(element => element.id === southType)!;
  const itemSettingsManifest = southManifest.items.rootAttribute.attributes.find(
    attribute => attribute.key === 'settings'
  )! as OIBusObjectAttribute;
  historyQueryItemEntity.id = command.id || '';
  historyQueryItemEntity.name = command.name;
  historyQueryItemEntity.description = command.description ?? null;
  historyQueryItemEntity.enabled = command.enabled;
  historyQueryItemEntity.settings = encryptionService.encryptConnectorSecrets(
    command.settings,
    currentSettings?.settings || null,
    itemSettingsManifest
  );
};

export const toHistoryQueryLightDTO = (
  historyQuery: HistoryQueryEntityLight,
  getUserInfo: GetUserInfo,
  getHistoryMetrics?: (historyId: string) => HistoryQueryMetrics | null
): HistoryQueryLightDTO => {
  // Plain synchronous read of the already-in-memory metrics of the running engine, if any.
  // No SSE connection or polling is involved here.
  const metrics = getHistoryMetrics?.(historyQuery.id);
  const isRunning = metrics?.historyMetrics.running ?? false;
  return {
    id: historyQuery.id,
    name: historyQuery.name,
    description: historyQuery.description,
    status: historyQuery.status,
    startTime: historyQuery.startTime,
    endTime: historyQuery.endTime,
    southType: historyQuery.southType,
    northType: historyQuery.northType,
    itemCount: historyQuery.itemCount,
    enabledItemCount: historyQuery.enabledItemCount,
    currentItemNumber: isRunning ? metrics!.historyMetrics.currentItemNumber : undefined,
    numberOfItems: isRunning ? metrics!.historyMetrics.numberOfItems : undefined,
    createdBy: getUserInfo(historyQuery.createdBy),
    updatedBy: getUserInfo(historyQuery.updatedBy),
    createdAt: historyQuery.createdAt,
    updatedAt: historyQuery.updatedAt
  };
};

export const toHistoryQueryDTO = (
  historyQuery: HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings>,
  getUserInfo: GetUserInfo
): BaseEntity &
  HistoryQueryCommonDTO &
  HistoryQuerySouthTypedDTO<OIBusSouthType, SouthSettings, SouthItemSettings> &
  HistoryQueryNorthTypedDTO<OIBusNorthType, NorthSettings> => {
  const southManifest = southManifestList.find(element => element.id === historyQuery.southType)!;
  const northManifest = northManifestList.find(element => element.id === historyQuery.northType)!;
  const items = historyQuery.items.map(item => toHistoryQueryItemDTO(item, historyQuery.southType, getUserInfo));
  return {
    id: historyQuery.id,
    name: historyQuery.name,
    description: historyQuery.description,
    status: historyQuery.status,
    southType: historyQuery.southType,
    southSettings: encryptionService.filterSecrets(historyQuery.southSettings, southManifest.settings),
    queryTimeRange: {
      startTime: historyQuery.queryTimeRange.startTime,
      endTime: historyQuery.queryTimeRange.endTime,
      maxReadInterval: historyQuery.queryTimeRange.maxReadInterval,
      readDelay: historyQuery.queryTimeRange.readDelay
    },
    northType: historyQuery.northType,
    northSettings: encryptionService.filterSecrets(historyQuery.northSettings, northManifest.settings),
    southServerTrust: toServerTrustDTO(historyQuery.southServerTrust, getUserInfo),
    northServerTrust: toServerTrustDTO(historyQuery.northServerTrust, getUserInfo),
    caching: {
      trigger: {
        scanMode: toScanModeDTO(historyQuery.caching.trigger.scanMode, getUserInfo),
        numberOfElements: historyQuery.caching.trigger.numberOfElements,
        numberOfFiles: historyQuery.caching.trigger.numberOfFiles
      },
      throttling: {
        runMinDelay: historyQuery.caching.throttling.runMinDelay,
        maxSize: historyQuery.caching.throttling.maxSize,
        maxNumberOfElements: historyQuery.caching.throttling.maxNumberOfElements
      },
      error: {
        retryInterval: historyQuery.caching.error.retryInterval,
        retryCount: historyQuery.caching.error.retryCount,
        retentionDuration: historyQuery.caching.error.retentionDuration,
        maxSize: historyQuery.caching.error.maxSize
      },
      archive: {
        enabled: historyQuery.caching.archive.enabled,
        retentionDuration: historyQuery.caching.archive.retentionDuration,
        maxSize: historyQuery.caching.archive.maxSize
      }
    },
    items,
    northTransformers: historyQuery.northTransformers.map(transformerWithOptions => ({
      id: transformerWithOptions.id,
      transformer: toTransformerDTO(transformerWithOptions.transformer, getUserInfo),
      options: transformerWithOptions.options,
      items: transformerWithOptions.items.map(item => ({
        id: item.id,
        name: item.name,
        enabled: item.enabled,
        createdBy: getUserInfo(item.createdBy),
        updatedBy: getUserInfo(item.updatedBy),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    })),
    createdBy: getUserInfo(historyQuery.createdBy),
    updatedBy: getUserInfo(historyQuery.updatedBy),
    createdAt: historyQuery.createdAt,
    updatedAt: historyQuery.updatedAt
  };
};

export { toHistoryQueryItemDTO } from './history-query-item-dto.utils';
