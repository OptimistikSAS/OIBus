import zlib from 'node:zlib';

import csv from 'papaparse';

import { OIBusAttribute, OIBusObjectAttribute } from '../../../shared/model/connector/form.model';
import { TransformerRecordListToFileSettings } from '../../../shared/model/connector/transformer-settings.model';

import { CacheMetadataSource } from '../../model/engine.model';
import type { ILogger } from '../../model/logger.model';
import {
  applyFilenameVariables,
  convertDelimiter,
  convertEscapeChar,
  convertNewline,
  convertQuoteChar,
  sanitizeFilename
} from '../../service/utils';
import { createFieldProcess } from '../field-process';
import { Row } from '../record-list/point-record';

const OUTPUT_KEY = 'configuration.oibus.manifest.transformers.file-output';
const FIELDS_KEY = 'configuration.oibus.manifest.transformers.file-fields';

/** How the file transformers write their file: its type, name and format, and the fields of its rows */
export type FileOutputSettings = Pick<TransformerRecordListToFileSettings, 'output' | 'filename' | 'keepOtherFields' | 'fields'>;

/**
 * The `output` options of the file transformers: the type of the written file (CSV or JSON), its encoding and
 * compression, and the format of a CSV file.
 */
export const buildFileOutputAttribute = (defaultFileType: 'csv' | 'json'): OIBusObjectAttribute => ({
  type: 'object',
  key: 'output',
  translationKey: `${OUTPUT_KEY}.title`,
  displayProperties: { visible: true, wrapInBox: true },
  enablingConditions: ['header', 'delimiter', 'newline', 'quoteChar', 'escapeChar', 'nullValue'].map(key => ({
    referralPathFromRoot: 'fileType',
    targetPathFromRoot: key,
    values: ['csv']
  })),
  validators: [{ type: 'REQUIRED', arguments: [] }],
  attributes: [
    {
      type: 'string-select',
      key: 'fileType',
      translationKey: `${OUTPUT_KEY}.file-type`,
      defaultValue: defaultFileType,
      selectableValues: ['csv', 'json'],
      validators: [{ type: 'REQUIRED', arguments: [] }],
      displayProperties: { row: 0, columns: 3, displayInViewMode: true }
    },
    {
      type: 'string-select',
      key: 'encoding',
      translationKey: `${OUTPUT_KEY}.encoding`,
      defaultValue: 'UTF_8',
      selectableValues: ['UTF_8', 'UTF_8_BOM', 'LATIN_1', 'UTF_16_LE'],
      validators: [{ type: 'REQUIRED', arguments: [] }],
      displayProperties: { row: 0, columns: 3, displayInViewMode: false }
    },
    {
      type: 'boolean',
      key: 'compression',
      translationKey: `${OUTPUT_KEY}.compression`,
      defaultValue: false,
      validators: [{ type: 'REQUIRED', arguments: [] }],
      displayProperties: { row: 0, columns: 3, displayInViewMode: true }
    },
    {
      type: 'boolean',
      key: 'header',
      translationKey: `${OUTPUT_KEY}.header`,
      defaultValue: true,
      validators: [{ type: 'REQUIRED', arguments: [] }],
      displayProperties: { row: 0, columns: 3, displayInViewMode: false }
    },
    {
      type: 'string-select',
      key: 'delimiter',
      translationKey: `${OUTPUT_KEY}.delimiter`,
      defaultValue: 'COMMA',
      selectableValues: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
      validators: [{ type: 'REQUIRED', arguments: [] }],
      displayProperties: { row: 1, columns: 3, displayInViewMode: false }
    },
    {
      type: 'string-select',
      key: 'newline',
      translationKey: `${OUTPUT_KEY}.newline`,
      defaultValue: 'LF',
      selectableValues: ['CRLF', 'LF', 'CR'],
      validators: [{ type: 'REQUIRED', arguments: [] }],
      displayProperties: { row: 1, columns: 3, displayInViewMode: false }
    },
    {
      type: 'string-select',
      key: 'quoteChar',
      translationKey: `${OUTPUT_KEY}.quote-char`,
      defaultValue: 'NONE',
      selectableValues: ['DOUBLE_QUOTE', 'SINGLE_QUOTE', 'NONE'],
      validators: [{ type: 'REQUIRED', arguments: [] }],
      displayProperties: { row: 1, columns: 3, displayInViewMode: false }
    },
    {
      type: 'string-select',
      key: 'escapeChar',
      translationKey: `${OUTPUT_KEY}.escape-char`,
      defaultValue: 'DOUBLE_QUOTE',
      selectableValues: ['BACKSLASH', 'DOUBLE_QUOTE'],
      validators: [{ type: 'REQUIRED', arguments: [] }],
      displayProperties: { row: 1, columns: 3, displayInViewMode: false }
    },
    {
      type: 'string',
      key: 'nullValue',
      translationKey: `${OUTPUT_KEY}.null-value`,
      defaultValue: '',
      validators: [],
      displayProperties: { row: 2, columns: 3, displayInViewMode: false }
    }
  ]
});

/**
 * The name of the written file, with variables: `@CurrentDate`, `@QueryStartTime`, `@QueryEndTime`, `@ConnectorName`,
 * `@ItemName`, and the `@SourceFilename` and `@SourceExtension` of a transformed file.
 */
export const buildFilenameAttribute = (defaultValue: string): OIBusAttribute => ({
  type: 'string',
  key: 'filename',
  translationKey: `${OUTPUT_KEY}.filename`,
  defaultValue,
  validators: [{ type: 'REQUIRED', arguments: [] }],
  displayProperties: { row: 0, columns: 8, displayInViewMode: true }
});

/**
 * The fields of the written rows: every field of the rows unless only the configured ones are kept, each configured
 * field being renamed and processed by operations (conversion, upper case, substring, date time conversion...).
 */
export const fileFieldsAttributes: Array<OIBusAttribute> = [
  {
    type: 'array',
    key: 'fields',
    translationKey: `${FIELDS_KEY}.title`,
    paginate: false,
    numberOfElementPerPage: 20,
    validators: [],
    rootAttribute: {
      type: 'object',
      key: 'fieldItem',
      translationKey: `${FIELDS_KEY}.item.title`,
      displayProperties: {
        visible: true,
        wrapInBox: true
      },
      enablingConditions: [],
      validators: [],
      attributes: [
        {
          type: 'string',
          key: 'field',
          translationKey: `${FIELDS_KEY}.field`,
          defaultValue: null,
          validators: [
            { type: 'REQUIRED', arguments: [] },
            { type: 'UNIQUE', arguments: [] }
          ],
          displayProperties: { row: 0, columns: 6, displayInViewMode: true }
        },
        {
          type: 'string',
          key: 'name',
          translationKey: `${FIELDS_KEY}.name`,
          defaultValue: null,
          validators: [],
          displayProperties: { row: 0, columns: 6, displayInViewMode: true }
        },
        {
          type: 'field-process',
          key: 'fieldProcess',
          translationKey: `${FIELDS_KEY}.field-process`,
          fieldKey: 'field',
          validators: [],
          displayProperties: { row: 1, columns: 12, displayInViewMode: true }
        }
      ]
    }
  },
  {
    type: 'boolean',
    key: 'keepOtherFields',
    translationKey: `${FIELDS_KEY}.keep-other-fields`,
    defaultValue: true,
    validators: [{ type: 'REQUIRED', arguments: [] }],
    displayProperties: { row: 4, columns: 4, displayInViewMode: true }
  }
];

/**
 * Writes the rows in a CSV or JSON file, named with the filename variables (see `applyFilenameVariables`), encoded and
 * possibly gzipped (adding `.gz` to its name).
 */
export function writeFile(
  rows: Array<Row>,
  settings: FileOutputSettings,
  source: CacheMetadataSource,
  sourceFilename: string | null,
  logger?: ILogger
): { output: Buffer; contentFile: string } {
  const { output: format } = settings;
  const fieldProcesses = (settings.fields ?? []).map(field => createFieldProcess(field.fieldProcess, `field "${field.field}"`, logger));
  const writtenRows = rows.map(row => writeRow(row, settings, fieldProcesses));
  let text: string;
  if (format.fileType === 'csv') {
    const quoteChar = convertQuoteChar(format.quoteChar ?? 'NONE');
    text = csv.unparse(writtenRows, {
      header: format.header ?? true,
      delimiter: convertDelimiter(format.delimiter ?? 'COMMA'),
      quoteChar: quoteChar || '"',
      escapeChar: convertEscapeChar(format.escapeChar ?? 'DOUBLE_QUOTE'),
      newline: convertNewline(format.newline ?? 'LF'),
      quotes: quoteChar !== ''
    });
  } else {
    text = JSON.stringify(writtenRows);
  }

  let output: Buffer;
  switch (format.encoding) {
    case 'UTF_8_BOM':
      output = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text)]);
      break;
    case 'LATIN_1':
      output = Buffer.from(text, 'latin1');
      break;
    case 'UTF_16_LE':
      output = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
      break;
    default:
      output = Buffer.from(text);
  }
  const contentFile = sanitizeFilename(applyFilenameVariables(settings.filename, source, sourceFilename));
  if (format.compression) {
    return { output: zlib.gzipSync(output), contentFile: `${contentFile}.gz` };
  }
  return { output, contentFile };
}

/**
 * A written row: the other fields of the row unless only the configured ones are kept, then the configured fields, each
 * processed by the field process at the same index
 */
function writeRow(row: Row, settings: FileOutputSettings, fieldProcesses: Array<(value: unknown) => unknown>): Record<string, unknown> {
  const fields = settings.fields ?? [];
  const writtenRow: Record<string, unknown> = {};
  if (settings.keepOtherFields) {
    const configuredFields = new Set(fields.map(field => field.field));
    for (const [key, value] of Object.entries(row)) {
      if (!configuredFields.has(key)) writtenRow[key] = value instanceof Date ? value.toISOString() : value;
    }
  }
  fields.forEach((field, index) => {
    writtenRow[field.name || field.field] = writeField(row[field.field], settings.output, fieldProcesses[index]);
  });
  return writtenRow;
}

/**
 * A field processed by its operations: a missing field, or a value they fail on, is the null value of a CSV file, null in a
 * JSON file. In a CSV file, an object or an array is written as its JSON text.
 */
function writeField(value: Row[string] | undefined, format: FileOutputSettings['output'], process: (value: unknown) => unknown): unknown {
  const csvFile = format.fileType === 'csv';
  // The operations apply to the values of the field only
  const processed = value === undefined || value === null ? null : process(value instanceof Date ? value.toISOString() : value);
  if (processed === null || processed === undefined) {
    return csvFile ? (format.nullValue ?? '') : null;
  }
  return csvFile && typeof processed === 'object' ? JSON.stringify(processed) : processed;
}
