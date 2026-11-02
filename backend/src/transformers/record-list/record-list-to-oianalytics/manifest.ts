import { OIBusAttribute } from '../../../../shared/model/connector/form.model';
import { TransformerManifest } from '../../../../shared/model/connector/transformer-manifest.model';

const KEY = 'configuration.oibus.manifest.transformers.record-list-to-oianalytics';

/**
 * The OIAnalytics payload is made of references, timestamps and values: each one is read from a field of the records and
 * can be processed by operations (upper case, substring, date time conversion...) - a timestamp must end as an ISO date
 * time, possibly rounded down to a precision by its date time conversion. Shared with the file-to-oianalytics transformer.
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
        type: 'field-process',
        key: 'referenceProcess',
        translationKey: `${KEY}.reference.reference-process`,
        fieldKey: 'referenceField',
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
    enablingConditions: [],
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
        type: 'field-process',
        key: 'timestampProcess',
        translationKey: `${KEY}.timestamp.timestamp-process`,
        fieldKey: 'timestampField',
        validators: [],
        displayProperties: { row: 0, columns: 8, displayInViewMode: false }
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
        type: 'field-process',
        key: 'valueProcess',
        translationKey: `${KEY}.value.value-process`,
        fieldKey: 'valueField',
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
