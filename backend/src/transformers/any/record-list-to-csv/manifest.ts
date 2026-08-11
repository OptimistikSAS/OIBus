import { TransformerManifest } from '../../../../shared/model/transformer.model';

const manifest: TransformerManifest = {
  id: 'record-list-to-csv',
  inputType: 'record-list',
  outputType: 'any',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [
      {
        type: 'string',
        key: 'filename',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.filename',
        defaultValue: '@CurrentDate.csv',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 5, displayInViewMode: false }
      },
      {
        type: 'string-select',
        key: 'encoding',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.encoding',
        defaultValue: 'UTF_8',
        selectableValues: ['UTF_8', 'UTF_8_BOM', 'LATIN_1', 'UTF_16_LE'],
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 3, displayInViewMode: false }
      },
      {
        type: 'boolean',
        key: 'header',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.header',
        defaultValue: true,
        validators: [],
        displayProperties: { row: 0, columns: 2, displayInViewMode: false }
      },
      {
        type: 'boolean',
        key: 'compression',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.compression',
        defaultValue: false,
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 2, displayInViewMode: true }
      },
      {
        type: 'string-select',
        key: 'delimiter',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.delimiter',
        defaultValue: 'COMMA',
        selectableValues: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 3, displayInViewMode: false }
      },
      {
        type: 'string-select',
        key: 'newline',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.newline',
        defaultValue: 'LF',
        selectableValues: ['CRLF', 'LF', 'CR'],
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 3, displayInViewMode: false }
      },
      {
        type: 'string-select',
        key: 'quoteChar',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.quote-char',
        defaultValue: 'NONE',
        selectableValues: ['DOUBLE_QUOTE', 'SINGLE_QUOTE', 'NONE'],
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 3, displayInViewMode: false }
      },
      {
        type: 'string-select',
        key: 'escapeChar',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.escape-char',
        defaultValue: 'DOUBLE_QUOTE',
        selectableValues: ['BACKSLASH', 'DOUBLE_QUOTE'],
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 3, displayInViewMode: false }
      },
      {
        type: 'array',
        key: 'datetimeFields',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.datetime-fields.title',
        paginate: false,
        numberOfElementPerPage: 0,
        validators: [],
        rootAttribute: {
          type: 'object',
          key: 'datetimeField',
          translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.datetime-fields.item.title',
          displayProperties: {
            visible: true,
            wrapInBox: true
          },
          enablingConditions: [],
          validators: [],
          attributes: [
            {
              type: 'string',
              key: 'fieldName',
              translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.datetime-fields.field-name',
              defaultValue: null,
              validators: [
                { type: 'REQUIRED', arguments: [] },
                { type: 'UNIQUE', arguments: [] }
              ],
              displayProperties: { row: 0, columns: 4, displayInViewMode: true }
            },
            {
              type: 'object',
              key: 'input',
              translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.datetime-fields.input.title',
              displayProperties: {
                visible: true,
                wrapInBox: false
              },
              enablingConditions: [
                { referralPathFromRoot: 'type', targetPathFromRoot: 'timezone', values: ['string', 'date-time'] },
                { referralPathFromRoot: 'type', targetPathFromRoot: 'format', values: ['string'] },
                { referralPathFromRoot: 'type', targetPathFromRoot: 'locale', values: ['string'] }
              ],
              validators: [],
              attributes: [
                {
                  type: 'string-select',
                  key: 'type',
                  translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.datetime-fields.input.type',
                  defaultValue: 'string',
                  selectableValues: ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms', 'date-time'],
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 0, columns: 4, displayInViewMode: true }
                },
                {
                  type: 'timezone',
                  key: 'timezone',
                  translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.datetime-fields.input.timezone',
                  defaultValue: 'UTC',
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 0, columns: 4, displayInViewMode: false }
                },
                {
                  type: 'string',
                  key: 'format',
                  translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.datetime-fields.input.format',
                  defaultValue: 'yyyy-MM-dd HH:mm:ss',
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 0, columns: 4, displayInViewMode: false }
                },
                {
                  type: 'string',
                  key: 'locale',
                  translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.datetime-fields.input.locale',
                  defaultValue: 'en-En',
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 0, columns: 4, displayInViewMode: false }
                }
              ]
            },
            {
              type: 'string',
              key: 'outputTimestampFormat',
              translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.datetime-fields.output-timestamp-format',
              defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
              validators: [{ type: 'REQUIRED', arguments: [] }],
              displayProperties: { row: 1, columns: 6, displayInViewMode: false }
            },
            {
              type: 'timezone',
              key: 'outputTimezone',
              translationKey: 'configuration.oibus.manifest.transformers.record-list-to-csv.datetime-fields.output-timezone',
              defaultValue: 'UTC',
              validators: [{ type: 'REQUIRED', arguments: [] }],
              displayProperties: { row: 1, columns: 6, displayInViewMode: false }
            }
          ]
        }
      }
    ],
    enablingConditions: [],
    validators: [
      {
        type: 'REQUIRED',
        arguments: []
      }
    ],
    displayProperties: {
      visible: true,
      wrapInBox: true
    }
  }
};

export default manifest;
