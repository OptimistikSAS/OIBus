import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toSouthConnectorItemDTO, toSouthItemGroupDTO, toSouthItemLightDTO } from './south-connector-dto.utils';
import testData from '../tests/utils/test-data';
import { SouthConnectorItemEntity } from '../model/south-connector.model';
import { SouthItemSettings } from '../../shared/model/south-settings.model';

const getUserInfo = (id: string) => ({ id, friendlyName: id });

describe('south-connector-dto utils', () => {
  describe('toSouthConnectorItemDTO', () => {
    const southType = testData.south.list[0].type;

    it('should map an item with a scan mode to its DTO', () => {
      const item: SouthConnectorItemEntity<SouthItemSettings> = {
        ...testData.south.list[0].items[0],
        scanMode: testData.scanMode.list[0]
      };

      const dto = toSouthConnectorItemDTO(item, southType, getUserInfo);

      assert.ok(dto.scanMode !== null);
      assert.strictEqual(dto.scanMode!.id, testData.scanMode.list[0].id);
    });

    it('should map an item without a scan mode (null) to a null scanMode DTO', () => {
      const item: SouthConnectorItemEntity<SouthItemSettings> = {
        ...testData.south.list[0].items[0],
        scanMode: null
      };

      const dto = toSouthConnectorItemDTO(item, southType, getUserInfo);

      assert.strictEqual(dto.scanMode, null);
    });

    it('should map an item with a group to its DTO', () => {
      const group = {
        id: 'group1',
        name: 'Test Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: null,
        endTimeOffset: null,
        maxReadInterval: null,
        recoveryStrategy: null,
        cachingStrategy: null,
        readDelay: 0,
        items: [],
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      };
      const item: SouthConnectorItemEntity<SouthItemSettings> = {
        ...testData.south.list[0].items[0],
        scanMode: testData.scanMode.list[0],
        group
      };

      const dto = toSouthConnectorItemDTO(item, southType, getUserInfo);

      assert.ok(dto.group !== null);
      assert.strictEqual(dto.group!.id, 'group1');
    });

    it('should map an item without a group (null) to a null group DTO', () => {
      const item: SouthConnectorItemEntity<SouthItemSettings> = {
        ...testData.south.list[0].items[0],
        scanMode: testData.scanMode.list[0],
        group: null
      };

      const dto = toSouthConnectorItemDTO(item, southType, getUserInfo);

      assert.strictEqual(dto.group, null);
    });
  });

  describe('toSouthItemGroupDTO', () => {
    it('should map a group entity to its DTO', () => {
      const group = {
        id: 'group1',
        name: 'Test Group',
        southId: testData.south.list[0].id,
        scanMode: testData.scanMode.list[0],
        startTimeOffset: 10,
        endTimeOffset: 20,
        maxReadInterval: 3600,
        recoveryStrategy: null,
        cachingStrategy: null,
        readDelay: 0,
        items: [],
        createdBy: 'creator',
        updatedBy: 'updater',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z'
      };

      const dto = toSouthItemGroupDTO(group, getUserInfo);

      assert.strictEqual(dto.id, 'group1');
      assert.strictEqual(dto.standardSettings.name, 'Test Group');
      assert.strictEqual(dto.standardSettings.scanMode.id, testData.scanMode.list[0].id);
      assert.strictEqual(dto.historySettings.startTimeOffset, 10);
      assert.strictEqual(dto.historySettings.endTimeOffset, 20);
      assert.deepStrictEqual(dto.createdBy, getUserInfo('creator'));
      assert.deepStrictEqual(dto.updatedBy, getUserInfo('updater'));
    });
  });

  describe('toSouthItemLightDTO', () => {
    it('should map an item entity light to its DTO', () => {
      const entity = {
        id: 'itemLight1',
        name: 'Light item',
        enabled: true,
        createdBy: 'creator',
        updatedBy: 'updater',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z'
      };

      const dto = toSouthItemLightDTO(entity, getUserInfo);

      assert.deepStrictEqual(dto, {
        id: 'itemLight1',
        name: 'Light item',
        enabled: true,
        createdBy: getUserInfo('creator'),
        updatedBy: getUserInfo('updater'),
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-02T00:00:00.000Z'
      });
    });
  });
});
