import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS_UPGRADE_REGISTRY, getUpgradesNewerThan } from './registry';
import { opcuaMaxParallelRunUpgrades } from './3.9/v3.9.0';

describe('SETTINGS_UPGRADE_REGISTRY', () => {
  it('contains the opcua maxParallelRun entries', () => {
    assert.deepStrictEqual(SETTINGS_UPGRADE_REGISTRY, opcuaMaxParallelRunUpgrades);
  });
});

describe('getUpgradesNewerThan', () => {
  it('returns entries strictly newer than the given version', () => {
    const upgrades = getUpgradesNewerThan('3.8.0');

    assert.strictEqual(upgrades.length, 2);
    assert.ok(upgrades.every(entry => entry.version === '3.9.0'));
  });

  it('excludes entries at exactly the given version (strictly newer, not newer-or-equal)', () => {
    const upgrades = getUpgradesNewerThan('3.9.0');

    assert.deepStrictEqual(upgrades, []);
  });

  it('excludes entries older than the given version', () => {
    const upgrades = getUpgradesNewerThan('3.10.0');

    assert.deepStrictEqual(upgrades, []);
  });

  it('returns entries sorted ascending by version', () => {
    const upgrades = getUpgradesNewerThan('0.0.0');

    const versions = upgrades.map(entry => entry.version);
    const sorted = [...versions].sort();
    // All current entries share the same version (3.9.0), so this mainly pins the
    // filter+sort contract; it will start exercising real reordering once a second
    // version is added to the registry.
    assert.deepStrictEqual(versions, sorted);
    assert.strictEqual(upgrades.length, SETTINGS_UPGRADE_REGISTRY.length);
  });
});
