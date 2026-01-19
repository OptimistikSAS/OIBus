import { TransformerManifest} from '../../../../shared/model/transformer.model';

const manifest: TransformerManifest = {
  id: 'setpoint-to-opcua',
  inputType: 'setpoint',
  outputType: 'opcua',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [
      {
        type: 'array',
        key: 'mapping',
        translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-opcua.mapping.title',
        paginate: true,
        numberOfElementPerPage: 20,
        validators: [],
        rootAttribute: {
          type: 'object',
          key: 'item',
          translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-opcua.mapping.title',
          displayProperties: {
            visible: true,
            wrapInBox: false
          },
          enablingConditions: [],
          validators: [],
          attributes: [
            {
              type: 'string',
              key: 'reference',
              translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-opcua.mapping.reference',
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
              translationKey: 'configuration.oibus.manifest.transformers.setpoint-to-opcua.mapping.node-id',
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
