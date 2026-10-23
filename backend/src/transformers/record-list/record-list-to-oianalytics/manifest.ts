import { TransformerManifest } from '../../../../shared/model/connector/transformer-manifest.model';

const manifest: TransformerManifest = {
  id: 'record-list-to-oianalytics',
  inputType: 'record-list',
  outputType: 'oianalytics',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [
      {
        type: 'string',
        key: 'pointIdColumn',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-oianalytics.point-id-column',
        defaultValue: 'pointId',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: false }
      },
      {
        type: 'string',
        key: 'timestampColumn',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-oianalytics.timestamp-column',
        defaultValue: 'timestamp',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: false }
      },
      {
        type: 'string',
        key: 'valueColumn',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-oianalytics.value-column',
        defaultValue: 'value',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: false }
      },
      {
        type: 'object',
        key: 'timestampSettings',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-oianalytics.timestamp-settings.title',
        displayProperties: { visible: true, wrapInBox: false },
        enablingConditions: [
          { referralPathFromRoot: 'type', targetPathFromRoot: 'timezone', values: ['string'] },
          { referralPathFromRoot: 'type', targetPathFromRoot: 'format', values: ['string'] },
          { referralPathFromRoot: 'type', targetPathFromRoot: 'locale', values: ['string'] }
        ],
        validators: [{ type: 'REQUIRED', arguments: [] }],
        attributes: [
          {
            type: 'string-select',
            key: 'type',
            translationKey: 'configuration.oibus.manifest.transformers.record-list-to-oianalytics.timestamp-settings.type',
            defaultValue: 'iso-string',
            selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 0, columns: 3, displayInViewMode: false }
          },
          {
            type: 'timezone',
            key: 'timezone',
            translationKey: 'configuration.oibus.manifest.transformers.record-list-to-oianalytics.timestamp-settings.timezone',
            defaultValue: 'UTC',
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 0, columns: 3, displayInViewMode: false }
          },
          {
            type: 'string',
            key: 'format',
            translationKey: 'configuration.oibus.manifest.transformers.record-list-to-oianalytics.timestamp-settings.format',
            defaultValue: 'yyyy-MM-dd HH:mm:ss',
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 0, columns: 3, displayInViewMode: false }
          },
          {
            type: 'string',
            key: 'locale',
            translationKey: 'configuration.oibus.manifest.transformers.record-list-to-oianalytics.timestamp-settings.locale',
            defaultValue: 'en-En',
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 0, columns: 3, displayInViewMode: false }
          }
        ]
      },
      {
        type: 'string-select',
        key: 'precision',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-oianalytics.precision',
        defaultValue: 'ms',
        selectableValues: ['ms', 's', 'min', 'hr'],
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 4, displayInViewMode: true }
      },
      {
        type: 'string',
        key: 'referenceProcess',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-oianalytics.reference-process',
        defaultValue: null,
        validators: [],
        displayProperties: { row: 2, columns: 12, displayInViewMode: false }
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
