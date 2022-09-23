/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../../tests/testConfig'
import SqliteLogging from './SqliteLogging.jsx'

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

describe('SqliteLogging', () => {
  test('check SqliteLogging', () => {
    act(() => {
      root.render(<SqliteLogging
        logParameters={testConfig.engine.logParameters.sqliteLog}
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change sqliteLevel to "warning"', () => {
    act(() => {
      root.render(<SqliteLogging
        logParameters={testConfig.engine.logParameters.sqliteLog}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.logParameters.sqliteLog.level'), { target: { value: 'warning', selectedIndex: 4 } })
    expect(onChange).toBeCalledWith('engine.logParameters.sqliteLog.level', 'error', null, null)
    expect(container).toMatchSnapshot()
  })
  test('check change sqliteLog maxNumberOfLogs to 10000000', () => {
    act(() => {
      root.render(<SqliteLogging
        logParameters={testConfig.engine.logParameters.sqliteLog}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.logParameters.sqliteLog.maxNumberOfLogs'), { target: { value: 10000000 } })
    expect(onChange).toBeCalledWith('engine.logParameters.sqliteLog.maxNumberOfLogs', 10000000, null)
    expect(container).toMatchSnapshot()
  })
})
