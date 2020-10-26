import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'
import objectPath from 'object-path'
import newConfig from '../../../../tests/testConfig'
import OIbScanMode from './OIbScanMode.jsx'

React.useContext = jest.fn().mockReturnValue({ newConfig })
const originalObjectPath = objectPath.get
objectPath.get = () => newConfig.south.dataSources[7].scanGroups

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
  test('check ScanMode with value="listen" and groupScan', () => {
    act(() => {
      ReactDOM.render(<OIbScanMode
        name="name"
        help={<div>help text</div>}
        scanGroup
        value="value"
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check ScanMode with value=""', () => {
    act(() => {
      ReactDOM.render(<OIbScanMode
        name="name"
        help={<div>help text</div>}
        value=""
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
    objectPath.get = originalObjectPath
  })
})
