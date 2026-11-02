import { Service, signal } from '@angular/core';

import Papa from 'papaparse';

import { OIBusContent } from '@oibus/shared/common/content.model';
import { RecordFieldValue } from '@oibus/shared/connector/field-process.model';

/** How many values of a field a field process is tested on by default */
const SAMPLE_SIZE = 5;

/**
 * The rows the field processes of a transformer are tested on: those of the content the last transformer test ran on, so
 * that the processing of a field is tested on its first values. Empty when no test ran.
 */
@Service()
export class FieldProcessSamplesService {
  private readonly rows = signal<ReadonlyArray<Record<string, unknown>>>([]);

  /** The rows of a tested content: those of a record list, or of a CSV or JSON file */
  setContent(content: OIBusContent | null) {
    this.rows.set(content ? rowsOf(content) : []);
  }

  /** The first non-empty values of a field of the rows, an object or an array as its JSON text */
  valuesOf(field: string): Array<RecordFieldValue> {
    const values: Array<RecordFieldValue> = [];
    for (const row of this.rows()) {
      const value = row[field];
      if (value === null || value === undefined || value === '') {
        continue;
      }
      values.push(typeof value === 'object' ? JSON.stringify(value) : (value as RecordFieldValue));
      if (values.length === SAMPLE_SIZE) {
        break;
      }
    }
    return values;
  }
}

/**
 * The rows of a content: the records of a record list; the objects of a JSON file (an array, or the first array of an
 * object), or the lines of a CSV file with a header - its delimiter detected.
 */
function rowsOf(content: OIBusContent): Array<Record<string, unknown>> {
  if (content.type === 'record-list') {
    return content.content;
  }
  const text = content.content ?? '';
  try {
    const json: unknown = JSON.parse(text);
    const array = Array.isArray(json) ? json : json && typeof json === 'object' ? Object.values(json).find(Array.isArray) : null;
    return (array ?? []).filter((row: unknown): row is Record<string, unknown> => !!row && typeof row === 'object');
  } catch {
    return Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true, dynamicTyping: true }).data;
  }
}
