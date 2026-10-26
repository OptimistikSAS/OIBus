import { OIBusAttribute } from '../../../../shared/model/connector/form.model';
import { TransformerManifest } from '../../../../shared/model/connector/transformer-manifest.model';

const KEY = 'configuration.oibus.manifest.transformers.record-list-to-oianalytics';

/**
 * The OIAnalytics payload is made of references, timestamps and values: each one is read from a field of the records, and
 * the references and values can be processed by a JS expression. Shared with the file-to-oianalytics transformer.
 */
export const oianalyticsPayloadAttributes: Array<OIBusAttribute> = [
  {
    type: 'object',
    key: 'reference',
    translationKey: `${KEY}.reference.title`,
    displayProperties: { visible: true, wrapInBox: true },
    enablingConditions: [],
    validators: [{ type: 'REQUIRED', arguments: [] }],
    attributes: [
      {
        type: 'string',
        key: 'referenceField',
        translationKey: `${KEY}.reference.reference-field`,
        defaultValue: 'pointId',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: false }
      },
      {
        type: 'string',
        key: 'referenceProcess',
        translationKey: `${KEY}.reference.reference-process`,
        defaultValue: null,
        validators: [],
        displayProperties: { row: 0, columns: 8, displayInViewMode: false }
      }
    ]
  },
  {
    type: 'object',
    key: 'timestamp',
    translationKey: `${KEY}.timestamp.title`,
    displayProperties: { visible: true, wrapInBox: true },
    enablingConditions: [
      { referralPathFromRoot: 'sourceType', targetPathFromRoot: 'timezone', values: ['string'] },
      { referralPathFromRoot: 'sourceType', targetPathFromRoot: 'format', values: ['string'] },
      { referralPathFromRoot: 'sourceType', targetPathFromRoot: 'locale', values: ['string'] }
    ],
    validators: [{ type: 'REQUIRED', arguments: [] }],
    attributes: [
      {
        type: 'string',
        key: 'timestampField',
        translationKey: `${KEY}.timestamp.timestamp-field`,
        defaultValue: 'timestamp',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: false }
      },
      {
        type: 'string-select',
        key: 'sourceType',
        translationKey: `${KEY}.timestamp.source-type`,
        defaultValue: 'iso-string',
        selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: false }
      },
      {
        type: 'string-select',
        key: 'precision',
        translationKey: `${KEY}.timestamp.precision`,
        defaultValue: 'ms',
        selectableValues: ['ms', 's', 'min', 'hr'],
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      },
      {
        type: 'timezone',
        key: 'timezone',
        translationKey: `${KEY}.timestamp.timezone`,
        defaultValue: 'UTC',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 4, displayInViewMode: false }
      },
      {
        type: 'string',
        key: 'format',
        translationKey: `${KEY}.timestamp.format`,
        defaultValue: 'yyyy-MM-dd HH:mm:ss',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 4, displayInViewMode: false }
      },
      {
        type: 'string',
        key: 'locale',
        translationKey: `${KEY}.timestamp.locale`,
        defaultValue: 'en-En',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 4, displayInViewMode: false }
      }
    ]
  },
  {
    type: 'object',
    key: 'value',
    translationKey: `${KEY}.value.title`,
    displayProperties: { visible: true, wrapInBox: true },
    enablingConditions: [],
    validators: [{ type: 'REQUIRED', arguments: [] }],
    attributes: [
      {
        type: 'string',
        key: 'valueField',
        translationKey: `${KEY}.value.value-field`,
        defaultValue: 'value',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: false }
      },
      {
        type: 'string',
        key: 'valueProcess',
        translationKey: `${KEY}.value.value-process`,
        defaultValue: null,
        validators: [],
        displayProperties: { row: 0, columns: 8, displayInViewMode: false }
      }
    ]
  }
];

const manifest: TransformerManifest = {
  id: 'record-list-to-oianalytics',
  inputType: 'record-list',
  outputType: 'oianalytics',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: oianalyticsPayloadAttributes,
    enablingConditions: [],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: false
    }
  }
};

export default manifest;
