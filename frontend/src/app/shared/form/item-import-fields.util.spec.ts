import { describe, expect, test } from 'vitest';
import { deriveItemImportFields } from './item-import-fields.util';
import { OIBusObjectAttribute } from '../../../../../backend/shared/model/form.model';
import { SouthConnectorManifest } from '../../../../../backend/shared/model/south-connector.model';

function buildManifest(settingsAttribute: Partial<OIBusObjectAttribute>): SouthConnectorManifest {
  return {
    items: {
      rootAttribute: {
        attributes: [
          {
            type: 'settings',
            key: 'settings',
            attributes: [],
            enablingConditions: [],
            ...settingsAttribute
          }
        ]
      }
    }
  } as unknown as SouthConnectorManifest;
}

describe('deriveItemImportFields', () => {
  test('always includes the base name and enabled headers', () => {
    const manifest = buildManifest({ key: 'settings', attributes: [], enablingConditions: [] });

    const { expectedHeaders, optionalHeaders } = deriveItemImportFields(manifest);

    expect(expectedHeaders).toEqual(['name', 'enabled']);
    expect(optionalHeaders).toEqual([]);
  });

  test('splits settings between expected and optional headers based on enabling conditions (folder-scanner-like manifest)', () => {
    const manifest = buildManifest({
      key: 'settings',
      attributes: [
        { key: 'regex' } as OIBusObjectAttribute,
        { key: 'minAge' } as OIBusObjectAttribute,
        { key: 'preserveFiles' } as OIBusObjectAttribute
      ],
      enablingConditions: [{ targetPathFromRoot: 'minAge', referralPathFromRoot: 'preserveFiles', values: [true], operator: 'EQUALS' }]
    });

    const { expectedHeaders, optionalHeaders } = deriveItemImportFields(manifest);

    expect(expectedHeaders).toEqual(['name', 'enabled', 'settings_regex', 'settings_preserveFiles']);
    expect(optionalHeaders).toEqual(['settings_minAge']);
  });

  test('splits settings between expected and optional headers based on enabling conditions (opcua-like manifest)', () => {
    const manifest = buildManifest({
      key: 'settings',
      attributes: [
        { key: 'nodeId' } as OIBusObjectAttribute,
        { key: 'mode' } as OIBusObjectAttribute,
        { key: 'maxAge' } as OIBusObjectAttribute,
        { key: 'deadband' } as OIBusObjectAttribute
      ],
      enablingConditions: [
        { targetPathFromRoot: 'maxAge', referralPathFromRoot: 'mode', values: ['HA'], operator: 'EQUALS' },
        { targetPathFromRoot: 'deadband', referralPathFromRoot: 'mode', values: ['DA'], operator: 'EQUALS' }
      ]
    });

    const { expectedHeaders, optionalHeaders } = deriveItemImportFields(manifest);

    expect(expectedHeaders).toEqual(['name', 'enabled', 'settings_nodeId', 'settings_mode']);
    expect(optionalHeaders).toEqual(['settings_maxAge', 'settings_deadband']);
  });

  test('returns only the base headers when the settings object has no attributes', () => {
    const manifest = buildManifest({ key: 'settings', attributes: [], enablingConditions: [] });

    const { expectedHeaders, optionalHeaders } = deriveItemImportFields(manifest);

    expect(expectedHeaders).toEqual(['name', 'enabled']);
    expect(optionalHeaders).toEqual([]);
  });
});
