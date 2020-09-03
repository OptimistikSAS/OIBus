import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import ScanModes from './ScanModes.jsx'

// fixing date to match snapshot
const RealDate = Date
const realToLocaleString = global.Date.prototype.toLocaleString
const realNow = global.Date.now
const constantDate = new Date(Date.UTC(2020, 1, 1, 0, 0, 0))
// Ensure test output is consistent across machine locale and time zone config.
const mockToLocaleString = () => constantDate.toUTCString()
const mockNow = () => 1577836799000
global.Date.prototype.toLocaleString = mockToLocaleString
global.Date.now = mockNow

const mockMath = Object.create(global.Math)
mockMath.random = () => 1
global.Math = mockMath

const dispatchNewConfig = jest.fn()
React.useContext = jest.fn().mockReturnValue({ dispatchNewConfig })

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('ScanModes', () => {
  test('check ScanModes', () => {
    act(() => {
      ReactDOM.render(<ScanModes
        scanModes={testConfig.engine.scanModes}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change first scan mode', () => {
    act(() => {
      ReactDOM.render(<ScanModes
        scanModes={testConfig.engine.scanModes}
      />, container)
    })
    Simulate.change(document.getElementById('engine.scanModes.0.scanMode'), { target: { value: 'every30Second' } })
    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.scanModes.0.scanMode', value: 'every30Second', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check change first cron', () => {
    act(() => {
      ReactDOM.render(<ScanModes
        scanModes={testConfig.engine.scanModes}
      />, container)
    })
    Simulate.change(document.getElementById('engine.scanModes.0.cronTime.year'), { target: { value: '*' } })
    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.scanModes.0.cronTime', value: '* * * * * *', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check delete first scan mode', () => {
    act(() => {
      ReactDOM.render(<ScanModes
        scanModes={testConfig.engine.scanModes}
      />, container)
    })
    Simulate.click(document.querySelector('td path'))
    expect(dispatchNewConfig).toBeCalledWith({ type: 'deleteRow', name: 'engine.scanModes.0' })
    expect(container).toMatchSnapshot()
  })
  test('check add line to scan modes', () => {
    act(() => {
      ReactDOM.render(<ScanModes
        scanModes={testConfig.engine.scanModes}
      />, container)
    })
    Simulate.click(document.querySelector('th path'))
    expect(dispatchNewConfig).toBeCalledWith({ type: 'addRow', name: 'engine.scanModes', value: { scanMode: '', cronTime: '' } })
    expect(container).toMatchSnapshot()
    global.Date = RealDate
    global.Date.prototype.toLocaleString = realToLocaleString
    global.Date.now = realNow
  })
})
