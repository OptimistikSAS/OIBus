import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import testConfig from '../../../../tests/testConfig'
import SqliteLogging from './SqliteLogging.jsx'

const onChange = jest.fn()

const mockMath = Object.create(global.Math)
mockMath.random = () => 1
global.Math = mockMath

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('SqliteLogging', () => {
  test('check SqliteLogging', () => {
    act(() => {
      ReactDOM.render(<SqliteLogging
        logParameters={testConfig.engine.logParameters.sqliteLog}
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change sqliteLevel to "warning"', () => {
    act(() => {
      ReactDOM.render(<SqliteLogging
        logParameters={testConfig.engine.logParameters.sqliteLog}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.logParameters.sqliteLog.level'), { target: { value: 'warning', selectedIndex: 4 } })
    expect(onChange).toBeCalledWith('engine.logParameters.sqliteLog.level', 'warning', null, null)
    expect(container).toMatchSnapshot()
  })
  test('check change sqliteLog fileName to "new_sqliteFilename"', () => {
    act(() => {
      ReactDOM.render(<SqliteLogging
        logParameters={testConfig.engine.logParameters.sqliteLog}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.logParameters.sqliteLog.fileName'), { target: { value: 'new_sqliteFilename' } })
    expect(onChange).toBeCalledWith('engine.logParameters.sqliteLog.fileName', 'new_sqliteFilename', null)
    expect(container).toMatchSnapshot()
  })
  test('check change sqliteLog maxSize to 10000000', () => {
    act(() => {
      ReactDOM.render(<SqliteLogging
        logParameters={testConfig.engine.logParameters.sqliteLog}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.logParameters.sqliteLog.maxSize'), { target: { value: 10000000 } })
    expect(onChange).toBeCalledWith('engine.logParameters.sqliteLog.maxSize', 10000000, null)
    expect(container).toMatchSnapshot()
  })
})
