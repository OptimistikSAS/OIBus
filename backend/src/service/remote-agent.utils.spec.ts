import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseRemoteAgentRecords, REMOTE_AGENT_DELIMITER } from './remote-agent.utils';

const line = (...values: Array<string>) => values.join(REMOTE_AGENT_DELIMITER);

describe('Remote agent utils', () => {
  it('should parse the records returned by the agent', () => {
    const content = [line('id', 'name', 'timestamp'), line('1', 'a, "quoted";', '2026-10-22T12:00:00.000Z'), line('2', '', ''), ''].join(
      '\r\n'
    );

    assert.deepStrictEqual(parseRemoteAgentRecords(content), [
      { id: '1', name: 'a, "quoted";', timestamp: '2026-10-22T12:00:00.000Z' },
      { id: '2', name: null, timestamp: null }
    ]);
  });

  it('should parse records with missing values and Unix line endings', () => {
    assert.deepStrictEqual(parseRemoteAgentRecords([line('id', 'name'), '1'].join('\n')), [{ id: '1', name: null }]);
  });

  it('should return no record for an empty result', () => {
    assert.deepStrictEqual(parseRemoteAgentRecords(''), []);
    assert.deepStrictEqual(parseRemoteAgentRecords(`${line('id', 'name')}\r\n`), []);
  });
});
