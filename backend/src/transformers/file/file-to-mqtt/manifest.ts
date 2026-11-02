import { TransformerManifest } from '../../../../shared/model/connector/transformer-manifest.model';

import { fileInputAttribute } from '../file-input';

/**
 * Publishes a MQTT message per row of a CSV or JSON file: its topic read from a field, its payload being a field or an
 * object of several fields, each processed by operations (conversion, date time conversion...).
 */
const manifest: TransformerManifest = {
  id: 'file-to-mqtt',
  inputType: 'file',
  outputType: 'mqtt',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [
      fileInputAttribute,
      // --- MQTT TOPIC ---
      {
        type: 'string',
        key: 'topicField',
        translationKey: 'configuration.oibus.manifest.transformers.file-to-mqtt.topic-field',
        defaultValue: 'topic',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 6, displayInViewMode: true }
      },
      // --- PAYLOAD TYPE SELECTION ---
      {
        type: 'string-select',
        key: 'payloadType',
        translationKey: 'configuration.oibus.manifest.transformers.file-to-mqtt.payload-type',
        defaultValue: 'object',
        selectableValues: ['value', 'object'],
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 6, displayInViewMode: true }
      },
      // --- SIMPLE VALUE CONFIG (Hidden if type is object) ---
      {
        type: 'string',
        key: 'valueField',
        translationKey: 'configuration.oibus.manifest.transformers.file-to-mqtt.value-field',
        defaultValue: 'value',
        validators: [],
        displayProperties: { row: 2, columns: 4, displayInViewMode: true }
      },
      {
        type: 'field-process',
        key: 'valueProcess',
        translationKey: 'configuration.oibus.manifest.transformers.file-to-mqtt.value-process',
        fieldKey: 'valueField',
        validators: [],
        displayProperties: { row: 2, columns: 8, displayInViewMode: false }
      },
      // --- OBJECT FIELDS CONFIG (Hidden if type is not object) ---
      {
        type: 'array',
        key: 'objectFields',
        translationKey: 'configuration.oibus.manifest.transformers.file-to-mqtt.object-fields.title',
        paginate: false,
        numberOfElementPerPage: 20,
        validators: [],
        rootAttribute: {
          type: 'object',
          key: 'field',
          translationKey: 'configuration.oibus.manifest.transformers.file-to-mqtt.object-fields.item.title',
          displayProperties: { visible: true, wrapInBox: true },
          enablingConditions: [],
          validators: [],
          attributes: [
            {
              type: 'string',
              key: 'key',
              translationKey: 'configuration.oibus.manifest.transformers.file-to-mqtt.object-fields.key',
              defaultValue: 'key',
              validators: [{ type: 'REQUIRED', arguments: [] }],
              displayProperties: { row: 0, columns: 6, displayInViewMode: true }
            },
            {
              type: 'string',
              key: 'field',
              translationKey: 'configuration.oibus.manifest.transformers.file-to-mqtt.object-fields.field',
              defaultValue: 'val',
              validators: [{ type: 'REQUIRED', arguments: [] }],
              displayProperties: { row: 0, columns: 6, displayInViewMode: true }
            },
            {
              type: 'field-process',
              key: 'fieldProcess',
              translationKey: 'configuration.oibus.manifest.transformers.file-to-mqtt.object-fields.field-process',
              fieldKey: 'field',
              validators: [],
              displayProperties: { row: 1, columns: 12, displayInViewMode: true }
            }
          ]
        }
      }
    ],
    enablingConditions: [
      { referralPathFromRoot: 'payloadType', targetPathFromRoot: 'objectFields', values: ['object'] },
      { referralPathFromRoot: 'payloadType', targetPathFromRoot: 'valueField', values: ['value'] },
      { referralPathFromRoot: 'payloadType', targetPathFromRoot: 'valueProcess', values: ['value'] }
    ],
    validators: [],
    displayProperties: { visible: true, wrapInBox: false }
  }
};

export default manifest;
