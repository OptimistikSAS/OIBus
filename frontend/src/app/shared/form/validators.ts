import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Instant } from '../../../../../backend/shared/model/types';
import { DateTime } from 'luxon';

export interface RangeFormValue {
  start: Instant;
  end: Instant;
}

export interface CsvValidationError {
  expectedHeaders: Array<string>;
  actualHeaders: Array<string>;
  missingHeaders: Array<string>;
  extraHeaders: Array<string>;
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
  } catch (_e) {
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
  } catch (_e) {
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

export function dateTimeRangeValidatorBuilder(type: 'start' | 'end'): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const startTime = control.parent?.get('startTime')?.value as string;
    const endTime = control.parent?.get('endTime')?.value as string;

    if (!startTime || !endTime) {
      return null;
    }

    const startDateTime = DateTime.fromISO(startTime).startOf('minute');
    const endDateTime = DateTime.fromISO(endTime).startOf('minute');

    if (startDateTime > endDateTime) {
      return type === 'start' ? { badStartDateRange: true } : { badEndDateRange: true };
    }

    return null;
  };
}

/**
 * Custom validator to check for unique field names in an array
 * Returns
 * - null if all field values are unique
 * - {duplicateFieldNames: true} if there are duplicate values
 */
export function uniqueFieldNamesValidator(fieldKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value || !Array.isArray(control.value)) {
      return null;
    }

    const fieldNames = control.value.map((item: any) => item[fieldKey]).filter(Boolean);
    const uniqueFieldNames = new Set(fieldNames);

    if (fieldNames.length !== uniqueFieldNames.size) {
      return { duplicateFieldNames: true };
    }

    return null;
  };
}

/**
 * Custom validator to ensure only one item has a specific field set to true
 * Returns
 * - null if zero or one items have the field set to true
 * - {onlyOneReference: true} if more than one item has the field set to true
 */
export function singleTrueValidator(fieldKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value || !Array.isArray(control.value)) {
      return null;
    }

    const trueCount = control.value.filter((item: any) => item[fieldKey] === true).length;

    if (trueCount > 1) {
      return { onlyOneReference: true };
    }

    return null;
  };
}

/**
 * Validates CSV headers against expected headers
 * Returns
 * - Promise<CsvValidationError | null> - null if valid, error object if invalid
 */
export async function validateCsvHeaders(
  file: File,
  delimiter: string,
  expectedHeaders: Array<string>,
  optionalHeaders: Array<string> = []
): Promise<CsvValidationError | null> {
  if (expectedHeaders.length === 0) {
    return null;
  }

  try {
    const text = await file.text();
    const lines = text.split('\n');

    if (lines.length === 0) {
      return {
        expectedHeaders,
        actualHeaders: [],
        missingHeaders: expectedHeaders,
        extraHeaders: []
      };
    }

    const firstLine = lines[0].trim();
    if (!firstLine) {
      return {
        expectedHeaders,
        actualHeaders: [],
        missingHeaders: expectedHeaders,
        extraHeaders: []
      };
    }

    const actualHeaders = firstLine.split(delimiter).map(h => h.trim());
    const allValidHeaders = [...expectedHeaders, ...optionalHeaders];

    const missingHeaders = expectedHeaders.filter(h => !actualHeaders.includes(h));
    const extraHeaders = actualHeaders.filter(h => !allValidHeaders.includes(h));

    if (missingHeaders.length > 0 || extraHeaders.length > 0) {
      return {
        expectedHeaders,
        actualHeaders,
        missingHeaders,
        extraHeaders
      };
    }

    return null;
  } catch (_error) {
    return {
      expectedHeaders,
      actualHeaders: [],
      missingHeaders: expectedHeaders,
      extraHeaders: []
    };
  }
}
