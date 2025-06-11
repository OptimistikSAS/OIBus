import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'console',
  category: 'debug',
  types: ['any', 'time-values'],
  settings: [
    {
      key: 'verbose',
      type: 'OibCheckbox',
      translationKey: 'north.console.verbose',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    }
  ]
};

export default manifest;
