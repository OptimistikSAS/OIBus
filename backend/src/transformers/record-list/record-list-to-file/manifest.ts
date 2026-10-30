import { TransformerManifest } from '../../../../shared/model/connector/transformer-manifest.model';

import { buildFilenameAttribute, buildFileOutputAttribute, fileFieldsAttributes } from '../../file/file-output';

/**
 * Writes the records in a CSV or JSON file, for the North connectors expecting files. With its default options, the
 * records are written in a CSV file; a JSON file sends them as they are.
 */
const manifest: TransformerManifest = {
  id: 'record-list-to-file',
  inputType: 'record-list',
  outputType: 'file',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [
      buildFileOutputAttribute('csv'),
      buildFilenameAttribute('@ConnectorName-@ItemName-@QueryStartTime-@CurrentDate.csv'),
      ...fileFieldsAttributes
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
