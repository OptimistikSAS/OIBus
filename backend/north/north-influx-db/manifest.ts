import { NorthConnectorManifest } from '../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  name: 'InfluxDB',
  category: 'database',
  description: 'InfluxDB desscription',
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
      defaultValue: '',
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'username',
      type: 'OibText',
      label: 'User',
      defaultValue: '',
      validators: [{ key: 'required' }]
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
      key: 'timestampPathInDataValue',
      type: 'OibText',
      label: 'Timestamp path in data value',
      defaultValue: '',
      newRow: true
    },
    {
      key: 'precision',
      type: 'OibSelect',
      label: 'Precision',
      defaultValue: 'ms',
      options: ['ns', 'u', 'ms', 's', 'm', 'h'],
      validators: [{ key: 'required' }],
      newRow: false
    },
    {
      key: 'regExp',
      type: 'OibText',
      label: 'RegExp',
      defaultValue: '(.*)',
      validators: [{ key: 'required' }]
    },
    {
      key: 'measurement',
      type: 'OibText',
      label: 'Measurement',
      defaultValue: '%1$s',
      validators: [{ key: 'required' }]
    },
    {
      key: 'tags',
      type: 'OibText',
      label: 'Tags',
      defaultValue: '',
      newRow: false,
      validators: [
        { key: 'minLength', params: { minLength: 1 } },
        { key: 'maxLength', params: { maxLength: 255 } }
      ]
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
  ]
};

export default manifest;
