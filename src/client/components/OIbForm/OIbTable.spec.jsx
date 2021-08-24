/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import OIbTable from './OIbTable.jsx'

const dispatchNewConfig = jest.fn()
React.useContext = jest.fn().mockReturnValue({ dispatchNewConfig })

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

describe('OIbTable', () => {
  test('check Table with name, label and rows', () => {
    act(() => {
      ReactDOM.render(<OIbTable
        name="a name"
        label="a title"
        rows={{ value: 'value' }}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Table with help', () => {
    act(() => {
      ReactDOM.render(<OIbTable
        name="a name"
        label="a title"
        help={<div>help</div>}
        rows={{ value: 'value' }}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check add to table', () => {
    act(() => {
      ReactDOM.render(<OIbTable
        name="name"
        label="a title"
        help={<div>help</div>}
        rows={{ value: 'value' }}
      />, container)
    })
    Simulate.click(document.querySelector('th path'))
    expect(dispatchNewConfig).toBeCalledWith({ type: 'addRow', name: 'name', value: {} })
    expect(container).toMatchSnapshot()
  })
  test('check delete from table', () => {
    act(() => {
      ReactDOM.render(<OIbTable
        name="name"
        label="a title"
        help={<div>help</div>}
        rows={{ scanMode: { type: 'OIbScanMode', label: 'Scan Mode' } }}
        value={[{ type: 'test', label: 'test' }]}
      />, container)
    })
    Simulate.click(document.querySelector('td path'))
    Simulate.click(document.getElementsByClassName('btn btn-primary')[0])
    expect(dispatchNewConfig).toBeCalledWith({ type: 'deleteRow', name: 'name.0' })
    expect(container).toMatchSnapshot()
  })
})
