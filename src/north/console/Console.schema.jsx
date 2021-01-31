import React from 'react'

const schema = { name: 'Console' }
schema.form = {
  OIConnectSettings: {
    type: 'OIbTitle',
    label: 'OIConsole settings',
    md: 12,
    children: (
      <>
        <p>
          Console just displays what is received from the South on the server console. It is mainly used to debug OIBus.
          In normal operations, console should be disabled because the console is relatively slow and may cause memory issues.
          The verbose mode can be set to False to limit what is sent to the console.
        </p>
      </>
    ),
  },
  verbose: {
    type: 'OIbCheckBox',
    md: 2,
    newRow: true,
    defaultValue: false,
  },
  viewer: {
    type: 'OIbCheckBox',
    md: 2,
    newRow: true,
    defaultValue: true,
  },
}
export default schema
