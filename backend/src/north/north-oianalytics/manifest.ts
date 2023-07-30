import { NorthConnectorManifest } from '../../../../shared/model/north-connector.model';
import { proxy } from '../../../../shared/model/manifest-factory';

const manifest: NorthConnectorManifest = {
  id: 'oianalytics',
  name: 'OIAnalytics',
  category: 'api',
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
      validators: [
        { key: 'required' },
        {
          key: 'pattern',
          params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' }
        }
      ],
      defaultValue: 'https://instance_name.oianalytics.fr',
      displayInViewMode: true
    },
    {
      key: 'accessKey',
      type: 'OibText',
      label: 'Access key',
      validators: [{ key: 'required' }],
      displayInViewMode: true
    },
    {
      key: 'secretKey',
      type: 'OibSecret',
      label: 'Secret key',
      displayInViewMode: false
    },
    {
      key: 'timeout',
      type: 'OibNumber',
      label: 'Timeout',
      newRow: true,
      defaultValue: 30_000,
      unitLabel: 'ms',
      validators: [{ key: 'required' }]
    },
    ...proxy,
    {
      key: 'acceptUnauthorized',
      type: 'OibCheckbox',
      label: 'Accept unauthorized certificate',
      validators: [{ key: 'required' }],
      defaultValue: false,
      displayInViewMode: true
    }
  ]
};
export default manifest;
