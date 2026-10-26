import { TransformerManifest } from '../../../../shared/model/connector/transformer-manifest.model';

import { opcuaMappingAttributes } from '../../record-list/record-list-to-opcua/manifest';
import { fileInputAttribute } from '../file-input';

/**
 * Writes the values of the rows of a CSV or JSON file to OPCUA, as the record-list-to-opcua transformer: the point and
 * the value of each row are read from its fields.
 */
const manifest: TransformerManifest = {
  id: 'file-to-opcua',
  inputType: 'file',
  outputType: 'opcua',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [fileInputAttribute, ...opcuaMappingAttributes],
    enablingConditions: [],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: false
    }
  }
};

export default manifest;
