import {
  byIdComparisonFn,
  createAuthenticationForm,
  getAuthenticationDTOFromForm,
  getValidators,
  groupFormControlsByRow
} from './form-utils';
import { FormComponentValidator, OibFormControl } from '../../../../shared/model/form.model';
import { Validators } from '@angular/forms';
import { Authentication } from '../../../../shared/model/engine.model';

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

  describe('createAuthenticationForm', () => {
    it('should generate basic auth with filled value', () => {
      const authentication: Authentication = {
        type: 'basic',
        username: 'user',
        password: 'pass'
      };
      const result = createAuthenticationForm(authentication);

      expect(result).toEqual({
        type: 'basic',
        username: 'user',
        password: 'pass',
        token: null,
        key: null,
        secret: null,
        certPath: null,
        keyPath: null
      });
    });

    it('should generate bearer auth with filled value', () => {
      const authentication: Authentication = {
        type: 'bearer',
        token: 'my token'
      };
      const result = createAuthenticationForm(authentication);

      expect(result).toEqual({
        type: 'bearer',
        username: null,
        password: null,
        token: 'my token',
        key: null,
        secret: null,
        certPath: null,
        keyPath: null
      });
    });

    it('should generate API Key auth with filled value', () => {
      const authentication: Authentication = {
        type: 'api-key',
        key: 'my key',
        secret: 'my secret'
      };
      const result = createAuthenticationForm(authentication);

      expect(result).toEqual({
        type: 'api-key',
        username: null,
        password: null,
        token: null,
        key: 'my key',
        secret: 'my secret',
        certPath: null,
        keyPath: null
      });
    });

    it('should generate cert auth with filled value', () => {
      const authentication: Authentication = {
        type: 'cert',
        certPath: 'my cert path',
        keyPath: 'my key path'
      };
      const result = createAuthenticationForm(authentication);

      expect(result).toEqual({
        type: 'cert',
        username: null,
        password: null,
        token: null,
        key: null,
        secret: null,
        certPath: 'my cert path',
        keyPath: 'my key path'
      });
    });

    it('should generate none auth with filled value', () => {
      const authentication: Authentication = {
        type: 'none'
      };
      const result = createAuthenticationForm(authentication);

      expect(result).toEqual({
        type: 'none',
        username: null,
        password: null,
        token: null,
        key: null,
        secret: null,
        certPath: null,
        keyPath: null
      });
    });
  });

  describe('getAuthenticationDTOFromForm', () => {
    it('should generate basic auth DTO', () => {
      const authentication = {
        type: 'basic',
        username: 'user',
        password: 'pass',
        token: null,
        key: null,
        secret: null,
        certPath: null,
        keyPath: null
      };
      const result = getAuthenticationDTOFromForm(authentication);

      expect(result).toEqual({
        type: 'basic',
        username: 'user',
        password: 'pass'
      });
    });

    it('should generate bearer auth DTO', () => {
      const authentication = {
        type: 'bearer',
        username: null,
        password: null,
        token: 'my token',
        key: null,
        secret: null,
        certPath: null,
        keyPath: null
      };
      const result = getAuthenticationDTOFromForm(authentication);

      expect(result).toEqual({
        type: 'bearer',
        token: 'my token'
      });
    });

    it('should generate API Key auth DTO', () => {
      const authentication = {
        type: 'api-key',
        username: null,
        password: null,
        token: null,
        key: 'my key',
        secret: 'my secret',
        certPath: null,
        keyPath: null
      };
      const result = getAuthenticationDTOFromForm(authentication);

      expect(result).toEqual({
        type: 'api-key',
        key: 'my key',
        secret: 'my secret'
      });
    });

    it('should generate cert auth DTO', () => {
      const authentication = {
        type: 'cert',
        username: null,
        password: null,
        token: null,
        key: null,
        secret: null,
        certPath: 'my cert path',
        keyPath: 'my key path'
      };
      const result = getAuthenticationDTOFromForm(authentication);

      expect(result).toEqual({
        type: 'cert',
        certPath: 'my cert path',
        keyPath: 'my key path'
      });
    });

    it('should generate none auth DTO', () => {
      const authentication = {
        type: 'none',
        username: null,
        password: null,
        token: null,
        key: null,
        secret: null,
        certPath: null,
        keyPath: null
      };
      const result = getAuthenticationDTOFromForm(authentication);

      expect(result).toEqual({
        type: 'none'
      });
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
