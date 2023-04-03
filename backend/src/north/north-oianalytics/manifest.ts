import { NorthConnectorManifest } from '../../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  name: 'OIAnalytics',
  category: 'oi',
  description: 'OIAnalytics description',
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
    { key: 'timeout', type: 'OibNumber', label: 'Timeout', newRow: true },
    { key: 'proxy', type: 'OibProxy', label: 'Proxy', newRow: true },
    { key: 'authentication', type: 'OibAuthentication', label: 'Authentication', newRow: true, authTypes: ['none', 'basic'] }
  ]
};
export default manifest;
