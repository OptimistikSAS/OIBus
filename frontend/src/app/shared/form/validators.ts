import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Instant } from '../../../../../backend/shared/model/types';
import { IntervalUnit } from '../../../../../backend/shared/model/scan-mode.model';
import { DateTime } from 'luxon';

/** Smallest scan mode interval accepted by the backend, in milliseconds. */
export const MIN_INTERVAL_MS = 10;

export const INTERVAL_UNIT_TO_MS: Record<IntervalUnit, number> = {
  ms: 1,
  s: 1_000,
  min: 60_000,
  hour: 3_600_000
};

/**
 * Cross-field validator for a scan mode interval group: the interval, resolved to milliseconds,
 * must be at least MIN_INTERVAL_MS. Checking the resolved value rather than each unit separately
 * means `5 ms` is rejected while `1 s` is not.
 */
export function minIntervalValidator(group: AbstractControl): ValidationErrors | null {
  const value = group.get('value')?.value;
  const unit = group.get('unit')?.value as IntervalUnit | null;
  if (value === null || value === undefined || value === '' || !unit) {
    return null;
  }
  const milliseconds = Number(value) * INTERVAL_UNIT_TO_MS[unit];
  if (!Number.isFinite(milliseconds)) {
    return null;
  }
  return milliseconds < MIN_INTERVAL_MS ? { intervalTooSmall: { min: MIN_INTERVAL_MS } } : null;
}

/**
 * Cross-field validator for the scan mode activation window group. The date range must be ordered,
 * and the time of day must be either fully set or fully empty and never zero-length (the engine
 * tests `start <= now < end`, so equal bounds would never match).
 */
export function activationWindowValidator(group: AbstractControl): ValidationErrors | null {
  const start: string | null = group.get('start')?.value;
  const end: string | null = group.get('end')?.value;
  const timeStart: string | null = group.get('timeStart')?.value;
  const timeEnd: string | null = group.get('timeEnd')?.value;

  // Both bounds are ISO UTC instants, so a lexicographic comparison is well defined.
  if (start && end && start >= end) {
    return { ascendingDates: true };
  }
  if ((timeStart && !timeEnd) || (!timeStart && timeEnd)) {
    return { timeOfDayIncomplete: true };
  }
  if (timeStart && timeEnd && timeStart === timeEnd) {
    return { timeOfDayEmpty: true };
  }
  return null;
}

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

export interface MqttTopicValidationError {
  topicErrors: Array<{
    conflictingTopics: Array<string>;
  }>;
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
 * - null if zero or one item have the field set to true
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

/**
 * Checks if two MQTT topics create overlapping subscriptions
 */
export function doMqttTopicsOverlap(topic1: string, topic2: string): boolean {
  if (topic1 === topic2) {
    return true;
  }

  return mqttTopicMatches(topic1, topic2) || mqttTopicMatches(topic2, topic1);
}

/**
 * Checks if a topic matches a pattern (with wildcards)
 */
function mqttTopicMatches(topic: string, pattern: string): boolean {
  if (!pattern.includes('+') && !pattern.includes('#')) {
    return topic === pattern;
  }

  if (pattern.includes('#')) {
    const hashIndex = pattern.indexOf('#');
    const prefix = pattern.substring(0, hashIndex);

    if (hashIndex === pattern.length - 1) {
      if (hashIndex === 0 || pattern.charAt(hashIndex - 1) === '/') {
        return topic.startsWith(prefix);
      }
    }
  }

  const topicParts = topic.split('/');
  const patternParts = pattern.split('/');

  if (patternParts[patternParts.length - 1] === '#') {
    if (topicParts.length < patternParts.length - 1) {
      return false;
    }
    for (let i = 0; i < patternParts.length - 1; i++) {
      if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) {
        return false;
      }
    }
    return true;
  }

  if (topicParts.length !== patternParts.length) {
    return false;
  }

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Creates a validator function to check for MQTT topic overlaps
 */
export function mqttTopicOverlapValidator(existingTopics: Array<string>): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const currentTopic = control.value;

    if (!currentTopic || typeof currentTopic !== 'string' || !currentTopic.trim()) {
      return null;
    }

    const conflictingTopics = existingTopics.filter(existingTopic => doMqttTopicsOverlap(currentTopic, existingTopic));

    if (conflictingTopics.length > 0) {
      return {
        mqttTopicOverlap: {
          conflictingTopics: conflictingTopics.join(', ')
        }
      };
    }
    return null;
  };
}

/**
 * Validates MQTT topics in CSV content for overlaps
 * Returns Promise<MqttTopicValidationError | null>
 */
export async function validateCsvMqttTopics(
  file: File,
  delimiter: string,
  existingMqttTopics: Array<string> = []
): Promise<MqttTopicValidationError | null> {
  try {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length <= 1) {
      return null;
    }

    const headers = lines[0].split(delimiter).map(h => h.trim());
    const topicColumnIndex = headers.indexOf('settings_topic');

    if (topicColumnIndex === -1) {
      return null;
    }

    const csvTopics: Array<string> = [];
    const conflictingTopics = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(delimiter).map(c => c.trim());
      if (columns.length > topicColumnIndex) {
        const topic = columns[topicColumnIndex];
        if (topic && topic.trim()) {
          csvTopics.push(topic.trim());
        }
      }
    }

    csvTopics.forEach(topic => {
      // Check against existing topics
      existingMqttTopics.forEach(existingTopic => {
        if (doMqttTopicsOverlap(topic, existingTopic)) {
          conflictingTopics.add(topic);
        }
      });

      csvTopics.forEach(otherTopic => {
        if (topic !== otherTopic && doMqttTopicsOverlap(topic, otherTopic)) {
          conflictingTopics.add(topic);
        }
      });
    });

    return conflictingTopics.size > 0 ? { topicErrors: [{ conflictingTopics: Array.from(conflictingTopics) }] } : null;
  } catch (_error) {
    return null;
  }
}
