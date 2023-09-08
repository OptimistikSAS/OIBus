import { NorthConnectorManifest } from '../../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'file-writer',
  name: 'File Writer',
  category: 'file',
  description: 'Write files and values into an output folder',
  modes: {
    files: true,
    points: true,
    items: false
  },
  settings: [
    {
      key: 'outputFolder',
      type: 'OibText',
      label: 'Output folder',
      defaultValue: './output',
      newRow: true,
      validators: [{ key: 'required' }]
    },
    {
      key: 'prefix',
      type: 'OibText',
      label: 'Prefix',
      defaultValue: '',
      newRow: true,
      validators: [
        { key: 'minLength', params: { minLength: 1 } },
        { key: 'maxLength', params: { maxLength: 255 } }
      ]
    },
    {
      key: 'suffix',
      type: 'OibText',
      label: 'Suffix',
      defaultValue: '',
      newRow: false,
      validators: [
        { key: 'minLength', params: { minLength: 1 } },
        { key: 'maxLength', params: { maxLength: 255 } }
      ]
    }
  ]
};
export default manifest;
