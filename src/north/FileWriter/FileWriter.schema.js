const schema = {
  name: 'FileWriter',
  supportPoints: true,
  supportFiles: true,
  category: 'FileIn',
}
schema.form = {
  OIConnectSettings: {
    type: 'OIbTitle',
    label: 'OIFileWriter settings',
    md: 12,
    children: `
      <p>
        FileWriter just writes what is received from the South on the specified folder.
      </p>
    `,
  },
  outputFolder: {
    type: 'OIbText',
    valid: 'notEmpty',
    defaultValue: './output',
    help: 'Path to the output folder</div>',
  },
  prefixFileName: {
    type: 'OIbText',
    defaultValue: '',
    help: 'A prefix for the filename</div>',
    valid: 'hasLengthBetween(0, 256)',
  },
  suffixFileName: {
    type: 'OIbText',
    defaultValue: '',
    help: 'A suffix for the filename</div>',
    valid: 'hasLengthBetween(0, 256)',
  },
}
module.exports = schema
