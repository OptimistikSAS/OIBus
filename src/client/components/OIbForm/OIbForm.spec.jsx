/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import OIbForm from './OIbForm.jsx'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('OIbForm', () => {
  test('check Form with value="{ form: {} }', () => {
    act(() => {
      ReactDOM.render(<OIbForm
        schema={{ form: {} }}
        values={{ object: 'value' }}
        onChange={() => (1)}
        name="name"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
