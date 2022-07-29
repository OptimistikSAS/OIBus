const schema = {
  name: 'Console',
  category: 'Debug',
  supportPoints: true,
  supportFiles: true,
}
schema.form = {
  ConsoleSettings: {
    type: 'OIbTitle',
    label: 'OIConsole settings',
    md: 12,
    children: `
      <p>
        Console just displays what is received from the South on the server console. It is mainly used to debug OIBus.
        In normal operations, console should be disabled because the console is relatively slow and may cause memory issues.
        The verbose mode can be set to False to limit what is sent to the console.
      </p>
    `,
  },
  verbose: {
    type: 'OIbCheckBox',
    md: 2,
    newRow: true,
    defaultValue: false,
  },
}
module.exports = schema
