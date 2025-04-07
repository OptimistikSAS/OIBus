import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'file-writer',
  category: 'file',
  types: ['any'],
  settings: [
    {
      key: 'outputFolder',
      type: 'OibText',
      translationKey: 'north.file-writer.output-folder',
      defaultValue: './output',
      newRow: true,
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'prefix',
      type: 'OibText',
      translationKey: 'north.file-writer.prefix',
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
      translationKey: 'north.file-writer.suffix',
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
