import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions } from './version-compare';

describe('compareVersions', () => {
  it('returns 0 for identical versions', () => {
    assert.strictEqual(compareVersions('3.9.0', '3.9.0'), 0);
  });

  it('sorts "3.10" after "3.9" numerically instead of lexicographically', () => {
    assert.ok(compareVersions('3.10', '3.9') > 0);
    assert.ok(compareVersions('3.9', '3.10') < 0);
  });

  it('compares differing part counts, falling back to "" on the shorter side', () => {
    assert.ok(compareVersions('1', '1.2') < 0);
    assert.ok(compareVersions('1.2', '1') > 0);
  });

  it('treats numerically-equal, textually-different parts as equal', () => {
    assert.strictEqual(compareVersions('01', '1'), 0);
    assert.strictEqual(compareVersions('3.09.0', '3.9.0'), 0);
  });

  it('falls back to a string comparison for non-numeric parts', () => {
    assert.ok(compareVersions('x.1', 'x.2') < 0);
    assert.ok(compareVersions('x.2', 'x.1') > 0);
    assert.strictEqual(compareVersions('x.1', 'x.1'), 0);
  });

  it('resolves a full three-part semantic version comparison', () => {
    assert.ok(compareVersions('3.9.1', '3.9.0') > 0);
    assert.ok(compareVersions('3.9.0', '3.9.1') < 0);
    assert.ok(compareVersions('4.0.0', '3.9.9') > 0);
  });

  it('sorts a pre-release before its release', () => {
    assert.ok(compareVersions('3.9.0-beta-6', '3.9.0') < 0);
    assert.ok(compareVersions('3.9.0', '3.9.0-beta-6') > 0);
    assert.ok(compareVersions('3.10.0-beta-1', '3.10.0') < 0);
  });

  it('sorts a pre-release after the previous release', () => {
    assert.ok(compareVersions('3.10.0-beta-1', '3.9.3') > 0);
    assert.ok(compareVersions('3.9.3', '3.10.0-beta-1') < 0);
  });

  it('compares pre-release numbers numerically', () => {
    assert.ok(compareVersions('3.9.0-beta-10', '3.9.0-beta-9') > 0);
    assert.ok(compareVersions('3.9.0-beta-9', '3.9.0-beta-10') < 0);
    assert.strictEqual(compareVersions('3.9.0-beta-6', '3.9.0-beta-6'), 0);
  });

  it('accepts dot-separated pre-release identifiers', () => {
    assert.ok(compareVersions('3.9.0-beta.2', '3.9.0-beta.1') > 0);
    assert.ok(compareVersions('3.9.0-beta.1', '3.9.0') < 0);
  });

  it('sorts a pre-release with more identifiers after its prefix', () => {
    assert.ok(compareVersions('3.9.0-beta', '3.9.0-beta-1') < 0);
  });
});
