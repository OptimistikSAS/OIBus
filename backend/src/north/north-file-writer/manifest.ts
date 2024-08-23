import Joi from 'joi';
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
  inputData: [
    {
      type: 'file-content',
      data: Joi.string().description('Contents of the file to be created')
    },
    {
      type: 'file-path',
      data: Joi.string().description('Path of a file to be copied over')
    }
  ],
  transformers: [
    {
      type: 'standard',
      inputType: 'time-values',
      outputType: 'file-content'
    },
    {
      type: 'standard',
      inputType: 'raw',
      outputType: 'file-path'
    },
    {
      type: 'custom',
      inputType: 'time-values',
      outputType: 'file-content'
    },
    {
      type: 'custom',
      inputType: 'raw',
      outputType: 'file-content'
    }
  ],
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
      newRow: true,
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
      newRow: false,
      validators: [
        { key: 'minLength', params: { minLength: 1 } },
        { key: 'maxLength', params: { maxLength: 255 } }
      ],
      displayInViewMode: true
    }
  ]
};
export default manifest;
