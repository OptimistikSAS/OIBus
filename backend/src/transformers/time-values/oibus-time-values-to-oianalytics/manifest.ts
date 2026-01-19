import { TransformerManifest } from '../../../../shared/model/transformer.model';

const manifest: TransformerManifest = {
  id: 'time-values-to-oianalytics',
  inputType: 'time-values',
  outputType: 'oianalytics',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [
      {
        type: 'string-select',
        key: 'precision',
        translationKey: 'configuration.oibus.manifest.transformers.time-values-to-oianalytics.precision',
        defaultValue: 'ms',
        selectableValues: ['ms', 's', 'min', 'hr'],
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
    ],
    enablingConditions: [],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: true
    }
  }
};

export default manifest;
