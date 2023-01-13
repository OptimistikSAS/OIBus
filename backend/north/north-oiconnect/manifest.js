export default {
  name: 'OIConnect',
  category: 'oi',
  modes: {
    files: true,
    points: true,
  },
  settings: [
    {
      key: 'host',
      type: 'OibText',
      label: 'Host',
      validators: [{ key: 'required' }, { key: 'pattern', params: { pattern: '^(http:\\/\\/|https:\\/\\/|HTTP:\\/\\/|HTTPS:\\/\\/).*' } }],
    },
    {
      key: 'valuesEndpoint',
      type: 'OibText',
      label: 'Values endpoint',
      defaultValue: '/engine/addValues',
      newRow: false,
      validators: [{ key: 'required' }],

    },
    {
      key: 'fileEndpoint',
      type: 'OibText',
      label: 'File endpoint',
      defaultValue: '/engine/addFile',
      newRow: false,
      validators: [{ key: 'required' }],
    },
    { key: 'authentication', type: 'OibAuthentication', label: 'Authentication', newRow: true },
    { key: 'proxy', type: 'OibProxy', label: 'Proxy', newRow: true },
  ],
}
