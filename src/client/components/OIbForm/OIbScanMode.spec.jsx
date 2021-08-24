/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import OIbScanMode from './OIbScanMode.jsx'

jest.mock('react-router-dom', () => (
  { useParams: jest.fn().mockReturnValue({ name: 'OPC-HDA' }) }
))

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('OIbScanMode', () => {
  test('check ScanMode with value="value"', () => {
    act(() => {
      ReactDOM.render(<OIbScanMode
        name="name"
        label="label"
        value="value"
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check ScanMode with no label', () => {
    act(() => {
      ReactDOM.render(<OIbScanMode
        name="name"
        value="value"
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check ScanMode with value="value" and help', () => {
    act(() => {
      ReactDOM.render(<OIbScanMode
        name="name"
        help={<div>help text</div>}
        label="label"
        value="value"
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
