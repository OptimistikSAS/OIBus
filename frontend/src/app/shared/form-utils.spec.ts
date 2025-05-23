import { byIdComparisonFn, getArrayValidators, getValidators, groupFormControlsByRow } from './form-utils';
import { FormComponentValidator, OibFormControl } from '../../../../backend/shared/model/form.model';
import { Validators } from '@angular/forms';

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
});
