import { NorthConnectorManifest } from '../../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  name: 'AWS3',
  category: 'file',
  description: 'AWS description',
  modes: {
    files: true,
    points: false
  },
  settings: [
    {
      key: 'bucket',
      type: 'OibText',
      label: 'Bucket',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'region',
      type: 'OibText',
      label: 'Region',
      newRow: false,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'folder',
      type: 'OibText',
      label: 'Folder',
      newRow: false,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'proxy',
      type: 'OibProxy',
      label: 'Proxy',
      newRow: true,
      readDisplay: false
    }
  ]
};

export default manifest;
