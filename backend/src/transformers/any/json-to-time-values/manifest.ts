import { TransformerManifest } from '../../../../shared/model/connector/transformer-manifest.model';

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
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 6, displayInViewMode: true }
      },
      {
        type: 'string',
        key: 'pointId',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.point-id',
        defaultValue: null,
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 4, displayInViewMode: true }
      },
      {
        type: 'string',
        key: 'value',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.value',
        defaultValue: null,
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 4, displayInViewMode: true }
      },
      {
        type: 'string',
        key: 'timestamp',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.timestamp',
        defaultValue: null,
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 4, displayInViewMode: true }
      },
      {
        type: 'object',
        key: 'datetimeSettings',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.datetime-settings.title',
        displayProperties: { visible: true, wrapInBox: false },
        enablingConditions: [
          { referralPathFromRoot: 'inputType', targetPathFromRoot: 'inputTimezone', values: ['string'] },
          { referralPathFromRoot: 'inputType', targetPathFromRoot: 'inputFormat', values: ['string'] },
          { referralPathFromRoot: 'inputType', targetPathFromRoot: 'inputLocale', values: ['string'] }
        ],
        validators: [],
        attributes: [
          {
            type: 'string-select',
            key: 'inputType',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.datetime-settings.input-type',
            defaultValue: 'iso-string',
            selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 0, columns: 3, displayInViewMode: false }
          },
          {
            type: 'timezone',
            key: 'inputTimezone',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.datetime-settings.timezone',
            defaultValue: 'UTC',
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 0, columns: 3, displayInViewMode: false }
          },
          {
            type: 'string',
            key: 'inputFormat',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.datetime-settings.format',
            defaultValue: 'yyyy-MM-dd HH:mm:ss',
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 0, columns: 3, displayInViewMode: false }
          },
          {
            type: 'string',
            key: 'inputLocale',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-time-values.datetime-settings.locale',
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
