import Joi from 'joi';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import { Database } from 'better-sqlite3';
import JoiValidator from '../../web-server/controllers/validators/joi.validator';
import { CONFIG_SCHEMA, EXPORT_FILE_SCHEMA, RESERVED_SCAN_MODE_ID } from './config-schema';
import { getUpgradesBetween } from './config-upgrades/registry';
import { ConfigUpgrade, JsonObject } from './config-upgrades/config-upgrade';
import { compareVersions } from './config-upgrades/version-compare';
import { version as currentOIBusVersion } from '../../../package.json';
import {
  ConfigExportDTO,
  ConfigImportEntityValidationError,
  ConfigImportResponseDTO,
  OIBusConfigurationDTO
} from '../../../shared/model/config-transfer.model';
import { OIBusObjectAttribute } from '../../../shared/model/form.model';
import { southManifestList } from '../south-manifests';
import { northManifestList } from '../north-manifests';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import IpFilterRepository from '../../repository/config/ip-filter.repository';
import CertificateRepository from '../../repository/config/certificate.repository';
import TransformerRepository from '../../repository/config/transformer.repository';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import NorthConnectorRepository from '../../repository/config/north-connector.repository';
import HistoryQueryRepository from '../../repository/config/history-query.repository';
import UserRepository from '../../repository/config/user.repository';
import ConfigurationWorkflowRepository from '../../repository/config/configuration-workflow.repository';
import { SouthConnectorEntity, SouthConnectorItemEntity, SouthItemGroupEntityLight } from '../../model/south-connector.model';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import { HistoryQueryEntity, HistoryQueryItemEntity } from '../../model/histor-query.model';
import {
  CustomTransformer,
  HistoryTransformerWithOptions,
  NorthTransformerWithOptions,
  SourceOriginSouth,
  Transformer,
  TransformerSource
} from '../../model/transformer.model';
import { ScanMode } from '../../model/scan-mode.model';
import { SouthItemSettings, SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';
import { OIAnalyticsNorthCommandDTO, OIAnalyticsSouthCommandDTO } from '../oia/oianalytics.model';
import { TransformerSourceCommandDTO } from '../../../shared/model/transformer.model';

/**
 * Raised at any rejection point of the import pipeline (malformed file, export from a newer OIBus,
 * failing upgrade step, validation failures). `validationErrors` is only populated for the
 * validation-failure case — every other rejection is a single top-level `message`. Nothing has been
 * written when it is raised.
 */
export class ConfigImportError extends Error {
  constructor(
    message: string,
    readonly validationErrors: Array<ConfigImportEntityValidationError> = []
  ) {
    super(message);
    this.name = 'ConfigImportError';
  }
}

/**
 * The oldest configuration an import accepts. Config export shipped in 3.10.0, but OIAnalytics can
 * produce a file from the configuration messages any OIBus sent it, down to 3.9.0 (pre-releases of
 * 3.9.0 excluded).
 */
export const MINIMUM_SUPPORTED_VERSION = '3.9.0';

export interface UpgradedConfiguration {
  fromVersion: string;
  toVersion: string;
  appliedUpgrades: Array<ConfigUpgrade>;
  config: OIBusConfigurationDTO;
}

const settingsField = (entry: JsonObject, field: string): unknown => (entry.settings as JsonObject | undefined)?.[field];

/** How to attribute a structural validation error to an entry of each configuration section. */
const SECTION_SCOPES: Record<string, (entry: JsonObject) => { scope: string; entityName: unknown }> = {
  scanModes: entry => ({ scope: 'scanMode', entityName: settingsField(entry, 'name') }),
  ipFilters: entry => ({ scope: 'ipFilter', entityName: settingsField(entry, 'address') }),
  certificates: entry => ({ scope: 'certificate', entityName: settingsField(entry, 'name') }),
  users: entry => ({ scope: 'user', entityName: settingsField(entry, 'login') }),
  transformers: entry => ({ scope: `transformer:${entry.type}`, entityName: settingsField(entry, 'name') }),
  southConnectors: entry => ({ scope: `south:${entry.type}`, entityName: settingsField(entry, 'name') }),
  northConnectors: entry => ({ scope: `north:${entry.type}`, entityName: settingsField(entry, 'name') }),
  historyQueries: entry => ({ scope: 'historyQuery', entityName: settingsField(entry, 'name') })
};

/**
 * Imports a configuration export file (produced by OIBus or by OIAnalytics, see `ConfigExportDTO`),
 * whatever OIBus version it comes from, as long as it is not newer than this one:
 *
 *  1. The file's top-level shape is checked, and it is rejected when its `oibusVersion` is newer than
 *     this instance.
 *  2. The config upgrade chain brings its configuration from `oibusVersion` to the current shape.
 *  3. The result is validated: structurally against `CONFIG_SCHEMA`, then every connector/item settings
 *     blob against its manifest.
 *  4. The local configuration is transactionally wiped and recreated from it.
 *
 * Nothing is written unless every step succeeds.
 */
export default class ConfigImportService {
  constructor(
    private validator: JoiValidator,
    // The remaining constructor params are only used by `importConfiguration` (the transactional
    // wipe+recreate write path) — `validateAndUpgrade` alone needs none of them.
    private database?: Database,
    private scanModeRepository?: ScanModeRepository,
    private ipFilterRepository?: IpFilterRepository,
    private certificateRepository?: CertificateRepository,
    private transformerRepository?: TransformerRepository,
    private southConnectorRepository?: SouthConnectorRepository,
    private northConnectorRepository?: NorthConnectorRepository,
    private historyQueryRepository?: HistoryQueryRepository,
    private userRepository?: UserRepository,
    private configurationWorkflowRepository?: ConfigurationWorkflowRepository
  ) {}

  /**
   * Runs steps 1–3 of the pipeline (see the class doc) and returns the upgraded, validated
   * configuration, without writing anything or mutating `rawInput`. `currentVersion` defaults to this
   * build's own version; it is only a parameter so tests can pin it independently of `package.json`.
   */
  async validateAndUpgrade(rawInput: unknown, currentVersion: string = currentOIBusVersion): Promise<UpgradedConfiguration> {
    const { error } = EXPORT_FILE_SCHEMA.validate(rawInput, { allowUnknown: true });
    if (error) {
      throw new ConfigImportError(`Malformed configuration export file: ${error.message}`);
    }
    const file = rawInput as ConfigExportDTO;

    // Upgrades only ever move a configuration forward: an export from a newer OIBus may carry shapes
    // this build has never heard of, so it is rejected rather than half-understood.
    if (compareVersions(file.oibusVersion, currentVersion) > 0) {
      throw new ConfigImportError(
        `Unsupported export: it was produced by OIBus ${file.oibusVersion}, which is newer than this OIBus instance (${currentVersion})`
      );
    }

    if (compareVersions(file.oibusVersion, MINIMUM_SUPPORTED_VERSION) < 0) {
      throw new ConfigImportError(
        `Unsupported export: it was produced by OIBus ${file.oibusVersion}, but configuration import is only supported from OIBus ${MINIMUM_SUPPORTED_VERSION}`
      );
    }

    const appliedUpgrades = getUpgradesBetween(file.oibusVersion, currentVersion);
    let config = structuredClone(file.config) as unknown as JsonObject;
    for (const upgrade of appliedUpgrades) {
      try {
        config = upgrade.apply(config);
      } catch (upgradeError: unknown) {
        throw new ConfigImportError(
          `Could not upgrade the configuration to OIBus ${upgrade.version} (${upgrade.description}): ${(upgradeError as Error).message}`
        );
      }
    }

    // Settings are only validated once the structure is known to be sound, since manifest validation
    // reaches into it.
    const structureErrors = this.validateStructure(config);
    if (structureErrors.length > 0) {
      throw new ConfigImportError(this.validationFailureMessage(appliedUpgrades), structureErrors);
    }
    const upgraded = config as unknown as OIBusConfigurationDTO;
    const settingsErrors = await this.validateSettings(upgraded);
    if (settingsErrors.length > 0) {
      throw new ConfigImportError(this.validationFailureMessage(appliedUpgrades), settingsErrors);
    }

    return { fromVersion: file.oibusVersion, toVersion: currentVersion, appliedUpgrades, config: upgraded };
  }

  private validationFailureMessage(appliedUpgrades: Array<ConfigUpgrade>): string {
    return appliedUpgrades.length > 0
      ? 'Imported configuration failed validation after applying config upgrades; nothing was imported'
      : 'Imported configuration failed validation; nothing was imported';
  }

  /**
   * Validates the whole configuration against `CONFIG_SCHEMA`, collecting every failure (not just the
   * first) and attributing each to the entity it belongs to.
   */
  private validateStructure(config: JsonObject): Array<ConfigImportEntityValidationError> {
    const { error } = CONFIG_SCHEMA.validate(config, { abortEarly: false, allowUnknown: true });
    if (!error) return [];
    return error.details.map(detail => this.toValidationError(config, detail));
  }

  private toValidationError(config: JsonObject, detail: Joi.ValidationErrorItem): ConfigImportEntityValidationError {
    const [section, index] = detail.path;
    const describe = typeof section === 'string' ? SECTION_SCOPES[section] : undefined;
    const entries = typeof section === 'string' ? config[section] : undefined;
    const entry = Array.isArray(entries) && typeof index === 'number' ? (entries[index] as unknown) : undefined;
    if (!describe || !entry || typeof entry !== 'object') {
      return { scope: 'config', message: detail.message };
    }
    const { scope, entityName } = describe(entry as JsonObject);
    const entityId = (entry as JsonObject).oIBusInternalId;
    return {
      scope,
      entityId: typeof entityId === 'string' ? entityId : undefined,
      entityName: typeof entityName === 'string' ? entityName : undefined,
      message: detail.message
    };
  }

  /**
   * Validates every manifest-driven settings blob against the current manifest for its type, using the
   * exact same `JoiValidator.validateSettings` the create/update endpoints use. Runs every check rather
   * than stopping at the first failure, so a rejected import reports every problem at once.
   */
  private async validateSettings(config: OIBusConfigurationDTO): Promise<Array<ConfigImportEntityValidationError>> {
    const errors: Array<ConfigImportEntityValidationError> = [];

    for (const south of config.southConnectors) {
      const manifest = southManifestList.find(candidate => candidate.id === south.type);
      if (!manifest) {
        errors.push({
          scope: `south:${south.type}`,
          entityId: south.oIBusInternalId,
          entityName: south.settings.name,
          message: `Unknown south connector type "${south.type}"`
        });
        continue;
      }
      await this.collectValidationError(errors, `south:${south.type}`, south.oIBusInternalId, south.settings.name, () =>
        this.validator.validateSettings(manifest.settings, south.settings.settings)
      );

      const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
        attribute => attribute.key === 'settings'
      ) as OIBusObjectAttribute;
      for (const item of south.settings.items) {
        await this.collectValidationError(errors, `south:${south.type}:item`, item.id ?? undefined, item.name, () =>
          this.validator.validateSettings(itemSettingsManifest, item.settings)
        );
      }
    }

    for (const north of config.northConnectors) {
      const manifest = northManifestList.find(candidate => candidate.id === north.type);
      if (!manifest) {
        errors.push({
          scope: `north:${north.type}`,
          entityId: north.oIBusInternalId,
          entityName: north.settings.name,
          message: `Unknown north connector type "${north.type}"`
        });
        continue;
      }
      await this.collectValidationError(errors, `north:${north.type}`, north.oIBusInternalId, north.settings.name, () =>
        this.validator.validateSettings(manifest.settings, north.settings.settings)
      );
    }

    for (const historyQuery of config.historyQueries) {
      const southManifest = southManifestList.find(candidate => candidate.id === historyQuery.settings.southType);
      const northManifest = northManifestList.find(candidate => candidate.id === historyQuery.settings.northType);

      if (!southManifest) {
        errors.push({
          scope: `historyQuerySouth:${historyQuery.settings.southType}`,
          entityId: historyQuery.oIBusInternalId,
          entityName: historyQuery.settings.name,
          message: `Unknown south connector type "${historyQuery.settings.southType}"`
        });
      } else {
        await this.collectValidationError(
          errors,
          `historyQuerySouth:${historyQuery.settings.southType}`,
          historyQuery.oIBusInternalId,
          historyQuery.settings.name,
          () => this.validator.validateSettings(southManifest.settings, historyQuery.settings.southSettings)
        );

        const itemSettingsManifest = southManifest.items.rootAttribute.attributes.find(
          attribute => attribute.key === 'settings'
        ) as OIBusObjectAttribute;
        for (const item of historyQuery.settings.items) {
          await this.collectValidationError(
            errors,
            `historyQuerySouth:${historyQuery.settings.southType}:item`,
            item.id ?? undefined,
            item.name,
            () => this.validator.validateSettings(itemSettingsManifest, item.settings)
          );
        }
      }

      if (!northManifest) {
        errors.push({
          scope: `historyQueryNorth:${historyQuery.settings.northType}`,
          entityId: historyQuery.oIBusInternalId,
          entityName: historyQuery.settings.name,
          message: `Unknown north connector type "${historyQuery.settings.northType}"`
        });
      } else {
        await this.collectValidationError(
          errors,
          `historyQueryNorth:${historyQuery.settings.northType}`,
          historyQuery.oIBusInternalId,
          historyQuery.settings.name,
          () => this.validator.validateSettings(northManifest.settings, historyQuery.settings.northSettings)
        );
      }
    }

    return errors;
  }

  private async collectValidationError(
    errors: Array<ConfigImportEntityValidationError>,
    scope: string,
    entityId: string | undefined,
    entityName: string | undefined,
    run: () => Promise<void>
  ): Promise<void> {
    try {
      await run();
    } catch (error: unknown) {
      errors.push({ scope, entityId, entityName, message: (error as Error).message });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // Transactional wipe+recreate (import proper)
  // ───────────────────────────────────────────────────────────────────────────────────────────

  /**
   * Runs the full config import pipeline: upgrade + validate (see `validateAndUpgrade`), then
   * transactionally wipes every in-scope section of the local configuration and recreates it from the
   * upgraded configuration, preserving every entity's original id. Nothing is written if
   * `validateAndUpgrade` rejects the file.
   *
   * Out of scope by design: the engine's own settings and the OIAnalytics registration are exported for
   * informational purposes only and are never written back here.
   *
   * Every secret-shaped field of an imported connector settings blob is empty, because secrets are
   * never exported (`EncryptionService.filterSecrets` strips them on the export side). Left enabled,
   * such a connector would immediately fail to connect with empty credentials, or — worse for a
   * write-capable protocol — connect successfully to a real target with no meaningful settings. Every
   * imported south and north connector, and every configuration workflow, is therefore forced
   * `enabled: false` regardless of the exported value; the response's `warnings` says so once per
   * section, so the caller must re-enter credentials and re-enable each of them manually.
   *
   * Two sections get special handling so the import can never lock its own caller out or delete a
   * reserved id nothing reseeds after startup:
   *  - The user calling this (`importedBy`) is never deleted or recreated, and any imported user
   *    sharing their id or login is skipped, so the account used to run the import always keeps
   *    working with its existing password.
   *  - The reserved `'subscription'` scan mode (used by push-driven south connectors) is never
   *    deleted; if the configuration also describes it, it is updated in place instead of recreated.
   */
  async importConfiguration(rawInput: unknown, importedBy: string): Promise<ConfigImportResponseDTO> {
    const { fromVersion, toVersion, appliedUpgrades, config } = await this.validateAndUpgrade(rawInput);
    if (
      !this.database ||
      !this.scanModeRepository ||
      !this.ipFilterRepository ||
      !this.certificateRepository ||
      !this.transformerRepository ||
      !this.southConnectorRepository ||
      !this.northConnectorRepository ||
      !this.historyQueryRepository ||
      !this.userRepository ||
      !this.configurationWorkflowRepository
    ) {
      throw new Error('ConfigImportService was constructed without the repositories required to write an import');
    }

    const currentUser = this.userRepository.findById(importedBy);
    if (!currentUser) {
      throw new Error('Config import must be run by an authenticated, existing user');
    }

    const warnings: Array<string> = [];

    // Excluded on EITHER match, not just login: `wipeConfiguration` below preserves the local row by
    // `id` (it's the only stable key across a login rename), so an entry whose id matches the importer's
    // own id must never be recreated — that row was never deleted, and re-inserting it would collide on
    // the primary key. The login match covers an entry describing a different id but the same (UNIQUE)
    // login as the importer.
    const usersToImport = config.users.filter(user => user.oIBusInternalId !== currentUser.id && user.settings.login !== currentUser.login);
    if (usersToImport.length < config.users.length) {
      warnings.push(
        `The account you are signed in with ("${currentUser.login}") was preserved with its existing password and was not ` +
          `overwritten by the import, so you are not locked out.`
      );
    }

    // Passwords must be hashed (argon2, genuinely async) before the synchronous transaction below
    // starts — better-sqlite3 transaction callbacks cannot await anything without letting the
    // transaction commit/roll back around the awaited gap.
    const hashedUserPasswords = await Promise.all(
      usersToImport.map(async user => ({
        user,
        hashedPassword: await argon2.hash(crypto.randomBytes(24).toString('hex'))
      }))
    );
    if (hashedUserPasswords.length > 0) {
      warnings.push(
        `${hashedUserPasswords.length} user(s) were recreated with a random password (passwords are never exported); ` +
          `each must be reset before that user can sign in again.`
      );
    }

    const importedConnectorCount = config.southConnectors.length + config.northConnectors.length;
    if (importedConnectorCount > 0) {
      warnings.push(
        `${importedConnectorCount} south/north connector(s) were imported without credentials (secrets are never exported) and have ` +
          `been disabled; re-enter their settings and re-enable each one manually before they run again.`
      );
    }
    const importedWorkflowCount = config.southConnectors.reduce((count, south) => count + south.settings.configurationWorkflows.length, 0);
    if (importedWorkflowCount > 0) {
      warnings.push(
        `${importedWorkflowCount} configuration workflow(s) were imported disabled; re-enable each one manually once its south ` +
          `connector is configured.`
      );
    }

    const runImport = this.database.transaction(() => {
      this.wipeConfiguration(importedBy, currentUser.id);
      this.recreateConfiguration(config, importedBy, hashedUserPasswords, warnings);
    });
    try {
      runImport();
    } catch (error: unknown) {
      // Nothing that reaches this point was caught by `validateAndUpgrade` — e.g. two entries sharing
      // an id, or a reference to an entity missing from the file — so it surfaces here as a raw
      // repository/SQLite error instead. better-sqlite3's `transaction()` wrapper has already rolled
      // back everything (including `wipeConfiguration`) by the time this catch runs, so the local
      // configuration is guaranteed untouched; this only replaces an unhandled 500 with the same clean,
      // structured rejection every other failure mode in this pipeline produces.
      throw new ConfigImportError(
        `Config import failed while writing the new configuration: ${(error as Error).message}. The local configuration was not modified.`
      );
    }

    return {
      fromVersion,
      toVersion,
      appliedUpgrades: appliedUpgrades.map(upgrade => ({ version: upgrade.version, description: upgrade.description })),
      warnings
    };
  }

  /**
   * Deletes every row in every section this import writes to, in the reverse of the creation order
   * `recreateConfiguration` uses — so a row is always deleted before whatever it references.
   *
   * `preserveUserId` is never deleted (the account running the import must keep working), and the
   * reserved `'subscription'` scan mode is never deleted (nothing reseeds it after process startup, so
   * once gone it stays gone). Configuration workflows are deleted explicitly (and audited) before their
   * south connector, instead of silently going with it through the foreign key cascade; deleting one
   * also cascades to its run history and point metadata, which are runtime state and not exported.
   */
  private wipeConfiguration(deletedBy: string, preserveUserId: string): void {
    for (const user of this.userRepository!.list()) {
      if (user.id === preserveUserId) continue;
      this.userRepository!.delete(user.id, deletedBy);
    }
    for (const historyQuery of this.historyQueryRepository!.findAllHistoriesLight()) {
      this.historyQueryRepository!.deleteHistory(historyQuery.id, deletedBy);
    }
    for (const north of this.northConnectorRepository!.findAllNorth()) {
      this.northConnectorRepository!.deleteNorth(north.id, deletedBy);
    }
    for (const workflow of this.configurationWorkflowRepository!.findAll()) {
      this.configurationWorkflowRepository!.delete(workflow.id, deletedBy);
    }
    for (const south of this.southConnectorRepository!.findAllSouth()) {
      this.southConnectorRepository!.deleteSouth(south.id, deletedBy);
    }
    // Standard transformers are seeded once at process startup, not per import — only custom
    // transformers are ever recreated here, so only those are wiped.
    for (const transformer of this.transformerRepository!.list().filter(candidate => candidate.type === 'custom')) {
      this.transformerRepository!.delete(transformer.id, deletedBy);
    }
    for (const certificate of this.certificateRepository!.list()) {
      this.certificateRepository!.delete(certificate.id, deletedBy);
    }
    for (const ipFilter of this.ipFilterRepository!.list()) {
      this.ipFilterRepository!.delete(ipFilter.id, deletedBy);
    }
    for (const scanMode of this.scanModeRepository!.findAll()) {
      if (scanMode.id === RESERVED_SCAN_MODE_ID) continue;
      this.scanModeRepository!.delete(scanMode.id, deletedBy);
    }
  }

  /**
   * Recreates every in-scope section from the configuration, in FK-safe order: scan modes → ip filters →
   * certificates → transformers → south connectors (+ items/groups, then their configuration workflows
   * and item ownership) → north connectors → history queries → users. Every entity is written under its
   * original exported id.
   */
  private recreateConfiguration(
    config: OIBusConfigurationDTO,
    importedBy: string,
    hashedUserPasswords: Array<{ user: OIBusConfigurationDTO['users'][number]; hashedPassword: string }>,
    warnings: Array<string>
  ): void {
    for (const scanMode of config.scanModes) {
      // The reserved scan mode was never deleted by `wipeConfiguration`, so it must be updated in
      // place rather than (re)created, or the insert would collide with the still-existing row.
      if (scanMode.oIBusInternalId === RESERVED_SCAN_MODE_ID) {
        this.scanModeRepository!.update(RESERVED_SCAN_MODE_ID, scanMode.settings, importedBy);
      } else {
        this.scanModeRepository!.create(scanMode.settings, importedBy, scanMode.oIBusInternalId);
      }
    }

    for (const ipFilter of config.ipFilters) {
      this.ipFilterRepository!.create(ipFilter.settings, importedBy, ipFilter.oIBusInternalId);
    }

    for (const certificate of config.certificates) {
      // Private keys are never exported (`CertificateDTO` has no such field) — the certificate is
      // still recreated under its original id, so anything referencing it by id keeps resolving, but
      // with an empty private key that makes it unusable for TLS until re-imported.
      this.certificateRepository!.create({
        id: certificate.oIBusInternalId,
        name: certificate.settings.name,
        description: certificate.settings.description,
        publicKey: certificate.settings.publicKey,
        privateKey: '',
        certificate: certificate.settings.certificate,
        certificateChain: certificate.settings.certificateChain,
        expiry: certificate.settings.expiry,
        createdBy: importedBy,
        updatedBy: importedBy
      });
      warnings.push(`Certificate "${certificate.settings.name}" was imported without its private key; re-import its private key manually.`);
    }

    const transformerIdMap = this.recreateTransformers(config, importedBy, warnings);

    // Always a create: `wipeConfiguration` has already deleted every row this loop could otherwise
    // collide with. Passing `isNew: true` explicitly (rather than letting the repository infer it from
    // existence) means a genuine id collision — e.g. two entries sharing an id — surfaces as a real
    // INSERT constraint error instead of silently taking the UPDATE branch; the caller
    // (`importConfiguration`) turns that into a clean `ConfigImportError`.
    for (const south of config.southConnectors) {
      this.southConnectorRepository!.saveSouth(this.buildSouthEntity(south, importedBy), true);
      this.recreateConfigurationWorkflows(south, importedBy);
    }

    for (const north of config.northConnectors) {
      this.northConnectorRepository!.saveNorth(this.buildNorthEntity(north, importedBy, transformerIdMap, warnings), true);
    }

    for (const historyQuery of config.historyQueries) {
      this.historyQueryRepository!.saveHistory(this.buildHistoryEntity(historyQuery, importedBy, transformerIdMap, warnings), true);
    }

    for (const { user, hashedPassword } of hashedUserPasswords) {
      this.userRepository!.createWithHashedPassword(
        {
          login: user.settings.login,
          firstName: user.settings.firstName,
          lastName: user.settings.lastName,
          email: user.settings.email,
          language: user.settings.language,
          timezone: user.settings.timezone
        },
        hashedPassword,
        importedBy,
        user.oIBusInternalId
      );
    }
  }

  /**
   * Recreates a south connector's configuration workflows under their original ids (disabled, see
   * `importConfiguration`), then restores which of the connector's just-created items each one owns.
   */
  private recreateConfigurationWorkflows(south: OIAnalyticsSouthCommandDTO, importedBy: string): void {
    for (const workflow of south.settings.configurationWorkflows) {
      this.configurationWorkflowRepository!.create(
        {
          name: workflow.settings.name,
          southId: south.oIBusInternalId,
          discoveryScope: workflow.settings.discoveryScope,
          // Same as `ConfigurationWorkflowService`: a remote workflow never diffs against a previous run
          identityKeyFields: workflow.settings.pushToOIAnalytics ? [] : workflow.settings.identityKeyFields,
          eligibilityFilter: workflow.settings.eligibilityFilter,
          itemFieldMapping: workflow.settings.itemFieldMapping,
          pushToOIAnalytics: workflow.settings.pushToOIAnalytics,
          scanMode: workflow.settings.scanModeId ? ({ id: workflow.settings.scanModeId } as ScanMode) : null,
          enabled: false
        },
        importedBy,
        workflow.oIBusInternalId
      );
      for (const ownedItem of workflow.ownedItems) {
        this.southConnectorRepository!.restoreItemWorkflowOwnership(ownedItem.id, workflow.oIBusInternalId, ownedItem.disabledReason);
      }
    }
  }

  /**
   * Recreates every custom transformer under its original id, and builds a map from every exported
   * transformer's original id (custom or standard) to the id it should be referenced by locally.
   * Standard transformers are never recreated (they are seeded once at process startup with their own,
   * independently generated ids) — they are instead matched to the equivalent local standard
   * transformer by `functionName`, since that is the only stable identity they have across installs.
   */
  private recreateTransformers(config: OIBusConfigurationDTO, importedBy: string, warnings: Array<string>): Map<string, string> {
    const transformerIdMap = new Map<string, string>();

    for (const transformer of config.transformers) {
      if (transformer.type === 'standard') {
        const functionName = (transformer.settings as unknown as { functionName: string }).functionName;
        const local = this.transformerRepository!.findByFunctionName(functionName);
        if (local) {
          transformerIdMap.set(transformer.oIBusInternalId, local.id);
        } else {
          warnings.push(`Standard transformer "${functionName}" was not found on this OIBus instance; links to it were skipped.`);
        }
        continue;
      }

      const settings = transformer.settings as {
        name: string;
        description: string;
        inputType: string;
        outputType: string;
        language: CustomTransformer['language'];
        timeout: number;
        customCode: string;
      };
      const customTransformer: CustomTransformer = {
        id: transformer.oIBusInternalId,
        type: 'custom',
        inputType: settings.inputType,
        outputType: settings.outputType,
        name: settings.name,
        description: settings.description,
        customCode: settings.customCode,
        language: settings.language,
        customManifest: transformer.manifest,
        timeout: settings.timeout,
        createdBy: importedBy,
        updatedBy: importedBy,
        createdAt: '',
        updatedAt: ''
      };
      // Always a create: `wipeConfiguration` already deleted every custom transformer. `isNew: true`
      // means a preserved id that collides with an existing row (e.g. a locally-generated standard
      // transformer sharing the same 6-char id space) INSERTs and fails on the constraint, instead of
      // silently taking the UPDATE branch and overwriting that unrelated row's columns.
      this.transformerRepository!.save(customTransformer, true);
      transformerIdMap.set(transformer.oIBusInternalId, customTransformer.id);
    }

    return transformerIdMap;
  }

  private buildSouthEntity(entry: OIAnalyticsSouthCommandDTO, importedBy: string): SouthConnectorEntity<SouthSettings, SouthItemSettings> {
    const command = entry.settings;
    const groups: Array<SouthItemGroupEntityLight> = command.groups.map(group => ({
      id: group.id!,
      name: group.standardSettings.name,
      scanMode: { id: group.standardSettings.scanModeId } as ScanMode,
      startTimeOffset: group.historySettings.startTimeOffset,
      endTimeOffset: group.historySettings.endTimeOffset,
      maxReadInterval: group.historySettings.maxReadInterval,
      readDelay: group.historySettings.readDelay,
      recoveryStrategy: group.historySettings.recoveryStrategy ?? null,
      cachingStrategy: group.historySettings.cachingStrategy ?? null,
      createdBy: importedBy,
      updatedBy: importedBy,
      createdAt: '',
      updatedAt: ''
    }));
    const items: Array<SouthConnectorItemEntity<SouthItemSettings>> = command.items.map(item => ({
      id: item.id!,
      name: item.name,
      enabled: item.enabled,
      scanMode: item.scanModeId ? ({ id: item.scanModeId } as ScanMode) : null,
      settings: item.settings,
      group: item.groupId ? ({ id: item.groupId } as SouthItemGroupEntityLight) : null,
      syncWithGroup: item.syncWithGroup ?? false,
      maxReadInterval: item.maxReadInterval,
      readDelay: item.readDelay,
      startTimeOffset: item.startTimeOffset,
      endTimeOffset: item.endTimeOffset,
      recoveryStrategy: item.recoveryStrategy,
      cachingStrategy: item.cachingStrategy,
      thresholdType: item.thresholdType,
      threshold: item.threshold,
      rangeLow: item.rangeLow,
      rangeHigh: item.rangeHigh,
      maxCachingInterval: item.maxCachingInterval,
      createdBy: importedBy,
      updatedBy: importedBy,
      createdAt: '',
      updatedAt: ''
    }));
    return {
      id: entry.oIBusInternalId,
      name: command.name,
      type: command.type,
      description: command.description,
      enabled: false,
      settings: command.settings as unknown as SouthSettings,
      items,
      groups,
      createdBy: importedBy,
      updatedBy: importedBy,
      createdAt: '',
      updatedAt: ''
    };
  }

  private buildNorthEntity(
    entry: OIAnalyticsNorthCommandDTO,
    importedBy: string,
    transformerIdMap: Map<string, string>,
    warnings: Array<string>
  ): NorthConnectorEntity<NorthSettings> {
    const command = entry.settings;
    const transformers: Array<NorthTransformerWithOptions> = [];
    for (const transformerWithOptions of command.transformers) {
      const localTransformerId = this.resolveTransformerLink(
        transformerWithOptions.transformerId,
        transformerIdMap,
        'north connector',
        command.name,
        warnings
      );
      if (!localTransformerId) continue;
      transformers.push({
        id: transformerWithOptions.id,
        transformer: { id: localTransformerId } as Transformer,
        options: transformerWithOptions.options,
        source: this.buildTransformerSource(transformerWithOptions.source)
      });
    }
    return {
      id: entry.oIBusInternalId,
      name: command.name,
      type: command.type,
      description: command.description,
      enabled: false,
      settings: command.settings as unknown as NorthSettings,
      caching: this.buildCachingEntity(command.caching),
      transformers,
      createdBy: importedBy,
      updatedBy: importedBy,
      createdAt: '',
      updatedAt: ''
    };
  }

  /**
   * Resolves an exported transformer link's `transformerId` to the id it should be referenced by
   * locally (see `recreateTransformers`), pushing a skip warning and returning `null` if the linked
   * transformer couldn't be matched — shared by `buildNorthEntity` and `buildHistoryEntity`, whose
   * transformer-link resolution is otherwise identical.
   */
  private resolveTransformerLink(
    transformerId: string,
    transformerIdMap: Map<string, string>,
    ownerKind: 'north connector' | 'history query',
    ownerName: string,
    warnings: Array<string>
  ): string | null {
    const localTransformerId = transformerIdMap.get(transformerId);
    if (!localTransformerId) {
      warnings.push(
        `Skipped a transformer link on ${ownerKind} "${ownerName}": referenced transformer "${transformerId}" could not be matched locally.`
      );
      return null;
    }
    return localTransformerId;
  }

  /**
   * Builds the entity-shape `caching` field (a `ScanMode` id stand-in plus throttling/error/archive)
   * from its exported command shape — shared by `buildNorthEntity` and `buildHistoryEntity`, whose
   * north/history query `caching` command shapes are otherwise identical.
   */
  private buildCachingEntity(caching: {
    trigger: { scanModeId: string; numberOfElements: number; numberOfFiles: number };
    throttling: { runMinDelay: number; maxSize: number; maxNumberOfElements: number };
    error: { retryInterval: number; retryCount: number; retentionDuration: number };
    archive: { enabled: boolean; retentionDuration: number };
  }): {
    trigger: { scanMode: ScanMode; numberOfElements: number; numberOfFiles: number };
    throttling: { runMinDelay: number; maxSize: number; maxNumberOfElements: number };
    error: { retryInterval: number; retryCount: number; retentionDuration: number };
    archive: { enabled: boolean; retentionDuration: number };
  } {
    return {
      trigger: {
        scanMode: { id: caching.trigger.scanModeId } as ScanMode,
        numberOfElements: caching.trigger.numberOfElements,
        numberOfFiles: caching.trigger.numberOfFiles
      },
      throttling: { ...caching.throttling },
      error: { ...caching.error },
      archive: { ...caching.archive }
    };
  }

  /**
   * Builds a `TransformerSource` from its exported command shape. Only `.id` (and, for a south source,
   * the south/group/item ids threaded through it) is ever read back out of these objects by
   * `NorthConnectorRepository`'s persistence SQL, so the south/group/item objects here are deliberately
   * minimal id-only stand-ins rather than full entities re-read from the repositories.
   */
  private buildTransformerSource(source: TransformerSourceCommandDTO): TransformerSource {
    switch (source.type) {
      case 'south':
        return {
          type: 'south',
          south: { id: source.southId } as SourceOriginSouth['south'],
          group: source.groupId ? ({ id: source.groupId } as SourceOriginSouth['group']) : undefined,
          items: source.items.map(item => ({ id: item.id }) as SourceOriginSouth['items'][number])
        };
      case 'oibus-api':
        return { type: 'oibus-api', dataSourceId: source.dataSourceId };
      case 'oianalytics-setpoint':
        return { type: 'oianalytics-setpoint' };
    }
  }

  private buildHistoryEntity(
    entry: OIBusConfigurationDTO['historyQueries'][number],
    importedBy: string,
    transformerIdMap: Map<string, string>,
    warnings: Array<string>
  ): HistoryQueryEntity<SouthSettings, NorthSettings, SouthItemSettings> {
    const command = entry.settings;
    const items: Array<HistoryQueryItemEntity<SouthItemSettings>> = command.items.map(item => ({
      id: item.id!,
      name: item.name,
      enabled: item.enabled,
      settings: item.settings,
      createdBy: importedBy,
      updatedBy: importedBy,
      createdAt: '',
      updatedAt: ''
    }));
    const northTransformers: Array<HistoryTransformerWithOptions> = [];
    for (const transformerWithOptions of command.northTransformers) {
      const localTransformerId = this.resolveTransformerLink(
        transformerWithOptions.transformerId,
        transformerIdMap,
        'history query',
        command.name,
        warnings
      );
      if (!localTransformerId) continue;
      northTransformers.push({
        id: transformerWithOptions.id,
        transformer: { id: localTransformerId } as Transformer,
        options: transformerWithOptions.options,
        items: transformerWithOptions.items.map(item => ({
          id: item.id,
          name: item.name,
          enabled: item.enabled,
          createdBy: importedBy,
          updatedBy: importedBy,
          createdAt: '',
          updatedAt: ''
        }))
      });
    }
    return {
      id: entry.oIBusInternalId,
      name: command.name,
      description: command.description,
      status: 'PENDING',
      southType: command.southType,
      southSettings: command.southSettings,
      queryTimeRange: { ...command.queryTimeRange },
      northType: command.northType,
      northSettings: command.northSettings,
      caching: this.buildCachingEntity(command.caching),
      items,
      northTransformers,
      createdBy: importedBy,
      updatedBy: importedBy,
      createdAt: '',
      updatedAt: ''
    };
  }
}
