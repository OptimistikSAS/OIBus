import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  name: 'ADS',
  category: 'iot',
  description: 'ADS description',
  modes: {
    subscription: false,
    lastPoint: true,
    lastFile: false,
    historyPoint: false,
    historyFile: false
  },
  settings: [
    {
      key: 'netId',
      type: 'OibText',
      label: 'Net ID',
      defaultValue: '127.0.0.1.1.1',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      label: 'Port',
      defaultValue: 851,
      newRow: false,
      class: 'col-2',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      readDisplay: true
    },
    {
      key: 'routerAddress',
      type: 'OibText',
      label: 'Router address',
      newRow: true,
      readDisplay: true
    },
    {
      key: 'routerTcpPort',
      type: 'OibNumber',
      label: 'Router TCP port',
      newRow: false,
      class: 'col-2',
      validators: [
        { key: 'min', params: { min: 1 } },
        { key: 'max', params: { max: 65535 } }
      ],
      readDisplay: true
    },
    {
      key: 'clientAmsNetId',
      type: 'OibText',
      label: 'AMS Net ID',
      newRow: true,
      readDisplay: true
    },
    {
      key: 'clientAdsPort',
      type: 'OibNumber',
      label: 'ADS Client port',
      newRow: false,
      class: 'col-2',
      validators: [
        { key: 'min', params: { min: 1 } },
        { key: 'max', params: { max: 65535 } }
      ],
      readDisplay: true
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      label: 'Retry interval (ms)',
      defaultValue: 10000,
      newRow: true,
      class: 'col-2',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 60_000 } }],
      readDisplay: false
    },
    {
      key: 'plcName',
      type: 'OibText',
      label: 'PLC name',
      defaultValue: '',
      newRow: true,
      class: 'col-4',
      readDisplay: true
    },
    {
      key: 'enumAsText',
      type: 'OibSelect',
      options: ['Text', 'Integer'],
      label: 'Enumeration value',
      defaultValue: 'Integer',
      newRow: true,
      class: 'col-4',
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'boolAsText',
      type: 'OibSelect',
      label: 'Boolean value',
      options: ['Text', 'Integer'],
      defaultValue: 'Integer',
      newRow: false,
      class: 'col-4',
      validators: [{ key: 'required' }],
      readDisplay: true
    }
  ],
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: false
    },
    settings: []
  }
};
export default manifest;
