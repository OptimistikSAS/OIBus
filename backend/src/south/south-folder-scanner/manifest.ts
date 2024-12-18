import { SouthConnectorManifest } from '../../../shared/model/south-connector.model';

const manifest: SouthConnectorManifest = {
  id: 'folder-scanner',
  category: 'file',
  modes: {
    subscription: false,
    lastPoint: false,
    lastFile: true,
    history: false
  },
  settings: [
    {
      key: 'inputFolder',
      type: 'OibText',
      translationKey: 'south.folder-scanner.input-folder',
      defaultValue: './input/',
      newRow: true,
      class: 'col-12',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'compression',
      type: 'OibCheckbox',
      translationKey: 'south.folder-scanner.compression',
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
        translationKey: 'south.items.folder-scanner.regex',
        defaultValue: '.txt',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'minAge',
        type: 'OibNumber',
        translationKey: 'south.items.folder-scanner.min-age',
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
        translationKey: 'south.items.folder-scanner.preserve-files',
        defaultValue: true,
        class: 'col-4',
        validators: [{ key: 'required' }],
        displayInViewMode: true
      },
      {
        key: 'ignoreModifiedDate',
        type: 'OibCheckbox',
        translationKey: 'south.items.folder-scanner.ignore-modified-date',
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
