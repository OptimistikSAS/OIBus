import { OIBusAttribute } from '../../../../shared/model/connector/form.model';
import { TransformerManifest } from '../../../../shared/model/connector/transformer-manifest.model';

/**
 * The Modbus values are written for the points mapped to a coil or a register: each point and its value are read from
 * columns of the records. Shared with the file-to-modbus transformer.
 */
export const modbusMappingAttributes: Array<OIBusAttribute> = [
  {
    type: 'string',
    key: 'pointIdColumn',
    translationKey: 'configuration.oibus.manifest.transformers.record-list-to-modbus.point-id-column',
    defaultValue: 'pointId',
    validators: [{ type: 'REQUIRED', arguments: [] }],
    displayProperties: { row: 0, columns: 4, displayInViewMode: false }
  },
  {
    type: 'string',
    key: 'valueColumn',
    translationKey: 'configuration.oibus.manifest.transformers.record-list-to-modbus.value-column',
    defaultValue: 'value',
    validators: [{ type: 'REQUIRED', arguments: [] }],
    displayProperties: { row: 0, columns: 4, displayInViewMode: false }
  },
  {
    type: 'array',
    key: 'mapping',
    translationKey: 'configuration.oibus.manifest.transformers.record-list-to-modbus.mapping.title',
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
      translationKey: 'configuration.oibus.manifest.transformers.record-list-to-modbus.mapping.title',
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
          translationKey: 'configuration.oibus.manifest.transformers.record-list-to-modbus.mapping.point-id',
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
          key: 'address',
          translationKey: 'configuration.oibus.manifest.transformers.record-list-to-modbus.mapping.address',
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
          type: 'string-select',
          key: 'modbusType',
          translationKey: 'configuration.oibus.manifest.transformers.record-list-to-modbus.mapping.modbus-type',
          defaultValue: 'register',
          selectableValues: ['coil', 'register'],
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
];

const manifest: TransformerManifest = {
  id: 'record-list-to-modbus',
  inputType: 'record-list',
  outputType: 'modbus',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: modbusMappingAttributes,
    enablingConditions: [],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: false
    }
  }
};

export default manifest;
