import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { forEachHistoryQuery, forEachHistoryQueryItem, forEachNorth, forEachSouth, forEachSouthItem, JsonObject } from './config-upgrade';

const config = (): JsonObject => ({
  southConnectors: [
    { type: 'opcua', settings: { name: 'south1', items: [{ name: 'item1' }, { name: 'item2' }] } },
    { type: 'mqtt', settings: { name: 'south2', items: [{ name: 'item3' }] } },
    { type: 'opcua', settings: { name: 'south3' } }
  ],
  northConnectors: [
    { type: 'file-writer', settings: { name: 'north1' } },
    { type: 'console', settings: { name: 'north2' } }
  ],
  historyQueries: [
    { settings: { name: 'history1', southType: 'opcua', items: [{ name: 'item4' }] } },
    { settings: { name: 'history2', southType: 'mssql', items: [{ name: 'item5' }] } }
  ]
});

const names = (collect: (push: (name: unknown) => void) => void): Array<unknown> => {
  const collected: Array<unknown> = [];
  collect(name => collected.push(name));
  return collected;
};

describe('config upgrade helpers', () => {
  it('forEachSouth visits the souths of a type, or all of them', () => {
    const configuration = config();
    assert.deepStrictEqual(
      names(push => forEachSouth(configuration, 'opcua', south => push((south.settings as JsonObject).name))),
      ['south1', 'south3']
    );
    assert.deepStrictEqual(
      names(push => forEachSouth(configuration, null, south => push((south.settings as JsonObject).name))),
      ['south1', 'south2', 'south3']
    );
  });

  it('forEachSouthItem visits the items of the souths of a type, tolerating a south without items', () => {
    const configuration = config();
    assert.deepStrictEqual(
      names(push => forEachSouthItem(configuration, 'opcua', (item, south) => push(`${(south.settings as JsonObject).name}/${item.name}`))),
      ['south1/item1', 'south1/item2']
    );
  });

  it('forEachNorth visits the norths of a type, or all of them', () => {
    const configuration = config();
    assert.deepStrictEqual(
      names(push => forEachNorth(configuration, 'console', north => push((north.settings as JsonObject).name))),
      ['north2']
    );
    assert.deepStrictEqual(
      names(push => forEachNorth(configuration, null, north => push((north.settings as JsonObject).name))),
      ['north1', 'north2']
    );
  });

  it('forEachHistoryQuery and forEachHistoryQueryItem filter on the south type', () => {
    const configuration = config();
    assert.deepStrictEqual(
      names(push => forEachHistoryQuery(configuration, 'mssql', settings => push(settings.name))),
      ['history2']
    );
    assert.deepStrictEqual(
      names(push => forEachHistoryQueryItem(configuration, null, (item, settings) => push(`${settings.name}/${item.name}`))),
      ['history1/item4', 'history2/item5']
    );
  });

  it('lets the visitor modify the configuration in place', () => {
    const configuration = config();
    forEachSouthItem(configuration, 'mqtt', item => (item.name = 'renamed'));
    assert.strictEqual(
      ((((configuration.southConnectors as Array<JsonObject>)[1].settings as JsonObject).items as Array<JsonObject>)[0] as JsonObject).name,
      'renamed'
    );
  });

  it('does nothing on a configuration missing a section', () => {
    assert.deepStrictEqual(
      names(push => {
        forEachSouth({}, null, push);
        forEachNorth({}, null, push);
        forEachHistoryQueryItem({}, null, push);
      }),
      []
    );
  });
});
