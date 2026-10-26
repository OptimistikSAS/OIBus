import { TransformerManifest } from '../../../../shared/model/connector/transformer-manifest.model';

import { modbusMappingAttributes } from '../../record-list/record-list-to-modbus/manifest';
import { fileInputAttribute } from '../file-input';

/**
 * Writes the values of the rows of a CSV or JSON file to Modbus, as the record-list-to-modbus transformer: the point and
 * the value of each row are read from its fields.
 */
const manifest: TransformerManifest = {
  id: 'file-to-modbus',
  inputType: 'file',
  outputType: 'modbus',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [fileInputAttribute, ...modbusMappingAttributes],
    enablingConditions: [],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: false
    }
  }
};

export default manifest;
