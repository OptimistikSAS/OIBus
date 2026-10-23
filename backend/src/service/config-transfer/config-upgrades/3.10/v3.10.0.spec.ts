import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { CONFIG_TRANSFER_FIXTURES_DIR } from '../../../../tests/config-transfer-fixtures/config-transfer-fixture';
import { JsonObject } from '../config-upgrade';
import {
  buildRecordListToCsvOptions,
  keepsResolvedTransformer,
  toNewSqlItemSettings,
  toNoneResamplingItemSettings,
  upgrade,
  usesRemoteAgent
} from './v3.10.0';

const fixtureConfig = (version: string): JsonObject =>
  JSON.parse(fs.readFileSync(path.join(CONFIG_TRANSFER_FIXTURES_DIR, version, 'export.json'), 'utf-8')).config;

const standardTransformers = (config: JsonObject, functionName: string): Array<JsonObject> =>
  (config.transformers as Array<JsonObject>).filter(
    transformer => transformer.type === 'standard' && (transformer.settings as JsonObject).functionName === functionName
  );

describe('3.10.0 config upgrade', () => {
  it('leaves a configuration already in the 3.10.0 shape untouched, as exported by a 3.10.0 pre-release', () => {
    const config = fixtureConfig('3.10.0');

    assert.deepStrictEqual(upgrade.apply(structuredClone(config)), config);
  });

  it('is safe to run twice', () => {
    const once = upgrade.apply(fixtureConfig('3.9.3'));

    assert.deepStrictEqual(upgrade.apply(structuredClone(once)), once);
  });

  it('adds the record-list-to-csv standard transformer once, and links to it', () => {
    const config = fixtureConfig('3.9.3');
    assert.deepStrictEqual(standardTransformers(config, 'record-list-to-csv'), []);

    upgrade.apply(config);

    const [recordListToCsv, ...others] = standardTransformers(config, 'record-list-to-csv');
    assert.ok(recordListToCsv);
    assert.deepStrictEqual(others, []);
    assert.deepStrictEqual(recordListToCsv.settings, { functionName: 'record-list-to-csv', inputType: 'record-list', outputType: 'any' });
    const links = (config.northConnectors as Array<JsonObject>).flatMap(
      north => (north.settings as JsonObject).transformers as Array<JsonObject>
    );
    assert.ok(links.some(link => link.transformerId === recordListToCsv.oIBusInternalId));
  });

  it('reuses the record-list-to-csv standard transformer the configuration already describes', () => {
    const config = fixtureConfig('3.9.3');
    const existing: JsonObject = { ...standardTransformers(config, 'iso')[0], oIBusInternalId: 'existingId' };
    existing.settings = { ...(existing.settings as JsonObject), functionName: 'record-list-to-csv' };
    (config.transformers as Array<JsonObject>).push(existing);

    upgrade.apply(config);

    assert.deepStrictEqual(
      standardTransformers(config, 'record-list-to-csv').map(transformer => transformer.oIBusInternalId),
      ['existingId']
    );
  });

  it('does not add the record-list-to-csv standard transformer when no link needs it', () => {
    const config = fixtureConfig('3.9.3');
    config.southConnectors = (config.southConnectors as Array<JsonObject>).filter(south => south.type !== 'mssql');
    config.historyQueries = [];
    // time-values-to-csv is replaced by record-list-to-csv
    config.transformers = (config.transformers as Array<JsonObject>).filter(
      transformer => (transformer.settings as JsonObject).functionName !== 'time-values-to-csv'
    );

    upgrade.apply(config);

    assert.deepStrictEqual(standardTransformers(config, 'record-list-to-csv'), []);
  });

  it('replaces the raw resampling of OPC UA and OPC items with none', () => {
    const config: JsonObject = {
      southConnectors: [
        {
          type: 'opcua',
          settings: { items: [{ settings: { nodeId: 'ns=1', mode: 'ha', haMode: { aggregate: 'average', resampling: 'raw' } } }] }
        },
        { type: 'opc', settings: { items: [{ settings: { nodeId: 'a', aggregate: 'count', resampling: 'raw' } }] } }
      ],
      historyQueries: [{ settings: { southType: 'opc', items: [{ settings: { nodeId: 'b', aggregate: 'count', resampling: 'raw' } }] } }]
    };

    upgrade.apply(config);

    assert.deepStrictEqual(
      (config.southConnectors as Array<JsonObject>).map(south => ((south.settings as JsonObject).items as Array<JsonObject>)[0].settings),
      [
        { nodeId: 'ns=1', mode: 'ha', haMode: { aggregate: 'average', resampling: 'none' } },
        { nodeId: 'a', aggregate: 'count', resampling: 'none' }
      ]
    );
    assert.deepStrictEqual(
      (((config.historyQueries as Array<JsonObject>)[0].settings as JsonObject).items as Array<JsonObject>)[0].settings,
      { nodeId: 'b', aggregate: 'count', resampling: 'none' }
    );
  });

  it('leaves the other resamplings untouched', () => {
    assert.strictEqual(toNoneResamplingItemSettings('opcua', { mode: 'ha', haMode: { aggregate: 'count', resampling: '1min' } }), null);
    assert.strictEqual(toNoneResamplingItemSettings('opcua', { mode: 'da', haMode: null }), null);
    assert.strictEqual(toNoneResamplingItemSettings('opc', { aggregate: 'count', resampling: '10s' }), null);
    assert.strictEqual(toNoneResamplingItemSettings('mqtt', { resampling: 'raw' }), null);
  });

  it('keeps a resolved transformer, except none at all or iso', () => {
    assert.strictEqual(keepsResolvedTransformer(undefined), false);
    assert.strictEqual(keepsResolvedTransformer('iso'), false);
    assert.strictEqual(keepsResolvedTransformer('ignore'), true);
    assert.strictEqual(keepsResolvedTransformer('json-to-csv'), true);
    // A custom transformer has no function name
    assert.strictEqual(keepsResolvedTransformer(null), true);
  });

  it('converts the date time fields of a SQL item to its tracking instant and CSV transformer options', () => {
    const oldSettings = {
      query: 'SELECT *',
      dateTimeFields: [
        { fieldName: 'timestamp', useAsReference: true, type: 'iso-string', timezone: null, format: null, locale: null },
        { fieldName: 'other', useAsReference: false, type: 'string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd', locale: 'en-US' }
      ],
      serialization: {
        type: 'csv' as const,
        filename: 'sql.csv',
        delimiter: 'SEMI_COLON',
        compression: true,
        outputTimestampFormat: 'yyyy-MM-dd',
        outputTimezone: 'Europe/Paris'
      }
    };

    assert.deepStrictEqual(toNewSqlItemSettings(oldSettings), {
      query: 'SELECT *',
      trackingInstant: {
        trackInstant: true,
        fieldName: 'timestamp',
        dateTimeInput: { type: 'iso-string', timezone: null, format: null, locale: null }
      }
    });
    const options = buildRecordListToCsvOptions(oldSettings);
    assert.strictEqual(options.filename, 'sql.csv');
    assert.strictEqual(options.delimiter, 'SEMI_COLON');
    assert.strictEqual(options.compression, true);
    assert.deepStrictEqual(
      (options.fields as Array<JsonObject>).map(field => [field.fieldName, (field.datetimeSettings as JsonObject).inputTimezone]),
      [
        ['timestamp', null],
        ['other', 'Europe/Paris']
      ]
    );
    assert.deepStrictEqual(toNewSqlItemSettings({ query: 'SELECT *' }), { query: 'SELECT *', trackingInstant: { trackInstant: false } });
  });

  describe('ODBC and OLEDB items', () => {
    const oldSettings = {
      query: 'SELECT *',
      dateTimeFields: [
        { fieldName: 'timestamp', useAsReference: true, type: 'string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd', locale: 'en-US' },
        { fieldName: 'other', useAsReference: false, type: 'unix-epoch', timezone: null, format: null, locale: null }
      ],
      serialization: {
        type: 'csv' as const,
        filename: 'odbc.csv',
        delimiter: 'COMMA',
        compression: false,
        outputTimestampFormat: 'yyyy-MM-dd HH:mm',
        outputTimezone: 'UTC'
      }
    };
    const fieldInputs = (options: Record<string, unknown>) =>
      (options.fields as Array<JsonObject>).map(field => [field.fieldName, (field.datetimeSettings as JsonObject).inputType]);

    it('tells which souths query their database through the remote agent', () => {
      assert.strictEqual(usesRemoteAgent('oledb', {}), true);
      assert.strictEqual(usesRemoteAgent('odbc', { remoteAgent: true }), true);
      assert.strictEqual(usesRemoteAgent('odbc', { remoteAgent: false }), false);
      assert.strictEqual(usesRemoteAgent('odbc', undefined), false);
      assert.strictEqual(usesRemoteAgent('mysql', { remoteAgent: true }), false);
    });

    it('only formats the reference field, sent as an ISO string, through the remote agent', () => {
      assert.deepStrictEqual(fieldInputs(buildRecordListToCsvOptions(oldSettings, true)), [['timestamp', 'iso-string']]);
      assert.deepStrictEqual(fieldInputs(buildRecordListToCsvOptions(oldSettings)), [
        ['timestamp', 'string'],
        ['other', 'unix-epoch']
      ]);
    });

    it('converts the items of ODBC souths and history queries', () => {
      const item = () => ({ id: 'itemId', name: 'item', enabled: true, settings: structuredClone(oldSettings) });
      const config: JsonObject = {
        transformers: [],
        northConnectors: [{ oIBusInternalId: 'northId', type: 'file-writer', settings: { transformers: [] } }],
        southConnectors: [
          { oIBusInternalId: 'agentId', type: 'odbc', settings: { settings: { remoteAgent: true }, items: [item()], groups: [] } },
          { oIBusInternalId: 'localId', type: 'odbc', settings: { settings: { remoteAgent: false }, items: [item()], groups: [] } }
        ],
        historyQueries: [{ settings: { southType: 'oledb', southSettings: {}, items: [item()], northTransformers: [] } }]
      };

      upgrade.apply(config);

      const links = ((config.northConnectors as Array<JsonObject>)[0].settings as JsonObject).transformers as Array<JsonObject>;
      const linkOf = (southId: string) => links.find(link => (link.source as JsonObject).southId === southId)!;
      assert.deepStrictEqual(fieldInputs(linkOf('agentId').options as JsonObject), [['timestamp', 'iso-string']]);
      assert.deepStrictEqual(fieldInputs(linkOf('localId').options as JsonObject), [
        ['timestamp', 'string'],
        ['other', 'unix-epoch']
      ]);
      const historyQuery = (config.historyQueries as Array<JsonObject>)[0].settings as JsonObject;
      const [historyLink] = historyQuery.northTransformers as Array<JsonObject>;
      assert.deepStrictEqual(fieldInputs(historyLink.options as JsonObject), [['timestamp', 'iso-string']]);
      assert.deepStrictEqual(((historyQuery.items as Array<JsonObject>)[0].settings as JsonObject).trackingInstant, {
        trackInstant: true,
        fieldName: 'timestamp',
        dateTimeInput: { type: 'string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd', locale: 'en-US' }
      });
    });
  });

  describe('time-values transformers', () => {
    const standard = (id: string, functionName: string, inputType: string, outputType: string): JsonObject => ({
      oIBusInternalId: id,
      type: 'standard',
      settings: { functionName, inputType, outputType },
      manifest: {}
    });
    const buildConfig = (): JsonObject => ({
      transformers: [
        standard('csv', 'record-list-to-csv', 'record-list', 'any'),
        standard('tvCsv', 'time-values-to-csv', 'time-values', 'any'),
        standard('tvOia', 'time-values-to-oianalytics', 'time-values', 'oianalytics'),
        { oIBusInternalId: 'custom', type: 'custom', settings: { name: 'custom', inputType: 'time-values', outputType: 'time-values' } }
      ],
      northConnectors: [
        {
          oIBusInternalId: 'northId',
          type: 'file-writer',
          settings: {
            transformers: [
              { id: 'l1', transformerId: 'csv', options: { filename: 'sql.csv' } },
              { id: 'l2', transformerId: 'tvCsv', options: { pointIdColumnTitle: 'Ref' } },
              { id: 'l3', transformerId: 'tvOia', options: { precision: 's' } }
            ]
          }
        }
      ],
      historyQueries: [
        { settings: { southType: 'opcua', items: [], northTransformers: [{ id: 'h1', transformerId: 'tvOia', options: null }] } }
      ]
    });

    it('replaces them by their record-list counterparts and converts the links', () => {
      const config = upgrade.apply(buildConfig());

      const transformers = config.transformers as Array<JsonObject>;
      assert.deepStrictEqual(
        transformers.map(transformer => [transformer.oIBusInternalId, (transformer.settings as JsonObject).functionName ?? null]),
        [
          ['csv', 'record-list-to-csv'],
          ['tvOia', 'record-list-to-oianalytics'],
          ['custom', null]
        ]
      );
      assert.deepStrictEqual(transformers[1].settings, {
        functionName: 'record-list-to-oianalytics',
        inputType: 'record-list',
        outputType: 'oianalytics'
      });
      assert.strictEqual((transformers[1].manifest as JsonObject).key, 'options');
      assert.deepStrictEqual(transformers[2].settings, { name: 'custom', inputType: 'record-list', outputType: 'record-list' });

      const [l1, l2, l3] = ((config.northConnectors as Array<JsonObject>)[0].settings as JsonObject).transformers as Array<JsonObject>;
      assert.deepStrictEqual(l1.options, { filename: 'sql.csv', keepOtherFields: true });
      assert.strictEqual(l2.transformerId, 'csv');
      assert.strictEqual((l2.options as JsonObject).keepOtherFields, false);
      assert.strictEqual(((l2.options as JsonObject).fields as Array<JsonObject>)[0].columnName, 'Ref');
      assert.strictEqual(l3.transformerId, 'tvOia');
      assert.strictEqual((l3.options as JsonObject).precision, 's');
      assert.strictEqual((l3.options as JsonObject).pointIdColumn, 'pointId');
      const [h1] = ((config.historyQueries as Array<JsonObject>)[0].settings as JsonObject).northTransformers as Array<JsonObject>;
      assert.strictEqual((h1.options as JsonObject).precision, 'ms');
    });

    it('is safe to run twice', () => {
      const once = upgrade.apply(buildConfig());

      assert.deepStrictEqual(upgrade.apply(structuredClone(once)), once);
    });
  });
});
