import { byIdComparisonFn, getValidators, groupFormControlsByRow } from './form-utils';
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
          label: 'my Label',
          defaultValue: 'default',
          validators: []
        },
        {
          type: 'OibText',
          key: 'oibText2',
          label: 'my Label',
          defaultValue: 'default',
          validators: []
        },
        {
          type: 'OibText',
          key: 'oibText3',
          label: 'my Label',
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
            label: 'my Label',
            defaultValue: 'default',
            validators: []
          },
          {
            type: 'OibText',
            key: 'oibText2',
            label: 'my Label',
            defaultValue: 'default',
            validators: []
          }
        ],
        [
          {
            type: 'OibText',
            key: 'oibText3',
            label: 'my Label',
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
          label: 'my Label',
          defaultValue: 'default',
          validators: []
        },
        {
          type: 'OibText',
          key: 'oibText2',
          label: 'my Label',
          defaultValue: 'default',
          validators: []
        },
        {
          type: 'OibText',
          key: 'oibText3',
          label: 'my Label',
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
            label: 'my Label',
            defaultValue: 'default',
            validators: []
          },
          {
            type: 'OibText',
            key: 'oibText2',
            label: 'my Label',
            defaultValue: 'default',
            validators: []
          }
        ],
        [
          {
            type: 'OibText',
            key: 'oibText3',
            label: 'my Label',
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
