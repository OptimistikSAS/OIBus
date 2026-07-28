import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 's7',
  category: 'iot',
  modes: {
    subscription: false,
    lastPoint: true,
    lastFile: false,
    history: false
  },
  settings: {
    type: 'object',
    key: 'settings',
    translationKey: 'configuration.oibus.manifest.south.settings',
    displayProperties: {
      visible: true,
      wrapInBox: false
    },
    enablingConditions: [],
    validators: [],
    attributes: [
      {
        type: 'string',
        key: 'host',
        translationKey: 'configuration.oibus.manifest.south.s7.host',
        defaultValue: '127.0.0.1',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 0,
          columns: 6,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'port',
        translationKey: 'configuration.oibus.manifest.south.s7.port',
        defaultValue: 102,
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
        key: 'connectionType',
        translationKey: 'configuration.oibus.manifest.south.s7.connection-type',
        defaultValue: 'PG',
        selectableValues: ['PG', 'OP', 'S7Basic'],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 0,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'rack',
        translationKey: 'configuration.oibus.manifest.south.s7.rack',
        defaultValue: 0,
        unit: null,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'MINIMUM',
            arguments: ['0']
          }
        ],
        displayProperties: {
          row: 1,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'slot',
        translationKey: 'configuration.oibus.manifest.south.s7.slot',
        defaultValue: 1,
        unit: null,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'MINIMUM',
            arguments: ['0']
          }
        ],
        displayProperties: {
          row: 1,
          columns: 3,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'connectTimeout',
        translationKey: 'configuration.oibus.manifest.south.s7.connect-timeout',
        unit: 'ms',
        defaultValue: 10000,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'MINIMUM',
            arguments: ['100']
          },
          {
            type: 'MAXIMUM',
            arguments: ['60000']
          }
        ],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'requestTimeout',
        translationKey: 'configuration.oibus.manifest.south.s7.request-timeout',
        unit: 'ms',
        defaultValue: 15000,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'MINIMUM',
            arguments: ['100']
          },
          {
            type: 'MAXIMUM',
            arguments: ['60000']
          }
        ],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'retryInterval',
        translationKey: 'configuration.oibus.manifest.south.s7.retry-interval',
        unit: 'ms',
        defaultValue: 10000,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          {
            type: 'MINIMUM',
            arguments: ['100']
          },
          {
            type: 'MAXIMUM',
            arguments: ['60000']
          }
        ],
        displayProperties: {
          row: 2,
          columns: 4,
          displayInViewMode: true
        }
      }
    ]
  },
  items: {
    type: 'array',
    key: 'items',
    translationKey: 'configuration.oibus.manifest.south.items',
    paginate: true,
    numberOfElementPerPage: 20,
    validators: [],
    rootAttribute: {
      type: 'object',
      key: 'item',
      translationKey: 'configuration.oibus.manifest.south.items.item',
      displayProperties: {
        visible: true,
        wrapInBox: false
      },
      enablingConditions: [],
      validators: [],
      attributes: [
        {
          type: 'string',
          key: 'name',
          translationKey: 'configuration.oibus.manifest.south.items.name',
          defaultValue: null,
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 0,
            columns: 4,
            displayInViewMode: true
          }
        },
        {
          type: 'boolean',
          key: 'enabled',
          translationKey: 'configuration.oibus.manifest.south.items.enabled',
          defaultValue: true,
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 0,
            columns: 4,
            displayInViewMode: true
          }
        },
        {
          type: 'scan-mode',
          key: 'scanMode',
          acceptableType: 'POLL',
          translationKey: 'configuration.oibus.manifest.south.items.scan-mode',
          validators: [
            {
              type: 'REQUIRED',
              arguments: []
            }
          ],
          displayProperties: {
            row: 0,
            columns: 4,
            displayInViewMode: true
          }
        },
        {
          type: 'object',
          key: 'settings',
          translationKey: 'configuration.oibus.manifest.south.items.settings',
          displayProperties: {
            visible: true,
            wrapInBox: true
          },
          enablingConditions: [],
          validators: [],
          attributes: [
            {
              type: 'string',
              key: 'address',
              translationKey: 'configuration.oibus.manifest.south.items.s7.address',
              defaultValue: 'DB1,REAL0',
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 6,
                displayInViewMode: true
              }
            }
          ]
        }
      ]
    }
  }
};
export default manifest;
