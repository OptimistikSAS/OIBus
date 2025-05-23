import { FormComponentValidator, OibFormControl } from '../../../../backend/shared/model/form.model';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';

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
    const control = createFormControl(setting, fb);
    formGroup.addControl(setting.key, control);
  });
  handleConditionalDisplay(formGroup, formDescription);
  return formGroup;
};

export const createFormControl = (formControlSettings: OibFormControl, fb: NonNullableFormBuilder): FormControl | FormGroup | FormArray => {
  const validators = getValidators(formControlSettings.validators || []);
  switch (formControlSettings.type) {
    case 'OibText':
    case 'OibNumber':
    case 'OibSecret':
    case 'OibSelect':
    case 'OibCodeBlock':
    case 'OibTextArea':
    case 'OibTimezone':
    case 'OibCertificate':
    case 'OibCheckbox':
    case 'OibScanMode':
      return fb.control(formControlSettings.defaultValue, validators);
    case 'OibArray': {
      // Default value for FormArray should be an array of initial item values
      const initialItemValues = formControlSettings.defaultValue || [];
      const arrayItems = initialItemValues.map((itemValue: any) => {
        const itemFormGroup = createFormGroup(formControlSettings.content, fb);
        itemFormGroup.patchValue(itemValue); // Populate the item form group
        return itemFormGroup;
      });

      const arrayValidators: Array<ValidatorFn> = [];
      if (formControlSettings.validators) {
        for (const v of formControlSettings.validators) {
          if (v.key === 'unique') {
            arrayValidators.push(arrayUniqueFieldValidator('fieldName'));
            console.log("Applied arrayUniqueFieldValidator for 'fieldName' to FormArray:", formControlSettings.key);
          }
          if (v.key === 'singleTrue') {
            arrayValidators.push(arraySingleTrueValidator('useAsReference'));
            console.log("Applied arraySingleTrueValidator for 'useAsReference' to FormArray:", formControlSettings.key);
          }
        }
      }
      return fb.array(arrayItems, { validators: arrayValidators });
    }
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

export function arrayUniqueFieldValidator(fieldKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!(control instanceof FormArray)) return null;
    const values = control.controls.map(group => group.get(fieldKey)?.value);
    const duplicates = values.filter((v, i, arr) => v && arr.indexOf(v) !== i && arr.lastIndexOf(v) === i); // Find unique duplicates

    if (duplicates.length > 0) {
      console.warn(`ARRAY VALIDATOR: Duplicate found for ${fieldKey}:`, duplicates, 'All values:', values);
      return {
        unique: { field: fieldKey, duplicateValues: duplicates, message: `Duplicate values for ${fieldKey}: ${duplicates.join(', ')}` }
      };
    }
    return null;
  };
}

export function arraySingleTrueValidator(fieldKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!(control instanceof FormArray)) return null;
    const trueCount = control.controls.filter(group => group.get(fieldKey)?.value === true).length;

    if (trueCount > 1) {
      console.warn(`ARRAY VALIDATOR: More than one true for ${fieldKey}. Count: ${trueCount}`);
      return { singleTrue: { field: fieldKey, message: `Only one item can have ${fieldKey} set to true.` } };
    }
    return null;
  };
}
