import { TransformerManifest } from '../../../../shared/model/connector/transformer-manifest.model';

import { fileInputAttribute } from '../file-input';

/** Sends the rows of a CSV or JSON file as records, with all their fields */
const manifest: TransformerManifest = {
  id: 'file-to-record-list',
  inputType: 'file',
  outputType: 'record-list',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [fileInputAttribute],
    enablingConditions: [],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: false
    }
  }
};

export default manifest;
