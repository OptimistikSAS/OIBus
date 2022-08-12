/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'
import timexe from 'timexe'

import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../tests/testConfig'
import Engine from './Engine.jsx'

const dispatchNewConfig = jest.fn()
React.useContext = jest.fn().mockReturnValue({ newConfig: testConfig, dispatchNewConfig })

// fixing date to match snapshot
const RealDate = Date
const realToLocaleString = global.Date.prototype.toLocaleString
const realNow = global.Date.now
const constantDate = new Date(Date.UTC(2020, 1, 1, 0, 0, 0))
// Ensure test output is consistent across machine locale and time zone config.
const mockToLocaleString = () => constantDate.toUTCString()
const mockNow = () => 1577836799000
global.Date.prototype.toLocaleString = mockToLocaleString
global.Date.now = mockNow

// mock timexe.nextTime
const realTimexeNextTime = timexe.nextTime
const mockTimexeNextTime = () => ({ time: '1600905600.000', error: '' })
timexe.nextTime = mockTimexeNextTime

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

describe('Engine', () => {
  test('check Engine', () => {
    act(() => {
      root.render(<Engine />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change engineName', () => {
    act(() => {
      root.render(<Engine />)
    })
    act(() => {
      Simulate.change(document.getElementById('engine.engineName'), { target: { value: 'OIBus test' } })
    })

    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.engineName', value: 'OIBus test', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check change port', () => {
    act(() => {
      root.render(<Engine />)
    })
    act(() => {
      Simulate.change(document.getElementById('engine.port'), { target: { value: 1234 } })
    })

    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.port', value: 1234, validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check change user', () => {
    act(() => {
      root.render(<Engine />)
    })
    act(() => {
      Simulate.change(document.getElementById('engine.user'), { target: { value: 'new_user' } })
    })

    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.user', value: 'new_user', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check change password', () => {
    act(() => {
      root.render(<Engine />)
    })
    act(() => {
      Simulate.change(document.getElementById('engine.password'), { target: { value: '{{notEncrypted}}new_password' } })
    })

    expect(dispatchNewConfig).toBeCalledWith({ type: 'update', name: 'engine.password', value: '{{notEncrypted}}new_password', validity: null })
    expect(container).toMatchSnapshot()
  })
  test('check Engine when config has no proxies', () => {
    testConfig.engine.proxies = null
    act(() => {
      root.render(<Engine />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check Engine when no engine', () => {
    testConfig.engine = null
    act(() => {
      root.render(<Engine />)
    })
    expect(container).toMatchSnapshot()
    global.Date = RealDate
    global.Date.prototype.toLocaleString = realToLocaleString
    global.Date.now = realNow
    timexe.nextTime = realTimexeNextTime
  })
})
