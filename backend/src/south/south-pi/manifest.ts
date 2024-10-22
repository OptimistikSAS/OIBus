import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'osisoft-pi',
  name: 'OSIsoft PI',
  category: 'database',
  description: 'Connect to OIBus agent to retrieve data from OSIsoft PI server',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    history: true,
    forceMaxInstantPerItem: false
  },
  settings: [
    {
      key: 'agentUrl',
      type: 'OibText',
      label: 'Remote agent URL',
      defaultValue: 'http://ip-adress-or-host:2224',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      label: 'Retry interval',
      defaultValue: 1000,
      unitLabel: 'ms',
      class: 'col-3',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }]
    }
  ],
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: false
    },
    settings: [
      {
        key: 'type',
        type: 'OibSelect',
        options: ['pointId', 'pointQuery'],
        label: 'Type',
        defaultValue: 'pointId',
        class: 'col-4',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'piPoint',
        type: 'OibText',
        label: 'Point ID',
        validators: [{ key: 'required' }],
        conditionalDisplay: { field: 'type', values: ['pointId'] },
        newRow: true,
        displayInViewMode: true
      },
      {
        key: 'piQuery',
        type: 'OibTextArea',
        label: 'Point Query',
        defaultValue: '*',
        validators: [{ key: 'required' }],
        conditionalDisplay: { field: 'type', values: ['pointQuery'] },
        newRow: true,
        displayInViewMode: true
      }
    ]
  }
};
export default manifest;
