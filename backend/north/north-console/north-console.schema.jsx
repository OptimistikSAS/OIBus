import React from 'react'
import manifest from './manifest.js'

const schema = { ...manifest }
schema.form = {
  ConsoleSettings: {
    type: 'OibTitle',
    label: 'Console Settings',
    md: 12,
    children: (
      <p>
        Console just displays what is received from the South on the server console. It is mainly used to debug OIBus.
        In normal operations, console should be disabled because the console is relatively slow and may cause memory issues.
        The verbose mode can be set to False to limit what is sent to the console.
      </p>
    ),
  },
  verbose: {
    type: 'OibCheckbox',
    label: 'Verbose',
    md: 2,
    newRow: true,
    defaultValue: false,
  },
}
export default schema
