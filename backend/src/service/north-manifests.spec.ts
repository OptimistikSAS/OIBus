import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { northManifestList } from './north-manifests';

describe('northManifestList', () => {
  it('exports an array', () => {
    assert.ok(Array.isArray(northManifestList));
  });

  it('contains one manifest per registered north connector', () => {
    assert.equal(northManifestList.length, 10);
  });

  it('contains only manifests with a non-empty unique id', () => {
    const ids = northManifestList.map(manifest => manifest.id);
    assert.equal(ids.length, new Set(ids).size);
    for (const id of ids) {
      assert.equal(typeof id, 'string');
      assert.ok(id.length > 0);
    }
  });

  it('includes the expected connector ids', () => {
    const ids: Array<string> = northManifestList.map(manifest => manifest.id);
    for (const expected of ['console', 'oianalytics', 'azure-blob', 'aws-s3', 'file-writer', 'sftp', 'rest', 'opcua', 'modbus', 'mqtt']) {
      assert.ok(ids.includes(expected), `expected northManifestList to include '${expected}'`);
    }
  });

  it('every manifest exposes a settings attribute tree, a category and supported types', () => {
    for (const manifest of northManifestList) {
      assert.ok(manifest.settings, `manifest '${manifest.id}' should have settings`);
      assert.equal(typeof manifest.category, 'string');
      assert.ok(Array.isArray(manifest.types));
      assert.ok(manifest.types.length > 0);
    }
  });
});
