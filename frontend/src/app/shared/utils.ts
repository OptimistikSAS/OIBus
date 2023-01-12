import { ConnectorFormValidator, OibFormControl } from '../model/form.model';
import { FormControl, FormControlOptions, FormGroup, ValidatorFn, Validators } from '@angular/forms';

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

export const createInput = (value: OibFormControl, form: FormGroup) => {
  switch (value.type) {
    case 'OibText':
    case 'OibNumber':
    case 'OibCheckbox':
    case 'OibSecret':
    case 'OibSelect':
    case 'OibCodeBlock':
    case 'OibTextArea':
    case 'OibScanMode':
    case 'OibTimezone':
      form.addControl(value.key, new FormControl(value.currentValue || value.defaultValue, getValidators(value.validators || [])));
      break;
  }
};
