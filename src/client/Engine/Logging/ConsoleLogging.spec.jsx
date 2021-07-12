import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import testConfig from '../../../../tests/testConfig'
import ConsoleLogging from './ConsoleLogging.jsx'

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

describe('ConsoleLogging', () => {
  test('check ConsoleLogging', () => {
    act(() => {
      ReactDOM.render(<ConsoleLogging
        logParameters={testConfig.engine.logParameters.consoleLog}
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change console level to "warning"', () => {
    act(() => {
      ReactDOM.render(<ConsoleLogging
        logParameters={testConfig.engine.logParameters.consoleLog}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.logParameters.consoleLog.level'), { target: { value: 'warning', selectedIndex: 4 } })
    expect(onChange).toBeCalledWith('engine.logParameters.consoleLog.level', 'warning', null, null)
    expect(container).toMatchSnapshot()
  })
})
