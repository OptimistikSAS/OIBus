import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'osisoft-pi',
  category: 'database',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: false,
    history: true
  },
  settings: [
    {
      key: 'throttling',
      type: 'OibFormGroup',
      translationKey: 'south.osisoft-pi.throttling.title',
      class: 'col',
      newRow: true,
      displayInViewMode: false,
      validators: [{ key: 'required' }],
      content: [
        {
          key: 'maxReadInterval',
          type: 'OibNumber',
          translationKey: 'south.osisoft-pi.throttling.max-read-interval',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 3600,
          unitLabel: 's',
          displayInViewMode: true
        },
        {
          key: 'readDelay',
          type: 'OibNumber',
          translationKey: 'south.osisoft-pi.throttling.read-delay',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 200,
          unitLabel: 'ms',
          displayInViewMode: true
        },
        {
          key: 'overlap',
          type: 'OibNumber',
          translationKey: 'south.osisoft-pi.throttling.overlap',
          validators: [{ key: 'required' }, { key: 'min', params: { min: 0 } }],
          defaultValue: 0,
          unitLabel: 'ms',
          displayInViewMode: true
        },
        {
          key: 'maxInstantPerItem',
          type: 'OibCheckbox',
          translationKey: 'south.osisoft-pi.throttling.max-instant-per-item',
          defaultValue: false,
          validators: [{ key: 'required' }],
          displayInViewMode: true
        }
      ]
    },
    {
      key: 'agentUrl',
      type: 'OibText',
      translationKey: 'south.osisoft-pi.agent-url',
      defaultValue: 'http://ip-adress-or-host:2224',
      validators: [{ key: 'required' }],
      newRow: true,
      displayInViewMode: true
    },
    {
      key: 'retryInterval',
      type: 'OibNumber',
      translationKey: 'south.osisoft-pi.retry-interval',
      defaultValue: 10_000,
      unitLabel: 'ms',
      class: 'col-3',
      validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 30_000 } }]
    }
  ],
  items: {
    scanMode: 'POLL',
    settings: [
      {
        key: 'type',
        type: 'OibSelect',
        options: ['point-id', 'point-query'],
        translationKey: 'south.items.osisoft-pi.type',
        defaultValue: 'point-id',
        class: 'col-4',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'piPoint',
        type: 'OibText',
        translationKey: 'south.items.osisoft-pi.pi-point',
        validators: [{ key: 'required' }],
        conditionalDisplay: { field: 'type', values: ['point-id'] },
        newRow: true,
        displayInViewMode: true
      },
      {
        key: 'piQuery',
        type: 'OibTextArea',
        translationKey: 'south.items.osisoft-pi.pi-query',
        defaultValue: '*',
        validators: [{ key: 'required' }],
        conditionalDisplay: { field: 'type', values: ['point-query'] },
        newRow: true,
        displayInViewMode: true
      }
    ]
  }
};
export default manifest;
