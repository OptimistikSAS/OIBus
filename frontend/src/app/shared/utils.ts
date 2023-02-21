import { ConnectorFormValidator, OibFormControl } from '../../../../shared/model/form.model';
import { FormControl, FormControlOptions, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { ScanModeDTO } from '../../../../shared/model/scan-mode.model';
import { ProxyDTO } from '../../../../shared/model/proxy.model';
import { Authentication } from '../../../../shared/model/engine.model';

/**
 * Create the validators associated to an input from the settings schema
 */
export const getValidators = (validators: Array<ConnectorFormValidator>): FormControlOptions => {
  const formValidators: Array<ValidatorFn> = validators.map(validator => {
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

  return { validators: formValidators };
};

export const createInput = (value: OibFormControl, form: FormGroup, scanModes: Array<ScanModeDTO> = [], proxies: Array<ProxyDTO> = []) => {
  switch (value.type) {
    case 'OibText':
    case 'OibNumber':
    case 'OibCheckbox':
    case 'OibSecret':
    case 'OibSelect':
    case 'OibCodeBlock':
    case 'OibTextArea':
    case 'OibTimezone':
      form.addControl(value.key, new FormControl(value.currentValue ?? value.defaultValue, getValidators(value.validators || [])));
      break;
    case 'OibScanMode':
      const scanMode = scanModes.find(element => element.id === value.currentValue?.id);
      form.addControl(value.key, new FormControl(scanMode, getValidators(value.validators ?? [])));
      break;
    case 'OibProxy':
      const proxy = proxies.find(element => element.id === value.currentValue);
      form.addControl(value.key, new FormControl(proxy?.id, getValidators(value.validators || [])));
      break;
    case 'OibAuthentication':
      const authentication: Authentication = {
        type: value.currentValue?.type || 'none',
        key: value.currentValue?.key || '',
        secret: ''
      };
      form.addControl(value.key, new FormControl(authentication, getValidators(value.validators || [])));
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
