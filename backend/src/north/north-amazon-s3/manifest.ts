import { NorthConnectorManifest } from '../../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'aws-s3',
  name: 'AWS S3',
  category: 'file',
  description: 'Store files into AWS S3 bucket',
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
      key: 'accessKey',
      type: 'OibText',
      label: 'Access key',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'secretKey',
      type: 'OibSecret',
      label: 'Secret key',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'proxyId',
      type: 'OibProxy',
      label: 'Proxy',
      newRow: true,
      readDisplay: false
    }
  ]
};

export default manifest;
