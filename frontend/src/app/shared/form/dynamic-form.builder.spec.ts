import { AbstractControl, FormBuilder, FormControl, FormGroup } from '@angular/forms';

import { describe, expect, test } from 'vitest';

import {
  OIBusArrayAttribute,
  OIBusAttribute,
  OIBusAttributeValidator,
  OIBusControlAttribute,
  OIBusEnablingCondition,
  OIBusObjectAttribute,
  OIBusStringAttribute
} from '@oibus/shared/connector/form.model';

import {
  addAttributeToForm,
  addEnablingConditions,
  applyPlatformConditions,
  createControl,
  createMqttValidator,
  extractFormValue,
  getArrayValidators,
  isDisplayableAttribute
} from './dynamic-form.builder';

const displayProperties = { row: 0, columns: 4, displayInViewMode: true };
const fb = new FormBuilder().nonNullable;

const stringAttribute = (key: string, validators: Array<OIBusAttributeValidator> = []): OIBusStringAttribute => ({
  type: 'string',
  key,
  translationKey: 'translation',
  defaultValue: 'default',
  validators,
  displayProperties
});

const objectAttribute = (key: string, attributes: Array<OIBusAttribute>): OIBusObjectAttribute => ({
  type: 'object',
  key,
  translationKey: 'translation',
  validators: [],
  attributes,
  enablingConditions: [],
  displayProperties: { visible: true, wrapInBox: false }
});

const arrayAttribute = (key: string, attributes: Array<OIBusAttribute>): OIBusArrayAttribute => ({
  type: 'array',
  key,
  translationKey: 'translation',
  validators: [],
  paginate: false,
  numberOfElementPerPage: 20,
  rootAttribute: objectAttribute('item', attributes)
});

const controlAttributes: Array<{ attribute: OIBusControlAttribute; value: unknown }> = [
  {
    attribute: { type: 'boolean', key: 'boolean', translationKey: '', defaultValue: true, validators: [], displayProperties },
    value: true
  },
  { attribute: { type: 'instant', key: 'instant', translationKey: '', validators: [], displayProperties }, value: null },
  {
    attribute: { type: 'number', key: 'number', translationKey: '', defaultValue: 3, unit: null, validators: [], displayProperties },
    value: 3
  },
  { attribute: stringAttribute('string'), value: 'default' },
  {
    attribute: {
      type: 'code',
      key: 'code',
      translationKey: '',
      contentType: 'sql',
      defaultValue: 'SELECT',
      validators: [],
      displayProperties
    },
    value: 'SELECT'
  },
  {
    attribute: {
      type: 'string-select',
      key: 'stringSelect',
      translationKey: '',
      selectableValues: ['a', 'b'],
      defaultValue: 'b',
      validators: [],
      displayProperties
    },
    value: 'b'
  },
  {
    attribute: { type: 'timezone', key: 'timezone', translationKey: '', defaultValue: 'UTC', validators: [], displayProperties },
    value: 'UTC'
  },
  { attribute: { type: 'secret', key: 'secret', translationKey: '', validators: [], displayProperties }, value: null },
  {
    attribute: { type: 'scan-mode', key: 'scanMode', translationKey: '', acceptableType: 'POLL', validators: [], displayProperties },
    value: null
  },
  { attribute: { type: 'certificate', key: 'certificate', translationKey: '', validators: [], displayProperties }, value: null }
];

describe('dynamic-form.builder', () => {
  describe('createControl', () => {
    test.each(controlAttributes)('should create a $attribute.type control with its default value', ({ attribute, value }) => {
      expect(createControl(fb, attribute).value).toEqual(value);
    });

    test.each([
      { validator: { type: 'REQUIRED', arguments: [] }, invalid: '', valid: 'value' },
      { validator: { type: 'VALID_CRON', arguments: [] }, invalid: '', valid: '* * * * *' },
      { validator: { type: 'POSITIVE_INTEGER', arguments: [] }, invalid: -1, valid: 0 },
      { validator: { type: 'MINIMUM', arguments: ['5'] }, invalid: 4, valid: 5 },
      { validator: { type: 'MAXIMUM', arguments: ['5'] }, invalid: 6, valid: 5 },
      { validator: { type: 'PATTERN', arguments: ['^a+$'] }, invalid: 'b', valid: 'aa' }
    ] satisfies Array<{ validator: OIBusAttributeValidator; invalid: unknown; valid: unknown }>)(
      'should apply the $validator.type validator',
      ({ validator, invalid, valid }) => {
        const control = createControl(fb, stringAttribute('field', [validator]));

        control.setValue(invalid);
        expect(control.valid).toBe(false);
        control.setValue(valid);
        expect(control.valid).toBe(true);
      }
    );

    test.each(['UNIQUE', 'SINGLE_TRUE', 'MQTT_TOPIC_OVERLAP', 'PLATFORM'] as const)(
      'should not validate a single field with the %s validator',
      type => {
        const control = createControl(fb, stringAttribute('field', [{ type, arguments: ['windows'] }]));

        control.setValue('');
        expect(control.valid).toBe(true);
      }
    );
  });

  describe('addAttributeToForm', () => {
    test('should add the controls of all the attribute types, recursively', () => {
      const form = new FormGroup<Record<string, AbstractControl>>({});
      const attributes: Array<OIBusAttribute> = [
        ...controlAttributes.map(({ attribute }) => attribute),
        objectAttribute('object', [stringAttribute('nested')]),
        arrayAttribute('array', [stringAttribute('name', [{ type: 'UNIQUE', arguments: [] }])])
      ];

      attributes.forEach(attribute => expect(addAttributeToForm(fb, form, attribute)).toBe(true));

      expect(form.getRawValue()).toEqual({
        ...Object.fromEntries(controlAttributes.map(({ attribute, value }) => [attribute.key, value])),
        object: { nested: 'default' },
        array: []
      });
      const array = form.controls['array'];
      array.setValue([{ name: 'a' }, { name: 'a' }]);
      expect(array.errors).toEqual({ duplicateFieldNames: true });
    });
  });

  describe('getArrayValidators', () => {
    test('should create a validator per unique and single true field', () => {
      const control = new FormControl<Array<Record<string, unknown>>>(
        [],
        getArrayValidators([
          stringAttribute('name', [{ type: 'UNIQUE', arguments: [] }]),
          {
            type: 'boolean',
            key: 'reference',
            translationKey: '',
            defaultValue: false,
            validators: [{ type: 'SINGLE_TRUE', arguments: [] }],
            displayProperties
          },
          stringAttribute('other', [{ type: 'REQUIRED', arguments: [] }])
        ])
      );

      control.setValue([
        { name: 'a', reference: true, other: '' },
        { name: 'b', reference: false }
      ]);
      expect(control.errors).toBeNull();

      control.setValue([
        { name: 'a', reference: true },
        { name: 'a', reference: true }
      ]);
      expect(control.errors).toEqual({ duplicateFieldNames: true, onlyOneReference: true });
    });

    test('should create no validator for fields without array validators', () => {
      expect(getArrayValidators([stringAttribute('name')])).toEqual([]);
    });
  });

  describe('createMqttValidator', () => {
    test('should add a topic overlap validator to the topic control', () => {
      const group = new FormGroup({ topic: new FormControl('') });

      createMqttValidator(group, ['factory/#']);

      group.controls.topic.setValue('factory/line1');
      expect(group.controls.topic.errors).toEqual({ mqttTopicOverlap: { conflictingTopics: 'factory/#' } });
      group.controls.topic.setValue('other/line1');
      expect(group.controls.topic.errors).toBeNull();
    });

    test.each([
      { label: 'there is no existing topic', group: new FormGroup({ topic: new FormControl('factory/line1') }), topics: [] },
      { label: 'there is no topic control', group: new FormGroup({ name: new FormControl('factory/line1') }), topics: ['factory/#'] }
    ])('should not add a validator when $label', ({ group, topics }) => {
      createMqttValidator(group, topics);

      group.updateValueAndValidity();
      expect(group.valid).toBe(true);
    });
  });

  describe('isDisplayableAttribute', () => {
    test.each(controlAttributes.map(({ attribute }) => attribute).filter(attribute => attribute.type !== 'code'))(
      'should display a $type attribute',
      attribute => {
        expect(isDisplayableAttribute(attribute)).toBe(true);
      }
    );

    test.each([
      controlAttributes.find(({ attribute }) => attribute.type === 'code')!.attribute,
      objectAttribute('object', []),
      arrayAttribute('array', [])
    ])('should not display a $type attribute', attribute => {
      expect(isDisplayableAttribute(attribute)).toBe(false);
    });
  });

  describe('extractFormValue', () => {
    test.each([
      { label: 'null', value: null, expected: null },
      { label: 'undefined', value: undefined, expected: undefined },
      { label: 'a primitive', value: 'text', expected: 'text' },
      { label: 'an empty object', value: {}, expected: undefined },
      { label: 'nested empty objects', value: { a: 1, b: {}, c: { d: {} } }, expected: { a: 1, b: undefined, c: { d: undefined } } },
      { label: 'arrays', value: [{}, { a: [] }, 2], expected: [undefined, { a: [] }, 2] }
    ])('should process $label', ({ value, expected }) => {
      expect(extractFormValue(value)).toEqual(expected);
    });
  });

  describe('applyPlatformConditions', () => {
    const buildObjectAttribute = (platformValidators: Array<OIBusAttributeValidator> = []): OIBusObjectAttribute =>
      objectAttribute('settings', [stringAttribute('winField', platformValidators)]);

    test.each([
      {
        label: 'disables a field not enabled on the current platform',
        validators: [{ type: 'PLATFORM', arguments: ['windows'] }],
        platform: 'linux',
        enabled: false
      },
      {
        label: 'keeps a field enabled on the matching platform',
        validators: [{ type: 'PLATFORM', arguments: ['windows'] }],
        platform: 'windows',
        enabled: true
      },
      { label: 'keeps a field without platform restriction enabled', validators: [], platform: 'linux', enabled: true }
    ] satisfies Array<{ label: string; validators: Array<OIBusAttributeValidator>; platform: string; enabled: boolean }>)(
      'should $label',
      ({ validators, platform, enabled }) => {
        const group = new FormGroup({ winField: new FormControl('') });
        applyPlatformConditions(group, buildObjectAttribute(validators), platform);
        expect(group.controls.winField.enabled).toBe(enabled);
      }
    );
  });

  describe('addEnablingConditions', () => {
    const condition: OIBusEnablingCondition = { referralPathFromRoot: 'driver', targetPathFromRoot: 'winField', values: ['SMB'] };

    test.each([
      { operator: undefined, value: 'SMB', enabled: true },
      { operator: undefined, value: 'NFS', enabled: false },
      { operator: 'EQUALS', value: 'SMB', enabled: true },
      { operator: 'NOT_EQUAL', value: 'SMB', enabled: false },
      { operator: 'NOT_EQUAL', value: 'NFS', enabled: true },
      { operator: 'CONTAINS', value: 'SMB-v2', enabled: true },
      { operator: 'CONTAINS', value: 'NFS', enabled: false },
      { operator: 'CONTAINS', value: 12, enabled: false }
    ] as const)('should evaluate $operator with $value to $enabled', ({ operator, value, enabled }) => {
      const group = new FormGroup({ driver: new FormControl<string | number>(value), winField: new FormControl('') });

      addEnablingConditions(group, [{ ...condition, operator }]);

      expect(group.controls.winField.enabled).toBe(enabled);
    });

    test('should enable and disable the target when the referenced value changes, until unsubscribed', () => {
      const group = new FormGroup({ driver: new FormControl('NFS'), winField: new FormControl('') });
      const subscription = addEnablingConditions(group, [condition]);
      expect(group.controls.winField.disabled).toBe(true);

      group.controls.driver.setValue('SMB');
      expect(group.controls.winField.enabled).toBe(true);
      group.controls.driver.setValue('NFS');
      expect(group.controls.winField.disabled).toBe(true);

      subscription.unsubscribe();
      group.controls.driver.setValue('SMB');
      expect(group.controls.winField.disabled).toBe(true);
    });

    test('should not enable the target when the platform guard forbids it', () => {
      const group = new FormGroup({ driver: new FormControl('SMB'), winField: new FormControl('') });
      addEnablingConditions(group, [condition], () => false);
      expect(group.controls.winField.disabled).toBe(true);
      // Even after the referenced value changes to a matching value, the guard keeps it disabled.
      group.controls.driver.setValue('SMB');
      expect(group.controls.winField.disabled).toBe(true);
    });

    test('should throw when a control of the condition does not exist', () => {
      const group = new FormGroup({ driver: new FormControl('SMB') });
      expect(() => addEnablingConditions(group, [condition])).toThrow('wrong configuration in manifest');
    });
  });
});
