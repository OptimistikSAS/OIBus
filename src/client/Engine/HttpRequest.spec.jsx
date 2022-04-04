/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import testConfig from '../../../tests/testConfig'
import HttpRequest from './HttpRequest.jsx'

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

describe('HttpRequest', () => {
  test('check HttpRequest', () => {
    act(() => {
      root.render(<HttpRequest
        httpRequest={testConfig.engine.httpRequest}
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change stack to "request"', () => {
    act(() => {
      root.render(<HttpRequest
        httpRequest={testConfig.engine.httpRequest}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.httpRequest.stack'), { target: { value: 'axios', selectedIndex: 0 } })
    expect(onChange).toBeCalledWith('engine.httpRequest.stack', 'axios', null, null)
    expect(container).toMatchSnapshot()
  })
  test('check change timeout', () => {
    act(() => {
      root.render(<HttpRequest
        httpRequest={testConfig.engine.httpRequest}
        onChange={onChange}
      />)
    })
    Simulate.change(document.getElementById('engine.httpRequest.timeout'), { target: { value: 60 } })
    expect(onChange).toBeCalledWith('engine.httpRequest.timeout', 60, null)
    expect(container).toMatchSnapshot()
  })
})
