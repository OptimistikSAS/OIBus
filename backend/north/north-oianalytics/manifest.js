export default {
  name: 'OIAnalytics',
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
      readDisplay: true,
    },
    {
      key: 'authentication',
      type: 'OibAuthentication',
      label: 'Authentication',
      newRow: true,
    },
    { key: 'proxy', type: 'OibProxy', label: 'Proxy', newRow: true },
  ],
}
