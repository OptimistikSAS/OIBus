/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import OibCheckbox from './oib-checkbox.jsx'

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

describe('OIbCheckBox', () => {
  test('check CheckBox with value(=true)', () => {
    act(() => {
      root.render(<OibCheckbox
        label="label"
        value
        name="name"
        onChange={() => (1)}
        defaultValue={false}
        checkBox
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Switch with value(=true)', () => {
    act(() => {
      root.render(<OibCheckbox
        label="label"
        value
        name="name"
        onChange={() => (1)}
        defaultValue={false}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check CheckBox with value(=false)', () => {
    act(() => {
      root.render(<OibCheckbox
        label="label"
        value={false}
        name="name"
        onChange={() => (1)}
        defaultValue={false}
        checkBox
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Switch with value(=false)', () => {
    act(() => {
      root.render(<OibCheckbox
        label="label"
        value={false}
        name="name"
        onChange={() => (1)}
        defaultValue={false}
      />)
    })
    expect(container).toMatchSnapshot()
  })
})
