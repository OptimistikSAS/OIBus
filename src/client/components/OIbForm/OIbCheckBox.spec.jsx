/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import OIbCheckBox from './OIbCheckBox.jsx'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('OIbCheckBox', () => {
  test('check CheckBox with value(=true)', () => {
    act(() => {
      ReactDOM.render(<OIbCheckBox
        label="label"
        value
        name="name"
        onChange={() => (1)}
        defaultValue={false}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check CheckBox with value(=true) and switch mode', () => {
    act(() => {
      ReactDOM.render(<OIbCheckBox
        label="label"
        value
        name="name"
        onChange={() => (1)}
        defaultValue={false}
        switchButton
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check CheckBox with value(=false)', () => {
    act(() => {
      ReactDOM.render(<OIbCheckBox
        label="label"
        value={false}
        name="name"
        onChange={() => (1)}
        defaultValue={false}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
