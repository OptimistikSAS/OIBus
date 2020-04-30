import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import Proxies from './Proxies.jsx'

const dispatchNewConfig = jest.fn()
React.useContext = jest.fn().mockReturnValue({ dispatchNewConfig })

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

describe('Proxies', () => {
  test('check Proxies', () => {
    act(() => {
      ReactDOM.render(<Proxies
        proxies={testConfig.engine.proxies}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change first name', () => {
    act(() => {
      ReactDOM.render(<Proxies
        proxies={testConfig.engine.proxies}
      />, container)
    })
    Simulate.change(document.getElementById('engine.proxies.0.name'), { target: { value: 'newName' } })
    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.proxies.0.name', value: 'newName', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check change first protocol', () => {
    act(() => {
      ReactDOM.render(<Proxies
        proxies={testConfig.engine.proxies}
      />, container)
    })
    Simulate.change(document.getElementById('engine.proxies.0.protocol'), { target: { value: 'https', selectedIndex: 1 } })
    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.proxies.0.protocol', value: 'https', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check change first host', () => {
    act(() => {
      ReactDOM.render(<Proxies
        proxies={testConfig.engine.proxies}
      />, container)
    })
    Simulate.change(document.getElementById('engine.proxies.0.host'), { target: { value: 'host' } })
    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.proxies.0.host', value: 'host', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check change first port', () => {
    act(() => {
      ReactDOM.render(<Proxies
        proxies={testConfig.engine.proxies}
      />, container)
    })
    Simulate.change(document.getElementById('engine.proxies.0.port'), { target: { value: 1234 } })
    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.proxies.0.port', value: 1234, validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check change first username', () => {
    act(() => {
      ReactDOM.render(<Proxies
        proxies={testConfig.engine.proxies}
      />, container)
    })
    Simulate.change(document.getElementById('engine.proxies.0.username'), { target: { value: 'newUsername' } })
    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.proxies.0.username', value: 'newUsername', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check change first password', () => {
    act(() => {
      ReactDOM.render(<Proxies
        proxies={testConfig.engine.proxies}
      />, container)
    })
    Simulate.change(document.getElementById('engine.proxies.0.password'), { target: { value: '{{notEncrypted}}newPassword' } })
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'engine.proxies.0.password',
      value: '{{notEncrypted}}newPassword',
      validity: null,
    })
    expect(container).toMatchSnapshot()
  })
  test('check delete first proxie', () => {
    act(() => {
      ReactDOM.render(<Proxies
        proxies={testConfig.engine.proxies}
      />, container)
    })
    Simulate.click(document.querySelector('td path'))
    expect(dispatchNewConfig).toBeCalledWith({ type: 'deleteRow', name: 'engine.proxies.0' })
    expect(container).toMatchSnapshot()
  })
  test('check add line to proxies', () => {
    act(() => {
      ReactDOM.render(<Proxies
        proxies={testConfig.engine.proxies}
      />, container)
    })
    Simulate.click(document.querySelector('th path'))
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'addRow',
      name: 'engine.proxies',
      value: {
        name: '',
        protocol: '',
        host: '',
        port: '',
        username: '',
        password: '',
      },
    })
    expect(container).toMatchSnapshot()
  })
})
