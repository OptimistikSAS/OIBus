import { TransformerManifest } from '../../../../shared/model/transformer.model';

const manifest: TransformerManifest = {
  id: 'json-to-csv',
  inputType: 'any',
  outputType: 'any',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [
      {
        type: 'string',
        key: 'filename',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.filename',
        defaultValue: '@CurrentDate.csv',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 0,
          columns: 6,
          displayInViewMode: true
        }
      },
      {
        type: 'string-select',
        key: 'delimiter',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.delimiter',
        defaultValue: 'SEMI_COLON',
        selectableValues: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 0,
          columns: 6,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'rowIteratorPath',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.row-iterator-path',
        defaultValue: '$[*]',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 1,
          columns: 6,
          displayInViewMode: true
        }
      },
      {
        type: 'array',
        key: 'fields',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.fields.title',
        paginate: false,
        numberOfElementPerPage: 20,
        validators: [],
        rootAttribute: {
          type: 'object',
          key: 'fieldItem',
          translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.fields.item.title',
          displayProperties: {
            visible: true,
            wrapInBox: true
          },
          enablingConditions: [
            {
              referralPathFromRoot: 'dataType',
              targetPathFromRoot: 'datetimeSettings',
              values: ['datetime']
            }
          ],
          validators: [],
          attributes: [
            {
              type: 'string',
              key: 'columnName',
              translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.fields.column-name',
              defaultValue: null,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: true
              }
            },
            {
              type: 'string',
              key: 'jsonPath',
              translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.fields.json-path',
              defaultValue: null,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: true
              }
            },
            {
              type: 'string-select',
              key: 'dataType',
              translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.fields.data-type',
              defaultValue: 'string',
              selectableValues: ['string', 'number', 'datetime', 'array', 'boolean', 'object'],
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: true
              }
            },
            {
              type: 'object',
              key: 'datetimeSettings',
              translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.fields.datetime-settings.title',
              displayProperties: {
                visible: true,
                wrapInBox: false
              },
              enablingConditions: [
                { referralPathFromRoot: 'inputType', targetPathFromRoot: 'inputTimezone', values: ['string'] },
                { referralPathFromRoot: 'inputType', targetPathFromRoot: 'inputFormat', values: ['string'] },
                { referralPathFromRoot: 'inputType', targetPathFromRoot: 'inputLocale', values: ['string'] },
                { referralPathFromRoot: 'outputType', targetPathFromRoot: 'outputTimezone', values: ['string'] },
                { referralPathFromRoot: 'outputType', targetPathFromRoot: 'outputFormat', values: ['string'] },
                { referralPathFromRoot: 'outputType', targetPathFromRoot: 'outputLocale', values: ['string'] }
              ],
              validators: [],
              attributes: [
                {
                  type: 'string-select',
                  key: 'inputType',
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.fields.datetime-settings.input-type',
                  defaultValue: 'iso-string',
                  selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 0, columns: 3, displayInViewMode: false }
                },
                {
                  type: 'timezone',
                  key: 'inputTimezone',
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.fields.datetime-settings.timezone',
                  defaultValue: 'UTC',
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 0, columns: 3, displayInViewMode: false }
                },
                {
                  type: 'string',
                  key: 'inputFormat',
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.fields.datetime-settings.format',
                  defaultValue: 'yyyy-MM-dd HH:mm:ss',
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 0, columns: 3, displayInViewMode: false }
                },
                {
                  type: 'string',
                  key: 'inputLocale',
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.fields.datetime-settings.locale',
                  defaultValue: 'en-En',
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 0, columns: 3, displayInViewMode: false }
                },
                {
                  type: 'string-select',
                  key: 'outputType',
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.fields.datetime-settings.output-type',
                  defaultValue: 'iso-string',
                  selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 1, columns: 3, displayInViewMode: false }
                },
                {
                  type: 'timezone',
                  key: 'outputTimezone',
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.fields.datetime-settings.timezone',
                  defaultValue: 'UTC',
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 1, columns: 3, displayInViewMode: false }
                },
                {
                  type: 'string',
                  key: 'outputFormat',
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.fields.datetime-settings.format',
                  defaultValue: 'yyyy-MM-dd HH:mm:ss',
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 1, columns: 3, displayInViewMode: false }
                },
                {
                  type: 'string',
                  key: 'outputLocale',
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-csv.fields.datetime-settings.locale',
                  defaultValue: 'en-En',
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 1, columns: 3, displayInViewMode: false }
                }
              ]
            }
          ]
        }
      }
    ],
    enablingConditions: [],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: true
    }
  }
};

export default manifest;
