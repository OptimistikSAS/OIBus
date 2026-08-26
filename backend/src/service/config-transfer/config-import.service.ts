import Joi from 'joi';
import JoiValidator from '../../web-server/controllers/validators/joi.validator';
import { getUpgradesNewerThan, SettingsUpgradeEntry } from './settings-upgrades/registry';
import { CONFIG_EXPORT_FORMAT_VERSION } from './config-transfer.service';
import { ConfigExportEnvelopeDTO } from '../../../shared/model/config-transfer.model';
import { OIBusObjectAttribute } from '../../../shared/model/form.model';
import { southManifestList } from '../south-manifests';
import { northManifestList } from '../north-manifests';

/**
 * The highest export `formatVersion` this build of OIBus knows how to import. Deliberately the
 * same constant the export endpoint stamps onto every envelope it produces (`config-transfer.service.ts`)
 * — an import is only ever rejected for being newer than what *this* build can produce, never for
 * being older (older envelopes are what the settings-upgrade registry exists to bring forward).
 */
export const SUPPORTED_FORMAT_VERSION = CONFIG_EXPORT_FORMAT_VERSION;

export interface AppliedUpgrade {
  scope: string;
  version: string;
  entityId?: string;
}

export interface ConfigImportEntityValidationError {
  scope: string;
  entityId?: string;
  entityName?: string;
  message: string;
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

const ENVELOPE_SHAPE_SCHEMA = Joi.object({
  formatVersion: Joi.number().integer().required(),
  oibusVersion: Joi.string().required(),
  exportedAt: Joi.string().required(),
  fullConfiguration: Joi.object({
    engine: Joi.object().required(),
    registration: Joi.object().required(),
    scanModes: Joi.array().required(),
    ipFilters: Joi.array().required(),
    certificates: Joi.array().required(),
    southConnectors: Joi.array().required(),
    northConnectors: Joi.array().required(),
    users: Joi.array().required(),
    transformers: Joi.array().required()
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
      // Unreachable given SettingsUpgradeScope, but keeps this function total rather than
      // throwing on a future scope variant no one updated this switch for.
      return { kind: 'envelope' };
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
  constructor(private validator: JoiValidator) {}

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
      const scope = parseScope(upgrade.scope);

      switch (scope.kind) {
        case 'envelope': {
          Object.assign(envelope, upgrade.apply(envelope as unknown as Record<string, unknown>));
          applied.push({ scope: upgrade.scope, version: upgrade.version });
          break;
        }

        case 'engine': {
          const engine = envelope.fullConfiguration.engine;
          engine.settings = upgrade.apply(engine.settings as unknown as Record<string, unknown>) as typeof engine.settings;
          applied.push({ scope: upgrade.scope, version: upgrade.version, entityId: engine.oIBusInternalId });
          break;
        }

        case 'south': {
          for (const south of envelope.fullConfiguration.southConnectors) {
            if (south.type !== scope.connectorType) continue;
            south.settings.settings = upgrade.apply(south.settings.settings as Record<string, unknown>);
            applied.push({ scope: upgrade.scope, version: upgrade.version, entityId: south.oIBusInternalId });
          }
          break;
        }

        case 'north': {
          for (const north of envelope.fullConfiguration.northConnectors) {
            if (north.type !== scope.connectorType) continue;
            north.settings.settings = upgrade.apply(north.settings.settings as Record<string, unknown>);
            applied.push({ scope: upgrade.scope, version: upgrade.version, entityId: north.oIBusInternalId });
          }
          break;
        }

        case 'historyQuerySouth': {
          for (const historyQuery of envelope.historyQueries.historyQueries) {
            if (historyQuery.settings.southType !== scope.connectorType) continue;
            historyQuery.settings.southSettings = upgrade.apply(historyQuery.settings.southSettings as Record<string, unknown>);
            applied.push({ scope: upgrade.scope, version: upgrade.version, entityId: historyQuery.oIBusInternalId });
          }
          break;
        }

        case 'historyQueryNorth': {
          for (const historyQuery of envelope.historyQueries.historyQueries) {
            if (historyQuery.settings.northType !== scope.connectorType) continue;
            historyQuery.settings.northSettings = upgrade.apply(historyQuery.settings.northSettings as Record<string, unknown>);
            applied.push({ scope: upgrade.scope, version: upgrade.version, entityId: historyQuery.oIBusInternalId });
          }
          break;
        }

        case 'transformer': {
          for (const transformer of envelope.fullConfiguration.transformers) {
            if (transformer.type !== 'standard' || transformer.settings.functionName !== scope.functionName) continue;
            transformer.settings = upgrade.apply(transformer.settings as unknown as Record<string, unknown>) as typeof transformer.settings;
            applied.push({ scope: upgrade.scope, version: upgrade.version, entityId: transformer.oIBusInternalId });
          }
          break;
        }
      }
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
}
