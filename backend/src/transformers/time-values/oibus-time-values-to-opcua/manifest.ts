import { TransformerManifest } from '../../../../shared/model/transformer.model';

const manifest: TransformerManifest = {
  id: 'time-values-to-opcua',
  inputType: 'time-values',
  outputType: 'opcua',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [
      {
        type: 'array',
        key: 'mapping',
        translationKey: 'configuration.oibus.manifest.transformers.time-values-to-opcua.mapping.title',
        paginate: true,
        numberOfElementPerPage: 20,
        validators: [],
        rootAttribute: {
          type: 'object',
          key: 'item',
          translationKey: 'configuration.oibus.manifest.transformers.time-values-to-opcua.mapping.title',
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
              translationKey: 'configuration.oibus.manifest.transformers.time-values-to-opcua.mapping.point-id',
              defaultValue: null,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: true
              }
            },
            {
              type: 'string',
              key: 'nodeId',
              translationKey: 'configuration.oibus.manifest.transformers.time-values-to-opcua.mapping.node-id',
              defaultValue: null,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
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
