import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { addEnablingConditions, applyPlatformConditions, createControl } from './dynamic-form.builder';
import {
  OIBusAttributeValidator,
  OIBusEnablingCondition,
  OIBusObjectAttribute,
  OIBusStringAttribute
} from '../../../../../backend/shared/model/form.model';
import { describe, expect, test } from 'vitest';

describe('dynamic-form.builder', () => {
  const buildObjectAttribute = (platformValidators: Array<OIBusAttributeValidator> = []): OIBusObjectAttribute => ({
    key: 'settings',
    type: 'object',
    translationKey: 'Settings',
    validators: [],
    enablingConditions: [],
    displayProperties: { visible: true, wrapInBox: false },
    attributes: [
      {
        key: 'winField',
        type: 'string',
        translationKey: 'Windows field',
        defaultValue: '',
        validators: platformValidators,
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      } as OIBusStringAttribute
    ]
  });

  describe('applyPlatformConditions', () => {
    test('disables a field not enabled on the current platform', () => {
      const group = new FormGroup({ winField: new FormControl('') });
      applyPlatformConditions(group, buildObjectAttribute([{ type: 'PLATFORM', arguments: ['windows'] }]), 'linux');
      expect(group.get('winField')!.disabled).toBe(true);
    });

    test('keeps a field enabled on the matching platform', () => {
      const group = new FormGroup({ winField: new FormControl('') });
      applyPlatformConditions(group, buildObjectAttribute([{ type: 'PLATFORM', arguments: ['windows'] }]), 'windows');
      expect(group.get('winField')!.enabled).toBe(true);
    });

    test('keeps a field without platform restriction enabled', () => {
      const group = new FormGroup({ winField: new FormControl('') });
      applyPlatformConditions(group, buildObjectAttribute(), 'linux');
      expect(group.get('winField')!.enabled).toBe(true);
    });
  });

  describe('createControl with PLATFORM validator', () => {
    test('does not produce a validator that crashes Validators.compose', () => {
      const fb = new FormBuilder().nonNullable;
      const attribute = {
        key: 'winField',
        type: 'string',
        translationKey: 'Windows field',
        defaultValue: '',
        validators: [{ type: 'PLATFORM', arguments: ['windows'] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      } as OIBusStringAttribute;

      expect(() => createControl(fb, attribute)).not.toThrow();
      const control = createControl(fb, attribute);
      expect(() => control.updateValueAndValidity()).not.toThrow();
    });
  });

  describe('addEnablingConditions', () => {
    const condition: OIBusEnablingCondition = { referralPathFromRoot: 'driver', targetPathFromRoot: 'winField', values: ['SMB'] };

    test('enables the target when the condition is met', () => {
      const group = new FormGroup({ driver: new FormControl('SMB'), winField: new FormControl('') });
      addEnablingConditions(group, [condition]);
      expect(group.get('winField')!.enabled).toBe(true);
    });

    test('does not enable the target when the platform guard forbids it', () => {
      const group = new FormGroup({ driver: new FormControl('SMB'), winField: new FormControl('') });
      addEnablingConditions(group, [condition], () => false);
      expect(group.get('winField')!.disabled).toBe(true);
      // Even after the referenced value changes to a matching value, the guard keeps it disabled.
      group.get('driver')!.setValue('SMB');
      expect(group.get('winField')!.disabled).toBe(true);
    });
  });
});
