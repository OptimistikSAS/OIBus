import { compareVersions } from './version-compare';
import { opcuaMaxParallelRunUpgrades } from './3.9/v3.9.0';

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
 * shape current manifests expect, the same way an entity migration backfills one column. `version`
 * is the OIBus version that introduced the shape change (the same version that should carry a
 * matching knex entity migration for existing installs).
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
 */
export const SETTINGS_UPGRADE_REGISTRY: Array<SettingsUpgradeEntry> = [...opcuaMaxParallelRunUpgrades];

/**
 * Returns every registry entry whose `version` is strictly newer than `version`, sorted ascending
 * (oldest first) so callers can apply them in the order the shape changes actually happened.
 */
export function getUpgradesNewerThan(version: string): Array<SettingsUpgradeEntry> {
  return SETTINGS_UPGRADE_REGISTRY.filter(entry => compareVersions(entry.version, version) > 0).sort((a, b) =>
    compareVersions(a.version, b.version)
  );
}
