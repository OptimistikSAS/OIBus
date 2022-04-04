/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import testConfig from '../../../tests/testConfig'
import Proxies from './Proxies.jsx'

const dispatchNewConfig = jest.fn()
React.useContext = jest.fn().mockReturnValue({ dispatchNewConfig })

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

describe('Proxies', () => {
  test('check Proxies', () => {
    act(() => {
      root.render(<Proxies
        proxies={testConfig.engine.proxies}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change first name', () => {
    act(() => {
      root.render(<Proxies
        proxies={testConfig.engine.proxies}
      />)
    })
    act(() => (
      Simulate.change(document.getElementById('engine.proxies.0.name'), { target: { value: 'newName' } })
    ))

    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.proxies.0.name', value: 'newName', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check change first protocol', () => {
    act(() => {
      root.render(<Proxies
        proxies={testConfig.engine.proxies}
      />)
    })
    act(() => {
      Simulate.change(document.getElementById('engine.proxies.0.protocol'), { target: { value: 'https', selectedIndex: 1 } })
    })

    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.proxies.0.protocol', value: 'https', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check change first host', () => {
    act(() => {
      root.render(<Proxies
        proxies={testConfig.engine.proxies}
      />)
    })
    act(() => {
      Simulate.change(document.getElementById('engine.proxies.0.host'), { target: { value: 'host' } })
    })

    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.proxies.0.host', value: 'host', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check change first port', () => {
    act(() => {
      root.render(<Proxies
        proxies={testConfig.engine.proxies}
      />)
    })
    act(() => {
      Simulate.change(document.getElementById('engine.proxies.0.port'), { target: { value: 1234 } })
    })

    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.proxies.0.port', value: 1234, validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check change first username', () => {
    act(() => {
      root.render(<Proxies
        proxies={testConfig.engine.proxies}
      />)
    })
    act(() => {
      Simulate.change(document.getElementById('engine.proxies.0.username'), { target: { value: 'newUsername' } })
    })

    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.proxies.0.username', value: 'newUsername', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check change first password', () => {
    act(() => {
      root.render(<Proxies
        proxies={testConfig.engine.proxies}
      />)
    })
    act(() => {
      Simulate.change(document.getElementById('engine.proxies.0.password'), { target: { value: '{{notEncrypted}}newPassword' } })
    })

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
      root.render(<Proxies
        proxies={testConfig.engine.proxies}
      />)
    })
    act(() => {
      Simulate.click(document.querySelector('td path'))
    })
    act(() => {
      Simulate.click(document.getElementsByClassName('btn btn-primary')[0])
    })

    expect(dispatchNewConfig).toBeCalledWith({ type: 'deleteRow', name: 'engine.proxies.0' })
    expect(container).toMatchSnapshot()
  })
  test('check add line to proxies', () => {
    act(() => {
      root.render(<Proxies
        proxies={testConfig.engine.proxies}
      />)
    })
    act(() => {
      Simulate.click(document.querySelector('th path'))
    })

    expect(dispatchNewConfig).toBeCalledWith({
      type: 'addRow',
      name: 'engine.proxies',
      value: {
        name: 'name',
        protocol: 'http',
        host: '',
        port: '',
        username: '',
        password: '',
      },
    })
    expect(container).toMatchSnapshot()
  })
})
