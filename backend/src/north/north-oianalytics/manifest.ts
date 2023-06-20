import { NorthConnectorManifest } from '../../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  id: 'oianalytics',
  name: 'OIAnalytics',
  category: 'oi',
  description: 'Send files and values to OIAnalytics application',
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
      defaultValue: 'https://instance_name.oianalytics.fr',
      readDisplay: true
    },
    {
      key: 'authentication',
      type: 'OibAuthentication',
      label: 'Authentication',
      newRow: true,
      authTypes: ['none', 'basic'],
      defaultValue: { type: 'basic', password: '', username: '' }
    },
    { key: 'timeout', type: 'OibNumber', label: 'Timeout', newRow: true, defaultValue: 30_000 },
    { key: 'proxy', type: 'OibProxy', label: 'Proxy' },
    {
      key: 'acceptUnauthorized',
      type: 'OibCheckbox',
      label: 'Accept unauthorized certificate',
      validators: [{ key: 'required' }],
      defaultValue: false,
      readDisplay: true
    }
  ]
};
export default manifest;
