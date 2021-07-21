/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import OIbLink from './OIbLink.jsx'

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
  test('check OIbLink with value="http://localhost"', () => {
    act(() => {
      ReactDOM.render(<OIbLink
        label="label"
        value="http://localhost"
        name="name"
        onChange={() => (1)}
        defaultValue=""
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check OIbLink with invalide value', () => {
    act(() => {
      ReactDOM.render(<OIbLink
        label="label"
        name="name"
        onChange={() => (1)}
        value="no http prefix"
        defaultValue="default text"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check OIbLink inline', () => {
    act(() => {
      ReactDOM.render(<OIbLink
        name="name"
        onChange={() => (1)}
        value="http://localhost"
        defaultValue=""
        inline
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
