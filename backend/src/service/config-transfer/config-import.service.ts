import Joi from 'joi';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import { Database } from 'better-sqlite3';
import JoiValidator from '../../web-server/controllers/validators/joi.validator';
import { scanModeSchema, ipFilterSchema, userSchema } from '../../web-server/controllers/validators/oibus-validation-schema';
import { getUpgradesNewerThan, SettingsUpgradeEntry } from './settings-upgrades/registry';
import { CONFIG_EXPORT_FORMAT_VERSION } from './config-transfer.service';
import {
  ConfigExportEnvelopeDTO,
  ConfigImportEntityValidationError,
  ConfigImportResponseDTO
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
 * The highest export `formatVersion` this build of OIBus knows how to import. Deliberately the
 * same constant the export endpoint stamps onto every envelope it produces (`config-transfer.service.ts`)
 * — an import is only ever rejected for being newer than what *this* build can produce, never for
 * being older (older envelopes are what the settings-upgrade registry exists to bring forward).
 */
export const SUPPORTED_FORMAT_VERSION = CONFIG_EXPORT_FORMAT_VERSION;

/**
 * The reserved scan mode id push-driven south connectors (MQTT, OPC-UA DA subscriptions, …) and the
 * engine special-case by id. `ScanModeRepository` only reseeds it (and the other defaults) when the
 * table is completely empty at construction time — never after an import — so it must never be
 * deleted here, or it is gone for the life of the process.
 */
const RESERVED_SCAN_MODE_ID = 'subscription';

export interface AppliedUpgrade {
  scope: string;
  version: string;
  entityId?: string;
}

/**
 * Raised at any rejection point of the import pipeline (malformed input, unsupported format
 * version, post-upgrade validation failures). `validationErrors` is only populated for the
 * validation-failure case — every other rejection is a single top-level `message`. Never carries
 * any indication that repository writes happened, because this pipeline never performs any.
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
 * `oIBusInternalId` plus a `settings` sub-schema, matching the `BaseAuditFields & { settings: T }`
 * shape every non-manifest-driven section of the envelope uses. South/north connectors and history
 * queries are NOT covered by this helper — those get full manifest-driven validation in
 * `validateEnvelope` once settings-upgrades have had a chance to run, so a bare shape check here
 * would be redundant. Every other section (scan modes, ip filters, certificates, users) never goes
 * through manifest validation at all, so this is the only check standing between a malformed entry
 * and an unhandled exception mid-transaction in `recreateConfiguration` — hence `settings.required()`
 * with the real per-type schema, not just `Joi.object()`.
 */
const auditedEntrySchema = (settingsSchema: Joi.Schema): Joi.ObjectSchema =>
  Joi.object({
    oIBusInternalId: Joi.string().required(),
    settings: settingsSchema.required()
  }).unknown(true);

const CERTIFICATE_SETTINGS_SCHEMA = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required().allow(null, ''),
  publicKey: Joi.string().required().allow(''),
  certificate: Joi.string().required().allow(''),
  certificateChain: Joi.string().required().allow(null, ''),
  expiry: Joi.string().required().allow(null, '')
}).unknown(true);

/**
 * The reserved `'subscription'` scan mode is seeded with `type: 'cron'` but an empty `cron` string
 * (nothing ever schedules it — it's referenced by id, not run) — a shape `scanModeSchema`'s cron
 * validator, built for real user-submitted scan modes, rejects. Its envelope entry is only ever
 * matched back to the local reserved row by id (see `recreateConfiguration`), so its `settings` are
 * not meaningfully validated here regardless of what an export happens to contain for it.
 */
const SCAN_MODE_ENTRY_SCHEMA = Joi.object({
  oIBusInternalId: Joi.string().required(),
  settings: Joi.when('oIBusInternalId', {
    is: RESERVED_SCAN_MODE_ID,
    then: Joi.object().unknown(true).required(),
    otherwise: scanModeSchema.required()
  })
}).unknown(true);

const TRANSFORMER_ENTRY_SCHEMA = Joi.object({
  oIBusInternalId: Joi.string().required(),
  type: Joi.string().valid('custom', 'standard').required(),
  settings: Joi.object().required(),
  manifest: Joi.object().required()
}).unknown(true);

const ENVELOPE_SHAPE_SCHEMA = Joi.object({
  formatVersion: Joi.number().integer().required(),
  oibusVersion: Joi.string().required(),
  exportedAt: Joi.string().required(),
  fullConfiguration: Joi.object({
    engine: Joi.object().required(),
    registration: Joi.object().required(),
    scanModes: Joi.array().items(SCAN_MODE_ENTRY_SCHEMA).required(),
    ipFilters: Joi.array().items(auditedEntrySchema(ipFilterSchema)).required(),
    certificates: Joi.array().items(auditedEntrySchema(CERTIFICATE_SETTINGS_SCHEMA)).required(),
    southConnectors: Joi.array().required(),
    northConnectors: Joi.array().required(),
    users: Joi.array().items(auditedEntrySchema(userSchema)).required(),
    transformers: Joi.array().items(TRANSFORMER_ENTRY_SCHEMA).required()
  })
    .required()
    .unknown(true),
  historyQueries: Joi.object({
    historyQueries: Joi.array().required()
  })
    .required()
    .unknown(true)
})
  .required()
  .unknown(true);

/**
 * Result of `parseScope`: which section of the envelope a `SettingsUpgradeEntry`/validation
 * failure applies to, and (for the type-keyed scopes) which connector/transformer `type` /
 * `functionName` it is restricted to.
 */
type ParsedScope =
  | { kind: 'envelope' }
  | { kind: 'engine' }
  | { kind: 'south'; connectorType: string }
  | { kind: 'north'; connectorType: string }
  | { kind: 'historyQuerySouth'; connectorType: string }
  | { kind: 'historyQueryNorth'; connectorType: string }
  | { kind: 'transformer'; functionName: string };

function parseScope(scope: string): ParsedScope {
  if (scope === 'envelope') return { kind: 'envelope' };
  if (scope === 'engine') return { kind: 'engine' };
  const [prefix, ...rest] = scope.split(':');
  const suffix = rest.join(':');
  switch (prefix) {
    case 'south':
      return { kind: 'south', connectorType: suffix };
    case 'north':
      return { kind: 'north', connectorType: suffix };
    case 'historyQuerySouth':
      return { kind: 'historyQuerySouth', connectorType: suffix };
    case 'historyQueryNorth':
      return { kind: 'historyQueryNorth', connectorType: suffix };
    case 'transformer':
      return { kind: 'transformer', functionName: suffix };
    default:
      // A scope prefix the registry declares but this switch was never updated for. Throwing here
      // (rather than silently falling back to envelope-scope, which would `Object.assign` the
      // upgrade's return value onto the whole envelope) turns a registry/code drift bug into a
      // loud, nothing-written rejection instead of silent top-level corruption.
      throw new Error(`Unknown settings-upgrade scope "${scope}"`);
  }
}

/**
 * Runs the upgrade-then-validate half of the config import pipeline: brings an older exported
 * envelope's settings blobs up to the shape current manifests expect (via the shared
 * settings-upgrade registry), then validates every settings blob against those manifests with the
 * same `JoiValidator` the create/update endpoints use. Performs no repository writes of its own —
 * it hands back the (possibly rewritten) envelope and the list of upgrades that were applied so a
 * later stage can transactionally wipe and recreate the local configuration from it.
 */
export default class ConfigImportService {
  constructor(
    private validator: JoiValidator,
    // The remaining constructor params are only used by `importConfiguration` (the transactional
    // wipe+recreate write path) — `validateAndUpgrade` alone needs none of them, which is why the
    // 4a-era test suite can keep constructing this service with only a validator.
    private database?: Database,
    private scanModeRepository?: ScanModeRepository,
    private ipFilterRepository?: IpFilterRepository,
    private certificateRepository?: CertificateRepository,
    private transformerRepository?: TransformerRepository,
    private southConnectorRepository?: SouthConnectorRepository,
    private northConnectorRepository?: NorthConnectorRepository,
    private historyQueryRepository?: HistoryQueryRepository,
    private userRepository?: UserRepository
  ) {}

  async validateAndUpgrade(rawInput: unknown): Promise<{ envelope: ConfigExportEnvelopeDTO; appliedUpgrades: Array<AppliedUpgrade> }> {
    const envelope = await this.parseEnvelope(rawInput);

    if (envelope.formatVersion > SUPPORTED_FORMAT_VERSION) {
      throw new ConfigImportError(
        `Unsupported export format version ${envelope.formatVersion}: this OIBus instance supports up to format version ${SUPPORTED_FORMAT_VERSION}`
      );
    }

    const upgrades = getUpgradesNewerThan(envelope.oibusVersion);
    const appliedUpgrades = this.applyUpgrades(envelope, upgrades);

    const validationErrors = await this.validateEnvelope(envelope);
    if (validationErrors.length > 0) {
      throw new ConfigImportError(
        'Imported configuration failed validation after applying settings upgrades; nothing was imported',
        validationErrors
      );
    }

    return { envelope, appliedUpgrades };
  }

  /**
   * Validates only the top-level envelope shape (presence and basic type of every section the
   * rest of the pipeline reaches into) — not the manifest-specific settings blobs inside those
   * sections, which `validateEnvelope` handles once upgrades have had a chance to run.
   */
  private async parseEnvelope(rawInput: unknown): Promise<ConfigExportEnvelopeDTO> {
    try {
      await this.validator.validate(ENVELOPE_SHAPE_SCHEMA, rawInput as object);
    } catch (error: unknown) {
      throw new ConfigImportError(`Malformed configuration export file: ${(error as Error).message}`);
    }
    return rawInput as ConfigExportEnvelopeDTO;
  }

  /**
   * Applies every upgrade entry (ascending) to every matching section of the envelope, mutating it
   * in place, and returns the flattened list of what was applied (one entry per matching
   * connector/history query/transformer instance, not one per registry entry).
   */
  private applyUpgrades(envelope: ConfigExportEnvelopeDTO, upgrades: Array<SettingsUpgradeEntry>): Array<AppliedUpgrade> {
    const applied: Array<AppliedUpgrade> = [];

    for (const upgrade of upgrades) {
      let scope: ParsedScope;
      try {
        scope = parseScope(upgrade.scope);
      } catch (error: unknown) {
        // A registry entry this build's `parseScope` doesn't understand is a code/registry drift
        // bug, not bad user input — but it must still fail the whole import loudly (nothing
        // written) rather than silently mis-applying the upgrade, per the "registry gap fails
        // import loudly" requirement.
        throw new ConfigImportError(
          `Invalid settings-upgrade registry entry "${upgrade.scope}@${upgrade.version}": ${(error as Error).message}`
        );
      }

      switch (scope.kind) {
        case 'envelope': {
          Object.assign(envelope, upgrade.apply(envelope as unknown as Record<string, unknown>));
          applied.push({ scope: upgrade.scope, version: upgrade.version });
          break;
        }

        case 'engine': {
          const engine = envelope.fullConfiguration.engine;
          engine.settings = upgrade.apply(engine.settings as unknown as Record<string, unknown>) as unknown as typeof engine.settings;
          applied.push({ scope: upgrade.scope, version: upgrade.version, entityId: engine.oIBusInternalId });
          break;
        }

        case 'south': {
          const connectorType = scope.connectorType;
          applied.push(
            ...this.applyToMatchingEntities(
              envelope.fullConfiguration.southConnectors,
              south => south.type === connectorType,
              south => south.settings.settings,
              (south, settings) => (south.settings.settings = settings as unknown as typeof south.settings.settings),
              south => south.oIBusInternalId,
              upgrade
            )
          );
          break;
        }

        case 'north': {
          const connectorType = scope.connectorType;
          applied.push(
            ...this.applyToMatchingEntities(
              envelope.fullConfiguration.northConnectors,
              north => north.type === connectorType,
              north => north.settings.settings,
              (north, settings) => (north.settings.settings = settings as unknown as typeof north.settings.settings),
              north => north.oIBusInternalId,
              upgrade
            )
          );
          break;
        }

        case 'historyQuerySouth': {
          const connectorType = scope.connectorType;
          applied.push(
            ...this.applyToMatchingEntities(
              envelope.historyQueries.historyQueries,
              historyQuery => historyQuery.settings.southType === connectorType,
              historyQuery => historyQuery.settings.southSettings,
              (historyQuery, settings) =>
                (historyQuery.settings.southSettings = settings as unknown as typeof historyQuery.settings.southSettings),
              historyQuery => historyQuery.oIBusInternalId,
              upgrade
            )
          );
          break;
        }

        case 'historyQueryNorth': {
          const connectorType = scope.connectorType;
          applied.push(
            ...this.applyToMatchingEntities(
              envelope.historyQueries.historyQueries,
              historyQuery => historyQuery.settings.northType === connectorType,
              historyQuery => historyQuery.settings.northSettings,
              (historyQuery, settings) =>
                (historyQuery.settings.northSettings = settings as unknown as typeof historyQuery.settings.northSettings),
              historyQuery => historyQuery.oIBusInternalId,
              upgrade
            )
          );
          break;
        }

        case 'transformer': {
          const functionName = scope.functionName;
          applied.push(
            ...this.applyToMatchingEntities(
              envelope.fullConfiguration.transformers,
              transformer =>
                transformer.type === 'standard' &&
                (transformer.settings as unknown as { functionName: string }).functionName === functionName,
              transformer => transformer.settings,
              (transformer, settings) => (transformer.settings = settings as unknown as typeof transformer.settings),
              transformer => transformer.oIBusInternalId,
              upgrade
            )
          );
          break;
        }
      }
    }

    return applied;
  }

  /**
   * Shared by every type-keyed `applyUpgrades` branch (south, north, historyQuerySouth,
   * historyQueryNorth, transformer): filters `entities` down to the ones this upgrade's scope
   * matches, runs `upgrade.apply` on the one settings field `getSettings`/`setSettings` read and
   * write, and records one `AppliedUpgrade` per matching entity.
   */
  private applyToMatchingEntities<T>(
    entities: Array<T>,
    matches: (entity: T) => boolean,
    getSettings: (entity: T) => unknown,
    setSettings: (entity: T, settings: Record<string, unknown>) => void,
    getEntityId: (entity: T) => string,
    upgrade: SettingsUpgradeEntry
  ): Array<AppliedUpgrade> {
    const applied: Array<AppliedUpgrade> = [];
    for (const entity of entities) {
      if (!matches(entity)) continue;
      setSettings(entity, upgrade.apply(getSettings(entity) as Record<string, unknown>));
      applied.push({ scope: upgrade.scope, version: upgrade.version, entityId: getEntityId(entity) });
    }
    return applied;
  }

  /**
   * Validates every manifest-driven settings blob in the envelope against the current manifest for
   * its type, using the exact same `JoiValidator.validateSettings` the create/update endpoints use.
   * Runs every check rather than stopping at the first failure, so a rejected import reports every
   * problem at once. Transformer settings are not manifest-validated here: a transformer's own
   * `settings` (name/description/functionName/customCode/…) has no `JoiValidator`-checked schema
   * anywhere in the codebase today — only the `options` a south/north/history query passes *into* a
   * transformer are schema-checked, and that is out of scope for this pipeline.
   */
  private async validateEnvelope(envelope: ConfigExportEnvelopeDTO): Promise<Array<ConfigImportEntityValidationError>> {
    const errors: Array<ConfigImportEntityValidationError> = [];

    for (const south of envelope.fullConfiguration.southConnectors) {
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

    for (const north of envelope.fullConfiguration.northConnectors) {
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

    for (const historyQuery of envelope.historyQueries.historyQueries) {
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
   * transactionally wipes every in-scope section of the local configuration and recreates it from
   * the (possibly upgraded) envelope, preserving every entity's original id. Nothing is written if
   * `validateAndUpgrade` rejects the envelope.
   *
   * Out of scope by design, per the issue: the engine's own settings and the OIAnalytics
   * registration are exported for informational purposes only and are never written back here.
   *
   * Every imported south/north connector settings blob is exactly as validated in
   * `validateAndUpgrade` — but every secret-shaped field in it is an empty string, because secrets
   * are never exported (`EncryptionService.filterSecrets`, used by the export side, strips them the
   * same way the local `settings` column already represents "no secret configured"). Left enabled,
   * such a connector would immediately fail to connect with empty credentials, or — worse for a
   * write-capable protocol — connect successfully to a real target with no meaningful settings. Every
   * imported south and north connector is therefore forced `enabled: false` here regardless of the
   * exported value; the response's `warnings` says so once, not per connector, so the caller must
   * re-enter credentials and re-enable each connector manually before it runs again.
   *
   * Two sections get special handling so the import can never lock its own caller out or delete a
   * reserved id nothing reseeds after startup:
   *  - The user calling this (`importedBy`) is never deleted or recreated, and any envelope user
   *    sharing their login is skipped, so the account used to run the import always keeps working
   *    with its existing password.
   *  - The reserved `'subscription'` scan mode (used by push-driven south connectors) is never
   *    deleted; if the envelope also describes it, it is updated in place instead of recreated.
   */
  async importConfiguration(rawInput: unknown, importedBy: string): Promise<ConfigImportResponseDTO> {
    const { envelope, appliedUpgrades } = await this.validateAndUpgrade(rawInput);
    if (
      !this.database ||
      !this.scanModeRepository ||
      !this.ipFilterRepository ||
      !this.certificateRepository ||
      !this.transformerRepository ||
      !this.southConnectorRepository ||
      !this.northConnectorRepository ||
      !this.historyQueryRepository ||
      !this.userRepository
    ) {
      throw new Error('ConfigImportService was constructed without the repositories required to write an import');
    }

    const currentUser = this.userRepository.findById(importedBy);
    if (!currentUser) {
      throw new Error('Config import must be run by an authenticated, existing user');
    }

    const warnings: Array<string> = [];

    // Excluded on EITHER match, not just login: `wipeConfiguration` below preserves the local row
    // by `id` (it's the only stable key across a login rename), so an envelope entry whose id
    // matches the importer's own id must never be recreated — that row was never deleted, and
    // re-inserting it would collide on the primary key. The login match is kept alongside it for
    // the (rarer, but `login` is UNIQUE at the DB level too) case of an envelope entry describing a
    // different id but the same login as the importer.
    const usersToImport = envelope.fullConfiguration.users.filter(
      user => user.oIBusInternalId !== currentUser.id && user.settings.login !== currentUser.login
    );
    if (usersToImport.length < envelope.fullConfiguration.users.length) {
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

    const importedConnectorCount = envelope.fullConfiguration.southConnectors.length + envelope.fullConfiguration.northConnectors.length;
    if (importedConnectorCount > 0) {
      warnings.push(
        `${importedConnectorCount} south/north connector(s) were imported without credentials (secrets are never exported) and have ` +
          `been disabled; re-enter their settings and re-enable each one manually before they run again.`
      );
    }

    const runImport = this.database.transaction(() => {
      this.wipeConfiguration(importedBy, currentUser.id);
      this.recreateConfiguration(envelope, importedBy, hashedUserPasswords, warnings);
    });
    try {
      runImport();
    } catch (error: unknown) {
      // Nothing that reaches this point was caught by `validateAndUpgrade`'s manifest validation —
      // e.g. two envelope entries sharing an id, or a malformed reserved scan mode entry — so it
      // surfaces here as a raw repository/SQLite error instead. better-sqlite3's `transaction()`
      // wrapper has already rolled back everything (including `wipeConfiguration`) by the time this
      // catch runs, so the local configuration is guaranteed untouched; this only replaces an
      // unhandled 500 with the same clean, structured rejection every other failure mode in this
      // pipeline produces.
      throw new ConfigImportError(
        `Config import failed while writing the new configuration: ${(error as Error).message}. The local configuration was not modified.`
      );
    }

    return {
      appliedUpgrades: appliedUpgrades.map(upgrade => ({ scope: upgrade.scope, version: upgrade.version, entityId: upgrade.entityId })),
      warnings
    };
  }

  /**
   * Deletes every row in every section this import writes to, in the reverse of the creation order
   * `recreateConfiguration` uses — so a row is always deleted before whatever it references. Loops
   * existing per-id `delete*` methods inside the enclosing transaction rather than adding new bulk
   * `deleteAll` repository methods, per the plan's default (only add one if looping proves
   * insufficient — it hasn't).
   *
   * `preserveUserId` is never deleted (the account running the import must keep working), and the
   * reserved `'subscription'` scan mode is never deleted (nothing reseeds it after process startup,
   * so once gone it stays gone).
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
   * Recreates every in-scope section from the envelope, in FK-safe order: scan modes → ip filters →
   * certificates → transformers → south connectors (+ items/groups) → north connectors → history
   * queries → users. Every entity is written under its original exported id — see the id-preservation
   * patches in each repository's `save*`/`create` method for how that is made safe.
   */
  private recreateConfiguration(
    envelope: ConfigExportEnvelopeDTO,
    importedBy: string,
    hashedUserPasswords: Array<{ user: ConfigExportEnvelopeDTO['fullConfiguration']['users'][number]; hashedPassword: string }>,
    warnings: Array<string>
  ): void {
    for (const scanMode of envelope.fullConfiguration.scanModes) {
      // The reserved scan mode was never deleted by `wipeConfiguration`, so it must be updated in
      // place rather than (re)created, or the insert would collide with the still-existing row.
      if (scanMode.oIBusInternalId === RESERVED_SCAN_MODE_ID) {
        this.scanModeRepository!.update(RESERVED_SCAN_MODE_ID, scanMode.settings, importedBy);
      } else {
        this.scanModeRepository!.create(scanMode.settings, importedBy, scanMode.oIBusInternalId);
      }
    }

    for (const ipFilter of envelope.fullConfiguration.ipFilters) {
      this.ipFilterRepository!.create(ipFilter.settings, importedBy, ipFilter.oIBusInternalId);
    }

    for (const certificate of envelope.fullConfiguration.certificates) {
      // Private keys are never exported (`CertificateDTO` has no such field) — the certificate is
      // still recreated under its original id, so anything referencing it by id keeps resolving,
      // but with an empty private key that makes it unusable for TLS until re-imported.
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

    const transformerIdMap = this.recreateTransformers(envelope, importedBy, warnings);

    for (const south of envelope.fullConfiguration.southConnectors) {
      this.southConnectorRepository!.saveSouth(this.buildSouthEntity(south, importedBy));
    }

    for (const north of envelope.fullConfiguration.northConnectors) {
      this.northConnectorRepository!.saveNorth(this.buildNorthEntity(north, importedBy, transformerIdMap, warnings));
    }

    for (const historyQuery of envelope.historyQueries.historyQueries) {
      this.historyQueryRepository!.saveHistory(this.buildHistoryEntity(historyQuery, importedBy, transformerIdMap, warnings));
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
   * Recreates every custom transformer under its original id, and builds a map from every exported
   * transformer's original id (custom or standard) to the id it should be referenced by locally.
   * Standard transformers are never recreated (they are seeded once at process startup with their
   * own, independently generated ids) — they are instead matched to the equivalent local standard
   * transformer by `functionName`, since that is the only stable identity they have across installs.
   */
  private recreateTransformers(envelope: ConfigExportEnvelopeDTO, importedBy: string, warnings: Array<string>): Map<string, string> {
    const transformerIdMap = new Map<string, string>();

    for (const transformer of envelope.fullConfiguration.transformers) {
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
      this.transformerRepository!.save(customTransformer);
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
   * Builds a `TransformerSource` from its exported command shape. Only `.id` (and, for a south
   * source, the south/group/item ids threaded through it) is ever read back out of these objects by
   * `NorthConnectorRepository`'s persistence SQL, so the south/group/item objects here are
   * deliberately minimal id-only stand-ins rather than full entities re-read from the repositories.
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
    entry: ConfigExportEnvelopeDTO['historyQueries']['historyQueries'][number],
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
