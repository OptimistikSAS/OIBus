import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { removeEmptyTimestampOrigin, upgrade } from './v3.9.2';
import { JsonObject } from '../config-upgrade';

describe('3.9.2 config upgrade', () => {
  it('removes an empty timestamp origin, and returns any other settings as is', () => {
    assert.deepStrictEqual(removeEmptyTimestampOrigin({ nodeId: 'ns=1', timestampOrigin: '' }), { nodeId: 'ns=1' });
    const settings = { nodeId: 'ns=1', timestampOrigin: 'point' };
    assert.strictEqual(removeEmptyTimestampOrigin(settings), settings);
  });

  it('upgrades the items of OPC UA souths and history queries only, and is safe to run twice', () => {
    const item = (): JsonObject => ({ settings: { nodeId: 'ns=1', timestampOrigin: '' } });
    const config: JsonObject = {
      southConnectors: [
        { type: 'opcua', settings: { items: [item()] } },
        { type: 'mqtt', settings: { items: [item()] } }
      ],
      historyQueries: [{ settings: { southType: 'opcua', items: [item()] } }, { settings: { southType: 'mssql', items: [item()] } }]
    };

    const once = upgrade.apply(config);

    assert.deepStrictEqual(once, {
      southConnectors: [
        { type: 'opcua', settings: { items: [{ settings: { nodeId: 'ns=1' } }] } },
        { type: 'mqtt', settings: { items: [item()] } }
      ],
      historyQueries: [
        { settings: { southType: 'opcua', items: [{ settings: { nodeId: 'ns=1' } }] } },
        { settings: { southType: 'mssql', items: [item()] } }
      ]
    });
    assert.deepStrictEqual(upgrade.apply(structuredClone(once)), once);
  });
});
