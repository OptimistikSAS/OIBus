import { ConfigurationWorkflowCommandDTO } from '../../shared/model/api/configuration-workflow.model';
import { OIBusRecord } from '../../shared/model/common/content.model';
import { RecordFieldValue } from '../../shared/model/connector/field-process.model';

import { RecordFieldProcess, RecordFilterCondition } from '../model/configuration-workflow.model';
import type { ILogger } from '../model/logger.model';
import { OIBusValidationError } from '../model/types';
import { applyFieldOperations } from '../transformers/field-process';
import { toRecordFieldValue } from './field-process.utils';

/**
 * Exactly one of itemFieldMapping (local)/pushToOIAnalytics (remote) applies - never both, never neither -
 * and a local workflow needs at least one identity key field to diff against its previous run. Shared by
 * every path that saves a workflow (the standalone workflow endpoints and the south connector command).
 */
export function checkWorkflowMode(command: ConfigurationWorkflowCommandDTO): void {
  if (command.itemFieldMapping !== null && command.pushToOIAnalytics) {
    throw new OIBusValidationError('A configuration workflow cannot both create/update items and push to OIAnalytics');
  }
  if (command.itemFieldMapping === null && !command.pushToOIAnalytics) {
    throw new OIBusValidationError('A configuration workflow must either create/update items or push to OIAnalytics');
  }
  if (!command.pushToOIAnalytics && command.identityKeyFields.length === 0) {
    throw new OIBusValidationError('A configuration workflow creating/updating items requires at least one identity key field');
  }
}

/** Identity keys only drive the local diff against the previous run - a remote workflow never performs it,
 *  so whatever it was sent with is discarded rather than stored as meaningless configuration. */
export function resolveIdentityKeyFields(command: ConfigurationWorkflowCommandDTO): Array<string> {
  return command.pushToOIAnalytics ? [] : command.identityKeyFields;
}

/** How many values of each field a preview returns, for a field process to be tested on. */
const FIELD_SAMPLE_SIZE = 5;

/**
 * Processes the fields of every discovered record through the workflow's `fieldProcesses`, before anything else reads
 * them (the eligibility filter included). A missing field stays missing, and an empty value stays empty: there is
 * nothing to process. Never throws: a value an operation fails on (e.g. a text for a number operation) is set to null,
 * with a warning, rather than failing the whole run over one unexpected value.
 */
export function processRecords(
  records: Array<OIBusRecord>,
  fieldProcesses: Array<RecordFieldProcess>,
  logger?: ILogger
): Array<OIBusRecord> {
  const processes = fieldProcesses.filter(process => process.operations.length > 0);
  if (processes.length === 0) {
    return records;
  }
  const warned = new Set<string>();
  return records.map(record => {
    const processed = { ...record };
    for (const { field, operations } of processes) {
      if (processed[field] === undefined || processed[field] === null) {
        continue;
      }
      try {
        processed[field] = toRecordFieldValue(applyFieldOperations(processed[field], operations));
      } catch (error: unknown) {
        processed[field] = null;
        const message = `Field process of "${field}" failed: ${(error as Error).message}`;
        if (logger && !warned.has(field)) {
          warned.add(field);
          logger.warn(`${message} - the field is set to null (later failures of this field are not logged)`);
        }
      }
    }
    return processed;
  });
}

/** The first non-empty values of each field of the discovered records - what a field process is tested on. */
export function sampleFieldValues(records: Array<OIBusRecord>): Record<string, Array<RecordFieldValue>> {
  const samples: Record<string, Array<RecordFieldValue>> = {};
  for (const record of records) {
    for (const [field, value] of Object.entries(record)) {
      samples[field] ??= [];
      if (value !== null && value !== undefined && samples[field].length < FIELD_SAMPLE_SIZE) {
        samples[field].push(value);
      }
    }
  }
  return samples;
}

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
 * Resolves every value of a workflow's `itemFieldMapping` against the discovered record it was matched
 * against. This is a deliberate `{{field}}` placeholder syntax rather than the `@Placeholder` convention
 * used elsewhere in OIBus (filename/query variables): those substitute a small, connector-defined set of
 * built-in tokens, while a workflow's field names are arbitrary and come from whatever the discovered
 * record contains.
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

// `path` is a single key of the discovered record - `itemFieldMapping` values only ever resolve
// against the flat record itself, so dotted-path lookup isn't exercised in practice, but is kept
// generic since a discovered record can itself carry nested objects (e.g. a raw OPC-UA node's metadata).
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
