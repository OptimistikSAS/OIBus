import { AbstractControl, ValidationErrors } from '@angular/forms';
import { Instant } from './types';

export interface RangeFormValue {
  start: Instant;
  end: Instant;
}

/**
 * Validator to check if a number is a positive integer
 * { invalidPositiveInteger: true } if the number is not
 */
export function validPositiveInteger(control: AbstractControl): { invalidPositiveInteger: true } | null {
  if (!control.value) {
    return null;
  }
  return Number.isInteger(control.value) && control.value >= 0 ? null : { invalidPositiveInteger: true };
}

/**
 * Validator to check if a regex is valid
 * Returns
 * - null if the regex is valid
 * - {invalidRegex: true} if the regex is invalid
 */
export function validRegex(control: AbstractControl): { invalidRegex: true } | null {
  try {
    new RegExp(control.value);
    return null;
  } catch (e) {
    return { invalidRegex: true };
  }
}

/**
 * Validator to check if a string is a validjson
 * Returns
 * - null if the string is valid
 * - {invalidJson: true} if the string is not a valid json
 */
export function validJson(control: AbstractControl): { invalidJson: true } | null {
  try {
    if (!control.value) {
      return null;
    }
    JSON.parse(control.value);
    return null;
  } catch (e) {
    return { invalidJson: true };
  }
}

/**
 * Validates that the start is before the end in the FormGroup.
 * If this is not the case, returns an `ascendingDates` error.
 * The FormGroup must have a `start` and an `end` field.
 */
export function ascendingDates(group: AbstractControl): ValidationErrors | null {
  const value: RangeFormValue = group.value;
  return value.start && value.end && value.start > value.end ? { ascendingDates: true } : null;
}
