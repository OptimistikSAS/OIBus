import { NorthConnectorManifest } from '../../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  name: 'OIConnect',
  category: 'oi',
  description: 'OIConnect description',
  modes: {
    files: true,
    points: true
  },
  settings: [
    {
      key: 'host',
      type: 'OibText',
      label: 'Host',
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' } }],
      readDisplay: true
    },
    {
      key: 'acceptUnauthorized',
      type: 'OibCheckbox',
      label: 'Accept unauthorized certificate',
      validators: [{ key: 'required' }],
      defaultValue: false,
      readDisplay: true
    },
    {
      key: 'valuesEndpoint',
      type: 'OibText',
      label: 'Values endpoint',
      defaultValue: '/engine/add-values',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    {
      key: 'fileEndpoint',
      type: 'OibText',
      label: 'File endpoint',
      defaultValue: '/engine/add-file',
      newRow: false,
      validators: [{ key: 'required' }],
      readDisplay: true
    },
    { key: 'timeout', type: 'OibNumber', label: 'Timeout', newRow: true },
    { key: 'proxy', type: 'OibProxy', label: 'Proxy', newRow: true },
    {
      key: 'authentication',
      type: 'OibAuthentication',
      label: 'Authentication',
      newRow: true,
      authTypes: ['none', 'basic', 'bearer', 'api-key']
    }
  ]
};

export default manifest;
