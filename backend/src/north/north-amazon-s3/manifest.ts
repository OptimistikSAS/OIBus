import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';
import { proxy } from '../../../shared/model/manifest-factory';

const manifest: NorthConnectorManifest = {
  id: 'aws-s3',
  name: 'AWS S3',
  category: 'file',
  description: 'Store files in Amazon S3™ (Simple Storage Service)',
  modes: {
    files: true,
    points: true
  },
  settings: [
    {
      key: 'bucket',
      type: 'OibText',
      label: 'Bucket',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'region',
      type: 'OibText',
      label: 'Region',
      defaultValue: 'eu-west-3',
      newRow: false,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'folder',
      type: 'OibText',
      label: 'Folder',
      newRow: false,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'accessKey',
      type: 'OibText',
      label: 'Access key',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'secretKey',
      type: 'OibSecret',
      label: 'Secret key',
      newRow: true
    },
    ...proxy
  ]
};

export default manifest;
