import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'ads',
  name: 'ADS',
  category: 'iot',
  description: 'The ADS protocol (Automation Device Specification) is a transport layer within TwinCAT systems, developed by Beckhoff.',
  modes: {
    subscription: false,
    lastPoint: true,
    lastFile: false,
    history: false,
    forceMaxInstantPerItem: false
  },
  settings: [
    {
      key: 'netId',
      type: 'OibText',
      label: 'Net ID',
      defaultValue: '127.0.0.1.1.1',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'port',
      type: 'OibNumber',
      label: 'PLC Port',
      defaultValue: 851,
      newRow: false,
      class: 'col-2',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 65535 } }],
      displayInViewMode: true
    },
    {
      key: 'routerAddress',
      type: 'OibText',
      label: 'Router address',
      newRow: true,
      displayInViewMode: true
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
      displayInViewMode: true
    },
    {
      key: 'clientAmsNetId',
      type: 'OibText',
      label: 'AMS Net ID',
      newRow: true,
      displayInViewMode: true
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
      displayInViewMode: true
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      label: 'Retry interval',
      unitLabel: 'ms',
      defaultValue: 10000,
      newRow: true,
      class: 'col-4',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 60_000 } }],
      displayInViewMode: false
    },
    {
      key: 'plcName',
      type: 'OibText',
      label: 'PLC name',
      defaultValue: '',
      newRow: true,
      class: 'col-4',
      displayInViewMode: true
    },
    {
      key: 'enumAsText',
      type: 'OibSelect',
      options: ['Text', 'Integer'],
      label: 'Enumeration value',
      defaultValue: 'Integer',
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'boolAsText',
      type: 'OibSelect',
      label: 'Boolean value',
      options: ['Text', 'Integer'],
      defaultValue: 'Integer',
      class: 'col-4',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'structureFiltering',
      type: 'OibArray',
      label: 'Structure filtering',
      content: [
        {
          key: 'name',
          label: 'Structure name',
          type: 'OibText',
          defaultValue: '',
          validators: [{ key: 'required' }],
          displayInViewMode: true
        },
        {
          key: 'fields',
          label: 'Fields to keep (comma separated)',
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
        label: 'Address',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      }
    ]
  }
};
export default manifest;
