import { TransformerManifest } from '../../../../shared/model/transformer.model';

const manifest: TransformerManifest = {
  id: 'time-values-to-json',
  inputType: 'time-values',
  outputType: 'any',
  settings: {
    type: 'object',
    key: 'options',
    translationKey: 'configuration.oibus.manifest.transformers.options',
    attributes: [],
    enablingConditions: [],
    validators: [],
    displayProperties: {
      visible: true,
      wrapInBox: false
    }
  }
};

export default manifest;
