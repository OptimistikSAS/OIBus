import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'sftp',
  name: 'SFTP',
  category: 'file',
  description: 'Read files from a remote SFTP server',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: true,
    history: false,
    forceMaxInstantPerItem: false
  },
  settings: [
    {
      key: 'host',
      type: 'OibText',
      label: 'Host',
      validators: [{ key: 'required' }],
      defaultValue: '127.0.0.1',
      displayInViewMode: true,
      newRow: true,
      class: 'col-6'
    },
    {
      key: 'port',
      type: 'OibNumber',
      label: 'Port',
      defaultValue: 8080,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true,
      class: 'col-2'
    },
    {
      key: 'authentication',
      type: 'OibSelect',
      options: ['password', 'private-key'],
      label: 'Authentication',
      pipe: 'authentication',
      defaultValue: 'user',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true,
      class: 'col-4'
    },
    {
      key: 'username',
      type: 'OibText',
      label: 'Username',
      defaultValue: '',
      displayInViewMode: false,
      class: 'col-4'
    },
    {
      key: 'password',
      type: 'OibSecret',
      label: 'Password',
      defaultValue: '',
      displayInViewMode: false,
      conditionalDisplay: { field: 'authentication', values: ['password'] },
      class: 'col-4'
    },
    {
      key: 'privateKey',
      type: 'OibText',
      label: 'Private key path (PEM format)',
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'authentication', values: ['private-key'] },
      newRow: true,
      displayInViewMode: false,
      class: 'col-4'
    },
    {
      key: 'passphrase',
      type: 'OibSecret',
      label: 'Passphrase',
      conditionalDisplay: { field: 'authentication', values: ['private-key'] },
      displayInViewMode: false,
      class: 'col-4'
    },
    {
      key: 'compression',
      type: 'OibCheckbox',
      label: 'Compress file',
      defaultValue: false,
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    }
  ],
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: false
    },
    settings: [
      {
        key: 'remoteFolder',
        type: 'OibText',
        label: 'Remote folder',
        defaultValue: '/remote-folder',
        newRow: true,
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'regex',
        type: 'OibText',
        label: 'RegExp',
        defaultValue: '.*.csv',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'minAge',
        type: 'OibNumber',
        label: 'Minimum Age',
        unitLabel: 'ms',
        defaultValue: 1000,
        newRow: true,
        class: 'col-4',
        validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
        displayInViewMode: true
      },
      {
        key: 'preserveFiles',
        type: 'OibCheckbox',
        label: 'Preserve file',
        defaultValue: true,
        class: 'col-4',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'ignoreModifiedDate',
        type: 'OibCheckbox',
        label: 'Ignore modified date',
        defaultValue: false,
        class: 'col-4',
        conditionalDisplay: { field: 'preserveFiles', values: [true] },
        validators: [{ key: 'required' }],
        displayInViewMode: false
      }
    ]
  }
};
export default manifest;
