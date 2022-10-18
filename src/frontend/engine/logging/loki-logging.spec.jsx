/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../../tests/test-config'
import LokiLogging from './loki-logging.jsx'

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

describe('LokiLogging', () => {
  test('check LokiLogging', () => {
    act(() => {
      root.render(<LokiLogging
        logParameters={testConfig.engine.logParameters.lokiLog}
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change lokiLog level to "warning"', () => {
    act(() => {
      root.render(<LokiLogging
        logParameters={testConfig.engine.logParameters.lokiLog}
        onChange={onChange}
      />)
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
      root.render(<LokiLogging
        logParameters={testConfig.engine.logParameters.lokiLog}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.logParameters.lokiLog.lokiAddress'), { target: { value: 'http://test.loki.fr' } })
    expect(onChange).toBeCalledWith('engine.logParameters.lokiLog.lokiAddress', 'http://test.loki.fr', null)
    expect(container).toMatchSnapshot()
  })
  test('check change lokiLog interval to 10', () => {
    act(() => {
      root.render(<LokiLogging
        logParameters={testConfig.engine.logParameters.lokiLog}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.logParameters.lokiLog.interval'), { target: { value: 10 } })
    expect(onChange).toBeCalledWith('engine.logParameters.lokiLog.interval', 10, null)
    expect(container).toMatchSnapshot()
  })
})
