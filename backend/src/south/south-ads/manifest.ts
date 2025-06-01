import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'ads',
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
        key: 'netId',
        translationKey: 'configuration.oibus.manifest.south.ads.net-id',
        defaultValue: '127.0.0.1.1.1',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: {
          row: 0,
          columns: 8,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'port',
        translationKey: 'configuration.oibus.manifest.south.ads.port',
        unit: null,
        defaultValue: 851,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          { type: 'MINIMUM', arguments: ['1'] },
          { type: 'MAXIMUM', arguments: ['65535'] }
        ],
        displayProperties: {
          row: 0,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'routerAddress',
        translationKey: 'configuration.oibus.manifest.south.ads.router-address',
        defaultValue: null,
        validators: [],
        displayProperties: {
          row: 1,
          columns: 8,
          displayInViewMode: true
        }
      },
      {
        type: 'number',
        key: 'routerTcpPort',
        translationKey: 'configuration.oibus.manifest.south.ads.router-tcp-port',
        unit: null,
        defaultValue: null,
        validators: [
          { type: 'MINIMUM', arguments: ['1'] },
          { type: 'MAXIMUM', arguments: ['65535'] }
        ],
        displayProperties: {
          row: 1,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'clientAmsNetId',
        translationKey: 'configuration.oibus.manifest.south.ads.client-ams-net-id',
        defaultValue: null,
        validators: [],
        displayProperties: {
          row: 2,
          columns: 8,
          displayInViewMode: true
        }
      },
      {
        key: 'clientAdsPort',
        type: 'number',
        translationKey: 'configuration.oibus.manifest.south.ads.client-ads-port',
        unit: null,
        defaultValue: null,
        validators: [
          { type: 'MINIMUM', arguments: ['1'] },
          { type: 'MAXIMUM', arguments: ['65535'] }
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
        translationKey: 'configuration.oibus.manifest.south.ads.retry-interval',
        unit: 'ms',
        defaultValue: 10_000,
        validators: [
          {
            type: 'REQUIRED',
            arguments: []
          },
          { type: 'MINIMUM', arguments: ['100'] },
          { type: 'MAXIMUM', arguments: ['60000'] }
        ],
        displayProperties: {
          row: 3,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string',
        key: 'plcName',
        translationKey: 'configuration.oibus.manifest.south.ads.plc-name',
        defaultValue: null,
        validators: [],
        displayProperties: {
          row: 4,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string-select',
        key: 'enumAsText',
        selectableValues: ['text', 'integer'],
        translationKey: 'configuration.oibus.manifest.south.ads.enum-as-text',
        defaultValue: 'integer',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: {
          row: 4,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'string-select',
        key: 'boolAsText',
        translationKey: 'configuration.oibus.manifest.south.ads.bool-as-text',
        selectableValues: ['text', 'integer'],
        defaultValue: 'integer',
        validators: [{ type: 'REQUIRED', arguments: [] }],
        displayProperties: {
          row: 4,
          columns: 4,
          displayInViewMode: true
        }
      },
      {
        type: 'array',
        key: 'structureFiltering',
        translationKey: 'configuration.oibus.manifest.south.ads.structure-filtering',
        paginate: false,
        numberOfElementPerPage: 0,
        validators: [],
        rootAttribute: {
          type: 'object',
          key: 'structureFiltering',
          translationKey: 'configuration.oibus.manifest.south.ads.structure-filtering.structure',
          enablingConditions: [],
          validators: [],
          displayProperties: {
            visible: true,
            wrapInBox: false
          },
          attributes: [
            {
              type: 'string',
              key: 'name',
              translationKey: 'configuration.oibus.manifest.south.ads.structure-filtering.name',
              defaultValue: null,
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
              type: 'string',
              key: 'fields',
              translationKey: 'configuration.oibus.manifest.south.ads.structure-filtering.fields',
              defaultValue: null,
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
          key: 'scanModeId',
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
              translationKey: 'configuration.oibus.manifest.south.items.ads.address',
              defaultValue: null,
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
            }
          ]
        }
      ]
    }
  }
};
export default manifest;
