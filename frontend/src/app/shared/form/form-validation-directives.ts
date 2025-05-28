import { ValidationErrorDirective, ValidationErrorsComponent } from 'ngx-valdemort';
import { FormControlValidationDirective } from './form-control-validation.directive';
import { ValErrorDelayDirective } from './val-error-delay.directive';

/**
 * This array contains all the form validation directives that are used in the application.
 * As they must be used together, it is easier to import them all at once (and be sure we don't forget one).
 * ESLint makes sure that they can't be imported individually.
 */
export const OI_FORM_VALIDATION_DIRECTIVES = [
  ValidationErrorDirective,
  ValErrorDelayDirective,
  ValidationErrorsComponent,
  FormControlValidationDirective
];
