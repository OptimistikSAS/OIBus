import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'metroscope-lithium',
  category: 'api',
  modes: {
    files: false,
    points: true
  },
  settings: [
    {
      key: 'endpoint',
      type: 'OibText',
      newRow: true,
      translationKey: 'north.metroscope-lithium.endpoint',
      defaultValue: 'https://lithium.metroscope.io/api/open/import',
      displayInViewMode: true,
      validators: [{ key: 'required' }]
    },
    {
      key: 'apiKey',
      type: 'OibSecret',
      translationKey: 'north.metroscope-lithium.api-key',
      defaultValue: '',
      displayInViewMode: false,
      validators: [{ key: 'required' }]
    },
    {
      key: 'sourceId',
      type: 'OibText',
      translationKey: 'north.metroscope-lithium.source-id',
      defaultValue: 'oibus',
      displayInViewMode: true,
      validators: [{ key: 'required' }],
      class: 'col-6'
    },
    {
      key: 'group',
      type: 'OibText',
      translationKey: 'north.metroscope-lithium.group',
      defaultValue: 'cycle',
      displayInViewMode: true,
      validators: [{ key: 'required' }],
      class: 'col-6'
    },
    {
      key: 'label',
      type: 'OibText',
      translationKey: 'north.metroscope-lithium.label',
      defaultValue: '',
      displayInViewMode: true,
      class: 'col-6'
    },
    {
      key: 'timeout',
      type: 'OibNumber',
      translationKey: 'north.metroscope-lithium.timeout',
      defaultValue: 30,
      unitLabel: 's',
      validators: [{ key: 'required' }],
      class: 'col-6'
    },
    {
      key: 'useProxy',
      translationKey: 'north.metroscope-lithium.use-proxy',
      type: 'OibCheckbox',
      newRow: true,
      defaultValue: false,
      displayInViewMode: true,
      validators: [{ key: 'required' }]
    },
    {
      key: 'proxyUrl',
      translationKey: 'north.metroscope-lithium.proxy-url',
      type: 'OibText',
      validators: [{ key: 'required' }],
      conditionalDisplay: { field: 'useProxy', values: [true] }
    },
    {
      key: 'proxyUsername',
      translationKey: 'north.metroscope-lithium.proxy-username',
      type: 'OibText',
      conditionalDisplay: { field: 'useProxy', values: [true] }
    },
    {
      key: 'proxyPassword',
      translationKey: 'north.metroscope-lithium.proxy-password',
      type: 'OibSecret',
      conditionalDisplay: { field: 'useProxy', values: [true] }
    }
  ]
};

export default manifest;
