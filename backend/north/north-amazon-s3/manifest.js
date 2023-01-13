export default {
  name: 'AWS3',
  category: 'file',
  modes: {
    files: true,
    points: false,
  },
  settings: [
    {
      key: 'bucket',
      type: 'OibText',
      label: 'Bucket',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: true,
    },
    {
      key: 'region',
      type: 'OibText',
      label: 'Region',
      newRow: false,
      validators: [{ key: 'required' }],
      readDisplay: true,
    },
    {
      key: 'folder',
      type: 'OibText',
      label: 'Folder',
      newRow: false,
      validators: [{ key: 'required' }],
      readDisplay: true,
    },
    {
      key: 'authentication',
      type: 'OibAuthentication',
      label: 'Authentication',
      mode: 'API Key',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: false,
    },

    {
      key: 'proxy',
      type: 'OibProxy',
      label: 'Proxy',
      newRow: true,
      readDisplay: false,
    },
  ],
}
