import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addOpcuaMaxParallelRun, opcuaMaxParallelRunUpgrades } from './v3.9.0';

describe('addOpcuaMaxParallelRun', () => {
  it('adds maxParallelRun: 1 to a settings object that does not have it', () => {
    const result = addOpcuaMaxParallelRun({ url: 'opc.tcp://localhost:4840', keepSessionAlive: false });

    assert.deepStrictEqual(result, { url: 'opc.tcp://localhost:4840', keepSessionAlive: false, maxParallelRun: 1 });
  });

  it('overwrites an existing maxParallelRun value with 1', () => {
    const result = addOpcuaMaxParallelRun({ maxParallelRun: 5 });

    assert.strictEqual(result.maxParallelRun, 1);
  });

  it('does not mutate the input object', () => {
    const input = { url: 'opc.tcp://localhost:4840' };

    const result = addOpcuaMaxParallelRun(input);

    assert.strictEqual(Object.prototype.hasOwnProperty.call(input, 'maxParallelRun'), false);
    assert.notStrictEqual(result, input);
  });

  it('preserves every other field untouched', () => {
    const input = { url: 'opc.tcp://localhost:4840', keepSessionAlive: true, readTimeout: 1000 };

    const result = addOpcuaMaxParallelRun(input);

    assert.strictEqual(result.url, 'opc.tcp://localhost:4840');
    assert.strictEqual(result.keepSessionAlive, true);
    assert.strictEqual(result.readTimeout, 1000);
  });
});

describe('opcuaMaxParallelRunUpgrades', () => {
  it('registers one entry for the opcua south connector scope and one for the opcua history-query south scope, both version 3.9.0', () => {
    assert.strictEqual(opcuaMaxParallelRunUpgrades.length, 2);
    assert.ok(opcuaMaxParallelRunUpgrades.every(entry => entry.version === '3.9.0'));

    const scopes = opcuaMaxParallelRunUpgrades.map(entry => entry.scope).sort();
    assert.deepStrictEqual(scopes, ['historyQuerySouth:opcua', 'south:opcua']);
  });

  it('reuses the exact same apply function for both entries', () => {
    assert.strictEqual(opcuaMaxParallelRunUpgrades[0].apply, addOpcuaMaxParallelRun);
    assert.strictEqual(opcuaMaxParallelRunUpgrades[1].apply, addOpcuaMaxParallelRun);
  });
});
