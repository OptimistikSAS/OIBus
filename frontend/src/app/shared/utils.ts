import { ConnectorFormValidator, OibFormControl } from '../../../../shared/model/form.model';
import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { ScanModeDTO } from '../../../../shared/model/scan-mode.model';
import { ProxyDTO } from '../../../../shared/model/proxy.model';
import { Authentication, AuthenticationType } from '../../../../shared/model/engine.model';

/**
 * Create the validators associated to an input from the settings schema
 */
export const getValidators = (validators: Array<ConnectorFormValidator>): Array<ValidatorFn> => {
  return validators.map(validator => {
    switch (validator.key) {
      case 'required':
        return Validators.required;
      case 'min':
        return Validators.min(validator.params.min);
      case 'max':
        return Validators.max(validator.params.max);
      case 'pattern':
        return Validators.pattern(validator.params.pattern);
      case 'minLength':
        return Validators.minLength(validator.params.minLength);
      case 'maxLength':
        return Validators.maxLength(validator.params.maxLength);
      default:
        return Validators.nullValidator;
    }
  });
};

export const createAuthenticationForm = (value: Authentication) => {
  switch (value.type) {
    case 'basic':
      return {
        type: 'basic' as AuthenticationType | null,
        username: value.username as string | null,
        password: value.password as string | null,
        token: null as string | null,
        key: null as string | null,
        secret: null as string | null,
        certPath: null as string | null,
        keyPath: null as string | null
      };
    case 'bearer':
      return {
        type: 'bearer' as AuthenticationType | null,
        username: null as string | null,
        password: null as string | null,
        token: value.token as string | null,
        key: null as string | null,
        secret: null as string | null,
        certPath: null as string | null,
        keyPath: null as string | null
      };
    case 'api-key':
      return {
        type: 'api-key' as AuthenticationType | null,
        username: null as string | null,
        password: null as string | null,
        token: null as string | null,
        key: value.key as string | null,
        secret: value.secret as string | null,
        certPath: null as string | null,
        keyPath: null as string | null
      };
    case 'cert':
      return {
        type: 'cert' as AuthenticationType | null,
        username: null as string | null,
        password: null as string | null,
        token: null as string | null,
        key: null as string | null,
        secret: null as string | null,
        certPath: value.certPath as string | null,
        keyPath: value.keyPath as string | null
      };
    case 'none':
    default:
      return {
        type: 'none' as AuthenticationType | null,
        username: null as string | null,
        password: null as string | null,
        token: null as string | null,
        key: null as string | null,
        secret: null as string | null,
        certPath: null as string | null,
        keyPath: null as string | null
      };
  }
};

export const getAuthenticationDTOFromForm = (
  formValue: Partial<{
    type: AuthenticationType | null;
    username: string | null;
    password: string | null;
    token: string | null;
    key: string | null;
    secret: string | null;
    certPath: string | null;
    keyPath: string | null;
  }>
): Authentication => {
  switch (formValue.type) {
    case 'basic':
      return {
        type: formValue.type,
        username: formValue.username!,
        password: formValue.password!
      };
    case 'bearer':
      return {
        type: formValue.type,
        token: formValue.token!
      };
    case 'api-key':
      return {
        type: formValue.type,
        key: formValue.key!,
        secret: formValue.secret!
      };
    case 'cert':
      return {
        type: formValue.type,
        certPath: formValue.certPath!,
        keyPath: formValue.keyPath!
      };
    case 'none':
    default:
      return { type: 'none' };
  }
};

export const createInput = (value: OibFormControl, form: FormGroup, scanModes: Array<ScanModeDTO> = [], proxies: Array<ProxyDTO> = []) => {
  switch (value.type) {
    case 'OibText':
    case 'OibNumber':
    case 'OibSecret':
    case 'OibSelect':
    case 'OibCodeBlock':
    case 'OibTextArea':
    case 'OibTimezone':
      form.addControl(value.key, new FormControl(value.currentValue ?? value.defaultValue, getValidators(value.validators || [])));
      break;
    case 'OibCheckbox':
      form.addControl(
        value.key,
        new FormControl(value.currentValue ?? (value.defaultValue || false), getValidators(value.validators || []))
      );
      break;
    case 'OibScanMode':
      const scanMode = scanModes.find(element => element.id === value.currentValue?.id);
      form.addControl(value.key, new FormControl(scanMode, getValidators(value.validators || [])));
      break;
    case 'OibProxy':
      const proxy = proxies.find(element => element.id === value.currentValue);
      form.addControl(value.key, new FormControl(proxy?.id, getValidators(value.validators || [])));
      break;
    case 'OibDateTimeFormat':
      form.addControl(
        value.key,
        new FormControl(value.currentValue || value.defaultValue || { type: 'datetime' }, getValidators(value.validators || []))
      );
      break;
    case 'OibAuthentication':
      form.addControl(
        value.key,
        new FormControl(createAuthenticationForm(value.currentValue || { type: 'none' }), getValidators(value.validators || []))
      );
      break;
  }
};

export const getRowSettings = (settings: Array<OibFormControl>, settingsValues: any): Array<Array<OibFormControl>> => {
  const rowList: Array<Array<OibFormControl>> = [];
  // Create rows from the manifest so settings can be put together on the same row
  settings.forEach(element => {
    if (settingsValues) {
      element.currentValue = settingsValues[element.key];
    }
    if (element.newRow || rowList.length === 0) {
      rowList.push([element]);
    } else {
      rowList[rowList.length - 1].push(element);
    }
  });
  return rowList;
};

export function byIdComparisonFn(o1: { id: string } | null, o2: { id: string } | null) {
  return (!o1 && !o2) || (o1 && o2 && o1.id === o2.id);
}

/**
 *
 * @param manifestSettings - List of settings from the manifest to check the conditional display
 * @param input - The name of the input that has changed
 * @param inputValue - The value of the input that has changed
 * @param settingsForm - The form with controls to disable
 */
export function disableInputs(manifestSettings: Array<OibFormControl>, input: string, inputValue: any, settingsForm: FormGroup) {
  manifestSettings.forEach(settings => {
    if (settings.conditionalDisplay) {
      Object.entries(settings.conditionalDisplay).forEach(([key, values]) => {
        if (key === input) {
          const foundSettings = manifestSettings.find(s => s.key === key);
          if (!foundSettings) return;
          if (foundSettings.type === 'OibAuthentication') {
            if (!values.includes(inputValue.type)) {
              settingsForm.controls[settings.key].disable();
            } else {
              settingsForm.controls[settings.key].enable();
            }
          } else {
            if (!values.includes(inputValue)) {
              settingsForm.controls[settings.key].disable();
            } else {
              settingsForm.controls[settings.key].enable();
            }
          }
        }
      });
    }
  });
}
