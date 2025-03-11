import { FormComponentValidator, OibFormControl } from '../../../../backend/shared/model/form.model';
import { FormControl, FormGroup, NonNullableFormBuilder, ValidatorFn, Validators } from '@angular/forms';
import { mqttTopicOverlapValidator, singleTrueValidator, uniqueFieldNamesValidator } from './validators';

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
      case 'unique':
      case 'singleTrue':
      case 'mqttTopicOverlap':
        // Note: These are handled at the array level, not individual field level
        return Validators.nullValidator;
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
      return fb.control(formControlSettings.defaultValue, validators);
    case 'OibArray':
      const arrayValidators = [...getValidators(formControlSettings.validators || []), ...getArrayValidators(formControlSettings.content)];
      return fb.control(formControlSettings.defaultValue || [], arrayValidators);
    case 'OibCheckbox':
      return fb.control(formControlSettings.defaultValue || false, validators);
    case 'OibScanMode':
      return fb.control(null, validators);
    case 'OibTransformer':
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

/**
 * Create array-specific validators based on the content configuration
 */
export const getArrayValidators = (content: Array<OibFormControl>): Array<ValidatorFn> => {
  const validators: Array<ValidatorFn> = [];

  const uniqueFields: Array<string> = [];
  const singleTrueFields: Array<string> = [];

  content.forEach(field => {
    if (field.validators) {
      field.validators.forEach(validator => {
        if (validator.key === 'unique') {
          uniqueFields.push(field.key);
        }
        if (validator.key === 'singleTrue') {
          singleTrueFields.push(field.key);
        }
      });
    }
  });

  uniqueFields.forEach(fieldKey => {
    validators.push(uniqueFieldNamesValidator(fieldKey));
  });

  singleTrueFields.forEach(fieldKey => {
    validators.push(singleTrueValidator(fieldKey));
  });

  return validators;
};

export const createFormGroupWithMqttValidation = (
  formDescription: Array<OibFormControl>,
  fb: NonNullableFormBuilder,
  existingMqttTopics: Array<string> = []
): FormGroup => {
  const formGroup = fb.group({});
  formDescription.forEach(setting => {
    let formControl = createFormControl(setting, fb);

    if (setting.key === 'topic' && existingMqttTopics.length > 0) {
      const validators = getValidators(setting.validators || []);
      validators.push(mqttTopicOverlapValidator(existingMqttTopics));
      formControl = fb.control(setting.defaultValue, validators);
    }

    formGroup.addControl(setting.key, formControl);
  });

  handleConditionalDisplay(formGroup, formDescription);
  return formGroup;
};
