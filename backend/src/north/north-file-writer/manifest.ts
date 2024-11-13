import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'file-writer',
  name: 'File Writer',
  category: 'file',
  description: 'Write files and data to the output folder',
  modes: {
    files: true,
    points: true
  },
  settings: [
    {
      key: 'outputFolder',
      type: 'OibText',
      label: 'Output folder',
      defaultValue: './output',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'prefix',
      type: 'OibText',
      label: 'Prefix',
      defaultValue: '@ConnectorName-',
      validators: [
        { key: 'minLength', params: { minLength: 1 } },
        { key: 'maxLength', params: { maxLength: 255 } }
      ],
      displayInViewMode: true
    },
    {
      key: 'suffix',
      type: 'OibText',
      label: 'Suffix',
      defaultValue: '-@CurrentDate',
      validators: [
        { key: 'minLength', params: { minLength: 1 } },
        { key: 'maxLength', params: { maxLength: 255 } }
      ],
      displayInViewMode: true
    }
  ]
};
export default manifest;
