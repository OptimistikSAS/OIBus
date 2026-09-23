import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS_UPGRADE_REGISTRY, SettingsUpgradeEntry, getUpgradesNewerThan } from './registry';

/**
 * Sample inputs for every registry entry, keyed by `${scope}@${version}`: at least one settings
 * blob in the old shape and one already in the new shape (with a user-set value, so an upgrade
 * that overwrites instead of defaulting is caught). Required for every entry — see the
 * idempotency contract on `SettingsUpgradeEntry`.
 */
const IDEMPOTENCY_FIXTURES: Record<string, Array<Record<string, unknown>>> = {};

describe('SETTINGS_UPGRADE_REGISTRY', () => {
  it('has idempotency fixtures for every entry', () => {
    const missing = SETTINGS_UPGRADE_REGISTRY.map(entry => `${entry.scope}@${entry.version}`).filter(
      key => !IDEMPOTENCY_FIXTURES[key]?.length
    );
    assert.deepStrictEqual(missing, [], `add IDEMPOTENCY_FIXTURES for: ${missing.join(', ')}`);
  });

  it('only contains upgrades that are safe to run twice', () => {
    for (const entry of SETTINGS_UPGRADE_REGISTRY) {
      for (const fixture of IDEMPOTENCY_FIXTURES[`${entry.scope}@${entry.version}`] ?? []) {
        const once = entry.apply(structuredClone(fixture));
        const twice = entry.apply(structuredClone(once));
        assert.deepStrictEqual(twice, once, `${entry.scope}@${entry.version} is not idempotent for ${JSON.stringify(fixture)}`);
      }
    }
  });
});

describe('getUpgradesNewerThan', () => {
  const testEntries: Array<SettingsUpgradeEntry> = [
    { version: '3.11.0', scope: 'south:test', apply: settings => settings },
    { version: '3.10.1', scope: 'south:test', apply: settings => settings },
    { version: '3.11.0-beta-3', scope: 'north:test', apply: settings => settings }
  ];
  let originalEntries: Array<SettingsUpgradeEntry>;

  beforeEach(() => {
    originalEntries = SETTINGS_UPGRADE_REGISTRY.splice(0, SETTINGS_UPGRADE_REGISTRY.length, ...testEntries);
  });

  afterEach(() => {
    SETTINGS_UPGRADE_REGISTRY.splice(0, SETTINGS_UPGRADE_REGISTRY.length, ...originalEntries);
  });

  it('returns entries strictly newer than the given version, sorted ascending', () => {
    const upgrades = getUpgradesNewerThan('3.10.0');

    assert.deepStrictEqual(
      upgrades.map(entry => entry.version),
      ['3.10.1', '3.11.0-beta-3', '3.11.0']
    );
  });

  it('excludes entries at exactly the given version (strictly newer, not newer-or-equal)', () => {
    assert.deepStrictEqual(
      getUpgradesNewerThan('3.11.0-beta-3').map(entry => entry.version),
      ['3.11.0']
    );
  });

  it("includes a release's entries when importing an export from one of its pre-releases", () => {
    assert.deepStrictEqual(
      getUpgradesNewerThan('3.11.0-beta-1').map(entry => entry.version),
      ['3.11.0-beta-3', '3.11.0']
    );
  });

  it('returns nothing for an export at or above the newest entry', () => {
    assert.deepStrictEqual(getUpgradesNewerThan('3.11.0'), []);
    assert.deepStrictEqual(getUpgradesNewerThan('3.12.0'), []);
  });
});
