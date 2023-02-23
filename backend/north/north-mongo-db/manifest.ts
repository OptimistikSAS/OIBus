import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';
import Joi from 'joi';

const manifest: NorthConnectorManifest = {
  name: 'MongoDB',
  category: 'database',
  description: 'MongoDB description',
  modes: {
    files: false,
    points: true
  },
  settings: [
    {
      key: 'host',
      type: 'OibText',
      label: 'Host',
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' } }],
      defaultValue: 'http://localhost:8086',
      newRow: true,
      readDisplay: true
    },
    {
      key: 'database',
      type: 'OibText',
      newRow: false,
      label: 'Database',
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'username',
      type: 'OibText',
      label: 'User',
      defaultValue: '',
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'password',
      type: 'OibSecret',
      label: 'Password',
      defaultValue: '',
      newRow: false,
      validators: [
        { key: 'minLength', params: { minLength: 1 } },
        { key: 'maxLength', params: { maxLength: 255 } }
      ]
    },
    {
      key: 'regExp',
      type: 'OibText',
      label: 'RegExp',
      defaultValue: '(.*)',
      validators: [{ key: 'required' }],
      newRow: true
    },
    {
      key: 'collection',
      type: 'OibText',
      label: 'Collection',
      defaultValue: '%1$s',
      validators: [{ key: 'required' }]
    },
    {
      key: 'indexFields',
      type: 'OibText',
      label: 'Index fields',
      defaultValue: '',
      newRow: false,
      validators: [
        { key: 'minLength', params: { minLength: 1 } },
        { key: 'maxLength', params: { maxLength: 255 } }
      ]
    },
    {
      key: 'createCollection',
      type: 'OibCheckbox',
      label: 'Create collection if it does not exist',
      defaultValue: false,
      validators: [{ key: 'required' }]
    },
    {
      key: 'timestampKey',
      type: 'OibText',
      label: 'Timestamp key',
      defaultValue: 'timestamp',
      newRow: false,
      validators: [{ key: 'required' }]
    },
    {
      key: 'useDataKeyValue',
      type: 'OibCheckbox',
      label: 'Use key "value" of Json "data"',
      defaultValue: false,
      validators: [{ key: 'required' }]
    },
    {
      key: 'keyParentValue',
      type: 'OibText',
      label: 'Key parent value'
    },
    {
      key: 'timestampPathInDataValue',
      type: 'OibText',
      label: 'Timestamp path in data value'
    }
  ],
  schema: Joi.object({
    host: Joi.string()
      .required()
      .uri({ scheme: ['http', 'https', 'HTTP', 'HTTPS'] }),
    database: Joi.string().required(),
    username: Joi.string().required(),
    password: Joi.string().min(1).max(255),
    regExp: Joi.string().required(),
    collection: Joi.string().required(),
    indexFields: Joi.string().min(1).max(255),
    createCollection: Joi.boolean().required(),
    timestampKey: Joi.string().required(),
    useDataKeyValue: Joi.boolean().required(),
    keyParentValue: Joi.string(),
    timestampPathInDataValue: Joi.string()
  })
};

export default manifest;
