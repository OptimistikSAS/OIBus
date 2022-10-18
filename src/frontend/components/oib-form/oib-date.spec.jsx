/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import OibDate from './oib-date.jsx'

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

describe('OIbDate', () => {
  test('check date with value="2021-11-20"', () => {
    act(() => {
      root.render(<OibDate
        name="endTime"
        value="2021-11-20"
        label="To date"
        onChange={() => {}}
      />)
    })
    expect(container).toMatchSnapshot()
  })
})
