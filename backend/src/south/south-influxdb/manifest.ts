import { SouthConnectorManifest } from '../../../shared/model/connector/south-manifest.model';

const manifest: SouthConnectorManifest = {
  id: 'influxdb',
  category: 'database',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    history: true
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
        type: 'object',
        key: 'connectionSettings',
        translationKey: 'configuration.oibus.manifest.south.influxdb.connection-settings.title',
        displayProperties: {
          visible: true,
          wrapInBox: true
        },
        enablingConditions: [
          {
            referralPathFromRoot: 'version',
            targetPathFromRoot: 'host',
            values: ['1']
          },
          {
            referralPathFromRoot: 'version',
            targetPathFromRoot: 'port',
            values: ['1']
          },
          {
            referralPathFromRoot: 'version',
            targetPathFromRoot: 'protocol',
            values: ['1']
          },
          {
            referralPathFromRoot: 'version',
            targetPathFromRoot: 'database',
            values: ['1', '3']
          },
          {
            referralPathFromRoot: 'version',
            targetPathFromRoot: 'username',
            values: ['1']
          },
          {
            referralPathFromRoot: 'version',
            targetPathFromRoot: 'password',
            values: ['1']
          },
          {
            referralPathFromRoot: 'version',
            targetPathFromRoot: 'url',
            values: ['2', '3']
          },
          {
            referralPathFromRoot: 'version',
            targetPathFromRoot: 'token',
            values: ['2', '3']
          },
          {
            referralPathFromRoot: 'version',
            targetPathFromRoot: 'organisation',
            values: ['2']
          },
          {
            referralPathFromRoot: 'version',
            targetPathFromRoot: 'bucket',
            values: ['2']
          }
        ],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        attributes: [
          {
            type: 'string-select',
            key: 'version',
            translationKey: 'configuration.oibus.manifest.south.influxdb.connection-settings.version',
            defaultValue: '1',
            selectableValues: ['1', '2', '3'],
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
            type: 'string',
            key: 'host',
            translationKey: 'configuration.oibus.manifest.south.influxdb.connection-settings.host',
            defaultValue: 'localhost',
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 1,
              columns: 5,
              displayInViewMode: true
            }
          },
          {
            type: 'number',
            key: 'port',
            translationKey: 'configuration.oibus.manifest.south.influxdb.connection-settings.port',
            defaultValue: 8086,
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
              row: 1,
              columns: 4,
              displayInViewMode: true
            }
          },
          {
            type: 'string-select',
            key: 'protocol',
            translationKey: 'configuration.oibus.manifest.south.influxdb.connection-settings.protocol',
            defaultValue: 'http',
            selectableValues: ['http', 'https'],
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 1,
              columns: 3,
              displayInViewMode: true
            }
          },
          {
            type: 'string',
            key: 'database',
            translationKey: 'configuration.oibus.manifest.south.influxdb.connection-settings.database',
            defaultValue: null,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 2,
              columns: 6,
              displayInViewMode: true
            }
          },
          {
            type: 'string',
            key: 'username',
            translationKey: 'configuration.oibus.manifest.south.influxdb.connection-settings.username',
            defaultValue: null,
            validators: [],
            displayProperties: {
              row: 3,
              columns: 6,
              displayInViewMode: true
            }
          },
          {
            type: 'secret',
            key: 'password',
            translationKey: 'configuration.oibus.manifest.south.influxdb.connection-settings.password',
            validators: [],
            displayProperties: {
              row: 3,
              columns: 6,
              displayInViewMode: false
            }
          },
          {
            type: 'string',
            key: 'url',
            translationKey: 'configuration.oibus.manifest.south.influxdb.connection-settings.url',
            defaultValue: 'http://localhost:8086',
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 1,
              columns: 9,
              displayInViewMode: true
            }
          },
          {
            type: 'secret',
            key: 'token',
            translationKey: 'configuration.oibus.manifest.south.influxdb.connection-settings.token',
            validators: [],
            displayProperties: {
              row: 2,
              columns: 6,
              displayInViewMode: false
            }
          },
          {
            type: 'string',
            key: 'organisation',
            translationKey: 'configuration.oibus.manifest.south.influxdb.connection-settings.organisation',
            defaultValue: null,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 3,
              columns: 6,
              displayInViewMode: true
            }
          },
          {
            type: 'string',
            key: 'bucket',
            translationKey: 'configuration.oibus.manifest.south.influxdb.connection-settings.bucket',
            defaultValue: null,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              }
            ],
            displayProperties: {
              row: 3,
              columns: 6,
              displayInViewMode: true
            }
          }
        ]
      },
      {
        type: 'number',
        key: 'maxParallelRun',
        translationKey: 'configuration.oibus.manifest.south.influxdb.max-parallel-run',
        unit: null,
        defaultValue: 1,
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
            arguments: ['8']
          }
        ],
        displayProperties: {
          row: 1,
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
              type: 'code',
              key: 'query',
              contentType: 'sql',
              translationKey: 'configuration.oibus.manifest.south.items.influxdb.query',
              defaultValue: "SELECT * FROM measurement WHERE time > '@StartTime' AND time <= '@EndTime'",
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 12,
                displayInViewMode: true
              }
            },
            {
              type: 'number',
              key: 'requestTimeout',
              translationKey: 'configuration.oibus.manifest.south.items.influxdb.request-timeout',
              unit: 'ms',
              defaultValue: 15000,
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 1,
                columns: 4,
                displayInViewMode: false
              }
            }
          ]
        }
      ]
    }
  }
};

export default manifest;
