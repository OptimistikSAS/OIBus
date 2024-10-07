import { SouthConnectorManifest } from '../../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'folder-scanner',
  name: 'Folder Scanner',
  category: 'file',
  description: 'Read files from a local or remote folder',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: true,
    history: false,
    forceMaxInstantPerItem: false,
    sharedConnection: false
  },
  settings: [
    {
      key: 'inputFolder',
      type: 'OibText',
      label: 'Input folder',
      defaultValue: './input/',
      newRow: true,
      class: 'col-12',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'compression',
      type: 'OibCheckbox',
      label: 'Compress file',
      defaultValue: false,
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    }
  ],
  items: {
    scanMode: {
      acceptSubscription: false,
      subscriptionOnly: false
    },
    settings: [
      {
        key: 'regex',
        type: 'OibText',
        label: 'RegExp',
        defaultValue: '.txt',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'minAge',
        type: 'OibNumber',
        label: 'Minimum Age',
        unitLabel: 'ms',
        defaultValue: 1000,
        newRow: true,
        class: 'col-4',
        validators: [{ key: 'required' }, { key: 'min', params: { min: 100 } }, { key: 'max', params: { max: 3_600_000 } }],
        displayInViewMode: true
      },
      {
        key: 'preserveFiles',
        type: 'OibCheckbox',
        label: 'Preserve file',
        defaultValue: true,
        class: 'col-4',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'ignoreModifiedDate',
        type: 'OibCheckbox',
        label: 'Ignore modified date',
        defaultValue: false,
        class: 'col-4',
        conditionalDisplay: { field: 'preserveFiles', values: [true] },
        validators: [{ key: 'required' }],
        displayInViewMode: false
      }
    ]
  }
};
export default manifest;
