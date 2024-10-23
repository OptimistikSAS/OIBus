import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'console',
  name: 'Console',
  category: 'debug',
  description: 'Display filename or values in Console (used for debug)',
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
      displayInViewMode: true
    }
  ]
};

export default manifest;
