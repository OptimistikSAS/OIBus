/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import HttpRequest from './HttpRequest.jsx'

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

describe('HttpRequest', () => {
  test('check HttpRequest', () => {
    act(() => {
      ReactDOM.render(<HttpRequest
        httpRequest={testConfig.engine.httpRequest}
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change stack to "request"', () => {
    act(() => {
      ReactDOM.render(<HttpRequest
        httpRequest={testConfig.engine.httpRequest}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.httpRequest.stack'), { target: { value: 'axios', selectedIndex: 0 } })
    expect(onChange).toBeCalledWith('engine.httpRequest.stack', 'axios', null, null)
    expect(container).toMatchSnapshot()
  })
  test('check change timeout', () => {
    act(() => {
      ReactDOM.render(<HttpRequest
        httpRequest={testConfig.engine.httpRequest}
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('engine.httpRequest.timeout'), { target: { value: 60 } })
    expect(onChange).toBeCalledWith('engine.httpRequest.timeout', 60, null)
    expect(container).toMatchSnapshot()
  })
})
