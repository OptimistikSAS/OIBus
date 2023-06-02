import {
  byIdComparisonFn,
  createAuthenticationForm,
  createInput,
  disableInputs,
  getAuthenticationDTOFromForm,
  getRowSettings,
  getValidators
} from './utils';
import {
  ConnectorFormValidator,
  OibAuthenticationFormControl,
  OibCheckboxFormControl,
  OibFormControl,
  OibProxyFormControl,
  OibScanModeFormControl,
  OibTextFormControl
} from '../../../../shared/model/form.model';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Authentication } from '../../../../shared/model/engine.model';
import { ScanModeDTO } from '../../../../shared/model/scan-mode.model';
import { ProxyDTO } from '../../../../shared/model/proxy.model';

describe('utils', () => {
  describe('getValidators', () => {
    it('should generate validators array', () => {
      const validators: Array<ConnectorFormValidator> = [
        { key: 'required' },
        { key: 'min', params: { min: 1 } },
        { key: 'max', params: { max: 100 } },
        { key: 'pattern', params: { pattern: 'my pattern' } },
        { key: 'minLength', params: { minLength: 2 } },
        { key: 'maxLength', params: { maxLength: 98 } },
        { key: 'other' } as unknown as ConnectorFormValidator
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

  describe('createInput', () => {
    it('should create OibText form control', () => {
      const formGroup = new FormGroup({});
      const oibFormControlWithCurrentValue: OibTextFormControl = {
        type: 'OibText',
        key: 'oibText1',
        label: 'my Label',
        defaultValue: 'default',
        currentValue: 'current',
        validators: []
      };
      createInput(oibFormControlWithCurrentValue, formGroup);
      let values = formGroup.getRawValue();
      expect(values).toEqual({ oibText1: 'current' });
      const oibFormControlWithDefaultValue: OibTextFormControl = {
        type: 'OibText',
        key: 'oibText2',
        label: 'my Label2',
        defaultValue: 'default'
      };
      createInput(oibFormControlWithDefaultValue, formGroup);

      values = formGroup.getRawValue();
      expect(values).toEqual({ oibText1: 'current', oibText2: 'default' });
    });

    it('should create OibCheckbox form control', () => {
      const formGroup = new FormGroup({});
      const oibFormControlWithCurrentValue: OibCheckboxFormControl = {
        type: 'OibCheckbox',
        key: 'oibCheckbox1',
        label: 'my Label',
        defaultValue: false,
        currentValue: true,
        validators: []
      };
      createInput(oibFormControlWithCurrentValue, formGroup);
      let values = formGroup.getRawValue();
      expect(values).toEqual({ oibCheckbox1: true });
      const oibFormControlWithDefaultValue: OibCheckboxFormControl = {
        type: 'OibCheckbox',
        key: 'oibCheckbox2',
        label: 'my Label2',
        defaultValue: false
      };
      createInput(oibFormControlWithDefaultValue, formGroup);

      values = formGroup.getRawValue();
      expect(values).toEqual({ oibCheckbox1: true, oibCheckbox2: false });

      const oibFormControlWithoutDefaultValue: OibCheckboxFormControl = {
        type: 'OibCheckbox',
        key: 'oibCheckbox3',
        label: 'my Label3'
      };
      createInput(oibFormControlWithoutDefaultValue, formGroup);
      values = formGroup.getRawValue();
      expect(values).toEqual({ oibCheckbox1: true, oibCheckbox2: false, oibCheckbox3: false });
    });

    it('should create OibScanMode form control', () => {
      const formGroup = new FormGroup({});
      const scanModeList: Array<ScanModeDTO> = [
        {
          id: 'subscription',
          name: 'subscribe',
          description: '',
          cron: 'subscribe'
        },
        {
          id: 'id1',
          name: 'cron',
          description: '',
          cron: 'cron'
        },
        {
          id: 'id2',
          name: 'another cron',
          description: '',
          cron: 'cron'
        }
      ];
      const oibFormControlWithCurrentValue: OibScanModeFormControl = {
        type: 'OibScanMode',
        key: 'oibScanMode1',
        label: 'my Label',
        acceptSubscription: false,
        subscriptionOnly: false,
        currentValue: {
          id: 'id2',
          name: 'another cron',
          description: '',
          cron: 'cron'
        },
        validators: []
      };
      createInput(oibFormControlWithCurrentValue, formGroup, scanModeList);
      let values = formGroup.getRawValue();
      expect(values).toEqual({
        oibScanMode1: {
          id: 'id2',
          name: 'another cron',
          description: '',
          cron: 'cron'
        }
      });
      const oibFormControlWithoutCurrentValue: OibScanModeFormControl = {
        type: 'OibScanMode',
        key: 'oibScanMod2',
        label: 'my Label',
        acceptSubscription: false,
        subscriptionOnly: false
      };
      createInput(oibFormControlWithoutCurrentValue, formGroup);

      values = formGroup.getRawValue();
      expect(values).toEqual({
        oibScanMode1: {
          id: 'id2',
          name: 'another cron',
          description: '',
          cron: 'cron'
        },
        oibScanMod2: null
      });
    });

    it('should create OibProxy form control', () => {
      const formGroup = new FormGroup({});
      const proxyList: Array<ProxyDTO> = [
        {
          id: 'id1',
          name: 'proxy1',
          description: '',
          address: 'localhost',
          username: 'user',
          password: 'pass'
        },
        {
          id: 'id2',
          name: 'proxy2',
          description: '',
          address: 'localhost',
          username: 'user',
          password: 'pass'
        },
        {
          id: 'id3',
          name: 'proxy3',
          description: '',
          address: 'localhost',
          username: 'user',
          password: 'pass'
        }
      ];
      const oibFormControlWithCurrentValue: OibProxyFormControl = {
        type: 'OibProxy',
        key: 'oibProxy1',
        label: 'my Label',
        currentValue: 'id2',
        validators: []
      };
      createInput(oibFormControlWithCurrentValue, formGroup, [], proxyList);
      let values = formGroup.getRawValue();
      expect(values).toEqual({
        oibProxy1: 'id2'
      });
      const oibFormControlWithoutCurrentValue: OibProxyFormControl = {
        type: 'OibProxy',
        key: 'oibProxy2',
        label: 'my Label'
      };
      createInput(oibFormControlWithoutCurrentValue, formGroup);

      values = formGroup.getRawValue();
      expect(values).toEqual({
        oibProxy1: 'id2',
        oibProxy2: null
      });
    });

    it('should create OibAuthentication form control', () => {
      const formGroup = new FormGroup({});
      const oibFormControlWithCurrentValue: OibAuthenticationFormControl = {
        type: 'OibAuthentication',
        key: 'oibAuthentication1',
        label: 'my Label',
        authTypes: ['bearer', 'none'],
        currentValue: {
          type: 'bearer',
          token: 'token'
        },
        validators: []
      };
      createInput(oibFormControlWithCurrentValue, formGroup);
      let values = formGroup.getRawValue();
      expect(values).toEqual({
        oibAuthentication1: {
          type: 'bearer',
          token: 'token',
          username: null,
          password: null,
          key: null,
          secret: null,
          certPath: null,
          keyPath: null
        }
      });
      const oibFormControlWithoutCurrentValue: OibAuthenticationFormControl = {
        type: 'OibAuthentication',
        key: 'oibAuthentication2',
        label: 'my Label',
        authTypes: ['bearer', 'none']
      };
      createInput(oibFormControlWithoutCurrentValue, formGroup);

      values = formGroup.getRawValue();
      expect(values).toEqual({
        oibAuthentication1: {
          type: 'bearer',
          token: 'token',
          username: null,
          password: null,
          key: null,
          secret: null,
          certPath: null,
          keyPath: null
        },
        oibAuthentication2: {
          type: 'none',
          token: null,
          username: null,
          password: null,
          key: null,
          secret: null,
          certPath: null,
          keyPath: null
        }
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

  describe('getRowSettings', () => {
    it('should return empty array', () => {
      expect(getRowSettings([], null)).toEqual([]);
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
      expect(getRowSettings(arraySettings, null)).toEqual(expectedRowList);
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
          currentValue: 'current',
          validators: []
        },
        {
          type: 'OibText',
          key: 'oibText3',
          label: 'my Label',
          newRow: true,
          defaultValue: 'default',
          currentValue: 'current',
          validators: []
        }
      ];

      const settings = { oibText1: 'current1', oibText2: 'current2', oibText3: 'current3' };

      const expectedRowList: Array<Array<OibFormControl>> = [
        [
          {
            type: 'OibText',
            key: 'oibText1',
            label: 'my Label',
            defaultValue: 'default',
            currentValue: 'current1',
            validators: []
          },
          {
            type: 'OibText',
            key: 'oibText2',
            label: 'my Label',
            defaultValue: 'default',
            currentValue: 'current2',
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
            currentValue: 'current3',
            validators: []
          }
        ]
      ];
      expect(getRowSettings(arraySettings, settings)).toEqual(expectedRowList);
    });
  });

  describe('disableInputs', () => {
    it('should disable inputs', () => {
      const manifestSettings: Array<OibFormControl> = [
        {
          type: 'OibText',
          key: 'oibText1',
          label: 'my Label',
          currentValue: 'current1',
          validators: []
        },
        {
          type: 'OibText',
          key: 'oibText2',
          label: 'my Label',
          currentValue: 'current2',
          conditionalDisplay: { oibAuthentication1: ['none'] },
          validators: []
        },
        {
          type: 'OibText',
          key: 'oibText3',
          label: 'my Label',
          currentValue: 'current3',
          conditionalDisplay: { oibText1: ['enabledValue'] },
          validators: []
        },
        {
          type: 'OibText',
          key: 'oibText4',
          label: 'my Label',
          currentValue: 'current4',
          conditionalDisplay: { oibAuthentication1: ['cert'] },
          validators: []
        },
        {
          type: 'OibAuthentication',
          key: 'oibAuthentication1',
          label: 'my Label',
          authTypes: ['cert', 'none'],
          currentValue: {
            type: 'cert',
            keyPath: 'keyPath',
            certPath: 'certPath'
          },
          validators: []
        }
      ];
      const formGroup = new FormGroup({
        oibText1: new FormControl('current1'),
        oibText2: new FormControl('current2'),
        oibText3: new FormControl('current3'),
        oibText4: new FormControl('current4'),
        oibAuthentication1: new FormGroup({
          type: new FormControl('cert'),
          keyPath: new FormControl('keyPath'),
          certPath: new FormControl('certPath')
        }),
        oibAuthentication2: new FormGroup({
          type: new FormControl('none')
        })
      });

      disableInputs(manifestSettings, 'oibText1', 'current1', formGroup);
      expect(formGroup.controls.oibText1.disabled).toBeFalse();
      expect(formGroup.controls.oibText2.disabled).toBeFalse();
      expect(formGroup.controls.oibText3.disabled).toBeTrue();
      expect(formGroup.controls.oibText4.disabled).toBeFalse();
      expect(formGroup.controls.oibAuthentication1.disabled).toBeFalse();
      expect(formGroup.controls.oibAuthentication1.disabled).toBeFalse();

      disableInputs(manifestSettings, 'oibText1', 'enabledValue', formGroup);
      expect(formGroup.controls.oibText1.disabled).toBeFalse();
      expect(formGroup.controls.oibText2.disabled).toBeFalse();
      expect(formGroup.controls.oibText3.disabled).toBeFalse();
      expect(formGroup.controls.oibText4.disabled).toBeFalse();
      expect(formGroup.controls.oibAuthentication1.disabled).toBeFalse();
      expect(formGroup.controls.oibAuthentication1.disabled).toBeFalse();

      disableInputs(manifestSettings, 'oibAuthentication1', { type: 'cert' }, formGroup);
      expect(formGroup.controls.oibText1.disabled).toBeFalse();
      expect(formGroup.controls.oibText2.disabled).toBeTrue();
      expect(formGroup.controls.oibText3.disabled).toBeFalse();
      expect(formGroup.controls.oibText4.disabled).toBeFalse();
      expect(formGroup.controls.oibAuthentication1.disabled).toBeFalse();
      expect(formGroup.controls.oibAuthentication1.disabled).toBeFalse();

      const badManifestSettings: Array<OibFormControl> = [
        {
          type: 'OibText',
          key: 'badKey',
          label: 'my Label',
          currentValue: 'current1',
          conditionalDisplay: { otherKey: ['cert'] },
          validators: []
        }
      ];
      disableInputs(badManifestSettings, 'otherKey', 'value', formGroup);
      // Nothing changed
      expect(formGroup.controls.oibText1.disabled).toBeFalse();
      expect(formGroup.controls.oibText2.disabled).toBeTrue();
      expect(formGroup.controls.oibText3.disabled).toBeFalse();
      expect(formGroup.controls.oibText4.disabled).toBeFalse();
      expect(formGroup.controls.oibAuthentication1.disabled).toBeFalse();
      expect(formGroup.controls.oibAuthentication1.disabled).toBeFalse();
    });
  });
});
