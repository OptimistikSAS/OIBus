import { NorthConnectorManifest } from '../../../../shared/model/north-connector.model';

const manifest: NorthConnectorManifest = {
  name: 'CsvToHttp',
  category: 'api',
  description: 'CsvToHttp description',
  modes: {
    files: true,
    points: false
  },
  settings: [
    {
      key: 'applicativeHostUrl',
      label: 'Host url',
      type: 'OibText',
      newRow: true,
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' } }],
      readDisplay: true
    },
    {
      key: 'requestMethod',
      type: 'OibSelect',
      options: ['GET', 'POST', 'PUT', 'PATCH'],
      label: 'HTTP Method',
      defaultValue: 'POST',
      newRow: false,
      validators: [{ key: 'required' }]
    },
    {
      key: 'bodyMaxLength',
      type: 'OibNumber',
      label: 'Max length of the body',
      defaultValue: 100,
      newRow: false,
      validators: [{ key: 'required' }, { key: 'min', params: { min: 1 } }, { key: 'max', params: { max: 10_000 } }]
    },
    {
      key: 'acceptUnconvertedRows',
      type: 'OibCheckbox',
      label: 'Accept unconverted rows',
      defaultValue: false,
      newRow: false
    },
    {
      key: 'csvDelimiter',
      type: 'OibSelect',
      options: [',', ';'],
      label: 'CSV delimiter',
      defaultValue: ';',
      validators: [{ key: 'required' }],
      newRow: true
    },
    { key: 'proxy', type: 'OibProxy', label: 'Proxy', newRow: true }
  ]
};

export default manifest;
