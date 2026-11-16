import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FILE_PASSTHROUGH,
  passthroughFor,
  planRouting,
  planSourceRouting,
  RECORD_LIST_PASSTHROUGH,
  RoutingLink,
  RoutingPlan,
  SETPOINT_PASSTHROUGH,
  southContentType
} from './passthrough-transformers';

const link = (id: string, functionName: string | undefined, itemIds: Array<string> = [], groupItemIds?: Array<string>): RoutingLink => ({
  id,
  functionName,
  itemIds,
  groupItemIds
});
const ITEMS = ['i1', 'i2', 'i3'];

describe('passthrough transformers', () => {
  it('should tell the content type each south sends', () => {
    assert.strictEqual(southContentType('opcua'), 'record-list');
    assert.strictEqual(southContentType('mssql'), 'record-list');
    assert.strictEqual(southContentType('mqtt'), 'any-content');
    assert.strictEqual(southContentType('folder-scanner'), 'any');
  });

  it('should find the passthrough of the content a North received as is', () => {
    assert.strictEqual(passthroughFor('any', 'aws-s3', false), FILE_PASSTHROUGH);
    assert.strictEqual(passthroughFor('record-list', 'console', false), RECORD_LIST_PASSTHROUGH);
    assert.strictEqual(passthroughFor('setpoint', 'file-writer', false), SETPOINT_PASSTHROUGH);
    assert.strictEqual(passthroughFor('record-list', 'oianalytics', true), undefined);
    assert.strictEqual(passthroughFor('any', 'mqtt', false), undefined);
    assert.strictEqual(passthroughFor('any', 'unknown', false), undefined);
    // JSON payloads were only cached through 'iso'
    assert.strictEqual(passthroughFor('any-content', 'rest', false), undefined);
    assert.strictEqual(passthroughFor('any-content', 'rest', true), FILE_PASSTHROUGH);
    assert.strictEqual(passthroughFor('any-content', 'opcua', true), undefined);
  });

  describe('planRouting', () => {
    const plan = (overrides: Partial<RoutingPlan>): RoutingPlan => ({
      removed: [],
      toPassthrough: [],
      narrowed: new Map(),
      excluded: new Map(),
      added: undefined,
      ...overrides
    });
    const southLevel = { itemIds: [], excludedItemIds: [] };

    it('should add a passthrough at the south level for the data without transformer', () => {
      assert.deepStrictEqual(planRouting([], ITEMS, true, true, true), plan({ added: southLevel }));
      assert.deepStrictEqual(planRouting([], [], true, true, true), plan({ added: southLevel }));
      assert.deepStrictEqual(planRouting([], ITEMS, false, false, true), plan({}));
    });

    it('should keep the transformers and only add the passthrough below them', () => {
      const links = [link('csv', 'record-list-to-csv', ['i1']), link('custom', undefined, [], ['i2'])];

      assert.deepStrictEqual(planRouting(links, ITEMS, true, true, true), plan({ added: southLevel }));
    });

    it('should not add a passthrough under a south level transformer', () => {
      assert.deepStrictEqual(planRouting([link('csv', 'record-list-to-csv')], ITEMS, true, true, true), plan({}));
    });

    it('should replace iso by the passthrough when the North accepted the data', () => {
      const links = [link('iso1', 'iso', ['i1']), link('iso2', 'iso')];

      assert.deepStrictEqual(planRouting(links, ITEMS, true, true, true), plan({ toPassthrough: ['iso1', 'iso2'] }));
    });

    it('should remove iso when the North did not accept the data', () => {
      assert.deepStrictEqual(planRouting([link('iso', 'iso')], ITEMS, false, false, true), plan({ removed: ['iso'] }));
    });

    it('should leave the ignored items out of the passthrough', () => {
      assert.deepStrictEqual(
        planRouting([link('ignore', 'ignore', ['i2'])], ITEMS, true, true, true),
        plan({ removed: ['ignore'], added: { itemIds: [], excludedItemIds: ['i2'] } })
      );
      assert.deepStrictEqual(
        planRouting([link('ignore', 'ignore', ITEMS)], ITEMS, true, true, true),
        plan({ removed: ['ignore'], added: { itemIds: [], excludedItemIds: ITEMS } })
      );
    });

    it('should leave the ignored items out of the south and group level transformers, and of the item lists', () => {
      const links = [
        link('ignore', 'ignore', ['i1', 'i3']),
        link('group', 'record-list-to-json', [], ['i1', 'i2']),
        link('json', 'record-list-to-json', ['i3', 'i2']),
        link('csv', 'record-list-to-csv', ['i3']),
        link('south', 'record-list-to-csv'),
        link('ignoreGroup', 'ignore', [], ['i3'])
      ];

      assert.deepStrictEqual(
        planRouting(links, ITEMS, true, true, true),
        plan({
          removed: ['ignore', 'csv', 'ignoreGroup'],
          narrowed: new Map([['json', ['i2']]]),
          excluded: new Map([
            ['group', ['i1']],
            ['south', ['i1', 'i3']]
          ])
        })
      );
    });

    it('should leave the items of an ignored south out of the south level transformers it shadowed', () => {
      const links = [link('ignore', 'ignore'), link('csv', 'record-list-to-csv'), link('json', 'record-list-to-json', ['i1'])];

      assert.deepStrictEqual(
        planRouting(links, ITEMS, true, true, true),
        plan({ removed: ['ignore'], excluded: new Map([['csv', ['i2', 'i3']]]) })
      );
    });

    it('should narrow the transformers to item lists when items cannot be left out', () => {
      const links = [
        link('ignore', 'ignore', ['i1']),
        link('json', 'record-list-to-json', ['i3', 'i1']),
        link('iso', 'iso'),
        link('ignoreAll', 'ignore', ['i2', 'i3']),
        link('csv', 'record-list-to-csv', ['i2'])
      ];

      assert.deepStrictEqual(
        planRouting(links, ITEMS, true, true, false),
        plan({ removed: ['ignore', 'iso', 'ignoreAll', 'csv'], toPassthrough: [], narrowed: new Map([['json', ['i3']]]) })
      );
      assert.deepStrictEqual(
        planRouting([link('ignore', 'ignore', ['i1']), link('iso', 'iso')], ITEMS, true, true, false),
        plan({ removed: ['ignore'], toPassthrough: ['iso'], narrowed: new Map([['iso', ['i2', 'i3']]]) })
      );
      assert.deepStrictEqual(
        planRouting([link('ignore', 'ignore', ['i1'])], ITEMS, true, true, false),
        plan({ removed: ['ignore'], added: { itemIds: ['i2', 'i3'], excludedItemIds: [] } })
      );
    });

    it('should remove an iso link the North dropped the data of, and leave its items out of what it shadowed', () => {
      const links = [link('iso', 'iso', ['i1']), link('csv', 'record-list-to-csv')];

      assert.deepStrictEqual(
        planRouting(links, ITEMS, false, false, true),
        plan({ removed: ['iso'], excluded: new Map([['csv', ['i1']]]) })
      );
    });
  });
  describe('planSourceRouting', () => {
    it('should keep a source without link as is', () => {
      assert.deepStrictEqual(planSourceRouting([], true), { removed: [], toPassthrough: undefined, ignored: false });
    });

    it('should remove every link of an ignored source', () => {
      assert.deepStrictEqual(
        planSourceRouting(
          [
            { id: 'ignore', functionName: 'ignore' },
            { id: 'json', functionName: 'record-list-to-json' }
          ],
          true
        ),
        { removed: ['ignore', 'json'], toPassthrough: undefined, ignored: true }
      );
      assert.deepStrictEqual(planSourceRouting([{ id: 'iso', functionName: 'iso' }], false), {
        removed: ['iso'],
        toPassthrough: undefined,
        ignored: true
      });
    });

    it('should replace iso by the passthrough', () => {
      assert.deepStrictEqual(
        planSourceRouting(
          [
            { id: 'iso', functionName: 'iso' },
            { id: 'ignore', functionName: 'ignore' },
            { id: 'custom', functionName: undefined }
          ],
          true
        ),
        { removed: ['ignore'], toPassthrough: 'iso', ignored: false }
      );
    });

    it('should keep the transformer of a source', () => {
      assert.deepStrictEqual(
        planSourceRouting(
          [
            { id: 'custom', functionName: undefined },
            { id: 'iso', functionName: 'iso' }
          ],
          true
        ),
        { removed: ['iso'], toPassthrough: undefined, ignored: false }
      );
    });
  });
});
