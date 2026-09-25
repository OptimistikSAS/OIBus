import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG_UPGRADES, getUpgradesBetween } from './registry';
import { ConfigUpgrade } from './config-upgrade';
import { compareVersions } from './version-compare';
import { MINIMUM_SUPPORTED_VERSION } from '../config-import.service';

describe('CONFIG_UPGRADES', () => {
  it('has unique versions', () => {
    const versions = CONFIG_UPGRADES.map(upgrade => upgrade.version);
    assert.deepStrictEqual(versions, [...new Set(versions)]);
  });

  it('only contains versions newer than the oldest configuration an import accepts', () => {
    assert.deepStrictEqual(
      CONFIG_UPGRADES.filter(upgrade => compareVersions(upgrade.version, MINIMUM_SUPPORTED_VERSION) <= 0),
      []
    );
  });
});

describe('getUpgradesBetween', () => {
  const step = (version: string): ConfigUpgrade => ({ version, description: version, apply: config => config });
  let originalUpgrades: Array<ConfigUpgrade>;

  beforeEach(() => {
    originalUpgrades = CONFIG_UPGRADES.splice(
      0,
      CONFIG_UPGRADES.length,
      step('3.11.0'),
      step('3.10.1'),
      step('3.11.0-beta-3'),
      step('3.12.0')
    );
  });

  afterEach(() => {
    CONFIG_UPGRADES.splice(0, CONFIG_UPGRADES.length, ...originalUpgrades);
  });

  const versionsBetween = (from: string, to: string): Array<string> => getUpgradesBetween(from, to).map(upgrade => upgrade.version);

  it('returns the steps newer than the export and not newer than this OIBus, oldest first', () => {
    assert.deepStrictEqual(versionsBetween('3.10.0', '3.11.0'), ['3.10.1', '3.11.0-beta-3', '3.11.0']);
  });

  it('excludes a step at exactly the export version, and includes one at exactly this OIBus version', () => {
    assert.deepStrictEqual(versionsBetween('3.10.1', '3.11.0-beta-3'), ['3.11.0-beta-3']);
  });

  it("includes a release's steps when importing an export from one of its pre-releases", () => {
    assert.deepStrictEqual(versionsBetween('3.11.0-beta-1', '3.11.0'), ['3.11.0-beta-3', '3.11.0']);
  });

  it('returns nothing when the export is at the version of this OIBus', () => {
    assert.deepStrictEqual(versionsBetween('3.12.0', '3.12.0'), []);
  });
});
