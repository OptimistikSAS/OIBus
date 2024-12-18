import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'aws-s3',
  category: 'file',
  modes: {
    files: true,
    points: true
  },
  settings: [
    {
      key: 'bucket',
      type: 'OibText',
      translationKey: 'north.aws-s3.bucket',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'region',
      type: 'OibText',
      translationKey: 'north.aws-s3.region',
      defaultValue: 'eu-west-3',
      newRow: false,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'folder',
      type: 'OibText',
      translationKey: 'north.aws-s3.folder',
      newRow: false,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'accessKey',
      type: 'OibText',
      translationKey: 'north.aws-s3.access-key',
      newRow: true,
      class: 'col-6',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'secretKey',
      type: 'OibSecret',
      translationKey: 'north.aws-s3.secret-key',
      class: 'col-6'
    },
    {
      key: 'useProxy',
      translationKey: 'north.aws-s3.use-proxy',
      type: 'OibCheckbox',
      newRow: true,
      defaultValue: false,
      displayInViewMode: true,
      validators: [{ key: 'required' }]
    },
    {
      key: 'proxyUrl',
      translationKey: 'north.aws-s3.proxy-url',
      type: 'OibText',
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'useProxy', values: [true] }
    },
    {
      key: 'proxyUsername',
      translationKey: 'north.aws-s3.proxy-username',
      type: 'OibText',
      conditionalDisplay: { field: 'useProxy', values: [true] }
    },
    {
      key: 'proxyPassword',
      translationKey: 'north.aws-s3.proxy-password',
      type: 'OibSecret',
      conditionalDisplay: { field: 'useProxy', values: [true] }
    }
  ]
};

export default manifest;
