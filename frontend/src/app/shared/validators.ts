import { AbstractControl, AsyncValidatorFn, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Instant } from '../../../../backend/shared/model/types';
import { DateTime } from 'luxon';
import { Observable, of } from 'rxjs';

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
 * Validator to check if a file has been selected in a FileInput
 * Returns
 * - null if a file has been selected
 * - {fileRequired: true} if no file has been selected
 */
export function fileRequiredValidator(control: AbstractControl): ValidationErrors | null {
  const file = control.value as File;
  if (!file || !(file instanceof File) || file.name === 'Choose a file') {
    return { fileRequired: true };
  }
  return null;
}

/**
 * Helper to check if a header matches, considering settings_ prefix
 */
export function headerMatches(expected: string, actual: string): boolean {
  const expectedLower = expected.toLowerCase();
  const actualLower = actual.toLowerCase();

  if (expectedLower === actualLower) return true;

  if (actualLower === `settings_${expectedLower}`) return true;

  if (expectedLower.startsWith('settings_') && actualLower === expectedLower.replace('settings_', '')) return true;

  return false;
}

/**
 * Validator to check if the CSV file has the expected headers.
 * Returns
 * - null if the CSV file has the expected headers
 * - {csvFormatError: CsvValidationError} if the CSV file does not have the expected headers
 */
export function simpleHeaderValidator(expectedHeaders: Array<string>, delimiter: string): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const file = control.value as File;
    const uploadFileName = 'Choose a file';

    if (!file || !(file instanceof File) || file.name === uploadFileName) {
      return of(null); // Let the fileRequiredValidator handle this
    }

    return new Observable(observer => {
      const reader = new FileReader();

      reader.onload = e => {
        try {
          const content = e.target?.result as string;
          if (!content) {
            observer.next(null);
            observer.complete();
            return;
          }

          const lines = content.split('\n');
          if (lines.length === 0) {
            observer.next({
              csvFormatError: {
                missingHeaders: expectedHeaders,
                extraHeaders: [],
                expectedHeaders: expectedHeaders,
                actualHeaders: []
              } as CsvValidationError
            });
            observer.complete();
            return;
          }

          const headerLine = lines[0].trim();
          const actualHeaders = headerLine.split(delimiter).map(header => header.trim().replace(/['"]/g, ''));

          const missingHeaders = expectedHeaders.filter(expected => !actualHeaders.some(actual => headerMatches(expected, actual)));

          const extraHeaders = actualHeaders.filter(actual => {
            const commonExtraHeaders = ['id', 'createdAt', 'updatedAt', 'scanModeName'];
            if (commonExtraHeaders.some(common => headerMatches(common, actual))) {
              return false;
            }
            return !expectedHeaders.some(expected => headerMatches(expected, actual));
          });

          if (missingHeaders.length > 0) {
            observer.next({
              csvFormatError: {
                missingHeaders,
                extraHeaders,
                expectedHeaders,
                actualHeaders
              } as CsvValidationError
            });
          } else {
            observer.next(null);
          }
          observer.complete();
        } catch (_error) {
          observer.next({
            csvFormatError: {
              missingHeaders: expectedHeaders,
              extraHeaders: [],
              expectedHeaders: expectedHeaders,
              actualHeaders: []
            } as CsvValidationError
          });
          observer.complete();
        }
      };

      reader.onerror = () => {
        observer.next({
          csvFormatError: {
            missingHeaders: expectedHeaders,
            extraHeaders: [],
            expectedHeaders: expectedHeaders,
            actualHeaders: []
          } as CsvValidationError
        });
        observer.complete();
      };

      reader.readAsText(file);
    });
  };
}
