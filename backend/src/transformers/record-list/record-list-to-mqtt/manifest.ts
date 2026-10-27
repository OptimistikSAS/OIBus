import { TransformerManifest } from '../../../../shared/model/connector/transformer-manifest.model';

/**
 * Publishes the records whose point is mapped to a topic: the payload is the record without its point column (as JSON),
 * or the value of one of its columns (as it is when it is text, as JSON otherwise).
 */
const manifest: TransformerManifest = {
  id: 'record-list-to-mqtt',
  inputType: 'record-list',
  outputType: 'mqtt',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [
      {
        type: 'string',
        key: 'pointIdColumn',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-mqtt.point-id-column',
        defaultValue: 'pointId',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: false }
      },
      {
        type: 'string-select',
        key: 'payload',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-mqtt.payload',
        defaultValue: 'record',
        selectableValues: ['record', 'value'],
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: false }
      },
      {
        type: 'string',
        key: 'valueColumn',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-mqtt.value-column',
        defaultValue: 'value',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: false }
      },
      {
        type: 'array',
        key: 'mapping',
        translationKey: 'configuration.oibus.manifest.transformers.record-list-to-mqtt.mapping.title',
        paginate: true,
        numberOfElementPerPage: 20,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        rootAttribute: {
          type: 'object',
          key: 'item',
          translationKey: 'configuration.oibus.manifest.transformers.record-list-to-mqtt.mapping.title',
          displayProperties: {
            visible: true,
            wrapInBox: false
          },
          enablingConditions: [],
          validators: [],
          attributes: [
            {
              type: 'string',
              key: 'pointId',
              translationKey: 'configuration.oibus.manifest.transformers.record-list-to-mqtt.mapping.point-id',
              defaultValue: null,
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
              key: 'topic',
              translationKey: 'configuration.oibus.manifest.transformers.record-list-to-mqtt.mapping.topic',
              defaultValue: null,
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
            }
          ]
        }
      }
    ],
    enablingConditions: [{ referralPathFromRoot: 'payload', targetPathFromRoot: 'valueColumn', values: ['value'] }],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: false
    }
  }
};

export default manifest;
