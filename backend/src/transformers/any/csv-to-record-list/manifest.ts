import { TransformerManifest } from '../../../../shared/model/connector/transformer-manifest.model';

const manifest: TransformerManifest = {
  id: 'csv-to-record-list',
  inputType: 'any',
  outputType: 'record-list',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [
      {
        type: 'string-select',
        key: 'delimiter',
        translationKey: 'configuration.oibus.manifest.transformers.csv-to-record-list.delimiter',
        defaultValue: 'SEMI_COLON',
        selectableValues: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 6, displayInViewMode: true }
      },
      {
        type: 'boolean',
        key: 'hasHeader',
        translationKey: 'configuration.oibus.manifest.transformers.csv-to-record-list.has-header',
        defaultValue: true,
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 6, displayInViewMode: true }
      },
      {
        type: 'string',
        key: 'pointIdColumn',
        translationKey: 'configuration.oibus.manifest.transformers.csv-to-record-list.point-id-column',
        defaultValue: 'id',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 4, displayInViewMode: true }
      },
      {
        type: 'string',
        key: 'timestampColumn',
        translationKey: 'configuration.oibus.manifest.transformers.csv-to-record-list.timestamp-column',
        defaultValue: 'timestamp',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 4, displayInViewMode: true }
      },
      {
        type: 'string',
        key: 'valueColumn',
        translationKey: 'configuration.oibus.manifest.transformers.csv-to-record-list.value-column',
        defaultValue: 'value',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 4, displayInViewMode: true }
      },
      {
        type: 'object',
        key: 'timestampSettings',
        translationKey: 'configuration.oibus.manifest.transformers.csv-to-record-list.timestamp-settings.title',
        displayProperties: { visible: true, wrapInBox: true },
        enablingConditions: [
          { referralPathFromRoot: 'type', targetPathFromRoot: 'timezone', values: ['string'] },
          { referralPathFromRoot: 'type', targetPathFromRoot: 'format', values: ['string'] },
          { referralPathFromRoot: 'type', targetPathFromRoot: 'locale', values: ['string'] }
        ],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        attributes: [
          {
            type: 'string-select',
            key: 'type',
            translationKey: 'configuration.oibus.manifest.transformers.csv-to-record-list.timestamp-settings.type',
            defaultValue: 'iso-string',
            selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 0, columns: 3, displayInViewMode: true }
          },
          {
            type: 'timezone',
            key: 'timezone',
            translationKey: 'configuration.oibus.manifest.transformers.csv-to-record-list.timestamp-settings.timezone',
            defaultValue: 'UTC',
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 0, columns: 3, displayInViewMode: true }
          },
          {
            type: 'string',
            key: 'format',
            translationKey: 'configuration.oibus.manifest.transformers.csv-to-record-list.timestamp-settings.format',
            defaultValue: 'yyyy-MM-dd HH:mm:ss',
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 0, columns: 3, displayInViewMode: false }
          },
          {
            type: 'string',
            key: 'locale',
            translationKey: 'configuration.oibus.manifest.transformers.csv-to-record-list.timestamp-settings.locale',
            defaultValue: 'en-En',
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 0, columns: 3, displayInViewMode: false }
          }
        ]
      }
    ],
    enablingConditions: [],
    validators: [],
    displayProperties: { visible: true, wrapInBox: true }
  }
};

export default manifest;
