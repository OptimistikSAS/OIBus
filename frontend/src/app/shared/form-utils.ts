import { FormComponentValidator, OibFormControl } from '../../../../shared/model/form.model';
import { FormControl, FormGroup, NonNullableFormBuilder, ValidatorFn, Validators } from '@angular/forms';

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

export const createFormGroup = (formDescription: Array<OibFormControl>, fb: NonNullableFormBuilder): FormGroup => {
  const formGroup = fb.group({});

  formDescription.forEach(setting => {
    const formControl = createFormControl(setting, fb);
    formGroup.addControl(setting.key, formControl);
  });
  handleConditionalDisplay(formGroup, formDescription);
  return formGroup;
};

export const createFormControl = (formControlSettings: OibFormControl, fb: NonNullableFormBuilder): FormControl | FormGroup => {
  switch (formControlSettings.type) {
    case 'OibText':
    case 'OibNumber':
    case 'OibSecret':
    case 'OibSelect':
    case 'OibCodeBlock':
    case 'OibTextArea':
    case 'OibTimezone':
      return fb.control(formControlSettings.defaultValue, getValidators(formControlSettings.validators || []));
    case 'OibArray':
      return fb.control(formControlSettings.defaultValue || [], getValidators(formControlSettings.validators || []));
    case 'OibCheckbox':
      return fb.control(formControlSettings.defaultValue || false, getValidators(formControlSettings.validators || []));
    case 'OibScanMode':
      return fb.control(null, getValidators(formControlSettings.validators || []));
    case 'OibFormGroup':
      return createFormGroup(formControlSettings.content, fb);
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
      if (formControl.conditionalDisplay!.values.includes(correspondingControl.value) && control.parent?.enabled) {
        control.enable();
      } else {
        control.disable({ emitEvent: false });
      }
      correspondingControl.valueChanges.subscribe(newVal => {
        if (formControl.conditionalDisplay!.values.includes(newVal) && control.parent?.enabled) {
          control.enable();
        } else {
          control.disable({ emitEvent: false });
        }
      });
    }
  });
};
