import { describe, expect, test } from 'vitest';

import testData from '../../../../test/test-data';
import {
  allowsVariable,
  buildItemMappableFields,
  isItemFieldVisible,
  isMandatoryFieldMissing,
  itemFieldMappingToSend,
  itemMappingProblem,
  MappableField
} from './item-field-mapping';

const name: MappableField = { path: 'name', translationKey: 'name', attributeType: 'string', mandatory: true };
const enabled: MappableField = {
  path: 'enabled',
  translationKey: 'enabled',
  attributeType: 'boolean',
  mandatory: true,
  hasUsableDefault: true
};
const scanModeId: MappableField = { path: 'scanModeId', translationKey: 'scan-mode', attributeType: 'scan-mode', mandatory: true };
const mode: MappableField = {
  path: 'settings.mode',
  translationKey: 'mode',
  attributeType: 'string-select',
  selectableValues: ['da', 'ha'],
  mandatory: true,
  hasUsableDefault: true
};
const aggregate: MappableField = {
  path: 'settings.haMode.aggregate',
  translationKey: 'aggregate',
  attributeType: 'string',
  enablingRules: [{ referralPath: 'settings.mode', values: ['ha'] }]
};
const fields = [name, enabled, scanModeId, mode, aggregate];

describe('item field mapping', () => {
  test('builds the fields of the manifest, with the historian ones', () => {
    const paths = buildItemMappableFields(testData.south.manifest).map(field => field.path);
    expect(paths).toContain('name');
    expect(paths).toContain('scanModeId');
    expect(paths).toContain('groupId');
    expect(paths).not.toContain('scanMode');
  });

  test('takes an expression but for the schedule and the constant-only fields', () => {
    expect(allowsVariable(name)).toBe(true);
    expect(allowsVariable(scanModeId)).toBe(false);
    expect(allowsVariable({ path: 'readDelay', translationKey: 'read-delay', attributeType: 'number' })).toBe(false);
  });

  test('shows a field once its enabling rules pass, or when its referral varies per record', () => {
    expect(isItemFieldVisible(aggregate, { 'settings.mode': 'da' })).toBe(false);
    expect(isItemFieldVisible(aggregate, { 'settings.mode': 'ha' })).toBe(true);
    expect(isItemFieldVisible(aggregate, { 'settings.mode': '{{mode}}' })).toBe(true);
  });

  test('hides the schedule of an item of a group', () => {
    expect(isItemFieldVisible(scanModeId, {})).toBe(true);
    expect(isItemFieldVisible(scanModeId, { groupId: 'group1' })).toBe(false);
  });

  test('requires the mandatory fields but the ones with a default, enabled aside', () => {
    expect(isMandatoryFieldMissing(name, { name: ' ' })).toBe(true);
    expect(isMandatoryFieldMissing(mode, {})).toBe(false);
    expect(isMandatoryFieldMissing(enabled, {})).toBe(true);
    expect(isMandatoryFieldMissing(scanModeId, { groupId: 'group1' })).toBe(false);
  });

  test('tells why a mapping cannot be used', () => {
    const complete = { name: '{{name}}', enabled: 'true', scanModeId: 'scanMode1' };
    expect(itemMappingProblem(fields, complete)).toBeNull();
    expect(itemMappingProblem(fields, { ...complete, scanModeId: '{{scanMode}}' })).toBe('south.workflows.mapping-constant-only');
    expect(itemMappingProblem(fields, { ...complete, name: '' })).toBe('south.workflows.mapping-mandatory-missing');
  });

  test('sends the visible and mapped fields only, trimmed', () => {
    const values = { name: ' {{name}} ', enabled: 'true', scanModeId: '', 'settings.mode': 'da', 'settings.haMode.aggregate': 'raw' };
    expect(itemFieldMappingToSend(fields, values, false)).toEqual({ name: '{{name}}', enabled: 'true', 'settings.mode': 'da' });
  });

  test('sends the subscription as the schedule of a connector that only subscribes', () => {
    expect(itemFieldMappingToSend([name], { name: 'a' }, true)).toEqual({ name: 'a', scanModeId: 'subscription' });
  });
});
