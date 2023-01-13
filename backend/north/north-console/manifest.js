export default {
  name: 'Console',
  category: 'debug',
  modes: {
    files: true,
    points: true,
  },
  settings: [
    {
      key: 'verbose',
      type: 'OibCheckbox',
      label: 'Verbose',
      newRow: true,
      validators: [{ key: 'required' }],
      readDisplay: true,
    },
  ],
}
