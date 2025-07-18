import {
  byIdComparisonFn,
  createFormGroupWithMqttValidation,
  getArrayValidators,
  getValidators,
  groupFormControlsByRow
} from './form-utils';
import { FormComponentValidator, OibFormControl } from '../../../../backend/shared/model/form.model';
import { FormBuilder, NonNullableFormBuilder, Validators } from '@angular/forms';
import { TestBed } from '@angular/core/testing';

describe('form-utils', () => {
  describe('getValidators', () => {
    it('should generate validators array', () => {
      const validators: Array<FormComponentValidator> = [
        { key: 'required' },
        { key: 'min', params: { min: 1 } },
        { key: 'max', params: { max: 100 } },
        { key: 'pattern', params: { pattern: 'my pattern' } },
        { key: 'minLength', params: { minLength: 2 } },
        { key: 'maxLength', params: { maxLength: 98 } },
        { key: 'other' } as unknown as FormComponentValidator
      ];
      const result = getValidators(validators);

      expect(result[0]).toEqual(Validators.required);
      expect(result[6]).toEqual(Validators.nullValidator);
    });
  });

  describe('getArrayValidators', () => {
    it('should return empty array when no validators are specified', () => {
      const content: Array<OibFormControl> = [
        {
          key: 'fieldName',
          type: 'OibText',
          translationKey: 'field.name',
          defaultValue: ''
        }
      ];

      const result = getArrayValidators(content);
      expect(result).toEqual([]);
    });

    it('should return empty array when no unique or singleTrue validators are specified', () => {
      const content: Array<OibFormControl> = [
        {
          key: 'fieldName',
          type: 'OibText',
          translationKey: 'field.name',
          defaultValue: '',
          validators: [{ key: 'required' }]
        }
      ];

      const result = getArrayValidators(content);
      expect(result).toEqual([]);
    });

    it('should return unique validator when unique validator is specified', () => {
      const content: Array<OibFormControl> = [
        {
          key: 'fieldName',
          type: 'OibText',
          translationKey: 'field.name',
          defaultValue: '',
          validators: [{ key: 'unique' }]
        }
      ];

      const result = getArrayValidators(content);
      expect(result.length).toBe(1);
      expect(typeof result[0]).toBe('function');
    });

    it('should return singleTrue validator when singleTrue validator is specified', () => {
      const content: Array<OibFormControl> = [
        {
          key: 'useAsReference',
          type: 'OibCheckbox',
          translationKey: 'use.as.reference',
          defaultValue: false,
          validators: [{ key: 'singleTrue' }]
        }
      ];

      const result = getArrayValidators(content);
      expect(result.length).toBe(1);
      expect(typeof result[0]).toBe('function');
    });

    it('should return multiple validators when both unique and singleTrue are specified', () => {
      const content: Array<OibFormControl> = [
        {
          key: 'fieldName',
          type: 'OibText',
          translationKey: 'field.name',
          defaultValue: '',
          validators: [{ key: 'unique' }]
        },
        {
          key: 'useAsReference',
          type: 'OibCheckbox',
          translationKey: 'use.as.reference',
          defaultValue: false,
          validators: [{ key: 'singleTrue' }]
        }
      ];

      const result = getArrayValidators(content);
      expect(result.length).toBe(2);
      expect(typeof result[0]).toBe('function');
      expect(typeof result[1]).toBe('function');
    });

    it('should handle multiple fields with same validator type', () => {
      const content: Array<OibFormControl> = [
        {
          key: 'fieldName1',
          type: 'OibText',
          translationKey: 'field.name1',
          defaultValue: '',
          validators: [{ key: 'unique' }]
        },
        {
          key: 'fieldName2',
          type: 'OibText',
          translationKey: 'field.name2',
          defaultValue: '',
          validators: [{ key: 'unique' }]
        }
      ];

      const result = getArrayValidators(content);
      expect(result.length).toBe(2);
    });

    it('should handle mixed validators on same field', () => {
      const content: Array<OibFormControl> = [
        {
          key: 'fieldName',
          type: 'OibText',
          translationKey: 'field.name',
          defaultValue: '',
          validators: [{ key: 'required' }, { key: 'unique' }]
        },
        {
          key: 'useAsReference',
          type: 'OibCheckbox',
          translationKey: 'use.as.reference',
          defaultValue: false,
          validators: [{ key: 'required' }, { key: 'singleTrue' }]
        }
      ];

      const result = getArrayValidators(content);
      expect(result.length).toBe(2);
    });
  });

  describe('byIdComparisonFn', () => {
    it('should compare by ID', () => {
      expect(byIdComparisonFn(null, null)).toBeTruthy();
      expect(byIdComparisonFn({ id: 'id1' }, { id: 'id1' })).toBeTruthy();
      expect(byIdComparisonFn({ id: 'id1' }, { id: 'id2' })).toBeFalsy();
    });
  });

  describe('groupFormControlsByRow', () => {
    it('should return empty array', () => {
      expect(groupFormControlsByRow([])).toEqual([]);
    });

    it('should return row list without values', () => {
      const arraySettings: Array<OibFormControl> = [
        {
          type: 'OibText',
          key: 'oibText1',
          translationKey: 'my Label',
          defaultValue: 'default',
          validators: []
        },
        {
          type: 'OibText',
          key: 'oibText2',
          translationKey: 'my Label',
          defaultValue: 'default',
          validators: []
        },
        {
          type: 'OibText',
          key: 'oibText3',
          translationKey: 'my Label',
          newRow: true,
          defaultValue: 'default',
          validators: []
        }
      ];

      const expectedRowList: Array<Array<OibFormControl>> = [
        [
          {
            type: 'OibText',
            key: 'oibText1',
            translationKey: 'my Label',
            defaultValue: 'default',
            validators: []
          },
          {
            type: 'OibText',
            key: 'oibText2',
            translationKey: 'my Label',
            defaultValue: 'default',
            validators: []
          }
        ],
        [
          {
            type: 'OibText',
            key: 'oibText3',
            translationKey: 'my Label',
            newRow: true,
            defaultValue: 'default',
            validators: []
          }
        ]
      ];
      expect(groupFormControlsByRow(arraySettings)).toEqual(expectedRowList);
    });

    it('should return row list with current values', () => {
      const arraySettings: Array<OibFormControl> = [
        {
          type: 'OibText',
          key: 'oibText1',
          translationKey: 'my Label',
          defaultValue: 'default',
          validators: []
        },
        {
          type: 'OibText',
          key: 'oibText2',
          translationKey: 'my Label',
          defaultValue: 'default',
          validators: []
        },
        {
          type: 'OibText',
          key: 'oibText3',
          translationKey: 'my Label',
          newRow: true,
          defaultValue: 'default',
          validators: []
        }
      ];

      const expectedRowList: Array<Array<OibFormControl>> = [
        [
          {
            type: 'OibText',
            key: 'oibText1',
            translationKey: 'my Label',
            defaultValue: 'default',
            validators: []
          },
          {
            type: 'OibText',
            key: 'oibText2',
            translationKey: 'my Label',
            defaultValue: 'default',
            validators: []
          }
        ],
        [
          {
            type: 'OibText',
            key: 'oibText3',
            translationKey: 'my Label',
            newRow: true,
            defaultValue: 'default',
            validators: []
          }
        ]
      ];
      expect(groupFormControlsByRow(arraySettings)).toEqual(expectedRowList);
    });
  });

  describe('createFormGroupWithMqttValidation', () => {
    let fb: NonNullableFormBuilder;

    beforeEach(() => {
      TestBed.configureTestingModule({});
      fb = TestBed.inject(FormBuilder).nonNullable;
    });

    it('should create form group without MQTT validation when no existing topics', () => {
      const formDescription: Array<OibFormControl> = [
        {
          key: 'topic',
          type: 'OibText',
          translationKey: 'Topic',
          validators: [{ key: 'required' }]
        },
        {
          key: 'qos',
          type: 'OibNumber',
          translationKey: 'QoS',
          defaultValue: 0
        }
      ];

      const formGroup = createFormGroupWithMqttValidation(formDescription, fb);

      expect(formGroup.get('topic')).toBeDefined();
      expect(formGroup.get('qos')).toBeDefined();
      expect(formGroup.get('topic')?.hasError('required')).toBe(true);
    });

    it('should create form group with MQTT validation when existing topics provided', () => {
      const formDescription: Array<OibFormControl> = [
        {
          key: 'topic',
          type: 'OibText',
          translationKey: 'Topic',
          validators: [{ key: 'required' }]
        },
        {
          key: 'qos',
          type: 'OibNumber',
          translationKey: 'QoS',
          defaultValue: 0
        }
      ];

      const existingTopics = ['/oibus/counter', '/oibus/#'];
      const formGroup = createFormGroupWithMqttValidation(formDescription, fb, existingTopics);

      expect(formGroup.get('topic')).toBeDefined();
      expect(formGroup.get('qos')).toBeDefined();

      formGroup.get('topic')?.setValue('/oibus/temperature');
      expect(formGroup.get('topic')?.hasError('mqttTopicOverlap')).toBe(true);

      formGroup.get('topic')?.setValue('/other/topic');
      expect(formGroup.get('topic')?.hasError('mqttTopicOverlap')).toBe(false);
    });

    it('should only add MQTT validation to topic field', () => {
      const formDescription: Array<OibFormControl> = [
        {
          key: 'topic',
          type: 'OibText',
          translationKey: 'Topic'
        },
        {
          key: 'name',
          type: 'OibText',
          translationKey: 'Name'
        },
        {
          key: 'qos',
          type: 'OibNumber',
          translationKey: 'QoS'
        }
      ];

      const existingTopics = ['/oibus/counter'];
      const formGroup = createFormGroupWithMqttValidation(formDescription, fb, existingTopics);

      formGroup.get('topic')?.setValue('/oibus/counter');
      expect(formGroup.get('topic')?.hasError('mqttTopicOverlap')).toBe(true);

      formGroup.get('name')?.setValue('/oibus/counter');
      expect(formGroup.get('name')?.hasError('mqttTopicOverlap')).toBe(false);
    });

    it('should handle conditional display with MQTT validation', () => {
      const formDescription: Array<OibFormControl> = [
        {
          key: 'mode',
          type: 'OibSelect',
          translationKey: 'Mode',
          options: ['subscribe', 'publish']
        },
        {
          key: 'topic',
          type: 'OibText',
          translationKey: 'Topic',
          conditionalDisplay: { field: 'mode', values: ['subscribe'] }
        }
      ];

      const existingTopics = ['/oibus/counter'];
      const formGroup = createFormGroupWithMqttValidation(formDescription, fb, existingTopics);

      formGroup.get('mode')?.setValue('subscribe');

      formGroup.get('topic')?.setValue('/oibus/counter');
      expect(formGroup.get('topic')?.hasError('mqttTopicOverlap')).toBe(true);
    });

    it('should preserve existing validators when adding MQTT validation', () => {
      const formDescription: Array<OibFormControl> = [
        {
          key: 'topic',
          type: 'OibText',
          translationKey: 'Topic',
          validators: [{ key: 'required' }, { key: 'minLength', params: { minLength: 5 } }]
        }
      ];

      const existingTopics = ['/oibus/counter'];
      const formGroup = createFormGroupWithMqttValidation(formDescription, fb, existingTopics);

      const topicControl = formGroup.get('topic');

      expect(topicControl?.hasError('required')).toBe(true);

      topicControl?.setValue('abc');
      expect(topicControl?.hasError('minlength')).toBe(true);

      topicControl?.setValue('/oibus/counter');
      expect(topicControl?.hasError('mqttTopicOverlap')).toBe(true);
    });
  });
});
