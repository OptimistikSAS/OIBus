import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildRecordListToCsvOptions, keepsResolvedTransformer, toNewSqlItemSettings, upgrade } from './v3.10.0';
import { JsonObject } from '../config-upgrade';
import { CONFIG_TRANSFER_FIXTURES_DIR } from '../../../../tests/config-transfer-fixtures/config-transfer-fixture';

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
    const existing = { ...standardTransformers(config, 'iso')[0], oIBusInternalId: 'existingId' };
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

    upgrade.apply(config);

    assert.deepStrictEqual(standardTransformers(config, 'record-list-to-csv'), []);
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
});
