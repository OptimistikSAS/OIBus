import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import OIbIpAddress from './OIbIpAddress.jsx'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('OIbLink', () => {
  test('check OIbLink with value="127.0.0.1"', () => {
    act(() => {
      ReactDOM.render(<OIbIpAddress
        label="label"
        value="127.0.0.1"
        name="name"
        onChange={() => (1)}
        defaultValue=""
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check OIbIpAddress with invalide value', () => {
    act(() => {
      ReactDOM.render(<OIbIpAddress
        label="label"
        name="name"
        onChange={() => (1)}
        value="no ip address"
        defaultValue="default text"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check OIbIpAddress inline', () => {
    act(() => {
      ReactDOM.render(<OIbIpAddress
        name="name"
        onChange={() => (1)}
        value="127.0.0.1"
        defaultValue=""
        inline
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
