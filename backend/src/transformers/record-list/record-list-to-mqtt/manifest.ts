import { TransformerManifest } from '../../../../shared/model/connector/transformer-manifest.model';

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
    enablingConditions: [],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: false
    }
  }
};

export default manifest;
