import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { CONFIG_TRANSFER_FIXTURES_DIR } from '../../../../tests/config-transfer-fixtures/config-transfer-fixture';
import { JsonObject } from '../config-upgrade';
import {
  buildRecordListToCsvOptions,
  COMPRESSED_FILE_OPTIONS,
  FILE_AS_IS_OPTIONS,
  keepsResolvedTransformer,
  toNewSqlItemSettings,
  toNoneResamplingItemSettings,
  toOIAnalyticsItemFileOptions,
  upgrade,
  usesRemoteAgent,
  withPrefixAndSuffix
} from './v3.10.0';

const fixtureConfig = (version: string): JsonObject =>
  JSON.parse(fs.readFileSync(path.join(CONFIG_TRANSFER_FIXTURES_DIR, version, 'export.json'), 'utf-8')).config;

const standardTransformers = (config: JsonObject, functionName: string): Array<JsonObject> =>
  (config.transformers as Array<JsonObject>).filter(
    transformer => transformer.type === 'standard' && (transformer.settings as JsonObject).functionName === functionName
  );

/** The options of record-list-to-csv and record-list-to-json, once replaced by record-list-to-file */
const csvFileOptions = {
  output: {
    fileType: 'csv',
    encoding: 'UTF_8',
    compression: false,
    header: true,
    delimiter: 'COMMA',
    newline: 'LF',
    quoteChar: 'NONE',
    escapeChar: 'DOUBLE_QUOTE',
    nullValue: ''
  },
  filename: '@CurrentDate.csv',
  keepOtherFields: true,
  fields: []
};
const jsonFileOptions = {
  output: { fileType: 'json', encoding: 'UTF_8', compression: false },
  filename: '@CurrentDate.json',
  keepOtherFields: true,
  fields: []
};

describe('3.10.0 config upgrade', () => {
  it('leaves a configuration already in the 3.10.0 shape untouched, as exported by a 3.10.0 pre-release', () => {
    const config = fixtureConfig('3.10.0');

    assert.deepStrictEqual(upgrade.apply(structuredClone(config)), config);
  });

  it('is safe to run twice', () => {
    const once = upgrade.apply(fixtureConfig('3.9.3'));

    assert.deepStrictEqual(upgrade.apply(structuredClone(once)), once);
  });

  it('renames the any data type of the transformers file', () => {
    const config = fixtureConfig('3.9.3');

    upgrade.apply(config);

    const dataTypes = (config.transformers as Array<JsonObject>).flatMap(transformer => [
      (transformer.settings as JsonObject).inputType,
      (transformer.settings as JsonObject).outputType
    ]);
    assert.ok(dataTypes.includes('file'));
    assert.ok(!dataTypes.includes('any'));
  });

  it('adds the record-list-to-csv standard transformer once, replaced by record-list-to-file, and links to it', () => {
    const config = fixtureConfig('3.9.3');
    assert.deepStrictEqual(standardTransformers(config, 'record-list-to-csv'), []);

    upgrade.apply(config);

    const [recordListToCsv, ...others] = standardTransformers(config, 'record-list-to-file');
    assert.ok(recordListToCsv);
    assert.deepStrictEqual(others, []);
    assert.deepStrictEqual(recordListToCsv.settings, { functionName: 'record-list-to-file', inputType: 'record-list', outputType: 'file' });
    assert.strictEqual((recordListToCsv.manifest as JsonObject).key, 'options');
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
      standardTransformers(config, 'record-list-to-file').map(transformer => transformer.oIBusInternalId),
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

  it('enables the content endpoints when a North transformer applies to the OIBus API, keeping an existing setting', () => {
    const engine = (webServer: JsonObject) => ({ settings: { webServer } });
    const north = (source: JsonObject) => ({ type: 'console', settings: { transformers: [{ transformerId: 't1', source, options: {} }] } });
    const used: JsonObject = { engine: engine({ port: 2223 }), northConnectors: [north({ type: 'oibus-api', dataSourceId: 'ds' })] };
    const unused: JsonObject = { engine: engine({ port: 2223 }), northConnectors: [north({ type: 'south', southId: 's1', items: [] })] };
    const kept: JsonObject = {
      engine: engine({ port: 2223, enableContentEndpoint: false }),
      northConnectors: [north({ type: 'oibus-api', dataSourceId: 'ds' })]
    };

    const enabled = (config: JsonObject) =>
      (((upgrade.apply(config).engine as JsonObject).settings as JsonObject).webServer as JsonObject).enableContentEndpoint;
    assert.strictEqual(enabled(used), true);
    assert.strictEqual(enabled(unused), false);
    assert.strictEqual(enabled(kept), false);
  });

  it('adds an empty description to the south and history query items, keeping the existing ones', () => {
    const config: JsonObject = {
      southConnectors: [{ type: 'mqtt', settings: { items: [{ name: 'item1' }, { name: 'item2', description: 'Kept' }] } }],
      historyQueries: [{ settings: { southType: 'mqtt', items: [{ name: 'item3' }] } }]
    };

    upgrade.apply(config);

    const southItems = ((config.southConnectors as Array<JsonObject>)[0].settings as JsonObject).items as Array<JsonObject>;
    assert.deepStrictEqual(
      southItems.map(item => item.description),
      [null, 'Kept']
    );
    const historyItems = ((config.historyQueries as Array<JsonObject>)[0].settings as JsonObject).items as Array<JsonObject>;
    assert.strictEqual(historyItems[0].description, null);
  });

  it('adds the empty interval strategy of the history items and groups, keeping the existing ones', () => {
    const config: JsonObject = {
      southConnectors: [
        {
          type: 'influxdb',
          settings: {
            items: [{ name: 'item1' }, { name: 'item2', emptyIntervalStrategy: 'advance' }],
            groups: [{ historySettings: {} }]
          }
        },
        { type: 'mqtt', settings: { items: [{ name: 'item3' }], groups: [{ historySettings: {} }] } }
      ]
    };

    upgrade.apply(config);

    const [influxdb, mqtt] = (config.southConnectors as Array<JsonObject>).map(south => south.settings as JsonObject);
    assert.deepStrictEqual(
      (influxdb.items as Array<JsonObject>).map(item => item.emptyIntervalStrategy),
      ['keep', 'advance']
    );
    assert.strictEqual(((influxdb.groups as Array<JsonObject>)[0].historySettings as JsonObject).emptyIntervalStrategy, 'keep');
    assert.strictEqual((mqtt.items as Array<JsonObject>)[0].emptyIntervalStrategy, null);
    assert.strictEqual(((mqtt.groups as Array<JsonObject>)[0].historySettings as JsonObject).emptyIntervalStrategy, null);
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
      // the fields of record-list-to-csv, then of the record-list-to-file replacing it
      (options.fields as Array<JsonObject>).map(field => [
        field.fieldName ?? field.field,
        (field.datetimeSettings as JsonObject).inputType
      ]);

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

  describe('CSV and JSON transformers', () => {
    const standard = (id: string, functionName: string, inputType: string, outputType: string): JsonObject => ({
      oIBusInternalId: id,
      type: 'standard',
      settings: { functionName, inputType, outputType }
    });
    const buildConfig = (): JsonObject => ({
      transformers: [
        standard('mqtt', 'csv-to-mqtt', 'any', 'mqtt'),
        standard('oia', 'json-to-oianalytics', 'any', 'oianalytics'),
        standard('records', 'csv-to-record-list', 'any', 'record-list'),
        standard('existing', 'file-to-record-list', 'file', 'record-list')
      ],
      northConnectors: [
        {
          oIBusInternalId: 'northId',
          type: 'console',
          settings: {
            transformers: [
              {
                id: 'l1',
                transformerId: 'mqtt',
                options: { delimiter: 'COMMA', topicColumn: 't', payloadType: 'string', valueColumn: 'v' }
              },
              { id: 'l2', transformerId: 'records', options: null }
            ]
          }
        }
      ],
      historyQueries: [
        {
          settings: {
            southType: 'folder-scanner',
            items: [],
            northTransformers: [
              { id: 'h1', transformerId: 'oia', options: { rowIteratorPath: '$[*]', pointId: 'id', value: 'v', timestamp: 't' } }
            ]
          }
        }
      ]
    });

    it('replaces them by the file transformers and converts the links', () => {
      const config = upgrade.apply(buildConfig());

      const transformers = config.transformers as Array<JsonObject>;
      assert.deepStrictEqual(
        transformers.map(transformer => [transformer.oIBusInternalId, transformer.settings]),
        [
          ['mqtt', { functionName: 'file-to-mqtt', inputType: 'file', outputType: 'mqtt' }],
          ['oia', { functionName: 'file-to-oianalytics', inputType: 'file', outputType: 'oianalytics' }],
          ['existing', { functionName: 'file-to-record-list', inputType: 'file', outputType: 'record-list' }]
        ]
      );
      assert.deepStrictEqual(
        ((transformers[0].manifest as JsonObject).attributes as Array<JsonObject>).map(attribute => attribute.key)[0],
        'input'
      );
      assert.deepStrictEqual(((config.northConnectors as Array<JsonObject>)[0].settings as JsonObject).transformers, [
        {
          id: 'l1',
          transformerId: 'mqtt',
          options: {
            input: { fileType: 'csv', delimiter: 'COMMA', hasHeader: true },
            topicField: 't',
            payloadType: 'string',
            valueField: 'v'
          }
        },
        { id: 'l2', transformerId: 'existing', options: { input: { fileType: 'csv', delimiter: 'SEMI_COLON', hasHeader: true } } }
      ]);
      assert.deepStrictEqual(((config.historyQueries as Array<JsonObject>)[0].settings as JsonObject).northTransformers, [
        {
          id: 'h1',
          transformerId: 'oia',
          options: {
            input: { fileType: 'json', rowIteratorPath: '$[*]' },
            reference: { referenceField: 'id', referenceProcess: null },
            timestamp: { timestampField: 't', sourceType: 'iso-string', precision: 'ms' },
            value: { valueField: 'v', valueProcess: null }
          }
        }
      ]);
    });

    it('is safe to run twice', () => {
      const once = upgrade.apply(buildConfig());

      assert.deepStrictEqual(upgrade.apply(structuredClone(once)), once);
    });
  });

  describe('compression of the folder scanner, FTP and SFTP files', () => {
    const fileTransformer = {
      oIBusInternalId: 'file',
      type: 'standard',
      settings: { functionName: 'file', inputType: 'file', outputType: 'file' }
    };
    const buildConfig = (): JsonObject => ({
      transformers: [fileTransformer],
      southConnectors: [
        {
          oIBusInternalId: 'compressed',
          type: 'folder-scanner',
          settings: { settings: { inputFolder: 'in', compression: true }, items: [] }
        },
        { oIBusInternalId: 'raw', type: 'ftp', settings: { settings: { host: 'h', compression: false }, items: [] } }
      ],
      northConnectors: [
        {
          oIBusInternalId: 'writer',
          type: 'file-writer',
          settings: {
            transformers: [
              { id: 'l1', transformerId: 'file', options: {}, source: { type: 'south', southId: 'compressed', items: [] } },
              { id: 'l2', transformerId: 'file', options: {}, source: { type: 'south', southId: 'raw', items: [] } },
              { id: 'l3', transformerId: 'file', options: {}, source: { type: 'oibus-api' } }
            ]
          }
        }
      ],
      historyQueries: [
        {
          settings: {
            southType: 'sftp',
            northType: 'file-writer',
            southSettings: { host: 'h', compression: true },
            items: [],
            northTransformers: [{ id: 'h1', transformerId: 'file', options: {}, items: [] }]
          }
        }
      ]
    });

    it('compresses the files in file-to-file transformers instead of the souths', () => {
      const config = upgrade.apply(buildConfig());

      const fileToFile = (config.transformers as Array<JsonObject>).find(
        transformer => (transformer.settings as JsonObject).functionName === 'file-to-file'
      )!;
      assert.strictEqual((fileToFile.manifest as JsonObject).key, 'options');
      const links = ((config.northConnectors as Array<JsonObject>)[0].settings as JsonObject).transformers as Array<JsonObject>;
      assert.deepStrictEqual(
        links.map(link => [link.id, link.transformerId, link.options]),
        [
          ['l1', fileToFile.oIBusInternalId, COMPRESSED_FILE_OPTIONS],
          // the other files sent as they are
          ['l2', fileToFile.oIBusInternalId, FILE_AS_IS_OPTIONS],
          ['l3', fileToFile.oIBusInternalId, FILE_AS_IS_OPTIONS]
        ]
      );
      assert.deepStrictEqual(
        (config.southConnectors as Array<JsonObject>).map(south => (south.settings as JsonObject).settings),
        [{ inputFolder: 'in' }, { host: 'h' }]
      );
      const historyQuery = (config.historyQueries as Array<JsonObject>)[0].settings as JsonObject;
      assert.deepStrictEqual(historyQuery.southSettings, { host: 'h' });
      assert.deepStrictEqual((historyQuery.northTransformers as Array<JsonObject>)[0].options, COMPRESSED_FILE_OPTIONS);
    });

    it('is safe to run twice', () => {
      const once = upgrade.apply(buildConfig());

      assert.deepStrictEqual(upgrade.apply(structuredClone(once)), once);
    });
  });

  describe('filename prefix and suffix of the File Writer and SFTP norths', () => {
    const buildConfig = (): JsonObject => ({
      transformers: [
        {
          oIBusInternalId: 'fileToFile',
          type: 'standard',
          settings: { functionName: 'file-to-file', inputType: 'file', outputType: 'file' }
        },
        { oIBusInternalId: 'custom', type: 'custom', settings: { name: 'custom', inputType: 'file', outputType: 'file' } }
      ],
      northConnectors: [
        {
          oIBusInternalId: 'writer',
          type: 'file-writer',
          settings: {
            name: 'Writer',
            settings: { outputFolder: 'out', prefix: '@ConnectorName-', suffix: '-@CurrentDate' },
            transformers: [
              { id: 'l1', transformerId: 'fileToFile', options: { ...FILE_AS_IS_OPTIONS }, source: { type: 'oibus-api' } },
              { id: 'l2', transformerId: 'custom', options: {}, source: { type: 'oibus-api' } }
            ]
          }
        },
        {
          oIBusInternalId: 'mqtt',
          type: 'mqtt',
          settings: {
            name: 'MQTT',
            settings: { prefix: 'kept' },
            transformers: [{ id: 'l3', transformerId: 'fileToFile', options: { ...FILE_AS_IS_OPTIONS }, source: { type: 'oibus-api' } }]
          }
        }
      ],
      historyQueries: [
        {
          settings: {
            name: 'History',
            southType: 'folder-scanner',
            northType: 'sftp',
            northSettings: { remoteFolder: 'remote', prefix: 'pre_', suffix: null },
            items: [],
            northTransformers: [{ id: 'h1', transformerId: 'fileToFile', options: { ...FILE_AS_IS_OPTIONS }, items: [] }]
          }
        }
      ]
    });

    it('adds them to the filename of the transformers of these norths', () => {
      const config = upgrade.apply(buildConfig());

      const [writer, mqtt] = (config.northConnectors as Array<JsonObject>).map(north => north.settings as JsonObject);
      assert.deepStrictEqual(writer.settings, { outputFolder: 'out' });
      assert.deepStrictEqual(
        (writer.transformers as Array<JsonObject>).map(link => link.options),
        [{ ...FILE_AS_IS_OPTIONS, filename: 'Writer-@SourceFilename-@CurrentDate@SourceExtension' }, {}]
      );
      assert.deepStrictEqual(mqtt.settings, { prefix: 'kept' });
      assert.deepStrictEqual((mqtt.transformers as Array<JsonObject>)[0].options, FILE_AS_IS_OPTIONS);
      const historyQuery = (config.historyQueries as Array<JsonObject>)[0].settings as JsonObject;
      assert.deepStrictEqual(historyQuery.northSettings, { remoteFolder: 'remote' });
      assert.deepStrictEqual((historyQuery.northTransformers as Array<JsonObject>)[0].options, {
        ...FILE_AS_IS_OPTIONS,
        filename: 'pre_@SourceFilename@SourceExtension'
      });
    });

    it('is safe to run twice', () => {
      const once = upgrade.apply(buildConfig());

      assert.deepStrictEqual(upgrade.apply(structuredClone(once)), once);
    });

    it('puts the suffix before the extension of the filename', () => {
      assert.strictEqual(withPrefixAndSuffix('@SourceFilename@SourceExtension', 'p_', '_s', 'N'), 'p_@SourceFilename_s@SourceExtension');
      assert.strictEqual(withPrefixAndSuffix('@CurrentDate.csv', '@ConnectorName-', '', 'North'), 'North-@CurrentDate.csv');
      assert.strictEqual(withPrefixAndSuffix('@ItemName', '', '-@ConnectorName', 'North'), '@ItemName-North');
    });
  });

  describe('OPC UA timeouts and subscription settings', () => {
    const subscription = {
      publishingInterval: 150,
      maxKeepAliveCount: 10,
      numberOfMessageBeforeFlush: 500,
      delayBetweenFlush: 2000
    };
    const buildConfig = (): JsonObject => ({
      southConnectors: [
        {
          type: 'opcua',
          settings: { name: 'South', settings: { url: 'u', readTimeout: 20_000, maxNumberOfMessages: 500, flushMessageTimeout: 2000 } }
        },
        { type: 'mqtt', settings: { name: 'MQTT', settings: { maxNumberOfMessages: 1 } } }
      ],
      northConnectors: [
        { type: 'opcua', settings: { name: 'North', settings: { url: 'u' } } },
        { type: 'mqtt', settings: { name: 'MQTT', settings: { host: 'h' } } }
      ],
      historyQueries: [
        {
          settings: {
            southType: 'opcua',
            northType: 'opcua',
            southSettings: { url: 'u', maxNumberOfMessages: 500, flushMessageTimeout: 2000 },
            northSettings: { url: 'u', connectionTimeout: 5000 }
          }
        },
        { settings: { southType: 'mqtt', northType: 'mqtt', southSettings: { maxNumberOfMessages: 1 }, northSettings: { host: 'h' } } }
      ]
    });

    it('adds them to the OPC UA souths, norths and history queries, moving the flush settings', () => {
      const config = upgrade.apply(buildConfig());

      const settingsOf = (connectors: unknown) => (connectors as Array<JsonObject>).map(c => (c.settings as JsonObject).settings);
      assert.deepStrictEqual(settingsOf(config.southConnectors), [
        { url: 'u', readTimeout: 20_000, connectionTimeout: 15_000, subscription },
        { maxNumberOfMessages: 1 }
      ]);
      assert.deepStrictEqual(settingsOf(config.northConnectors), [
        { url: 'u', connectionTimeout: 15_000, writeTimeout: 15_000 },
        { host: 'h' }
      ]);
      const [opcua, mqtt] = (config.historyQueries as Array<JsonObject>).map(historyQuery => historyQuery.settings as JsonObject);
      assert.deepStrictEqual(opcua.southSettings, { url: 'u', connectionTimeout: 15_000, subscription });
      assert.deepStrictEqual(opcua.northSettings, { url: 'u', connectionTimeout: 5000, writeTimeout: 15_000 });
      assert.deepStrictEqual(mqtt.southSettings, { maxNumberOfMessages: 1 });
      assert.deepStrictEqual(mqtt.northSettings, { host: 'h' });
    });

    it('is safe to run twice', () => {
      const once = upgrade.apply(buildConfig());

      assert.deepStrictEqual(upgrade.apply(structuredClone(once)), once);
    });
  });

  describe('connection settings of the database souths', () => {
    const buildConfig = (): JsonObject => ({
      southConnectors: [
        { type: 'mysql', settings: { name: 'MySQL', settings: { host: 'h', port: 3306 } } },
        {
          type: 'mssql',
          settings: { name: 'MSSQL', settings: { host: 'h', requestTimeout: 5000 }, items: [{ name: 'item', settings: { query: 'q' } }] }
        },
        { type: 'odbc', settings: { name: 'ODBC', settings: { remoteAgent: false, maxParallelRun: 4 } } },
        { type: 'oledb', settings: { name: 'OLEDB', settings: { agentUrl: 'u' } } }
      ],
      historyQueries: [
        { settings: { southType: 'influxdb', northType: 'console', southSettings: { version: '2', bucket: 'b' }, northSettings: {} } },
        { settings: { southType: 'mqtt', northType: 'console', southSettings: { host: 'h' }, northSettings: {} } },
        {
          settings: {
            southType: 'postgresql',
            northType: 'console',
            southSettings: { host: 'h' },
            northSettings: {},
            items: [{ name: 'item', settings: { query: 'q' } }]
          }
        }
      ]
    });

    it('moves the request timeout of the MSSQL and PostgreSQL souths to their items, the default one when missing', () => {
      const config = upgrade.apply(buildConfig());

      const [, mssql] = config.southConnectors as Array<JsonObject>;
      assert.deepStrictEqual(((mssql.settings as JsonObject).items as Array<JsonObject>)[0].settings, { query: 'q', requestTimeout: 5000 });
      assert.deepStrictEqual((mssql.settings as JsonObject).settings, {
        connectionSettings: { host: 'h', idleTimeout: 30_000 },
        maxParallelRun: 1
      });
      const postgresql = (config.historyQueries as Array<JsonObject>)[2].settings as JsonObject;
      assert.deepStrictEqual((postgresql.items as Array<JsonObject>)[0].settings, { query: 'q', requestTimeout: 15_000 });
    });

    it('groups the connection settings and keeps the queries of the database souths and history queries sequential', () => {
      const config = upgrade.apply(buildConfig());

      assert.deepStrictEqual(
        (config.southConnectors as Array<JsonObject>).map(south => (south.settings as JsonObject).settings),
        [
          { connectionSettings: { host: 'h', port: 3306, idleTimeout: 30_000 }, maxParallelRun: 1 },
          { connectionSettings: { host: 'h', idleTimeout: 30_000 }, maxParallelRun: 1 },
          { remoteAgent: false, maxParallelRun: 4 },
          { agentUrl: 'u' }
        ]
      );
      assert.deepStrictEqual(
        (config.historyQueries as Array<JsonObject>).map(historyQuery => (historyQuery.settings as JsonObject).southSettings),
        [
          { connectionSettings: { version: '2', bucket: 'b' }, maxParallelRun: 1 },
          { host: 'h' },
          { connectionSettings: { host: 'h', idleTimeout: 30_000 }, maxParallelRun: 1 }
        ]
      );
    });

    it('is safe to run twice', () => {
      const once = upgrade.apply(buildConfig());

      assert.deepStrictEqual(upgrade.apply(structuredClone(once)), once);
    });
  });

  describe('OIAnalytics setpoints', () => {
    const standard = (id: string, functionName: string, inputType: string, outputType: string) => ({
      oIBusInternalId: id,
      type: 'standard',
      settings: { functionName, inputType, outputType }
    });
    const setpointLink = (id: string, transformerId: string, options: JsonObject) => ({
      id,
      transformerId,
      options,
      source: { type: 'oianalytics-setpoint' }
    });
    const buildConfig = (): JsonObject => ({
      transformers: [
        standard('setpointToJson', 'setpoint-to-json', 'setpoint', 'file'),
        standard('setpointToModbus', 'setpoint-to-modbus', 'setpoint', 'modbus'),
        standard('setpointToMqtt', 'setpoint-to-mqtt', 'setpoint', 'mqtt'),
        standard('setpointToOpcua', 'setpoint-to-opcua', 'setpoint', 'opcua'),
        standard('recordListToMqtt', 'record-list-to-mqtt', 'record-list', 'mqtt'),
        { oIBusInternalId: 'custom', type: 'custom', settings: { name: 'custom', inputType: 'setpoint', outputType: 'setpoint' } }
      ],
      northConnectors: [
        {
          oIBusInternalId: 'north',
          type: 'console',
          settings: {
            transformers: [
              setpointLink('json', 'setpointToJson', {}),
              setpointLink('modbus', 'setpointToModbus', { mapping: [{ reference: 'sp1', address: '0x01', modbusType: 'coil' }] }),
              setpointLink('mqtt', 'setpointToMqtt', { mapping: [{ reference: 'sp1', topic: 'topic/sp1' }] }),
              setpointLink('opcua', 'setpointToOpcua', { mapping: [{ reference: 'sp1', nodeId: 'ns=1;s=sp1' }] }),
              {
                id: 'records',
                transformerId: 'recordListToMqtt',
                options: { pointIdColumn: 'pointId', mapping: [] },
                source: { type: 'oibus-api' }
              }
            ]
          }
        }
      ]
    });

    it('replaces the setpoint transformers by the record-list ones, reading the reference and value of the setpoints', () => {
      const config = upgrade.apply(buildConfig());

      assert.deepStrictEqual(
        (config.transformers as Array<JsonObject>).map(transformer => [transformer.oIBusInternalId, transformer.settings]),
        [
          ['setpointToJson', { functionName: 'record-list-to-file', inputType: 'record-list', outputType: 'file' }],
          ['setpointToModbus', { functionName: 'record-list-to-modbus', inputType: 'record-list', outputType: 'modbus' }],
          ['setpointToOpcua', { functionName: 'record-list-to-opcua', inputType: 'record-list', outputType: 'opcua' }],
          ['recordListToMqtt', { functionName: 'record-list-to-mqtt', inputType: 'record-list', outputType: 'mqtt' }],
          ['custom', { name: 'custom', inputType: 'record-list', outputType: 'record-list' }]
        ]
      );
      assert.strictEqual(((config.transformers as Array<JsonObject>)[1].manifest as JsonObject).key, 'options');
      const links = ((config.northConnectors as Array<JsonObject>)[0].settings as JsonObject).transformers as Array<JsonObject>;
      assert.deepStrictEqual(
        links.map(link => [link.id, link.transformerId, link.options]),
        [
          ['json', 'setpointToJson', jsonFileOptions],
          [
            'modbus',
            'setpointToModbus',
            { pointIdColumn: 'reference', valueColumn: 'value', mapping: [{ pointId: 'sp1', address: '0x01', modbusType: 'coil' }] }
          ],
          [
            'mqtt',
            'recordListToMqtt',
            { pointIdColumn: 'reference', payload: 'value', valueColumn: 'value', mapping: [{ pointId: 'sp1', topic: 'topic/sp1' }] }
          ],
          [
            'opcua',
            'setpointToOpcua',
            { pointIdColumn: 'reference', valueColumn: 'value', mapping: [{ pointId: 'sp1', nodeId: 'ns=1;s=sp1' }] }
          ],
          // record-list-to-mqtt kept publishing the whole record
          ['records', 'recordListToMqtt', { pointIdColumn: 'pointId', mapping: [], payload: 'record' }]
        ]
      );
    });

    it('is safe to run twice', () => {
      const once = upgrade.apply(buildConfig());

      assert.deepStrictEqual(upgrade.apply(structuredClone(once)), once);
    });
  });

  describe('South OIAnalytics', () => {
    const serialization = {
      type: 'csv',
      filename: 'a.csv',
      delimiter: 'TAB',
      compression: false,
      outputTimestampFormat: 'yyyy',
      outputTimezone: 'UTC'
    };
    const item = (id: string, groupId: string | null = null) => ({
      id,
      name: id,
      enabled: true,
      groupId,
      settings: { endpoint: '/api', serialization }
    });
    const buildConfig = (): JsonObject => ({
      transformers: [
        { oIBusInternalId: 'file', type: 'standard', settings: { functionName: 'file', inputType: 'file', outputType: 'file' } },
        {
          oIBusInternalId: 'records',
          type: 'standard',
          settings: { functionName: 'record-list-to-file', inputType: 'record-list', outputType: 'file' }
        }
      ],
      southConnectors: [{ oIBusInternalId: 'oia', type: 'oianalytics', settings: { items: [item('i1', 'g1'), item('i2')] } }],
      northConnectors: [
        {
          oIBusInternalId: 'writer',
          type: 'file-writer',
          settings: {
            transformers: [
              {
                id: 'l1',
                transformerId: 'file',
                options: {},
                source: { type: 'south', southId: 'oia', items: [], excludedItems: [{ id: 'i1', name: 'i1', enabled: true }] }
              }
            ]
          }
        }
      ],
      historyQueries: [
        {
          settings: {
            southType: 'oianalytics',
            northType: 'file-writer',
            items: [item('h1')],
            northTransformers: [{ id: 'h', transformerId: 'file', options: {}, items: [] }]
          }
        }
      ]
    });

    it('writes the CSV files of the items sent as they are through record-list-to-file', () => {
      const config = upgrade.apply(buildConfig());

      const [link, ...others] = ((config.northConnectors as Array<JsonObject>)[0].settings as JsonObject).transformers as Array<JsonObject>;
      assert.deepStrictEqual(others, []);
      assert.deepStrictEqual(
        { ...link, id: undefined },
        {
          id: undefined,
          transformerId: 'records',
          options: toOIAnalyticsItemFileOptions(serialization),
          source: { type: 'south', southId: 'oia', items: [{ id: 'i2', name: 'i2', enabled: true }] }
        }
      );
      const south = (config.southConnectors as Array<JsonObject>)[0];
      assert.deepStrictEqual(
        ((south.settings as JsonObject).items as Array<JsonObject>).map(candidate => candidate.settings),
        [{ endpoint: '/api' }, { endpoint: '/api' }]
      );
      const historyQuery = (config.historyQueries as Array<JsonObject>)[0].settings as JsonObject;
      assert.deepStrictEqual(
        (historyQuery.northTransformers as Array<JsonObject>).map(candidate => [candidate.transformerId, candidate.items]),
        [['records', [{ id: 'h1', name: 'h1', enabled: true }]]]
      );
    });

    it('adds the record-list-to-file transformer when the configuration does not describe it', () => {
      const config = buildConfig();
      config.transformers = (config.transformers as Array<JsonObject>).slice(0, 1);

      upgrade.apply(config);

      const recordListToFile = (config.transformers as Array<JsonObject>).find(
        transformer => (transformer.settings as JsonObject).functionName === 'record-list-to-file'
      )!;
      assert.strictEqual((recordListToFile.manifest as JsonObject).key, 'options');
    });

    it('is safe to run twice', () => {
      const once = upgrade.apply(buildConfig());

      assert.deepStrictEqual(upgrade.apply(structuredClone(once)), once);
    });
  });

  describe('File Writer North', () => {
    const buildConfig = (): JsonObject => ({
      transformers: [
        {
          oIBusInternalId: 'records',
          type: 'standard',
          settings: { functionName: 'file-to-record-list', inputType: 'file', outputType: 'record-list' }
        },
        { oIBusInternalId: 'custom', type: 'custom', settings: { name: 'custom', inputType: 'file', outputType: 'setpoint' } }
      ],
      northConnectors: [
        {
          oIBusInternalId: 'writer',
          type: 'file-writer',
          settings: {
            transformers: [
              {
                id: 'l1',
                transformerId: 'records',
                options: { input: { fileType: 'json', rowIteratorPath: '$[*]' } },
                source: { type: 'oibus-api' }
              },
              { id: 'l2', transformerId: 'custom', options: {}, source: { type: 'oibus-api' } }
            ]
          }
        },
        { oIBusInternalId: 'console', type: 'console', settings: { transformers: [{ id: 'l3', transformerId: 'records', options: {} }] } }
      ],
      historyQueries: [
        {
          settings: {
            southType: 'folder-scanner',
            northType: 'file-writer',
            items: [],
            northTransformers: [{ id: 'h1', transformerId: 'custom', options: {} }]
          }
        }
      ]
    });

    it('only sends files to the File Writers', () => {
      const config = upgrade.apply(buildConfig());

      const fileToFile = (config.transformers as Array<JsonObject>).find(
        transformer => (transformer.settings as JsonObject).functionName === 'file-to-file'
      )!;
      assert.strictEqual((fileToFile.manifest as JsonObject).key, 'options');
      const [writer, consoleNorth] = config.northConnectors as Array<JsonObject>;
      assert.deepStrictEqual((writer.settings as JsonObject).transformers, [
        {
          id: 'l1',
          transformerId: fileToFile.oIBusInternalId,
          options: {
            input: { fileType: 'json', rowIteratorPath: '$[*]' },
            output: { fileType: 'json', encoding: 'UTF_8', compression: false },
            filename: '@CurrentDate.json',
            keepOtherFields: true,
            fields: []
          },
          source: { type: 'oibus-api' }
        }
      ]);
      assert.deepStrictEqual((consoleNorth.settings as JsonObject).transformers, [{ id: 'l3', transformerId: 'records', options: {} }]);
      assert.deepStrictEqual(((config.historyQueries as Array<JsonObject>)[0].settings as JsonObject).northTransformers, []);
    });

    it('is safe to run twice', () => {
      const once = upgrade.apply(buildConfig());

      assert.deepStrictEqual(upgrade.apply(structuredClone(once)), once);
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
          ['csv', 'record-list-to-file'],
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
      assert.deepStrictEqual(l1.options, { ...csvFileOptions, filename: 'sql.csv' });
      assert.strictEqual(l2.transformerId, 'csv');
      assert.strictEqual((l2.options as JsonObject).keepOtherFields, false);
      assert.strictEqual(((l2.options as JsonObject).fields as Array<JsonObject>)[0].name, 'Ref');
      assert.strictEqual(l3.transformerId, 'tvOia');
      // grouped by part of the OIAnalytics payload
      assert.deepStrictEqual(l3.options, {
        reference: { referenceField: 'pointId', referenceProcess: null },
        timestamp: {
          timestampField: 'timestamp',
          sourceType: 'iso-string',
          precision: 's',
          timezone: 'UTC',
          format: 'yyyy-MM-dd HH:mm:ss',
          locale: 'en-En'
        },
        value: { valueField: 'value', valueProcess: null }
      });
      const [h1] = ((config.historyQueries as Array<JsonObject>)[0].settings as JsonObject).northTransformers as Array<JsonObject>;
      assert.strictEqual(((h1.options as JsonObject).timestamp as JsonObject).precision, 'ms');
    });

    it('is safe to run twice', () => {
      const once = upgrade.apply(buildConfig());

      assert.deepStrictEqual(upgrade.apply(structuredClone(once)), once);
    });
  });

  describe('OIAnalytics North', () => {
    const transformer = (id: string, functionName: string): JsonObject => ({
      oIBusInternalId: id,
      type: 'standard',
      settings: { functionName, inputType: 'any', outputType: 'any' },
      manifest: {}
    });
    const buildConfig = (functionNames: Array<string>): JsonObject => ({
      transformers: functionNames.map(functionName => transformer(functionName, functionName)),
      southConnectors: [
        { oIBusInternalId: 'opcua', type: 'opcua', settings: { items: [] } },
        { oIBusInternalId: 'modbus', type: 'modbus', settings: { items: [] } },
        { oIBusInternalId: 'mysql', type: 'mysql', settings: { items: [] } }
      ],
      northConnectors: [
        {
          oIBusInternalId: 'oia',
          type: 'oianalytics',
          settings: {
            transformers: [
              { id: 'iso', transformerId: 'iso', options: {}, source: { type: 'south', southId: 'opcua', items: [{ id: 'item1' }] } },
              { id: 'ignore', transformerId: 'ignore', options: {}, source: { type: 'south', southId: 'modbus', items: [] } }
            ]
          }
        },
        { oIBusInternalId: 'fileWriter', type: 'file-writer', settings: { transformers: [] } }
      ],
      historyQueries: [
        { settings: { southType: 'opcua', northType: 'oianalytics', items: [], northTransformers: [] } },
        { settings: { southType: 'mysql', northType: 'oianalytics', items: [], northTransformers: [] } }
      ]
    });

    it('sends the point-based souths of an export made before the record-list refactor through record-list-to-oianalytics', () => {
      const config = upgrade.apply(buildConfig(['iso', 'ignore', 'time-values-to-csv']));

      const oiaTransformer = (config.transformers as Array<JsonObject>).find(
        candidate => (candidate.settings as JsonObject).functionName === 'record-list-to-oianalytics'
      )!;
      assert.strictEqual((oiaTransformer.manifest as JsonObject).key, 'options');
      const links = ((config.northConnectors as Array<JsonObject>)[0].settings as JsonObject).transformers as Array<JsonObject>;
      const linksTo = (southId: string) => links.filter(link => (link.source as JsonObject).southId === southId);
      assert.deepStrictEqual(
        linksTo('opcua').map(link => [link.transformerId, (link.source as JsonObject).items]),
        [
          [oiaTransformer.oIBusInternalId, [{ id: 'item1' }]],
          [oiaTransformer.oIBusInternalId, []]
        ]
      );
      assert.deepStrictEqual(((linksTo('opcua')[0].options as JsonObject).reference as JsonObject).referenceField, 'pointId');
      assert.deepStrictEqual(linksTo('modbus'), []);
      assert.deepStrictEqual(linksTo('mysql'), []);
      const [opcuaHistory, mysqlHistory] = (config.historyQueries as Array<JsonObject>).map(
        historyQuery => (historyQuery.settings as JsonObject).northTransformers as Array<JsonObject>
      );
      assert.deepStrictEqual(
        opcuaHistory.map(link => [link.transformerId, link.items]),
        [[oiaTransformer.oIBusInternalId, []]]
      );
      assert.deepStrictEqual(mysqlHistory, []);
    });

    it('is safe to run twice', () => {
      const once = upgrade.apply(buildConfig(['iso', 'ignore', 'time-values-to-csv', 'record-list-to-oianalytics']));

      assert.deepStrictEqual(upgrade.apply(structuredClone(once)), once);
    });

    it('does not send the point-based souths of an export made after the record-list refactor to OIAnalytics', () => {
      const upgraded = upgrade.apply(buildConfig(['iso', 'ignore', 'record-list-to-csv']));

      const functionNames = (upgraded.transformers as Array<JsonObject>).map(
        transformer => (transformer.settings as JsonObject).functionName
      );
      // The passthroughs are for the other Norths, and for the OIBus API
      // record-list-to-json and setpoint-to-json merged into the record-list-to-file replacing record-list-to-csv
      assert.deepStrictEqual(functionNames, ['record-list-to-file', 'file-to-file']);
      const links = ((upgraded.northConnectors as Array<JsonObject>)[0].settings as JsonObject).transformers as Array<JsonObject>;
      assert.deepStrictEqual(
        links.map(link => link.source),
        [{ type: 'oibus-api' }]
      );
      assert.deepStrictEqual(
        (upgraded.historyQueries as Array<JsonObject>).map(historyQuery => (historyQuery.settings as JsonObject).northTransformers),
        [[], []]
      );
    });
  });

  describe('iso and ignore transformers', () => {
    const transformer = (id: string, functionName: string): JsonObject => ({
      oIBusInternalId: id,
      type: 'standard',
      settings: { functionName, inputType: 'any', outputType: 'any' },
      manifest: {}
    });
    const southLink = (id: string, transformerId: string, southId: string, items: Array<string> = [], groupId?: string) => ({
      id,
      transformerId,
      options: { kept: true },
      source: { type: 'south', southId, groupId, items: items.map(item => ({ id: item, name: item, enabled: true })) }
    });
    const item = (id: string, groupId: string | null = null) => ({ id, name: id, enabled: true, groupId, settings: {} });
    const buildConfig = (): JsonObject => ({
      transformers: [
        transformer('iso', 'iso'),
        transformer('ignore', 'ignore'),
        transformer('csv', 'record-list-to-csv'),
        transformer('json', 'record-list-to-json')
      ],
      southConnectors: [
        { oIBusInternalId: 'opcua', type: 'opcua', settings: { items: [item('i1', 'g1'), item('i2', 'g1'), item('i3')] } },
        { oIBusInternalId: 'folder', type: 'folder-scanner', settings: { items: [item('f1')] } },
        { oIBusInternalId: 'mqtt', type: 'mqtt', settings: { items: [item('m1')] } }
      ],
      northConnectors: [
        {
          oIBusInternalId: 'console',
          type: 'console',
          settings: {
            transformers: [
              southLink('ignoreI2', 'ignore', 'opcua', ['i2']),
              southLink('groupCsv', 'csv', 'opcua', [], 'g1'),
              southLink('ignoreFolder', 'ignore', 'folder'),
              { id: 'ignoreSetpoints', transformerId: 'ignore', options: {}, source: { type: 'oianalytics-setpoint' } }
            ]
          }
        },
        {
          oIBusInternalId: 's3',
          type: 'aws-s3',
          settings: {
            transformers: [
              southLink('isoMqtt', 'iso', 'mqtt'),
              southLink('isoOpcua', 'iso', 'opcua'),
              southLink('orphan', 'iso', 'deleted'),
              { id: 'isoApi', transformerId: 'iso', options: {}, source: { type: 'oibus-api', dataSourceId: 'ds1' } },
              { id: 'ignoreApi', transformerId: 'ignore', options: {}, source: { type: 'oibus-api', dataSourceId: 'ds2' } }
            ]
          }
        },
        { oIBusInternalId: 'fileWriter', type: 'file-writer', settings: { transformers: [] } }
      ],
      historyQueries: [
        {
          settings: {
            southType: 'opcua',
            northType: 'console',
            items: [item('h1'), item('h2')],
            northTransformers: [{ id: 'ignoreH1', transformerId: 'ignore', options: {}, items: [item('h1')] }]
          }
        }
      ]
    });
    const linksOf = (config: JsonObject, index: number) =>
      (((config.northConnectors as Array<JsonObject>)[index].settings as JsonObject).transformers as Array<JsonObject>).map(link => ({
        transformerId: link.transformerId,
        options: link.options,
        source: link.source
      }));
    const idOf = (config: JsonObject, functionName: string) =>
      (config.transformers as Array<JsonObject>).find(candidate => (candidate.settings as JsonObject).functionName === functionName)
        ?.oIBusInternalId;
    const lightItems = (...ids: Array<string>) => ids.map(id => ({ id, name: id, enabled: true }));

    it('replaces them by passthroughs routing the data as before', () => {
      const config = upgrade.apply(buildConfig());

      const fileId = idOf(config, 'file-to-file');
      // The setpoint passthrough (setpoint-to-json) merged into record-list-to-file, the file one replaced by file-to-file
      assert.deepStrictEqual(
        (config.transformers as Array<JsonObject>).map(candidate => (candidate.settings as JsonObject).functionName),
        ['record-list-to-file', 'file-to-file']
      );
      assert.strictEqual(((config.transformers as Array<JsonObject>)[1].manifest as JsonObject).key, 'options');
      assert.deepStrictEqual(linksOf(config, 0), [
        {
          transformerId: 'csv',
          options: csvFileOptions,
          source: { type: 'south', southId: 'opcua', groupId: 'g1', items: [], excludedItems: lightItems('i2') }
        },
        {
          transformerId: 'csv',
          options: jsonFileOptions,
          source: { type: 'south', southId: 'opcua', items: [], excludedItems: lightItems('i2') }
        },
        { transformerId: fileId, options: FILE_AS_IS_OPTIONS, source: { type: 'oibus-api' } }
      ]);
      assert.deepStrictEqual(linksOf(config, 1), [
        { transformerId: fileId, options: FILE_AS_IS_OPTIONS, source: { type: 'south', southId: 'mqtt', groupId: undefined, items: [] } },
        { transformerId: fileId, options: FILE_AS_IS_OPTIONS, source: { type: 'oibus-api', dataSourceId: 'ds1' } },
        { transformerId: fileId, options: FILE_AS_IS_OPTIONS, source: { type: 'south', southId: 'folder', items: [] } }
      ]);
      assert.deepStrictEqual(linksOf(config, 2), [
        { transformerId: 'csv', options: jsonFileOptions, source: { type: 'south', southId: 'opcua', items: [] } },
        { transformerId: fileId, options: FILE_AS_IS_OPTIONS, source: { type: 'south', southId: 'folder', items: [] } },
        { transformerId: fileId, options: FILE_AS_IS_OPTIONS, source: { type: 'oibus-api' } },
        { transformerId: 'csv', options: jsonFileOptions, source: { type: 'oianalytics-setpoint' } }
      ]);
      const historyLinks = ((config.historyQueries as Array<JsonObject>)[0].settings as JsonObject).northTransformers as Array<JsonObject>;
      assert.deepStrictEqual(
        historyLinks.map(link => [link.transformerId, link.options, link.items]),
        [['csv', jsonFileOptions, lightItems('h2')]]
      );
    });

    it('is safe to run twice', () => {
      const once = upgrade.apply(buildConfig());

      assert.deepStrictEqual(upgrade.apply(structuredClone(once)), once);
    });
  });
});
