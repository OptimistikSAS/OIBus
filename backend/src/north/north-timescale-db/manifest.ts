import { NorthConnectorManifest } from '../../../../shared/model/north-connector.model';
import Joi from 'joi';

const manifest: NorthConnectorManifest = {
  name: 'TimescaleDB',
  category: 'database',
  description: 'TimescaleDB description',
  modes: {
    files: false,
    points: true
  },
  settings: [
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
      ],
      readDisplay: false
    },
    {
      key: 'host',
      type: 'OibText',
      label: 'Host',
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' } }],
      newRow: true,
      readDisplay: true
    },
    {
      key: 'database',
      type: 'OibText',
      newRow: false,
      label: 'Database',
      defaultValue: '',
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'regExp',
      type: 'OibText',
      label: 'RegExp',
      defaultValue: '(.*)',
      validators: [{ key: 'required' }]
    },
    {
      key: 'table',
      type: 'OibText',
      label: 'Table',
      defaultValue: '%1$s',
      validators: [{ key: 'required' }]
    },
    {
      key: 'optFields',
      type: 'OibText',
      label: 'Optional fields',
      defaultValue: '',
      newRow: false,
      validators: [
        { key: 'minLength', params: { minLength: 1 } },
        { key: 'maxLength', params: { maxLength: 255 } }
      ]
    },
    {
      key: 'timestampPathInDataValue',
      type: 'OibText',
      label: 'Timestamp path in data value',
      defaultValue: '',
      newRow: true
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
      label: 'Key parent value',
      defaultValue: ''
    }
  ],
  schema: Joi.object({
    username: Joi.string().required(),
    password: Joi.string().min(1).max(255),
    host: Joi.string()
      .required()
      .uri({ scheme: ['http', 'https', 'HTTP', 'HTTPS'] }),
    database: Joi.string().required(),
    regExp: Joi.string().required(),
    table: Joi.string().required(),
    optFields: Joi.string().min(1).max(255),
    timestampPathInDataValue: Joi.string().allow(''),
    useDataKeyValue: Joi.boolean().required().falsy(0).truthy(1),
    keyParentValue: Joi.string().allow('')
  })
};

export default manifest;
