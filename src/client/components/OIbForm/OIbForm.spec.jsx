/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import OIbForm from './OIbForm.jsx'

let container
let root
// eslint-disable-next-line no-undef
globalThis.IS_REACT_ACT_ENVIRONMENT = true
beforeEach(() => {
  container = document.createElement('div')
  root = ReactDOMClient.createRoot(container)
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
  root = null
})

describe('OIbForm', () => {
  test('check Form with value="{ form: {} }', () => {
    act(() => {
      root.render(<OIbForm
        schema={{ form: {} }}
        values={{ object: 'value' }}
        onChange={() => (1)}
        name="name"
      />)
    })
    expect(container).toMatchSnapshot()
  })
})
