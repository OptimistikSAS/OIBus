import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { southManifestList } from './south-manifests';

describe('southManifestList', () => {
  it('exports an array', () => {
    assert.ok(Array.isArray(southManifestList));
  });

  it('contains one manifest per registered south connector', () => {
    assert.equal(southManifestList.length, 21);
  });

  it('contains only manifests with a non-empty unique id', () => {
    const ids = southManifestList.map(manifest => manifest.id);
    assert.equal(ids.length, new Set(ids).size);
    for (const id of ids) {
      assert.equal(typeof id, 'string');
      assert.ok(id.length > 0);
    }
  });

  it('includes the expected connector ids', () => {
    const ids: Array<string> = southManifestList.map(manifest => manifest.id);
    for (const expected of [
      'folder-scanner',
      'mqtt',
      'opcua',
      'opc',
      'mssql',
      'mysql',
      'odbc',
      'oledb',
      'oracle',
      'postgresql',
      'sqlite',
      'ads',
      'modbus',
      'oianalytics',
      'osisoft-pi',
      'rest',
      's7',
      'sftp',
      'ftp',
      'influxdb'
    ]) {
      assert.ok(ids.includes(expected), `expected southManifestList to include '${expected}'`);
    }
  });

  it('every manifest exposes an items schema, a category and settings', () => {
    for (const manifest of southManifestList) {
      assert.ok(manifest.settings, `manifest '${manifest.id}' should have settings`);
      assert.ok(manifest.items, `manifest '${manifest.id}' should have an items schema`);
      assert.equal(typeof manifest.category, 'string');
    }
  });
});
