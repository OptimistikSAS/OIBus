import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import OIbInteger from './OIbInteger.jsx'
import { minValue } from '../../../services/validation.service'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('OIbInteger', () => {
  test('check OIbInteger with value="a text"', () => {
    act(() => {
      ReactDOM.render(<OIbInteger
        label="label"
        value="12345678"
        name="name"
        onChange={() => (1)}
        defaultValue="0"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check OIbInteger with too small value', () => {
    act(() => {
      ReactDOM.render(<OIbInteger
        label="label"
        name="name"
        onChange={() => (1)}
        value="12"
        valid={minValue(100)}
        defaultValue="0"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change', () => {
    const onChange = jest.fn()
    act(() => {
      ReactDOM.render(<OIbInteger
        label="label"
        name="name"
        onChange={onChange}
        value="12"
        valid={minValue(100)}
        defaultValue="0"
      />, container)
    })
    Simulate.change(document.querySelector('input'), { target: { value: 'new_value' } })
    expect(onChange).toBeCalled()
    expect(container).toMatchSnapshot()
  })
})
