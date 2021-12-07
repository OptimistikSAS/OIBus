/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import testConfig from '../../../../tests/testConfig'
import LokiLogging from './LokiLogging.jsx'

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

describe('LokiLogging', () => {
  test('check LokiLogging', () => {
    act(() => {
      ReactDOM.render(<LokiLogging
        logParameters={testConfig.engine.logParameters.lokiLog}
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change lokiLog level to "warning"', () => {
    act(() => {
      ReactDOM.render(<LokiLogging
        logParameters={testConfig.engine.logParameters.lokiLog}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.logParameters.lokiLog.level'), {
      target: {
        value: 'warning',
        selectedIndex: 4,
      },
    })
    expect(onChange).toBeCalledWith('engine.logParameters.lokiLog.level', 'error', null, null)
    expect(container).toMatchSnapshot()
  })
  test('check change lokiLog address name to "http://test.loki.fr"', () => {
    act(() => {
      ReactDOM.render(<LokiLogging
        logParameters={testConfig.engine.logParameters.lokiLog}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.logParameters.lokiLog.lokiAddress'), { target: { value: 'http://test.loki.fr' } })
    expect(onChange).toBeCalledWith('engine.logParameters.lokiLog.lokiAddress', 'http://test.loki.fr', null)
    expect(container).toMatchSnapshot()
  })
  test('check change lokiLog interval to 10', () => {
    act(() => {
      ReactDOM.render(<LokiLogging
        logParameters={testConfig.engine.logParameters.lokiLog}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.logParameters.lokiLog.interval'), { target: { value: 10 } })
    expect(onChange).toBeCalledWith('engine.logParameters.lokiLog.interval', 10, null)
    expect(container).toMatchSnapshot()
  })
})
