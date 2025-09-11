import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'opc',
  category: 'iot',
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
        key: 'throttling',
        translationKey: 'configuration.oibus.manifest.south.opc.throttling.title',
        displayProperties: {
          visible: true,
          wrapInBox: false
        },
        enablingConditions: [],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        attributes: [
          {
            type: 'number',
            key: 'maxReadInterval',
            translationKey: 'configuration.oibus.manifest.south.opc.throttling.max-read-interval',
            unit: 's',
            defaultValue: 3600,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              },
              {
                type: 'POSITIVE_INTEGER',
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
            key: 'readDelay',
            translationKey: 'configuration.oibus.manifest.south.opc.throttling.read-delay',
            unit: 'ms',
            defaultValue: 200,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              },
              {
                type: 'POSITIVE_INTEGER',
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
            key: 'overlap',
            translationKey: 'configuration.oibus.manifest.south.opc.throttling.overlap',
            unit: 'ms',
            defaultValue: 0,
            validators: [
              {
                type: 'REQUIRED',
                arguments: []
              },
              {
                type: 'POSITIVE_INTEGER',
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
            type: 'boolean',
            key: 'maxInstantPerItem',
            translationKey: 'configuration.oibus.manifest.south.opc.throttling.max-instant-per-item',
            defaultValue: false,
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
          }
        ]
      },
      {
        type: 'string',
        key: 'agentUrl',
        translationKey: 'configuration.oibus.manifest.south.opc.agent-url',
        defaultValue: 'http://ip-adress-or-host:2224',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 1,
          columns: 9,
          displayInViewMode: false
        }
      },
      {
        type: 'number',
        key: 'retryInterval',
        translationKey: 'configuration.oibus.manifest.south.opc.retry-interval',
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
            arguments: ['30000']
          }
        ],
        displayProperties: {
          row: 1,
          columns: 3,
          displayInViewMode: false
        }
      },
      {
        type: 'string',
        key: 'host',
        defaultValue: 'localhost',
        translationKey: 'configuration.oibus.manifest.south.opc.host',
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 2,
          columns: 8,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'serverName',
        defaultValue: 'Matrikon.OPC.Simulation',
        translationKey: 'configuration.oibus.manifest.south.opc.server-name',
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
        type: 'string-select',
        key: 'mode',
        translationKey: 'configuration.oibus.manifest.south.opc.mode',
        defaultValue: 'hda',
        selectableValues: ['hda', 'da'],
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          }
        ],
        displayProperties: {
          row: 2,
          columns: 2,
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
          enablingConditions: [
            {
              referralPathFromRoot: 'aggregate',
              targetPathFromRoot: 'resampling',
              values: [
                'interpolative',
                'total',
                'average',
                'time-average',
                'count',
                'stdev',
                'minimum-actual-time',
                'minimum',
                'maximum-actual-time',
                'maximum',
                'start',
                'end',
                'delta',
                'reg-slope',
                'reg-const',
                'reg-dev',
                'variance',
                'range',
                'duration-good',
                'duration-bad',
                'percent-good',
                'percent-bad',
                'worst-quality'
              ]
            }
          ],
          validators: [],
          attributes: [
            {
              type: 'string',
              key: 'nodeId',
              translationKey: 'configuration.oibus.manifest.south.items.opc.node-id',
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
              type: 'string-select',
              key: 'aggregate',
              translationKey: 'configuration.oibus.manifest.south.items.opc.aggregate',
              defaultValue: 'raw',
              selectableValues: [
                'raw',
                'interpolative',
                'total',
                'average',
                'time-average',
                'count',
                'stdev',
                'minimum-actual-time',
                'minimum',
                'maximum-actual-time',
                'maximum',
                'start',
                'end',
                'delta',
                'reg-slope',
                'reg-const',
                'reg-dev',
                'variance',
                'range',
                'duration-good',
                'duration-bad',
                'percent-good',
                'percent-bad',
                'worst-quality',
                'annotations'
              ],
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
                columns: 4,
                displayInViewMode: false
              }
            },
            {
              type: 'string-select',
              key: 'resampling',
              translationKey: 'configuration.oibus.manifest.south.items.opc.resampling',
              defaultValue: 'raw',
              selectableValues: ['none', '1s', '10s', '30s', '1min', '1h', '1d'],
              validators: [
                {
                  type: 'REQUIRED',
                  arguments: []
                }
              ],
              displayProperties: {
                row: 0,
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
