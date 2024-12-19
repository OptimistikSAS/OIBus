import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'sftp',
  category: 'file',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: true,
    history: false
  },
  settings: [
    {
      key: 'host',
      type: 'OibText',
      translationKey: 'south.sftp.host',
      validators: [{ key: 'required' }],
      defaultValue: '127.0.0.1',
      displayInViewMode: true,
      newRow: true,
      class: 'col-9'
    },
    {
      key: 'port',
      type: 'OibNumber',
      translationKey: 'south.sftp.port',
      defaultValue: 8080,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true,
      class: 'col-3'
    },
    {
      key: 'authentication',
      type: 'OibSelect',
      options: ['password', 'private-key'],
      translationKey: 'south.sftp.authentication',
      defaultValue: 'password',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true,
      class: 'col-6'
    },
    {
      key: 'username',
      type: 'OibText',
      translationKey: 'south.sftp.username',
      defaultValue: '',
      displayInViewMode: false,
      newRow: true,
      class: 'col-4'
    },
    {
      key: 'password',
      type: 'OibSecret',
      translationKey: 'south.sftp.password',
      defaultValue: '',
      displayInViewMode: false,
      conditionalDisplay: { field: 'authentication', values: ['password'] },
      class: 'col-4'
    },
    {
      key: 'privateKey',
      type: 'OibText',
      translationKey: 'south.sftp.private-key',
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'authentication', values: ['private-key'] },
      displayInViewMode: false,
      class: 'col-4'
    },
    {
      key: 'passphrase',
      type: 'OibSecret',
      translationKey: 'south.sftp.passphrase',
      conditionalDisplay: { field: 'authentication', values: ['private-key'] },
      displayInViewMode: false,
      class: 'col-4'
    },
    {
      key: 'compression',
      type: 'OibCheckbox',
      translationKey: 'south.sftp.compression',
      defaultValue: false,
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    }
  ],
  items: {
    scanMode: 'POLL',
    settings: [
      {
        key: 'remoteFolder',
        type: 'OibText',
        translationKey: 'south.items.sftp.remote-folder',
        defaultValue: '/remote-folder',
        newRow: true,
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'regex',
        type: 'OibText',
        translationKey: 'south.items.sftp.regex',
        defaultValue: '.*.csv',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'minAge',
        type: 'OibNumber',
        translationKey: 'south.items.sftp.min-age',
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
        translationKey: 'south.items.sftp.preserve-file',
        defaultValue: true,
        class: 'col-4',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'ignoreModifiedDate',
        type: 'OibCheckbox',
        translationKey: 'south.items.sftp.ignore-modified-date',
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
