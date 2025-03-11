import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'sftp',
  category: 'file',
  types: ['raw'],
  settings: [
    {
      key: 'host',
      type: 'OibText',
      translationKey: 'north.sftp.host',
      validators: [{ key: 'required' }],
      defaultValue: '127.0.0.1',
      displayInViewMode: true,
      newRow: true,
      class: 'col-9'
    },
    {
      key: 'port',
      type: 'OibNumber',
      translationKey: 'north.sftp.port',
      defaultValue: 8080,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true,
      class: 'col-3'
    },
    {
      key: 'authentication',
      type: 'OibSelect',
      options: ['password', 'private-key'],
      translationKey: 'north.sftp.authentication',
      defaultValue: 'password',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true,
      class: 'col-6'
    },
    {
      key: 'username',
      type: 'OibText',
      translationKey: 'north.sftp.username',
      defaultValue: '',
      newRow: true,
      displayInViewMode: false,
      class: 'col-4'
    },
    {
      key: 'password',
      type: 'OibSecret',
      translationKey: 'north.sftp.password',
      defaultValue: '',
      displayInViewMode: false,
      conditionalDisplay: { field: 'authentication', values: ['password'] },
      class: 'col-4'
    },
    {
      key: 'privateKey',
      type: 'OibText',
      translationKey: 'north.sftp.private-key',
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'authentication', values: ['private-key'] },
      displayInViewMode: false,
      class: 'col-4'
    },
    {
      key: 'passphrase',
      type: 'OibSecret',
      translationKey: 'north.sftp.passphrase',
      conditionalDisplay: { field: 'authentication', values: ['private-key'] },
      displayInViewMode: false,
      class: 'col-4'
    },
    {
      key: 'remoteFolder',
      type: 'OibText',
      translationKey: 'north.sftp.remote-folder',
      defaultValue: '/remote-folder',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'prefix',
      type: 'OibText',
      translationKey: 'north.sftp.prefix',
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
      translationKey: 'north.sftp.suffix',
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
