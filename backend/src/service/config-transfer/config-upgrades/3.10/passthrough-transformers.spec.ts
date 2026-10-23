import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FILE_PASSTHROUGH,
  passthroughFor,
  planRouting,
  planSourceRouting,
  RECORD_LIST_PASSTHROUGH,
  RoutingLink,
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
    it('should add a passthrough at the south level for the data without transformer', () => {
      assert.deepStrictEqual(planRouting([], ITEMS, true, true), {
        removed: [],
        toPassthrough: [],
        narrowed: new Map(),
        added: { itemIds: [] }
      });
      assert.deepStrictEqual(planRouting([], [], true, true).added, { itemIds: [] });
      assert.deepStrictEqual(planRouting([], ITEMS, false, false).added, undefined);
    });

    it('should keep the transformers and only add the passthrough below them', () => {
      const plan = planRouting([link('csv', 'record-list-to-csv', ['i1']), link('custom', undefined, [], ['i2'])], ITEMS, true, true);

      assert.deepStrictEqual(plan, { removed: [], toPassthrough: [], narrowed: new Map(), added: { itemIds: [] } });
    });

    it('should not add a passthrough under a south level transformer', () => {
      assert.deepStrictEqual(planRouting([link('csv', 'record-list-to-csv')], ITEMS, true, true), {
        removed: [],
        toPassthrough: [],
        narrowed: new Map(),
        added: undefined
      });
    });

    it('should replace iso by the passthrough when the North accepted the data', () => {
      const plan = planRouting([link('iso1', 'iso', ['i1']), link('iso2', 'iso')], ITEMS, true, true);

      assert.deepStrictEqual(plan, { removed: [], toPassthrough: ['iso1', 'iso2'], narrowed: new Map(), added: undefined });
    });

    it('should remove iso when the North did not accept the data', () => {
      const plan = planRouting([link('iso', 'iso')], ITEMS, false, false);

      assert.deepStrictEqual(plan, { removed: ['iso'], toPassthrough: [], narrowed: new Map(), added: undefined });
    });

    it('should narrow the passthrough to the items not ignored', () => {
      const plan = planRouting([link('ignore', 'ignore', ['i2'])], ITEMS, true, true);

      assert.deepStrictEqual(plan, { removed: ['ignore'], toPassthrough: [], narrowed: new Map(), added: { itemIds: ['i1', 'i3'] } });
    });

    it('should not add the passthrough when every item is ignored', () => {
      const plan = planRouting([link('ignore', 'ignore', ITEMS)], ITEMS, true, true);

      assert.deepStrictEqual(plan, { removed: ['ignore'], toPassthrough: [], narrowed: new Map(), added: undefined });
    });

    it('should narrow the south and group level transformers to the items not ignored', () => {
      const plan = planRouting(
        [
          link('ignore', 'ignore', ['i1', 'i3']),
          link('group', 'record-list-to-json', [], ['i1', 'i2']),
          link('south', 'record-list-to-csv'),
          link('ignoreGroup', 'ignore', [], ['i3'])
        ],
        ITEMS,
        true,
        true
      );

      assert.deepStrictEqual(plan, {
        removed: ['ignore', 'south', 'ignoreGroup'],
        toPassthrough: [],
        narrowed: new Map([['group', ['i2']]]),
        added: undefined
      });
    });

    it('should drop the south level transformers shadowed by an ignored south', () => {
      const plan = planRouting(
        [link('ignore', 'ignore'), link('csv', 'record-list-to-csv'), link('json', 'record-list-to-json', ['i1'])],
        ITEMS,
        true,
        true
      );

      assert.deepStrictEqual(plan, { removed: ['ignore', 'csv'], toPassthrough: [], narrowed: new Map(), added: undefined });
    });

    it('should narrow every transformer an ignored item falls back to', () => {
      const plan = planRouting(
        [link('ignore', 'ignore', ['i1']), link('json', 'record-list-to-json', ['i3', 'i1']), link('iso', 'iso')],
        ITEMS,
        true,
        true
      );

      assert.deepStrictEqual(plan, {
        removed: ['ignore'],
        toPassthrough: ['iso'],
        narrowed: new Map([
          ['json', ['i3']],
          ['iso', ['i2']]
        ]),
        added: undefined
      });
    });

    it('should remove an iso link the North dropped the data of, and narrow what it shadowed', () => {
      const plan = planRouting([link('iso', 'iso', ['i1']), link('csv', 'record-list-to-csv')], ITEMS, false, false);

      assert.deepStrictEqual(plan, {
        removed: ['iso'],
        toPassthrough: [],
        narrowed: new Map([['csv', ['i2', 'i3']]]),
        added: undefined
      });
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
