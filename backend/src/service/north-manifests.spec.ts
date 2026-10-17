import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { OIBusObjectAttribute } from '../../shared/model/connector/form.model';

import { findInvalidSelectDefaults } from '../tests/utils/manifest-test-utils';
import { northManifestList } from './north-manifests';

describe('northManifestList', () => {
  it('exports an array', () => {
    assert.ok(Array.isArray(northManifestList));
  });

  it('contains one manifest per registered north connector', () => {
    assert.equal(northManifestList.length, 11);
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
    for (const expected of [
      'console',
      'oianalytics',
      'azure-blob',
      'azure-data-explorer',
      'aws-s3',
      'file-writer',
      'sftp',
      'rest',
      'opcua',
      'modbus',
      'mqtt'
    ]) {
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

  it('every string-select default value is one of its selectable values', () => {
    assert.deepStrictEqual(
      northManifestList.flatMap(manifest => findInvalidSelectDefaults(manifest, manifest.id)),
      []
    );
  });

  it('oianalytics shows the scope for both AAD authentications', () => {
    const settings = northManifestList.find(manifest => manifest.id === 'oianalytics')!.settings;
    const specificSettings = settings.attributes.find(attribute => attribute.key === 'specificSettings') as OIBusObjectAttribute;
    const scopeCondition = specificSettings.enablingConditions.find(condition => condition.targetPathFromRoot === 'scope');
    assert.deepStrictEqual(scopeCondition?.values, ['aad-client-secret', 'aad-certificate']);
  });
});
