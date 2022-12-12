/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import OibScanMode from './oib-scan-mode.jsx'

jest.mock('react-router-dom', () => (
  { useParams: jest.fn().mockReturnValue({ name: 'OPC-HDA' }) }
))

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

describe('OIbScanMode', () => {
  test('check ScanMode with value="value"', () => {
    act(() => {
      root.render(<OibScanMode
        name="name"
        label="label"
        value="value"
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check ScanMode with no label', () => {
    act(() => {
      root.render(<OibScanMode
        name="name"
        value="value"
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check ScanMode with value="value" and help', () => {
    act(() => {
      root.render(<OibScanMode
        name="name"
        help={<div>help text</div>}
        label="label"
        value="value"
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
})
