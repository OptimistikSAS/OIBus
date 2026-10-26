import { TransformerManifest } from '../../../../shared/model/connector/transformer-manifest.model';

import { oianalyticsPayloadAttributes } from '../../record-list/record-list-to-oianalytics/manifest';
import { fileInputAttribute } from '../file-input';

/**
 * Sends the rows of a CSV or JSON file in the OIAnalytics payload, as the record-list-to-oianalytics transformer: the
 * references, timestamps and values are read from fields of the rows.
 */
const manifest: TransformerManifest = {
  id: 'file-to-oianalytics',
  inputType: 'file',
  outputType: 'oianalytics',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [fileInputAttribute, ...oianalyticsPayloadAttributes],
    enablingConditions: [],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: false
    }
  }
};

export default manifest;
