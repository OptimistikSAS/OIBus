import { OIBusRecord } from '../../shared/model/engine.model';
import { RecordFilterCondition } from '../model/configuration-workflow.model';

/**
 * Evaluates one workflow's `eligibilityFilter` against a single discovered record - every condition
 * must pass (AND-ed); an empty filter means every record is eligible. Runs on the connector-agnostic
 * `Array<OIBusRecord>` shape Retrieve normalizes every connector down to, so it never needs to know
 * which connector produced the record. Never throws: a malformed condition (e.g. an invalid regex for
 * `matches`) is treated as not matching, rather than failing the whole run over one bad rule.
 */
export function isEligible(record: OIBusRecord, conditions: Array<RecordFilterCondition>): boolean {
  return conditions.every(condition => evaluateCondition(record, condition));
}

function evaluateCondition(record: OIBusRecord, condition: RecordFilterCondition): boolean {
  const fieldValue = record[condition.field];

  if (condition.operator === 'exists') {
    return fieldValue !== undefined && fieldValue !== null;
  }
  if (fieldValue === undefined || fieldValue === null) {
    // No other operator can meaningfully match a field that isn't there - except notEquals, where a
    // missing field is trivially "not equal" to whatever value was being checked for.
    return condition.operator === 'notEquals';
  }

  switch (condition.operator) {
    case 'equals':
      return String(fieldValue) === condition.value;
    case 'notEquals':
      return String(fieldValue) !== condition.value;
    case 'contains':
      return String(fieldValue).includes(condition.value ?? '');
    case 'matches':
      try {
        return new RegExp(condition.value ?? '').test(String(fieldValue));
      } catch {
        return false;
      }
    case 'greaterThan': {
      const numericValue = Number(fieldValue);
      const threshold = Number(condition.value);
      return !Number.isNaN(numericValue) && !Number.isNaN(threshold) && numericValue > threshold;
    }
    case 'lessThan': {
      const numericValue = Number(fieldValue);
      const threshold = Number(condition.value);
      return !Number.isNaN(numericValue) && !Number.isNaN(threshold) && numericValue < threshold;
    }
  }
}

// A control character, vanishingly unlikely to appear in a real field value, separating the
// "field=value" segments below. Without a real separator, field names alone don't prevent a
// collision - e.g. ["a"] on { a: "b=c" } could otherwise produce the same string as ["a", "b"] on
// some other record.
const IDENTITY_KEY_FIELD_SEPARATOR = String.fromCharCode(1);

/**
 * Canonical string identifying a discovered record across runs, from the workflow's
 * `identityKeyFields` in the declared order - the value written to (and looked up in)
 * `item_point_metadata.discovered_entry_key`.
 */
export function computeIdentityKey(record: OIBusRecord, identityKeyFields: Array<string>): string {
  return identityKeyFields.map(field => `${field}=${record[field] ?? ''}`).join(IDENTITY_KEY_FIELD_SEPARATOR);
}
