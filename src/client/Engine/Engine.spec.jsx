import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'
// need BrowserRouter so Link component is not complaining
import { BrowserRouter } from 'react-router-dom'

import newConfig from '../../../tests/testConfig'
import Engine from './Engine.jsx'

const dispatchNewConfig = jest.fn()
React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig })

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

describe('Engine', () => {
  test('check Engine', () => {
    act(() => {
      ReactDOM.render(<BrowserRouter><Engine /></BrowserRouter>, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change engineName', () => {
    act(() => {
      ReactDOM.render(<BrowserRouter><Engine /></BrowserRouter>, container)
    })
    Simulate.change(document.getElementById('engine.engineName'), { target: { value: 'OIBus test' } })
    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.engineName', value: 'OIBus test', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check change port', () => {
    act(() => {
      ReactDOM.render(<BrowserRouter><Engine /></BrowserRouter>, container)
    })
    Simulate.change(document.getElementById('engine.port'), { target: { value: 1234 } })
    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.port', value: 1234, validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check change user', () => {
    act(() => {
      ReactDOM.render(<BrowserRouter><Engine /></BrowserRouter>, container)
    })
    Simulate.change(document.getElementById('engine.user'), { target: { value: 'new_user' } })
    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.user', value: 'new_user', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check change password', () => {
    act(() => {
      ReactDOM.render(<BrowserRouter><Engine /></BrowserRouter>, container)
    })
    Simulate.change(document.getElementById('engine.password'), { target: { value: '{{notEncrypted}}new_password' } })
    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.password', value: '{{notEncrypted}}new_password', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check Engine when config has no proxies', () => {
    newConfig.engine.proxies = null
    act(() => {
      ReactDOM.render(<BrowserRouter><Engine /></BrowserRouter>, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Engine when no engine', () => {
    newConfig.engine = null
    act(() => {
      ReactDOM.render(<BrowserRouter><Engine /></BrowserRouter>, container)
    })
    expect(container).toMatchSnapshot()
  })
})
