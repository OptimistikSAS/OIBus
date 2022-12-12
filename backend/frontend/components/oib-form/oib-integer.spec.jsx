/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import OibInteger from './oib-integer.jsx'
import { minValue } from '../../../service/validation.service.js'

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

describe('OIbInteger', () => {
  test('check OIbInteger with value="a text"', () => {
    act(() => {
      root.render(<OibInteger
        label="label"
        value="12345678"
        name="name"
        onChange={() => (1)}
        defaultValue="0"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check OIbInteger with too small value', () => {
    act(() => {
      root.render(<OibInteger
        label="label"
        name="name"
        onChange={() => (1)}
        value="12"
        valid={minValue(100)}
        defaultValue="0"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change', () => {
    const onChange = jest.fn()
    act(() => {
      root.render(<OibInteger
        label="label"
        name="name"
        onChange={onChange}
        value="12"
        valid={minValue(100)}
        defaultValue="0"
      />)
    })
    Simulate.change(document.querySelector('input'), { target: { value: 'new_value' } })
    expect(onChange).toBeCalled()
    expect(container).toMatchSnapshot()
  })
})
