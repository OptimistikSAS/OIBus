import { compareVersions } from './version-compare';

/**
 * The part of an exported/imported configuration a settings-upgrade entry rewrites: either the
 * top-level export envelope itself, the engine settings blob, a south/north connector's settings
 * (keyed by connector `type`), a history query's south/north settings, or a transformer's
 * settings — mirroring the `entity-migrations/<major>/<major.minor>/` grouping used for the
 * equivalent knex entity migrations.
 */
export type SettingsUpgradeScope =
  | 'envelope'
  | 'engine'
  | `south:${string}`
  | `north:${string}`
  | `historyQuerySouth:${string}`
  | `historyQueryNorth:${string}`
  | `transformer:${string}`;

/**
 * A single forward-only settings upgrade: rewrites one settings JSON blob so it matches the
 * shape current manifests expect, the same way an entity migration backfills one column.
 *
 * `version` is the exact OIBus version, pre-release tag included, that introduced the shape change
 * (e.g. '3.11.0-beta-3' if it landed in that beta, not '3.11.0'), and the same version that should
 * carry a matching knex entity migration for existing installs.
 *
 * `apply` must be idempotent (`apply(apply(x))` deep-equals `apply(x)`) and must leave settings that
 * already have the new shape untouched: add a field only when it is missing (`settings.x ?? default`),
 * remove or rename one only when it is present. An export's `oibusVersion` is only a coarse marker of
 * its settings shape: an entry tagged '3.11.0' also runs on an export from '3.11.0-beta-4', which
 * may already carry the change if it landed in beta-3, so an upgrade must never clobber a value the
 * user set. Every entry needs an idempotency fixture in `registry.spec.ts`.
 */
export interface SettingsUpgradeEntry {
  version: string;
  scope: SettingsUpgradeScope;
  apply: (sectionJson: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Every known settings upgrade, DB-agnostic, reused both by knex entity migrations (which apply
 * an entry's `apply` function against rows in the local db) and by the config-import
 * upgrade pipeline (which applies matching entries against sections of an imported envelope). Not
 * pre-sorted — use `getUpgradesNewerThan` to get entries in application order.
 *
 * Config export/import first shipped in 3.10.0, so no export predates it: settings-shape changes
 * from earlier versions are handled by their knex entity migrations alone and have no entry here.
 */
export const SETTINGS_UPGRADE_REGISTRY: Array<SettingsUpgradeEntry> = [];

/**
 * Returns every registry entry whose `version` is strictly newer than `version`, sorted ascending
 * (oldest first) so callers can apply them in the order the shape changes actually happened.
 */
export function getUpgradesNewerThan(version: string): Array<SettingsUpgradeEntry> {
  return SETTINGS_UPGRADE_REGISTRY.filter(entry => compareVersions(entry.version, version) > 0).sort((a, b) =>
    compareVersions(a.version, b.version)
  );
}
