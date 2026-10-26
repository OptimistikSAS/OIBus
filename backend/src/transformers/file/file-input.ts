import Papa from 'papaparse';

import { CsvCharacter } from '../../../shared/model/common/types';
import { OIBusObjectAttribute } from '../../../shared/model/connector/form.model';

import { convertDelimiter, injectIndices } from '../../service/utils';
import { resolveJsonPath, resolveJsonPathRows } from '../json-path';
import { Row } from '../record-list/point-record';

const KEY = 'configuration.oibus.manifest.transformers.file-input';

/** How the file transformers read their file: its type, and the options of that type */
export interface FileInputSettings {
  fileType: 'csv' | 'json' | 'other';
  delimiter?: CsvCharacter;
  hasHeader?: boolean;
  rowIteratorPath?: string;
}

/**
 * The `input` options of the file transformers: the type of the file, then how to read its rows. A CSV file has a row
 * per line (the columns named by the header, or by their index from 0 without header); a JSON file has a row per node
 * matched by the row iterator JSONPath. Another file is not read (file-to-file only renames it).
 */
export const buildFileInputAttribute = (
  fileTypes: Array<FileInputSettings['fileType']>,
  defaultFileType: FileInputSettings['fileType']
): OIBusObjectAttribute => ({
  type: 'object',
  key: 'input',
  translationKey: `${KEY}.title`,
  displayProperties: { visible: true, wrapInBox: true },
  enablingConditions: [
    { referralPathFromRoot: 'fileType', targetPathFromRoot: 'delimiter', values: ['csv'] },
    { referralPathFromRoot: 'fileType', targetPathFromRoot: 'hasHeader', values: ['csv'] },
    { referralPathFromRoot: 'fileType', targetPathFromRoot: 'rowIteratorPath', values: ['json'] }
  ],
  validators: [{ type: 'REQUIRED', arguments: [] }],
  attributes: [
    {
      type: 'string-select',
      key: 'fileType',
      translationKey: `${KEY}.file-type`,
      defaultValue: defaultFileType,
      selectableValues: fileTypes,
      validators: [{ type: 'REQUIRED', arguments: [] }],
      displayProperties: { row: 0, columns: 4, displayInViewMode: true }
    },
    {
      type: 'string-select',
      key: 'delimiter',
      translationKey: `${KEY}.delimiter`,
      defaultValue: 'SEMI_COLON',
      selectableValues: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
      validators: [{ type: 'REQUIRED', arguments: [] }],
      displayProperties: { row: 0, columns: 4, displayInViewMode: false }
    },
    {
      type: 'boolean',
      key: 'hasHeader',
      translationKey: `${KEY}.has-header`,
      defaultValue: true,
      validators: [{ type: 'REQUIRED', arguments: [] }],
      displayProperties: { row: 0, columns: 4, displayInViewMode: false }
    },
    {
      type: 'string',
      key: 'rowIteratorPath',
      translationKey: `${KEY}.row-iterator-path`,
      defaultValue: '$[*]',
      validators: [{ type: 'REQUIRED', arguments: [] }],
      displayProperties: { row: 0, columns: 8, displayInViewMode: false }
    }
  ]
});

/** The input of the transformers reading the rows of CSV and JSON files */
export const fileInputAttribute = buildFileInputAttribute(['csv', 'json'], 'csv');

/** The rows read from a file, and the number of errors met while parsing a CSV file */
export interface FileRows {
  rows: Array<Row>;
  errors: number;
}

/**
 * Reads the rows of a CSV or JSON file (its text, or its already parsed JSON content).
 *
 * The fields of a CSV row are its columns. The fields of a JSON row are the properties of its node (an object or an
 * array being kept as its JSON text), plus each of `paths`: a field starting with `$` is a JSONPath of the whole file,
 * whose `[*]` are resolved for the row (e.g. `$.metrics[*].name`), read under its own path as name.
 */
export function readFileRows(data: unknown, input: FileInputSettings, paths: Array<string | null | undefined>): FileRows {
  if (input.fileType === 'csv') {
    return readCsvRows(typeof data === 'string' ? data : String(data), input);
  }
  const content: unknown = typeof data === 'string' ? JSON.parse(data) : data;
  const rowIteratorPath = input.rowIteratorPath || '$[*]';
  const jsonPaths = paths.filter((path): path is string => !!path && path.startsWith('$'));
  const rows = resolveJsonPathRows(rowIteratorPath, content).map(({ indices }) => {
    const node: unknown = resolveJsonPath(injectIndices(rowIteratorPath, indices), content);
    const row: Row = isObject(node) ? Object.fromEntries(Object.entries(node).map(([key, value]) => [key, toFieldValue(value)])) : {};
    for (const path of jsonPaths) {
      row[path] = toFieldValue(resolveJsonPath(injectIndices(path, indices), content));
    }
    return row;
  });
  return { rows, errors: 0 };
}

function readCsvRows(text: string, input: FileInputSettings): FileRows {
  const hasHeader = input.hasHeader ?? true;
  const result = Papa.parse<Record<string, unknown> | Array<unknown>>(text, {
    header: hasHeader,
    delimiter: convertDelimiter(input.delimiter ?? 'SEMI_COLON'),
    skipEmptyLines: true,
    dynamicTyping: true
  });
  // Without header, the columns are named by their index
  const rows = result.data.map(line => Object.fromEntries(Object.entries(line).map(([column, value]) => [column, toFieldValue(value)])));
  return { rows, errors: result.errors.length };
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A field as a record value: an object or an array as its JSON text, a missing value as null */
function toFieldValue(value: unknown): Row[string] {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) return value;
  return JSON.stringify(value);
}
