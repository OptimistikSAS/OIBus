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
  settings: [
    {
      key: 'netId',
      type: 'OibText',
      translationKey: 'south.ads.net-id',
      defaultValue: '127.0.0.1.1.1',
      newRow: true,
      class: 'col-8',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      translationKey: 'south.ads.port',
      defaultValue: 851,
      newRow: false,
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true
    },
    {
      key: 'routerAddress',
      type: 'OibText',
      translationKey: 'south.ads.router-address',
      newRow: true,
      class: 'col-8',
      displayInViewMode: true
    },
    {
      key: 'routerTcpPort',
      type: 'OibNumber',
      translationKey: 'south.ads.router-tcp-port',
      newRow: false,
      class: 'col-4',
      validators: [
        { key: 'min', params: { min: 1 } },
        { key: 'max', params: { max: 65535 } }
      ],
      displayInViewMode: true
    },
    {
      key: 'clientAmsNetId',
      type: 'OibText',
      translationKey: 'south.ads.client-ams-net-id',
      newRow: true,
      class: 'col-8',
      displayInViewMode: true
    },
    {
      key: 'clientAdsPort',
      type: 'OibNumber',
      translationKey: 'south.ads.client-ads-port',
      newRow: false,
      class: 'col-4',
      validators: [
        { key: 'min', params: { min: 1 } },
        { key: 'max', params: { max: 65535 } }
      ],
      displayInViewMode: true
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      translationKey: 'south.ads.retry-interval',
      unitLabel: 'ms',
      defaultValue: 10_000,
      newRow: true,
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 60_000 } }],
      displayInViewMode: false
    },
    {
      key: 'plcName',
      type: 'OibText',
      translationKey: 'south.ads.plc-name',
      defaultValue: '',
      newRow: true,
      class: 'col-4',
      displayInViewMode: true
    },
    {
      key: 'enumAsText',
      type: 'OibSelect',
      options: ['text', 'integer'],
      translationKey: 'south.ads.enum-as-text',
      defaultValue: 'integer',
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'boolAsText',
      type: 'OibSelect',
      translationKey: 'south.ads.bool-as-text',
      options: ['text', 'integer'],
      defaultValue: 'integer',
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'structureFiltering',
      type: 'OibArray',
      translationKey: 'south.ads.structure-filtering.structure',
      content: [
        {
          key: 'name',
          translationKey: 'south.ads.structure-filtering.name',
          type: 'OibText',
          defaultValue: '',
          validators: [{ key: 'required' }],
          displayInViewMode: true
        },
        {
          key: 'fields',
          translationKey: 'south.ads.structure-filtering.fields',
          type: 'OibText',
          defaultValue: '',
          validators: [{ key: 'required' }],
          displayInViewMode: true
        }
      ],
      class: 'col',
      newRow: true,
      displayInViewMode: false
    }
  ],
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: false
    },
    settings: [
      {
        key: 'address',
        type: 'OibText',
        translationKey: 'south.items.ads.address',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      }
    ]
  }
};
export default manifest;
