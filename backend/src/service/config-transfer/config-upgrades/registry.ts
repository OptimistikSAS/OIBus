import { compareVersions } from './version-compare';
import { ConfigUpgrade } from './config-upgrade';
import { upgrade as v3_9_2 } from './3.9/v3.9.2';
import { upgrade as v3_10_0 } from './3.10/v3.10.0';

/**
 * Every config upgrade step, in any order (`getUpgradesBetween` sorts them). The oldest configuration
 * an import accepts comes from OIBus 3.9.0 (see `MINIMUM_SUPPORTED_VERSION`), so changes from earlier
 * versions are handled by their entity migrations alone and have no step here.
 */
export const CONFIG_UPGRADES: Array<ConfigUpgrade> = [v3_9_2, v3_10_0];

/**
 * Returns the steps that bring a configuration exported by `fromVersion` to the shape of `toVersion`:
 * every step strictly newer than `fromVersion` and not newer than `toVersion`, oldest first.
 */
export function getUpgradesBetween(fromVersion: string, toVersion: string): Array<ConfigUpgrade> {
  return CONFIG_UPGRADES.filter(
    upgrade => compareVersions(upgrade.version, fromVersion) > 0 && compareVersions(upgrade.version, toVersion) <= 0
  ).sort((a, b) => compareVersions(a.version, b.version));
}
