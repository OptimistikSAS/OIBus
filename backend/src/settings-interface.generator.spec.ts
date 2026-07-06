/**
 * Tests for settings-interface.generator.ts.
 * Pure functions are tested directly. I/O functions use real temp directories
 * because Node.js built-in modules (node:fs) cannot be mocked via the require cache.
 */
import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import {
  capitalizeFirstLetter,
  toSnakeCase,
  buildNorthInterfaceName,
  buildSouthInterfaceName,
  buildTransformerInterfaceName,
  checkIfNullableOrUndefined,
  collectSubManifests,
  generateInterface,
  writeAttribute,
  buildTypescriptFile,
  listFiles,
  generateSettingsInterfaces,
  generateSettingsInterfacesForConnectorType,
  generateSettingsInterfacesForTransformers,
  generateTypesForManifest,
  generateTypesForTransformerManifest,
  runAsMain,
  type TypeGenerationDescription,
  type Interface,
  type Attribute
} from './settings-interface.generator';
import type { OIBusObjectAttribute, OIBusEnablingCondition, OIBusAttribute } from '../shared/model/form.model';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeObjectAttr(
  key: string,
  attrs: Array<OIBusAttribute> = [],
  conditions: Array<OIBusEnablingCondition> = []
): OIBusObjectAttribute {
  return { type: 'object', key, translationKey: key, validators: [], attributes: attrs, enablingConditions: conditions } as never;
}

function makeSimpleAttr(
  type: string,
  key: string,
  validators: Array<{ type: string }> = [],
  extraProps: Record<string, unknown> = {}
): OIBusAttribute {
  return { type, key, translationKey: key, validators, displayProperties: {}, ...extraProps } as never;
}

function emptyDesc(): TypeGenerationDescription {
  return {
    imports: new Set<string>(),
    enums: [],
    settingsInterfaces: [],
    settingsSubInterfaces: [],
    itemSettingsInterfaces: [],
    itemSettingsSubInterfaces: []
  };
}

// ─── test suite ──────────────────────────────────────────────────────────────

describe('settings-interface.generator', () => {
  let tmpDir: string;
  let origCwd: string;

  before(async () => {
    origCwd = process.cwd();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-gen-spec-'));
    // Create directory structure the generator writes to (relative to CWD).
    await fs.mkdir(path.join(tmpDir, 'shared', 'model'), { recursive: true });
    // Create empty src dirs (so listFiles works without real manifests).
    for (const d of ['src/south', 'src/north', 'src/transformers']) {
      await fs.mkdir(path.join(tmpDir, d), { recursive: true });
    }
    // Silence generator's console output.
    mock.method(console, 'info', () => undefined);
    mock.method(console, 'error', () => undefined);
  });

  after(async () => {
    process.chdir(origCwd);
    mock.restoreAll();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ── capitalizeFirstLetter / toSnakeCase ─────────────────────────────────

  describe('capitalizeFirstLetter', () => {
    it('capitalises the first character', () => {
      assert.equal(capitalizeFirstLetter('hello'), 'Hello');
      assert.equal(capitalizeFirstLetter(''), '');
      assert.equal(capitalizeFirstLetter('A'), 'A');
    });
  });

  describe('toSnakeCase', () => {
    it('converts camelCase to snake_case', () => {
      assert.equal(toSnakeCase('myFieldName'), 'my_field_name');
      assert.equal(toSnakeCase('simple'), 'simple');
    });
  });

  // ── buildNorthInterfaceName ─────────────────────────────────────────────

  describe('buildNorthInterfaceName', () => {
    const cases: Array<[string, string]> = [
      ['aws-s3', 'NorthAmazonS3Settings'],
      ['azure-blob', 'NorthAzureBlobSettings'],
      ['console', 'NorthConsoleSettings'],
      ['file-writer', 'NorthFileWriterSettings'],
      ['oianalytics', 'NorthOIAnalyticsSettings'],
      ['rest', 'NorthRESTSettings'],
      ['sftp', 'NorthSFTPSettings'],
      ['opcua', 'NorthOPCUASettings'],
      ['modbus', 'NorthModbusSettings'],
      ['mqtt', 'NorthMQTTSettings'],
      ['unknown-connector', '']
    ];
    for (const [id, expected] of cases) {
      it(`maps '${id}' → '${expected}'`, () => {
        assert.equal(buildNorthInterfaceName(id), expected);
      });
    }
  });

  // ── buildSouthInterfaceName ─────────────────────────────────────────────

  describe('buildSouthInterfaceName', () => {
    const cases: Array<[string, boolean, string]> = [
      ['ads', false, 'SouthADSSettings'],
      ['ads', true, 'SouthADSItemSettings'],
      ['folder-scanner', false, 'SouthFolderScannerSettings'],
      ['folder-scanner', true, 'SouthFolderScannerItemSettings'],
      ['ftp', false, 'SouthFTPSettings'],
      ['ftp', true, 'SouthFTPItemSettings'],
      ['influxdb', false, 'SouthInfluxDBSettings'],
      ['influxdb', true, 'SouthInfluxDBItemSettings'],
      ['modbus', false, 'SouthModbusSettings'],
      ['modbus', true, 'SouthModbusItemSettings'],
      ['mqtt', false, 'SouthMQTTSettings'],
      ['mqtt', true, 'SouthMQTTItemSettings'],
      ['mssql', false, 'SouthMSSQLSettings'],
      ['mssql', true, 'SouthMSSQLItemSettings'],
      ['mysql', false, 'SouthMySQLSettings'],
      ['mysql', true, 'SouthMySQLItemSettings'],
      ['odbc', false, 'SouthODBCSettings'],
      ['odbc', true, 'SouthODBCItemSettings'],
      ['oledb', false, 'SouthOLEDBSettings'],
      ['oledb', true, 'SouthOLEDBItemSettings'],
      ['oianalytics', false, 'SouthOIAnalyticsSettings'],
      ['oianalytics', true, 'SouthOIAnalyticsItemSettings'],
      ['opc', false, 'SouthOPCSettings'],
      ['opc', true, 'SouthOPCItemSettings'],
      ['osisoft-pi', false, 'SouthPISettings'],
      ['osisoft-pi', true, 'SouthPIItemSettings'],
      ['opcua', false, 'SouthOPCUASettings'],
      ['opcua', true, 'SouthOPCUAItemSettings'],
      ['oracle', false, 'SouthOracleSettings'],
      ['oracle', true, 'SouthOracleItemSettings'],
      ['postgresql', false, 'SouthPostgreSQLSettings'],
      ['postgresql', true, 'SouthPostgreSQLItemSettings'],
      ['rest', false, 'SouthRestSettings'],
      ['rest', true, 'SouthRestItemSettings'],
      ['sqlite', false, 'SouthSQLiteSettings'],
      ['sqlite', true, 'SouthSQLiteItemSettings'],
      ['sftp', false, 'SouthSFTPSettings'],
      ['sftp', true, 'SouthSFTPItemSettings'],
      ['unknown', false, ''],
      ['nope', true, '']
    ];
    for (const [id, itemInterface, expected] of cases) {
      it(`maps '${id}' (item=${itemInterface}) → '${expected}'`, () => {
        assert.equal(buildSouthInterfaceName(id, itemInterface), expected);
      });
    }
  });

  // ── buildTransformerInterfaceName ───────────────────────────────────────

  describe('buildTransformerInterfaceName', () => {
    it('builds from hyphenated id', () => {
      assert.equal(buildTransformerInterfaceName('csv-to-mqtt'), 'TransformerCsvToMqttSettings');
    });
  });

  // ── checkIfNullableOrUndefined ──────────────────────────────────────────

  describe('checkIfNullableOrUndefined', () => {
    const conditions: Array<OIBusEnablingCondition> = [{ targetPathFromRoot: 'enabled', conditionValue: true }] as never;

    it('nullable=true when no validators', () => {
      assert.equal(checkIfNullableOrUndefined(makeSimpleAttr('string', 'host'), []).nullable, true);
    });

    it('nullable=false when REQUIRED validator present', () => {
      assert.equal(checkIfNullableOrUndefined(makeSimpleAttr('string', 'host', [{ type: 'REQUIRED' }]), []).nullable, false);
    });

    it('undefinable=true when key matches enabling condition', () => {
      assert.equal(checkIfNullableOrUndefined(makeSimpleAttr('string', 'enabled'), conditions).undefinable, true);
    });

    it('undefinable=false when key does not match', () => {
      assert.equal(checkIfNullableOrUndefined(makeSimpleAttr('string', 'host'), conditions).undefinable, false);
    });

    it('undefinable=true when a PLATFORM validator restricts to a subset of platforms', () => {
      const attr = makeSimpleAttr('string', 'host', [{ type: 'PLATFORM', arguments: ['windows', 'linux'] } as never]);
      assert.equal(checkIfNullableOrUndefined(attr, []).undefinable, true);
    });

    it('undefinable=false when a PLATFORM validator lists every platform', () => {
      const attr = makeSimpleAttr('string', 'host', [{ type: 'PLATFORM', arguments: ['windows', 'linux', 'macos'] } as never]);
      assert.equal(checkIfNullableOrUndefined(attr, []).undefinable, false);
    });
  });

  // ── collectSubManifests ─────────────────────────────────────────────────

  describe('collectSubManifests', () => {
    it('returns empty for attributes with no object/array types', () => {
      const root = makeObjectAttr('root', [makeSimpleAttr('string', 'name')]);
      assert.deepEqual(collectSubManifests(root), []);
    });

    it('collects sub-manifests for nested object attributes', () => {
      const nested = makeObjectAttr('address', [makeSimpleAttr('string', 'street')]);
      const subs = collectSubManifests(makeObjectAttr('root', [nested]));
      assert.equal(subs.length, 1);
      assert.equal(subs[0]!.name, 'Address');
    });

    it('collects sub-manifests for array attributes', () => {
      const arrayAttr = {
        type: 'array',
        key: 'items',
        translationKey: 'items',
        validators: [],
        displayProperties: {},
        rootAttribute: makeObjectAttr('items', [makeSimpleAttr('string', 'value')])
      } as never;
      const subs = collectSubManifests(makeObjectAttr('root', [arrayAttr]));
      assert.equal(subs.length, 1);
      assert.equal(subs[0]!.name, 'Items');
    });

    it('recursively collects from nested objects', () => {
      const deep = makeObjectAttr('zone', [makeSimpleAttr('string', 'city')]);
      const mid = makeObjectAttr('location', [deep]);
      const subs = collectSubManifests(makeObjectAttr('root', [mid]));
      assert.ok(subs.length >= 2);
    });
  });

  // ── generateInterface — all switch cases ────────────────────────────────

  describe('generateInterface', () => {
    it('handles string/secret/code types', () => {
      const attrs = ['string', 'secret', 'code'].map(t => makeSimpleAttr(t, t + 'Key'));
      const result = generateInterface('MyInterface', makeObjectAttr('root', attrs), emptyDesc());
      assert.equal(result.attributes.filter((a: Attribute) => a.type === 'string').length, 3);
    });

    it('handles string-select type (creates enum)', () => {
      const desc = emptyDesc();
      generateInterface(
        'MyInterface',
        makeObjectAttr('root', [makeSimpleAttr('string-select', 'protocol', [], { selectableValues: ['A', 'B'] })]),
        desc
      );
      assert.equal(desc.enums.length, 1);
      assert.equal(desc.enums[0]!.name, 'MyInterfaceProtocol');
    });

    it('handles boolean type', () => {
      const result = generateInterface('MyInterface', makeObjectAttr('root', [makeSimpleAttr('boolean', 'enabled')]), emptyDesc());
      assert.equal(result.attributes[0]!.type, 'boolean');
    });

    it('handles scan-mode type (adds import)', () => {
      const desc = emptyDesc();
      generateInterface('MyInterface', makeObjectAttr('root', [makeSimpleAttr('scan-mode', 'scanMode')]), desc);
      assert.ok([...desc.imports].some(i => i.includes('ScanModeDTO')));
    });

    it('handles certificate type', () => {
      const result = generateInterface('MyInterface', makeObjectAttr('root', [makeSimpleAttr('certificate', 'cert')]), emptyDesc());
      assert.equal(result.attributes[0]!.type, 'string');
    });

    it('handles timezone type (adds import)', () => {
      const desc = emptyDesc();
      generateInterface('MyInterface', makeObjectAttr('root', [makeSimpleAttr('timezone', 'tz')]), desc);
      assert.ok([...desc.imports].some(i => i.includes('Timezone')));
    });

    it('handles array type', () => {
      const arrayAttr = {
        type: 'array',
        key: 'items',
        translationKey: 'items',
        validators: [],
        displayProperties: {},
        rootAttribute: makeObjectAttr('items', [])
      } as never;
      const result = generateInterface('MyInterface', makeObjectAttr('root', [arrayAttr]), emptyDesc());
      assert.ok(result.attributes[0]!.type.startsWith('Array<'));
    });

    it('handles object type', () => {
      const result = generateInterface(
        'MyInterface',
        makeObjectAttr('root', [makeObjectAttr('config', [makeSimpleAttr('string', 'val')])]),
        emptyDesc()
      );
      assert.equal(result.attributes[0]!.type, 'MyInterfaceConfig');
    });

    it('handles number type', () => {
      const result = generateInterface('MyInterface', makeObjectAttr('root', [makeSimpleAttr('number', 'port')]), emptyDesc());
      assert.equal(result.attributes[0]!.type, 'number');
    });
  });

  // ── writeAttribute (uses real temp file) ────────────────────────────────

  describe('writeAttribute', () => {
    it('writes required non-undefinable attribute', async () => {
      const tmpFile = path.join(tmpDir, 'test-write-required.ts');
      writeAttribute(tmpFile, { key: 'host', type: 'string', nullable: false, undefinable: false });
      const content = fsSync.readFileSync(tmpFile, 'utf8');
      assert.ok(content.includes('host: string'));
      assert.ok(!content.includes('?'));
      assert.ok(!content.includes('| null'));
    });

    it('writes nullable undefinable attribute', async () => {
      const tmpFile = path.join(tmpDir, 'test-write-nullable.ts');
      writeAttribute(tmpFile, { key: 'opt', type: 'string', nullable: true, undefinable: true });
      const content = fsSync.readFileSync(tmpFile, 'utf8');
      assert.ok(content.includes('opt?'));
      assert.ok(content.includes('| null'));
    });
  });

  // ── buildTypescriptFile (uses real temp dir as CWD) ─────────────────────

  describe('buildTypescriptFile', () => {
    function runInTmpDir<T>(fn: () => T): T {
      process.chdir(tmpDir);
      try {
        return fn();
      } finally {
        process.chdir(origCwd);
      }
    }

    function makeFullDesc(): TypeGenerationDescription {
      return {
        imports: new Set(['import { Timezone } from "./types";\n']),
        enums: [{ name: 'MyEnum', values: ['A', 'B'] }],
        settingsInterfaces: [
          { name: 'SouthFooSettings', attributes: [{ key: 'host', type: 'string', nullable: false, undefinable: false }] },
          { name: 'SouthBarSettings', attributes: [] }
        ],
        settingsSubInterfaces: [
          { name: 'SouthFooAuth', attributes: [{ key: 'token', type: 'string', nullable: true, undefinable: false }] }
        ],
        itemSettingsInterfaces: [
          { name: 'ItemFooSettings', attributes: [{ key: 'query', type: 'string', nullable: false, undefinable: false }] }
        ],
        itemSettingsSubInterfaces: []
      };
    }

    it('generates South type file including item settings sections', () => {
      runInTmpDir(() => buildTypescriptFile(makeFullDesc(), 'South'));
      const content = fsSync.readFileSync(path.join(tmpDir, 'shared/model/south-settings.model.ts'), 'utf8');
      assert.ok(content.includes('SouthItemSettings'));
      assert.ok(content.includes('ItemFooSettings'));
    });

    it('generates North type file (no item settings)', () => {
      runInTmpDir(() => buildTypescriptFile(makeFullDesc(), 'North'));
      const content = fsSync.readFileSync(path.join(tmpDir, 'shared/model/north-settings.model.ts'), 'utf8');
      assert.ok(content.includes('NorthSettings'));
      assert.ok(!content.includes('NorthItemSettings'));
    });

    it('generates Transformer type file', () => {
      runInTmpDir(() => buildTypescriptFile(makeFullDesc(), 'Transformer'));
      const content = fsSync.readFileSync(path.join(tmpDir, 'shared/model/transformer-settings.model.ts'), 'utf8');
      assert.ok(content.includes('TransformerSettings'));
    });

    it('writes type = object for interfaces with no attributes', () => {
      const desc: TypeGenerationDescription = { ...emptyDesc(), settingsInterfaces: [{ name: 'EmptySettings', attributes: [] }] };
      runInTmpDir(() => buildTypescriptFile(desc, 'North'));
      const content = fsSync.readFileSync(path.join(tmpDir, 'shared/model/north-settings.model.ts'), 'utf8');
      assert.ok(content.includes('type EmptySettings = object'));
    });
  });

  // ── listFiles (real temp dirs) ─────────────────────────────────────────

  describe('listFiles', () => {
    it('returns all files in a flat directory', async () => {
      const dir = await fs.mkdtemp(path.join(tmpDir, 'lf-flat-'));
      await fs.writeFile(path.join(dir, 'manifest.ts'), 'export const x = 1;');
      const files = listFiles(dir);
      assert.ok(files.some(f => f.endsWith('manifest.ts')));
    });

    it('recurses into subdirectories', async () => {
      const dir = await fs.mkdtemp(path.join(tmpDir, 'lf-rec-'));
      await fs.mkdir(path.join(dir, 'sub'), { recursive: true });
      await fs.writeFile(path.join(dir, 'sub', 'manifest.ts'), '');
      const files = listFiles(dir);
      assert.ok(files.some(f => f.includes('sub') && f.endsWith('manifest.ts')));
    });
  });

  // ── generateSettingsInterfaces (orchestration, empty src dirs) ──────────

  describe('generateSettingsInterfaces', () => {
    it('creates output files without errors when no manifests exist', async () => {
      process.chdir(tmpDir);
      try {
        await assert.doesNotReject(() => generateSettingsInterfaces());
      } finally {
        process.chdir(origCwd);
      }
      // Output files should have been created.
      assert.ok(fsSync.existsSync(path.join(tmpDir, 'shared/model/south-settings.model.ts')));
      assert.ok(fsSync.existsSync(path.join(tmpDir, 'shared/model/north-settings.model.ts')));
      assert.ok(fsSync.existsSync(path.join(tmpDir, 'shared/model/transformer-settings.model.ts')));
    });
  });

  // ── generateTypesForManifest ────────────────────────────────────────────

  describe('generateTypesForManifest', () => {
    it('generates types for a south connector manifest', () => {
      const manifest = {
        id: 'sqlite',
        settings: makeObjectAttr('settings', [makeSimpleAttr('string', 'databasePath', [{ type: 'REQUIRED' }])]),
        items: {
          rootAttribute: makeObjectAttr('item', [makeObjectAttr('settings', [makeSimpleAttr('string', 'query', [{ type: 'REQUIRED' }])])])
        }
      };
      const desc = emptyDesc();
      generateTypesForManifest(manifest as never, desc, 'South');
      assert.ok(desc.settingsInterfaces.some((i: Interface) => i.name === 'SouthSQLiteSettings'));
      assert.ok(desc.itemSettingsInterfaces.some((i: Interface) => i.name === 'SouthSQLiteItemSettings'));
    });

    it('generates types for a north connector manifest', () => {
      const manifest = {
        id: 'console',
        settings: makeObjectAttr('settings', [makeSimpleAttr('string', 'level')])
      };
      const desc = emptyDesc();
      generateTypesForManifest(manifest as never, desc, 'North');
      assert.ok(desc.settingsInterfaces.some((i: Interface) => i.name === 'NorthConsoleSettings'));
    });

    it('generates item sub-interfaces when the item settings contain nested object/array attributes', () => {
      const nestedAuth = makeObjectAttr('auth', [makeSimpleAttr('string', 'token', [{ type: 'REQUIRED' }])]);
      const arrayAttr = {
        type: 'array',
        key: 'filters',
        translationKey: 'filters',
        validators: [],
        displayProperties: {},
        rootAttribute: makeObjectAttr('filters', [makeSimpleAttr('string', 'expression')])
      } as never;
      const manifest = {
        id: 'mqtt',
        settings: makeObjectAttr('settings', [makeSimpleAttr('string', 'url', [{ type: 'REQUIRED' }])]),
        items: {
          rootAttribute: makeObjectAttr('item', [makeObjectAttr('settings', [nestedAuth, arrayAttr])])
        }
      };
      const desc = emptyDesc();
      generateTypesForManifest(manifest as never, desc, 'South');
      assert.ok(desc.itemSettingsInterfaces.some((i: Interface) => i.name === 'SouthMQTTItemSettings'));
      assert.ok(desc.itemSettingsSubInterfaces.some((i: Interface) => i.name === 'SouthMQTTItemSettingsAuth'));
      assert.ok(desc.itemSettingsSubInterfaces.some((i: Interface) => i.name === 'SouthMQTTItemSettingsFilters'));
    });
  });

  // ── generateTypesForTransformerManifest ─────────────────────────────────

  describe('generateTypesForTransformerManifest', () => {
    it('generates types for a transformer manifest', () => {
      const manifest = {
        id: 'csv-to-mqtt',
        settings: makeObjectAttr('settings', [makeSimpleAttr('string', 'topic', [{ type: 'REQUIRED' }])])
      };
      const desc = emptyDesc();
      generateTypesForTransformerManifest(manifest as never, desc);
      assert.ok(desc.settingsInterfaces.some((i: Interface) => i.name === 'TransformerCsvToMqttSettings'));
    });

    it('generates sub-interfaces when the settings contain a nested object attribute', () => {
      const nestedMapping = makeObjectAttr('mapping', [makeSimpleAttr('string', 'field', [{ type: 'REQUIRED' }])]);
      const manifest = {
        id: 'json-to-csv',
        settings: makeObjectAttr('settings', [makeSimpleAttr('string', 'topic', [{ type: 'REQUIRED' }]), nestedMapping])
      };
      const desc = emptyDesc();
      generateTypesForTransformerManifest(manifest as never, desc);
      assert.ok(desc.settingsInterfaces.some((i: Interface) => i.name === 'TransformerJsonToCsvSettings'));
      assert.ok(desc.settingsSubInterfaces.some((i: Interface) => i.name === 'TransformerJsonToCsvSettingsMapping'));
    });
  });

  // ── generateSettingsInterfacesForConnectorType / ForTransformers ────────
  // (covers the `for (const manifestPath of manifests) { await import(...) }`
  // loop body, which is never exercised when the src dirs are empty)
  //
  // `await import('./<x>/manifest.js')` inside settings-interface.generator.ts resolves
  // relative to *that module's own location* (backend/src/), not to process.cwd() — so a
  // fake manifest file placed only under a temp cwd would never actually be found. To make
  // the import genuinely succeed we drop a small, uniquely-named fixture folder directly
  // under the real backend/src/<type>/ tree (removed again in `finally`), while a temp cwd
  // supplies the `.ts` stub (only its filename matters to `listFiles`) and the output dir.

  describe('generateSettingsInterfacesForConnectorType / generateSettingsInterfacesForTransformers (real import resolution)', () => {
    const FIXTURE_NAME = '__oibus_test_fixture__';
    const createdTmpCwds: Array<string> = [];

    after(async () => {
      for (const dir of createdTmpCwds) {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    async function withRealFixture(typeDir: string, manifestSource: string, run: () => Promise<void>) {
      const realFixtureDir = path.join(origCwd, 'src', typeDir, FIXTURE_NAME);
      const tmpCwd = await fs.mkdtemp(path.join(os.tmpdir(), 'oibus-gen-fixture-'));
      createdTmpCwds.push(tmpCwd);
      await fs.mkdir(realFixtureDir, { recursive: true });
      await fs.writeFile(path.join(realFixtureDir, 'manifest.js'), manifestSource);
      await fs.mkdir(path.join(tmpCwd, 'shared', 'model'), { recursive: true });
      await fs.mkdir(path.join(tmpCwd, 'src', typeDir, FIXTURE_NAME), { recursive: true });
      // Only the filename matters for `listFiles`'s `.endsWith('manifest.ts')` filter.
      await fs.writeFile(path.join(tmpCwd, 'src', typeDir, FIXTURE_NAME, 'manifest.ts'), '// stub, discovered by name only');

      process.chdir(tmpCwd);
      try {
        await run();
        return tmpCwd;
      } finally {
        // NB: tmpCwd is cleaned in `after` (not here) so the caller can still read the
        // generated output files after this returns.
        process.chdir(origCwd);
        await fs.rm(realFixtureDir, { recursive: true, force: true });
      }
    }

    it('imports a real south manifest.js and generates its settings + item settings interfaces', async () => {
      const manifestSource = `module.exports = {
        id: 'sqlite',
        category: 'database',
        name: 'Fixture',
        description: 'fixture manifest for tests',
        settings: {
          type: 'object',
          key: 'settings',
          translationKey: 'settings',
          validators: [],
          enablingConditions: [],
          attributes: [
            { type: 'string', key: 'databasePath', translationKey: 'databasePath', validators: [{ type: 'REQUIRED' }], displayProperties: {} }
          ]
        },
        items: {
          rootAttribute: {
            type: 'object',
            key: 'item',
            translationKey: 'item',
            validators: [],
            enablingConditions: [],
            attributes: [
              {
                type: 'object',
                key: 'settings',
                translationKey: 'settings',
                validators: [],
                enablingConditions: [],
                attributes: [
                  { type: 'string', key: 'query', translationKey: 'query', validators: [{ type: 'REQUIRED' }], displayProperties: {} }
                ]
              }
            ]
          }
        }
      };
      `;
      let outputDir = '';
      await withRealFixture('south', manifestSource, async () => {
        outputDir = process.cwd();
        await generateSettingsInterfacesForConnectorType('South');
      });
      const content = fsSync.readFileSync(path.join(outputDir, 'shared/model/south-settings.model.ts'), 'utf8');
      assert.ok(content.includes('SouthSQLiteSettings'));
      assert.ok(content.includes('SouthSQLiteItemSettings'));
      assert.ok(content.includes('databasePath'));
      assert.ok(content.includes('query'));
    });

    it('imports a real north manifest.js and generates its settings interface', async () => {
      const manifestSource = `module.exports = {
        id: 'console',
        category: 'debug',
        name: 'Fixture',
        description: 'fixture manifest for tests',
        settings: {
          type: 'object',
          key: 'settings',
          translationKey: 'settings',
          validators: [],
          enablingConditions: [],
          attributes: [
            { type: 'boolean', key: 'verbose', translationKey: 'verbose', validators: [], displayProperties: {} }
          ]
        }
      };
      `;
      let outputDir = '';
      await withRealFixture('north', manifestSource, async () => {
        outputDir = process.cwd();
        await generateSettingsInterfacesForConnectorType('North');
      });
      const content = fsSync.readFileSync(path.join(outputDir, 'shared/model/north-settings.model.ts'), 'utf8');
      assert.ok(content.includes('NorthConsoleSettings'));
      assert.ok(content.includes('verbose'));
    });

    it('imports a real transformer manifest.js and generates its settings interface', async () => {
      const manifestSource = `module.exports = {
        id: 'csv-to-mqtt',
        category: 'transformer',
        name: 'Fixture',
        description: 'fixture manifest for tests',
        settings: {
          type: 'object',
          key: 'settings',
          translationKey: 'settings',
          validators: [],
          enablingConditions: [],
          attributes: [
            { type: 'string', key: 'topic', translationKey: 'topic', validators: [{ type: 'REQUIRED' }], displayProperties: {} }
          ]
        }
      };
      `;
      let outputDir = '';
      await withRealFixture('transformers', manifestSource, async () => {
        outputDir = process.cwd();
        await generateSettingsInterfacesForTransformers();
      });
      const content = fsSync.readFileSync(path.join(outputDir, 'shared/model/transformer-settings.model.ts'), 'utf8');
      assert.ok(content.includes('TransformerCsvToMqttSettings'));
      assert.ok(content.includes('topic'));
    });
  });

  // ── runAsMain ────────────────────────────────────────────────────────────

  describe('runAsMain', () => {
    it('returns false when not invoked as the main script', () => {
      const original = process.argv[1];
      process.argv[1] = '/some/other/script.js';
      try {
        assert.equal(runAsMain(), false);
      } finally {
        process.argv[1] = original;
      }
    });

    it('returns true and triggers generation when invoked as the main script', async () => {
      const original = process.argv[1];
      process.argv[1] = '/some/path/settings-interface.generator.js';
      process.chdir(tmpDir);
      try {
        assert.equal(runAsMain(), true);
        // Allow the fire-and-forget generateSettingsInterfaces().catch(console.error) to settle.
        await new Promise(resolve => setTimeout(resolve, 50));
      } finally {
        process.argv[1] = original;
        process.chdir(origCwd);
      }
    });
  });
});
