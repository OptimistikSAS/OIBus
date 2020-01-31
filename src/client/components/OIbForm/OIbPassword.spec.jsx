import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import OIbPassword from './OIbPassword.jsx'
import { minLength } from '../../../services/validation.service'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('OIbPassword', () => {
  test('check Password with value="a password"', () => {
    act(() => {
      ReactDOM.render(<OIbPassword
        label="label"
        value="a text"
        name="name"
        onChange={() => (1)}
        defaultValue="default"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Password with too short value', () => {
    act(() => {
      ReactDOM.render(<OIbPassword
        label="label"
        name="name"
        onChange={() => (1)}
        value="password"
        valid={minLength(10)}
        defaultValue="default"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Password with no label', () => {
    act(() => {
      ReactDOM.render(<OIbPassword
        name="name"
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Password with help', () => {
    act(() => {
      ReactDOM.render(<OIbPassword
        name="name"
        help={<div>help text</div>}
        onChange={() => (1)}
        value="password"
        defaultValue="default"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
