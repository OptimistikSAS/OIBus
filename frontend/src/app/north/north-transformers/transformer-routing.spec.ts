import { describe, expect, test } from 'vitest';

import { ItemLightDTO } from '@oibus/shared/api/south-connector.model';
import { TransformerDTO, TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';

import testData from '../../../test/test-data';
import { findDefaultTransformer, resolveItemRouting, southCoverage } from './transformer-routing';

const south = testData.south.listLight[0];
const otherSouth = testData.south.listLight[1];
const item = (id: string): ItemLightDTO => ({
  id,
  name: id,
  enabled: true,
  createdBy: { id: '', friendlyName: '' },
  updatedBy: { id: '', friendlyName: '' },
  createdAt: '',
  updatedAt: ''
});
const link = (id: string, source: Partial<Extract<TransformerDTOWithOptions['source'], { type: 'south' }>>): TransformerDTOWithOptions => ({
  id,
  transformer: testData.transformers.customList[0],
  options: {},
  source: { type: 'south', south, items: [], ...source }
});
const standard = (
  functionName: string,
  inputType: TransformerDTO['inputType'],
  outputType: TransformerDTO['outputType']
): TransformerDTO => ({
  id: functionName,
  type: 'standard',
  functionName,
  inputType,
  outputType,
  manifest: testData.transformers.customList[0].manifest
});

describe('transformer routing', () => {
  describe('resolveItemRouting', () => {
    const transformers = [
      link('otherSouth', { south: otherSouth }),
      link('group', { group: { id: 'g1', name: 'Group 1' }, excludedItems: [item('i2')] }),
      link('items', { items: [item('i1')] }),
      link('southWithout3', { excludedItems: [item('i3')] }),
      link('south', {})
    ];

    test('should route an item to its own transformer, then its group one, then its south one', () => {
      expect(resolveItemRouting(transformers, south.id, { id: 'i1', groupId: 'g1' })).toEqual({
        transformer: transformers[2],
        level: 'item'
      });
      expect(resolveItemRouting(transformers, south.id, { id: 'i4', groupId: 'g1' })).toEqual({
        transformer: transformers[1],
        level: 'group'
      });
      expect(resolveItemRouting(transformers, south.id, { id: 'i4', groupId: null })).toEqual({
        transformer: transformers[3],
        level: 'south'
      });
    });

    test('should skip the transformers leaving the item out', () => {
      expect(resolveItemRouting(transformers, south.id, { id: 'i2', groupId: 'g1' })).toEqual({
        transformer: transformers[3],
        level: 'south'
      });
      expect(resolveItemRouting(transformers, south.id, { id: 'i3', groupId: null })).toEqual({
        transformer: transformers[4],
        level: 'south'
      });
      expect(resolveItemRouting([transformers[1]], south.id, { id: 'i2', groupId: 'g1' })).toBeNull();
      expect(resolveItemRouting([], south.id, { id: 'i1', groupId: null })).toBeNull();
    });
  });

  test('should tell whether the data of a south reaches the north', () => {
    expect(southCoverage([], south.id)).toBe('none');
    expect(southCoverage([link('other', { south: otherSouth })], south.id)).toBe('none');
    expect(southCoverage([link('items', { items: [item('i1')] })], south.id)).toBe('some');
    expect(southCoverage([link('group', { group: { id: 'g1', name: 'Group 1' } })], south.id)).toBe('some');
    expect(southCoverage([link('south', { excludedItems: [item('i1')] })], south.id)).toBe('all');
    expect(southCoverage([{ ...link('api', {}), source: { type: 'oibus-api' } }], south.id)).toBe('none');
  });

  describe('findDefaultTransformer', () => {
    const transformers = [
      standard('file', 'any', 'any'),
      standard('record-list-to-json', 'record-list', 'any'),
      standard('setpoint-to-json', 'setpoint', 'any'),
      standard('record-list-to-oianalytics', 'record-list', 'oianalytics'),
      standard('json-to-oianalytics', 'any', 'oianalytics'),
      standard('record-list-to-mqtt', 'record-list', 'mqtt'),
      standard('record-list-to-opcua', 'record-list', 'opcua'),
      standard('csv-to-mqtt', 'any', 'mqtt'),
      testData.transformers.customList[0]
    ];
    const defaultOf = (dataType: TransformerDTO['inputType'] | null, northTypes: Array<string>) =>
      findDefaultTransformer(transformers, dataType, northTypes)?.id ?? null;

    test('should send files as they are when the north accepts files', () => {
      expect(defaultOf('any', ['any', 'oianalytics'])).toBe('file');
    });

    test("should propose the only transformer producing the north's own format", () => {
      expect(defaultOf('record-list', ['any', 'oianalytics'])).toBe('record-list-to-oianalytics');
      expect(defaultOf('any', ['mqtt'])).toBe('csv-to-mqtt');
    });

    test('should fall back to the passthrough of the data type', () => {
      expect(defaultOf('record-list', ['any', 'record-list'])).toBe('record-list-to-json');
      expect(defaultOf('setpoint', ['any'])).toBe('setpoint-to-json');
    });

    test('should not propose anything without obvious choice', () => {
      expect(defaultOf(null, ['any'])).toBeNull();
      expect(defaultOf('record-list', ['mqtt', 'opcua'])).toBeNull();
      expect(defaultOf('setpoint', ['modbus'])).toBeNull();
    });
  });
});
