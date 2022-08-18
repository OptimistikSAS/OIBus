/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../tests/testConfig.js'
import HealthSignal from './HealthSignal.jsx'

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

describe('HealthSignal', () => {
  test('check HealthSignal', () => {
    act(() => {
      root.render(<HealthSignal
        healthSignal={testConfig.engine.healthSignal}
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change healthSignal http to false', () => {
    act(() => {
      root.render(<HealthSignal
        healthSignal={testConfig.engine.healthSignal}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.healthSignal.http.enabled'), { target: { checked: false } })
    expect(onChange).toBeCalledWith('engine.healthSignal.http.enabled', false, null)
    expect(container).toMatchSnapshot()
  })
  test('check change healthSignal log to false', () => {
    act(() => {
      root.render(<HealthSignal
        healthSignal={testConfig.engine.healthSignal}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.healthSignal.logging.enabled'), { target: { checked: false } })
    expect(onChange).toBeCalledWith('engine.healthSignal.logging.enabled', false, null)
    expect(container).toMatchSnapshot()
  })
})
