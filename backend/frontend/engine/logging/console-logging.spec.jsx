/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../tests/test-config.js'
import ConsoleLogging from './console-logging.jsx'

const onChange = jest.fn()

const mockMath = Object.create(global.Math)
mockMath.random = () => 1
global.Math = mockMath

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

describe('ConsoleLogging', () => {
  test('check ConsoleLogging', () => {
    act(() => {
      root.render(<ConsoleLogging
        logParameters={testConfig.engine.logParameters.consoleLog}
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change console level to "warning"', () => {
    act(() => {
      root.render(<ConsoleLogging
        logParameters={testConfig.engine.logParameters.consoleLog}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.logParameters.consoleLog.level'), { target: { value: 'warning', selectedIndex: 3 } })
    expect(onChange).toBeCalledWith('engine.logParameters.consoleLog.level', 'warning', null, null)
    expect(container).toMatchSnapshot()
  })
})
