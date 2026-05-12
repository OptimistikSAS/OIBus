import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatQueryParams, getOIBusInfo, itemToFlattenedCSV } from './utils';
import type { SouthConnectorItemDTO } from '../../shared/model/south-connector.model';
import type { EngineSettingsDTO } from '../../shared/model/engine.model';
import os from 'node:os';
import process from 'node:process';

describe('utils — direct coverage', () => {
  describe('formatQueryParams', () => {
    it('should return empty object for no params', () => {
      const result = formatQueryParams('start', 'end', []);
      assert.deepStrictEqual(result, {});
    });

    it('should substitute @StartTime', () => {
      const result = formatQueryParams('2020-01-01', '2021-01-01', [{ key: 'from', value: '@StartTime' }]);
      assert.deepStrictEqual(result, { from: '2020-01-01' });
    });

    it('should substitute @EndTime', () => {
      const result = formatQueryParams('2020-01-01', '2021-01-01', [{ key: 'to', value: '@EndTime' }]);
      assert.deepStrictEqual(result, { to: '2021-01-01' });
    });

    it('should pass through default param values', () => {
      const result = formatQueryParams('s', 'e', [{ key: 'k', value: 'literal' }]);
      assert.deepStrictEqual(result, { k: 'literal' });
    });
  });

  describe('getOIBusInfo', () => {
    it('should return OIBus info including architecture and os', () => {
      const settings = { id: 'id', name: 'test', version: '1.0.0', launcherVersion: '1.0.0' } as EngineSettingsDTO;
      const info = getOIBusInfo(settings);
      assert.strictEqual(info.oibusId, 'id');
      assert.strictEqual(info.oibusName, 'test');
      assert.strictEqual(info.architecture, process.arch);
      assert.strictEqual(info.operatingSystem, `${os.type()} ${os.release()}`);
    });
  });

  describe('itemToFlattenedCSV', () => {
    const baseItem = {
      id: 'item1',
      connectorId: 'conn1',
      name: 'Item 1',
      enabled: true,
      scanModeId: 'sm1',
      scanMode: { id: 'sm1', name: 'Every 10s', cron: '*/10 * * * * *', createdBy: '', updatedBy: '', createdAt: '', updatedAt: '' },
      group: null,
      syncWithGroup: false,
      maxReadInterval: 3600,
      readDelay: 200,
      overlap: 0,
      settings: { address: '40001' }
    } as unknown as SouthConnectorItemDTO;

    it('should flatten items with scanModes', () => {
      const scanModes = [
        { id: 'sm1', name: 'Every 10s', cron: '*/10 * * * * *', description: '', createdBy: '', updatedBy: '', createdAt: '', updatedAt: '' }
      ];
      const result = itemToFlattenedCSV([baseItem], ',', scanModes);
      assert.ok(result.includes('Item 1'));
    });

    it('should flatten items without scanModes', () => {
      const result = itemToFlattenedCSV([baseItem], ',');
      assert.ok(result.includes('Item 1'));
    });

    it('should fall back to group historian settings when item fields are null', () => {
      const itemWithNulls = {
        ...baseItem,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        group: {
          id: 'g1',
          standardSettings: { name: 'Group A', scanMode: { id: 'sm1', name: 'Every 10s', cron: '' } },
          historySettings: { maxReadInterval: 9999, readDelay: 500, overlap: 10 }
        }
      } as unknown as SouthConnectorItemDTO;
      const result = itemToFlattenedCSV([itemWithNulls], ',');
      assert.ok(result.includes('9999') || result.includes('Group A'));
    });
  });
});
