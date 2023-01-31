import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  name: 'Console',
  category: 'debug',
  description: 'Console description',
  modes: {
    files: true,
    points: true
  },
  settings: [
    {
      key: 'verbose',
      type: 'OibCheckbox',
      label: 'Verbose',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: true
    }
  ]
};

export default manifest;
