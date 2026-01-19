import { TransformerManifest } from '../../../../shared/model/transformer.model';

const manifest: TransformerManifest = {
  id: 'json-to-mqtt',
  inputType: 'any',
  outputType: 'mqtt',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [
      // --- GENERAL SETTINGS ---
      {
        type: 'string',
        key: 'rowIteratorPath',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.row-iterator-path',
        defaultValue: '$[*]',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 12, displayInViewMode: true }
      },
      {
        type: 'string',
        key: 'topicPath',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.topic-path',
        defaultValue: '$[*].topic',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 6, displayInViewMode: true }
      },
      // --- PAYLOAD TYPE SELECTION ---
      {
        type: 'string-select',
        key: 'payloadType',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.payload-type',
        defaultValue: 'string',
        selectableValues: ['string', 'number', 'boolean', 'datetime', 'object'],
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 1, columns: 6, displayInViewMode: true }
      },
      // --- SIMPLE VALUE CONFIG (Hidden if type is object) ---
      {
        type: 'string',
        key: 'valuePath',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.value-path',
        defaultValue: '$[*].value',
        validators: [],
        displayProperties: { row: 1, columns: 4, displayInViewMode: true }
      },
      // --- DATETIME SETTINGS (Hidden if type is not datetime) ---
      {
        type: 'object',
        key: 'datetimeSettings',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.title',
        displayProperties: { visible: true, wrapInBox: true },
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
            translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.input-type',
            defaultValue: 'iso-string',
            selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 0, columns: 3, displayInViewMode: true }
          },
          {
            type: 'timezone',
            key: 'inputTimezone',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.timezone',
            defaultValue: 'UTC',
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 0, columns: 3, displayInViewMode: true }
          },
          {
            type: 'string',
            key: 'inputFormat',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.format',
            defaultValue: 'yyyy-MM-dd HH:mm:ss',
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 0, columns: 3, displayInViewMode: false }
          },
          {
            type: 'string',
            key: 'inputLocale',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.locale',
            defaultValue: 'en-En',
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 0, columns: 3, displayInViewMode: false }
          },
          {
            type: 'string-select',
            key: 'outputType',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.output-type',
            defaultValue: 'iso-string',
            selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 1, columns: 3, displayInViewMode: true }
          },
          {
            type: 'timezone',
            key: 'outputTimezone',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.timezone',
            defaultValue: 'UTC',
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 1, columns: 3, displayInViewMode: true }
          },
          {
            type: 'string',
            key: 'outputFormat',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.format',
            defaultValue: 'yyyy-MM-dd HH:mm:ss',
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 1, columns: 3, displayInViewMode: false }
          },
          {
            type: 'string',
            key: 'outputLocale',
            translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.locale',
            defaultValue: 'en-En',
            validators: [{ type: 'REQUIRED', arguments: [] }],
            displayProperties: { row: 1, columns: 3, displayInViewMode: false }
          }
        ]
      },
      // --- OBJECT FIELDS CONFIG (Hidden if type is not object) ---
      {
        type: 'array',
        key: 'objectFields',
        translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.object-fields.title',
        paginate: false,
        numberOfElementPerPage: 20,
        validators: [],
        rootAttribute: {
          type: 'object',
          key: 'field',
          translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.object-fields.item.title',
          displayProperties: { visible: true, wrapInBox: true },
          enablingConditions: [{ referralPathFromRoot: 'dataType', targetPathFromRoot: 'datetimeSettings', values: ['datetime'] }],
          validators: [],
          attributes: [
            {
              type: 'string',
              key: 'key',
              translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.object-fields.key',
              defaultValue: 'key',
              validators: [{ type: 'REQUIRED', arguments: [] }],
              displayProperties: { row: 0, columns: 4, displayInViewMode: true }
            },
            {
              type: 'string',
              key: 'path',
              translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.object-fields.path',
              defaultValue: '$[*].val',
              validators: [{ type: 'REQUIRED', arguments: [] }],
              displayProperties: { row: 0, columns: 4, displayInViewMode: true }
            },
            {
              type: 'string-select',
              key: 'dataType',
              translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.object-fields.data-type',
              defaultValue: 'string',
              selectableValues: ['string', 'number', 'boolean', 'datetime'],
              validators: [{ type: 'REQUIRED', arguments: [] }],
              displayProperties: { row: 0, columns: 4, displayInViewMode: true }
            },
            // Datetime settings specifically for object fields
            {
              type: 'object',
              key: 'datetimeSettings',
              translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.title',
              displayProperties: { visible: true, wrapInBox: false },
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
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.input-type',
                  defaultValue: 'iso-string',
                  selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 0, columns: 3, displayInViewMode: false }
                },
                {
                  type: 'timezone',
                  key: 'inputTimezone',
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.timezone',
                  defaultValue: 'UTC',
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 0, columns: 3, displayInViewMode: false }
                },
                {
                  type: 'string',
                  key: 'inputFormat',
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.format',
                  defaultValue: 'yyyy-MM-dd HH:mm:ss',
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 0, columns: 3, displayInViewMode: false }
                },
                {
                  type: 'string',
                  key: 'inputLocale',
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.locale',
                  defaultValue: 'en-En',
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 0, columns: 3, displayInViewMode: false }
                },
                {
                  type: 'string-select',
                  key: 'outputType',
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.output-type',
                  defaultValue: 'iso-string',
                  selectableValues: ['iso-string', 'unix-epoch', 'unix-epoch-ms', 'string'],
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 1, columns: 3, displayInViewMode: false }
                },
                {
                  type: 'timezone',
                  key: 'outputTimezone',
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.timezone',
                  defaultValue: 'UTC',
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 1, columns: 3, displayInViewMode: false }
                },
                {
                  type: 'string',
                  key: 'outputFormat',
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.format',
                  defaultValue: 'yyyy-MM-dd HH:mm:ss',
                  validators: [{ type: 'REQUIRED', arguments: [] }],
                  displayProperties: { row: 1, columns: 3, displayInViewMode: false }
                },
                {
                  type: 'string',
                  key: 'outputLocale',
                  translationKey: 'configuration.oibus.manifest.transformers.json-to-mqtt.datetime-settings.locale',
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
    enablingConditions: [
      { referralPathFromRoot: 'payloadType', targetPathFromRoot: 'datetimeSettings', values: ['datetime'] },
      { referralPathFromRoot: 'payloadType', targetPathFromRoot: 'objectFields', values: ['object'] },
      {
        referralPathFromRoot: 'payloadType',
        targetPathFromRoot: 'valuePath',
        values: ['string', 'number', 'boolean']
      }
    ],
    validators: [],
    displayProperties: { visible: true, wrapInBox: true }
  }
};

export default manifest;
