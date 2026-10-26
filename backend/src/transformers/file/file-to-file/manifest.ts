import { TransformerManifest } from '../../../../shared/model/connector/transformer-manifest.model';

import { buildFileInputAttribute } from '../file-input';
import { buildFilenameAttribute, buildFileOutputAttribute, fileFieldsAttributes } from '../file-output';

/**
 * Converts a CSV or JSON file into a CSV or JSON file, renaming, casting and processing the fields of its rows. Another
 * file is only renamed, and possibly compressed: changing its content needs a custom transformer.
 */
const manifest: TransformerManifest = {
  id: 'file-to-file',
  inputType: 'file',
  outputType: 'file',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [
      buildFileInputAttribute(['csv', 'json', 'other'], 'json'),
      buildFileOutputAttribute('csv'),
      buildFilenameAttribute('@CurrentDate.csv'),
      {
        type: 'boolean',
        key: 'compression',
        translationKey: 'configuration.oibus.manifest.transformers.file-output.compression',
        defaultValue: false,
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: { row: 0, columns: 4, displayInViewMode: true }
      },
      ...fileFieldsAttributes
    ],
    // the content of another file is not converted, only compressed (a converted file is compressed with its output)
    enablingConditions: [
      ...['output', 'keepOtherFields', 'fields'].map(key => ({
        referralPathFromRoot: 'input.fileType',
        targetPathFromRoot: key,
        values: ['csv', 'json']
      })),
      { referralPathFromRoot: 'input.fileType', targetPathFromRoot: 'compression', values: ['other'] }
    ],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: false
    }
  }
};

export default manifest;
