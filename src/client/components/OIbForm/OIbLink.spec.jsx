/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import OIbLink from './OIbLink.jsx'

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

describe('OIbLink', () => {
  test('check OIbLink with value="http://localhost"', () => {
    act(() => {
      root.render(<OIbLink
        label="label"
        value="http://localhost"
        name="name"
        onChange={() => (1)}
        defaultValue=""
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check OIbLink with invalide value', () => {
    act(() => {
      root.render(<OIbLink
        label="label"
        name="name"
        onChange={() => (1)}
        value="no http prefix"
        defaultValue="default text"
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check OIbLink inline', () => {
    act(() => {
      root.render(<OIbLink
        name="name"
        onChange={() => (1)}
        value="http://localhost"
        defaultValue=""
        inline
      />)
    })
    expect(container).toMatchSnapshot()
  })
})
