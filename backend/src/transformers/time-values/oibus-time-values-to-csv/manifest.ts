import { TransformerManifest } from '../../../../shared/model/transformer.model';

const manifest: TransformerManifest = {
  id: 'time-values-to-csv',
  inputType: 'time-values',
  outputType: 'any',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [
      {
        type: 'string',
        key: 'filename',
        translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.filename',
        defaultValue: '@CurrentDate.csv',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 0,
          columns: 4,
          displayInViewMode: false
        }
      },
      {
        type: 'string-select',
        key: 'delimiter',
        translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.delimiter',
        defaultValue: 'COMMA',
        selectableValues: ['DOT', 'SEMI_COLON', 'COLON', 'COMMA', 'NON_BREAKING_SPACE', 'SLASH', 'TAB', 'PIPE'],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 0,
          columns: 4,
          displayInViewMode: false
        }
      },
      {
        type: 'string',
        key: 'pointIdColumnTitle',
        translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.point-id',
        defaultValue: 'Reference',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 1,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'valueColumnTitle',
        translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.value',
        defaultValue: 'Value',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 1,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'timestampColumnTitle',
        translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.timestamp',
        defaultValue: 'Timestamp',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 1,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string-select',
        key: 'timestampType',
        translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.timestamp-type',
        defaultValue: 'iso-string',
        selectableValues: ['string', 'iso-string', 'unix-epoch', 'unix-epoch-ms'],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'timestampFormat',
        translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.timestamp-format',
        defaultValue: 'yyyy-MM-dd HH:mm:ss.SSS',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: false
        }
      },
      {
        type: 'timezone',
        key: 'timezone',
        translationKey: 'configuration.oibus.manifest.transformers.time-values-to-csv.timezone',
        defaultValue: 'UTC',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      }
    ],
    enablingConditions: [
      {
        referralPathFromRoot: 'timestampType',
        targetPathFromRoot: 'timezone',
        values: ['string']
      },
      {
        referralPathFromRoot: 'timestampType',
        targetPathFromRoot: 'timestampFormat',
        values: ['string']
      }
    ],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: true
    }
  }
};

export default manifest;
