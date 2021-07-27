/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import HealthSignal from './HealthSignal.jsx'

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

describe('HealthSignal', () => {
  test('check HealthSignal', () => {
    act(() => {
      ReactDOM.render(<HealthSignal
        healthSignal={testConfig.engine.healthSignal}
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change healthSignal http to false', () => {
    act(() => {
      ReactDOM.render(<HealthSignal
        healthSignal={testConfig.engine.healthSignal}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.healthSignal.http.enabled'), { target: { checked: false } })
    expect(onChange).toBeCalledWith('engine.healthSignal.http.enabled', false, null)
    expect(container).toMatchSnapshot()
  })
  test('check change healthSignal log to false', () => {
    act(() => {
      ReactDOM.render(<HealthSignal
        healthSignal={testConfig.engine.healthSignal}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.healthSignal.logging.enabled'), { target: { checked: false } })
    expect(onChange).toBeCalledWith('engine.healthSignal.logging.enabled', false, null)
    expect(container).toMatchSnapshot()
  })
})
