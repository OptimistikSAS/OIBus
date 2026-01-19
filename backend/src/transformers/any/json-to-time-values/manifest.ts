import { TransformerManifest } from '../../../../shared/model/transformer.model';

const manifest: TransformerManifest = {
  id: 'json-to-time-values',
  inputType: 'any',
  outputType: 'time-values',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [
      {
        type: 'string',
        key: 'rowIteratorPath',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.row-iterator-path',
        defaultValue: '$[*]',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 0,
          columns: 12,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'pointIdPath',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.point-id-path',
        defaultValue: '$[*].id',
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
        key: 'timestampPath',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.timestamp-path',
        defaultValue: '$[*].timestamp',
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
        key: 'valuePath',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.value-path',
        defaultValue: '$[*].value',
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
        type: 'object',
        key: 'timestampSettings',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.timestamp-settings.title',
        displayProperties: {
          visible: true,
          wrapInBox: true
        },
        enablingConditions: [
          {
            referralPathFromRoot: 'type',
            targetPathFromRoot: 'timezone',
            values: ['string']
          },
          {
            referralPathFromRoot: 'type',
            targetPathFromRoot: 'format',
            values: ['string']
          },
          {
            referralPathFromRoot: 'type',
            targetPathFromRoot: 'locale',
            values: ['string']
          }
        ],
        validators: [],
        attributes: [
          {
            type: 'string-select',
            key: 'type',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.timestamp-settings.type',
            defaultValue: 'iso-string',
            selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 0,
              columns: 3,
              displayInViewMode: true
            }
          },
          {
            type: 'timezone',
            key: 'timezone',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.timestamp-settings.timezone',
            defaultValue: 'UTC',
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 0,
              columns: 3,
              displayInViewMode: true
            }
          },
          {
            type: 'string',
            key: 'format',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.timestamp-settings.format',
            defaultValue: 'yyyy-MM-dd HH:mm:ss',
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 0,
              columns: 3,
              displayInViewMode: false
            }
          },
          {
            type: 'string',
            key: 'locale',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.timestamp-settings.locale',
            defaultValue: 'en-En',
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 0,
              columns: 3,
              displayInViewMode: false
            }
          }
        ]
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
