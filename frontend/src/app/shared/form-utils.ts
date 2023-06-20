import { FormComponentValidator, OibFormControl } from '../../../../shared/model/form.model';
import { FormControl, FormGroup, NonNullableFormBuilder, ValidatorFn, Validators } from '@angular/forms';
import { ScanModeDTO } from '../../../../shared/model/scan-mode.model';
import { ProxyDTO } from '../../../../shared/model/proxy.model';
import { Authentication, AuthenticationType } from '../../../../shared/model/engine.model';

/**
 * Create the validators associated to an input from the settings schema
 */
export const getValidators = (validators: Array<FormComponentValidator>): Array<ValidatorFn> => {
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

export const createFormGroup = (formDescription: Array<OibFormControl>, fb: NonNullableFormBuilder): FormGroup => {
  const formGroup = fb.group({});

  formDescription.forEach(setting => {
    const formControl = createFormControl(setting, fb);
    formGroup.addControl(setting.key, formControl);
  });
  handleConditionalDisplay(formGroup, formDescription);
  return formGroup;
};

export const createFormControl = (
  value: OibFormControl,
  fb: NonNullableFormBuilder,
  scanModes: Array<ScanModeDTO> = [],
  proxies: Array<ProxyDTO> = []
): FormControl | FormGroup => {
  switch (value.type) {
    case 'OibText':
    case 'OibNumber':
    case 'OibSecret':
    case 'OibSelect':
    case 'OibCodeBlock':
    case 'OibTextArea':
    case 'OibTimezone':
      return fb.control(value.defaultValue, getValidators(value.validators || []));
    case 'OibCheckbox':
      return fb.control(value.defaultValue || false, getValidators(value.validators || []));
    case 'OibScanMode':
      return fb.control(null, getValidators(value.validators || []));
    case 'OibProxy':
      return fb.control(null, getValidators(value.validators || []));
    case 'OibDateTimeFields':
      return fb.control(value.defaultValue || [], getValidators(value.validators || []));
    case 'OibAuthentication':
      return fb.control(createAuthenticationForm(value.defaultValue || { type: 'none' }), getValidators(value.validators || []));
    case 'FormGroup':
      const formGroup = fb.group({});
      value.content.forEach(item => {
        const formControl = createFormControl(item, fb, scanModes, proxies);
        formGroup.addControl(item.key, formControl);
      });
      return formGroup;
  }
};

export const groupFormControlsByRow = (settings: Array<OibFormControl>): Array<Array<OibFormControl>> => {
  const rowList: Array<Array<OibFormControl>> = [];
  // Create rows from the manifest so settings can be put together on the same row
  settings.forEach(element => {
    if (element.newRow || rowList.length === 0) {
      rowList.push([element]);
    } else {
      rowList[rowList.length - 1].push(element);
    }
  });
  return rowList;
};

export const byIdComparisonFn = (o1: any, o2: any) => {
  return (!o1 && !o2) || (o1 && o2 && o1.id === o2.id);
};

/**
 * Go through the form description to create the correct value change subscriptions to hide fields
 */
export const handleConditionalDisplay = (formGroup: FormGroup, formDescription: Array<OibFormControl>) => {
  formDescription.forEach(formControl => {
    const control = formGroup.controls[formControl.key];
    if (formControl.conditionalDisplay) {
      const correspondingControl = formGroup.controls[formControl.conditionalDisplay.field];
      correspondingControl.valueChanges.subscribe(newVal => {
        if (formControl.conditionalDisplay!.values.includes(newVal)) {
          control.enable();
        } else {
          control.disable();
        }
      });
    }
  });
};
