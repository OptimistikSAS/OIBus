/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import OIbTable from './OIbTable.jsx'

const dispatchNewConfig = jest.fn()
React.useContext = jest.fn().mockReturnValue({ dispatchNewConfig })

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

describe('OIbTable', () => {
  test('check Table with name, label and rows', () => {
    act(() => {
      root.render(<OIbTable
        name="a name"
        label="a title"
        rows={{ value: 'value' }}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Table with help', () => {
    act(() => {
      root.render(<OIbTable
        name="a name"
        label="a title"
        help={<div>help</div>}
        rows={{ value: 'value' }}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check add to table', () => {
    act(() => {
      root.render(<OIbTable
        name="name"
        label="a title"
        help={<div>help</div>}
        rows={{ value: 'value' }}
      />)
    })
    Simulate.click(document.querySelector('th path'))
    expect(dispatchNewConfig).toBeCalledWith({ type: 'addRow', name: 'name', value: {} })
    expect(container).toMatchSnapshot()
  })
  test('check delete from table', () => {
    act(() => {
      root.render(<OIbTable
        name="name"
        label="a title"
        help={<div>help</div>}
        rows={{ scanMode: { type: 'OIbScanMode', label: 'Scan Mode' } }}
        value={[{ type: 'test', label: 'test' }]}
      />)
    })
    act(() => {
      Simulate.click(document.querySelector('td path'))
    })
    act(() => {
      Simulate.click(document.getElementsByClassName('btn btn-primary')[0])
    })

    expect(dispatchNewConfig).toBeCalledWith({ type: 'deleteRow', name: 'name.0' })
    expect(container).toMatchSnapshot()
  })
})
