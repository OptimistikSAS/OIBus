import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'sftp',
  category: 'file',
  types: ['any'],
  settings: {
    type: 'object',
    key: 'settings',
    translationKey: 'configuration.oibus.manifest.north.settings',
    displayProperties: {
      visible: true,
      wrapInBox: false
    },
    enablingConditions: [
      {
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'password',
        values: ['password']
      },
      {
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'privateKey',
        values: ['private-key']
      },
      {
        referralPathFromRoot: 'authentication',
        targetPathFromRoot: 'passphrase',
        values: ['private-key']
      }
    ],
    validators: [],
    attributes: [
      {
        type: 'string',
        key: 'host',
        translationKey: 'configuration.oibus.manifest.north.sftp.host',
        defaultValue: '127.0.0.1',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 0,
          columns: 9,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'port',
        translationKey: 'configuration.oibus.manifest.north.sftp.port',
        defaultValue: 8080,
        unit: null,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'MINIMUM',
            arguments: ['1']
          },
          {
            type: 'MAXIMUM',
            arguments: ['65535']
          }
        ],
        displayProperties: {
          row: 0,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'string-select',
        key: 'authentication',
        translationKey: 'configuration.oibus.manifest.north.sftp.authentication',
        defaultValue: 'password',
        selectableValues: ['password', 'private-key'],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 1,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'username',
        translationKey: 'configuration.oibus.manifest.north.sftp.username',
        defaultValue: null,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'secret',
        key: 'password',
        translationKey: 'configuration.oibus.manifest.north.sftp.password',
        validators: [],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'privateKey',
        translationKey: 'configuration.oibus.manifest.north.sftp.private-key',
        defaultValue: null,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'secret',
        key: 'passphrase',
        translationKey: 'configuration.oibus.manifest.north.sftp.passphrase',
        validators: [],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'remoteFolder',
        translationKey: 'configuration.oibus.manifest.north.sftp.remote-folder',
        defaultValue: '/remote-folder',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 3,
          columns: 12,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'prefix',
        translationKey: 'configuration.oibus.manifest.north.sftp.prefix',
        defaultValue: '@ConnectorName-',
        validators: [],
        displayProperties: {
          row: 4,
          columns: 6,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'suffix',
        translationKey: 'configuration.oibus.manifest.north.sftp.suffix',
        defaultValue: '-@CurrentDate',
        validators: [],
        displayProperties: {
          row: 4,
          columns: 6,
          displayInViewMode: true
        }
      }
    ]
  }
};
export default manifest;
