/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import OIbDate from './OIbDate.jsx'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('OIbDate', () => {
  test('check date with value="2021-11-20"', () => {
    act(() => {
      ReactDOM.render(<OIbDate
        name="endTime"
        value="2021-11-20"
        label="To date"
        onChange={() => {}}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
