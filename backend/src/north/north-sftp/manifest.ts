import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'sftp',
  name: 'SFTP',
  category: 'file',
  description: 'Write files and values into a SFTP server',
  modes: {
    files: true,
    points: true
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
      key: 'remoteFolder',
      type: 'OibText',
      label: 'Remote folder',
      defaultValue: '/remote-folder',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'prefix',
      type: 'OibText',
      label: 'Prefix',
      defaultValue: '@ConnectorName-',
      newRow: true,
      validators: [
        { key: 'minLength', params: { minLength: 1 } },
        { key: 'maxLength', params: { maxLength: 255 } }
      ],
      displayInViewMode: true
    },
    {
      key: 'suffix',
      type: 'OibText',
      label: 'Suffix',
      defaultValue: '-@CurrentDate',
      newRow: false,
      validators: [
        { key: 'minLength', params: { minLength: 1 } },
        { key: 'maxLength', params: { maxLength: 255 } }
      ],
      displayInViewMode: true
    }
  ]
};
export default manifest;
