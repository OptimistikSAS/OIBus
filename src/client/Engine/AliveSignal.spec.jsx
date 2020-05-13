import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import AliveSignal from './AliveSignal.jsx'

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

describe('AliveSignal', () => {
  test('check AliveSignal', () => {
    act(() => {
      ReactDOM.render(<AliveSignal
        aliveSignal={testConfig.engine.aliveSignal}
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change aliveSignal to false', () => {
    act(() => {
      ReactDOM.render(<AliveSignal
        aliveSignal={testConfig.engine.aliveSignal}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.aliveSignal.enabled'), { target: { checked: false } })
    expect(onChange).toBeCalledWith('engine.aliveSignal.enabled', false, null)
    expect(container).toMatchSnapshot()
  })
})
