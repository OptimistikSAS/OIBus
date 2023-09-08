import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'console',
  category: 'debug',
  modes: {
    files: true,
    points: true,
    items: false
  },
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
