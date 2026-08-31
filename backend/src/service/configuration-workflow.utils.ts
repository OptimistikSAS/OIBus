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

// Matches a template that is *exactly* one placeholder, with nothing else around it.
const EXACT_PLACEHOLDER_REGEX = /^\{\{\s*([\w.]+)\s*\}\}$/;
const PLACEHOLDER_REGEX = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * Resolves every value of one workflow field mapping (`itemFieldMapping`/`remoteFieldMapping`) against
 * a context object - the discovered record for `itemFieldMapping`, or the discovered record plus the
 * already-created/updated item's own fields (nested under `item`) for `remoteFieldMapping`. This is a
 * deliberate `{{field}}` placeholder syntax rather than the `@Placeholder` convention used elsewhere in
 * OIBus (filename/query variables): those substitute a small, connector-defined set of built-in tokens,
 * while a workflow's field names are arbitrary and come from whatever the discovered record contains.
 *
 * A template that is *exactly* one placeholder resolves to the field's raw value, preserving its type -
 * so a numeric discovered field maps onto a numeric setting untouched, not stringified. A template with
 * any other surrounding text is string interpolation instead. A field that can't be resolved (missing
 * from the context) resolves to `null` (exact) or `''` (interpolated) - never throws.
 */
export function resolveFieldMapping(context: Record<string, unknown>, mapping: Record<string, string>): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [targetKey, template] of Object.entries(mapping)) {
    resolved[targetKey] = resolveTemplate(context, template);
  }
  return resolved;
}

function resolveTemplate(context: Record<string, unknown>, template: string): unknown {
  const exactMatch = template.match(EXACT_PLACEHOLDER_REGEX);
  if (exactMatch) {
    return lookupField(context, exactMatch[1]) ?? null;
  }
  return template.replace(PLACEHOLDER_REGEX, (_match, field) => {
    const value = lookupField(context, field);
    return value === null || value === undefined ? '' : String(value);
  });
}

// `path` is a single key for a record-level field, or one dotted level (e.g. `item.name`) for the
// `item` sub-context `remoteFieldMapping` gets - nothing deeper is supported.
function lookupField(context: Record<string, unknown>, path: string): unknown {
  const [first, ...rest] = path.split('.');
  let value: unknown = context[first];
  for (const key of rest) {
    if (value === null || typeof value !== 'object') {
      return undefined;
    }
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}
