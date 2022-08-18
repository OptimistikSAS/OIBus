/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import utils from '../helpers/utils.js'
import { testConfig } from '../../../tests/testConfig.js'
import { ConfigProvider, reducer } from './ConfigContext.jsx'

// mock fetch
global.fetch = jest.fn().mockImplementation((uri) => {
  let jsonString
  switch (uri) {
    case '/config/schemas/north':
      jsonString = JSON.stringify(['a', 'b', 'c'])
      break
    case '/config/schemas/south':
      jsonString = JSON.stringify(['d', 'e', 'f'])
      break
    case '/config':
      jsonString = JSON.stringify({ config: testConfig })
      break
    default:
      jsonString = '""'
  }
  return {
    status: 200,
    text: jest.fn().mockImplementation(() => jsonString),
  }
})

// mock states
let initState = 'activeConfig'
const setActiveConfig = jest.fn()
const setApiList = jest.fn()
const setProtocolList = jest.fn()
const setState = jest.fn()
React.useState = jest.fn().mockImplementation((init) => {
  if (init === null && initState === 'activeConfig') {
    initState = 'apiList'
    return [init, setActiveConfig]
  }
  if (init === undefined && initState === 'apiList') {
    initState = 'protocolList'
    return [init, setApiList]
  }
  if (init === undefined && initState === 'protocolList') {
    initState = 'activeConfig'
    return [init, setProtocolList]
  }
  return [init, setState]
})
// mock dispatchNewConfig
React.useReducer = jest.fn().mockImplementation(() => [testConfig, jest.fn()])
const dispatchNewConfig = (action) => reducer(testConfig, action)

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

describe('ConfigProvider', () => {
  test('check ConfigProvider', () => {
    act(() => {
      root.render(
        <ConfigProvider>
          <div />
        </ConfigProvider>,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check initial data setup', async () => {
    await act(async () => {
      root.render(
        <ConfigProvider>
          <div />
        </ConfigProvider>,
      )
    })
    expect(setActiveConfig).toBeCalledWith(testConfig)
    expect(setApiList).toBeCalledWith(['a', 'b', 'c'])
    expect(setProtocolList).toBeCalledWith(['d', 'e', 'f'])
    expect(container).toMatchSnapshot()
  })
  test('check initial data fail', async () => {
    const originalError = console.error
    console.error = jest.fn()
    const originalGlobalFetchMock = global.fetch
    global.fetch = jest.fn().mockImplementation(() => ({ status: 500 }))
    await act(async () => {
      root.render(
        <ConfigProvider>
          <div />
        </ConfigProvider>,
      )
    })
    expect(console.error).toBeCalled()
    global.fetch = originalGlobalFetchMock
    console.error = originalError
  })
  test('check reset action', () => {
    act(() => {
      root.render(
        <ConfigProvider>
          <div />
        </ConfigProvider>,
      )
    })
    const action = { type: 'reset', config: testConfig }
    const newState = dispatchNewConfig(action)
    expect(newState).toEqual(testConfig)
  })
  test('check update action', () => {
    act(() => {
      root.render(
        <ConfigProvider>
          <div />
        </ConfigProvider>,
      )
    })
    const action = { type: 'update', name: 'engine.port', value: 2224 }
    const newState = dispatchNewConfig(action)
    expect(newState.engine.port).toEqual(2224)
  })
  test('check update action with previous error', () => {
    // add some previuous error to test error cleaning
    testConfig.errors = { 'engine.port': 'some previous error' }

    act(() => {
      root.render(
        <ConfigProvider>
          <div />
        </ConfigProvider>,
      )
    })
    const action = { type: 'update', name: 'engine.port', value: 2224 }
    const newState = dispatchNewConfig(action)
    expect(newState.engine.port).toEqual(2224)
    expect(newState.errors).toBeUndefined()

    // remove test error
    delete testConfig.errors
  })
  test('check update action with multiple previous error', () => {
    // add some previuous error to test error cleaning
    testConfig.errors = {
      'engine.port': 'some previous error',
      'engine.user': 'some previous error',
    }

    act(() => {
      root.render(
        <ConfigProvider>
          <div />
        </ConfigProvider>,
      )
    })
    const action = { type: 'update', name: 'engine.port', value: 2224 }
    const newState = dispatchNewConfig(action)
    expect(newState.engine.port).toEqual(2224)
    expect(newState.errors).toEqual({ 'engine.user': 'some previous error' })

    // remove test error
    delete testConfig.errors
  })
  test('check update action invalide', () => {
    act(() => {
      root.render(
        <ConfigProvider>
          <div />
        </ConfigProvider>,
      )
    })
    const action = { type: 'update', name: 'engine.port', value: 0, validity: 'Value should be between 1 and 65535' }
    const newState = dispatchNewConfig(action)
    expect(newState.errors['engine.port']).toEqual('Value should be between 1 and 65535')
  })
  test('check deleteRow action', () => {
    act(() => {
      root.render(
        <ConfigProvider>
          <div />
        </ConfigProvider>,
      )
    })

    const action = { type: 'deleteRow', name: 'north.applications.0' }
    const newState = dispatchNewConfig(action)
    const expectedState = utils.jsonCopy(testConfig)
    expectedState.north.applications.shift()
    expect(newState).toEqual(expectedState)
  })
  test('check deleteRow action with previous error', () => {
    // add some previuous error to test error cleaning
    testConfig.errors = { 'north.applications.0': 'some previous error' }
    act(() => {
      root.render(
        <ConfigProvider>
          <div />
        </ConfigProvider>,
      )
    })

    const action = { type: 'deleteRow', name: 'north.applications.0' }
    const newState = dispatchNewConfig(action)
    const expectedState = utils.jsonCopy(testConfig)
    expectedState.north.applications.shift()
    delete expectedState.errors
    expect(newState).toEqual(expectedState)

    // remove test error
    delete testConfig.errors
  })
  test('check deleteRow action with multiple previous error', () => {
    // add some previuous error to test error cleaning
    testConfig.errors = {
      'north.applications.0': 'some previous error',
      'engine.port': 'some previous error',
    }
    act(() => {
      root.render(
        <ConfigProvider>
          <div />
        </ConfigProvider>,
      )
    })

    const action = { type: 'deleteRow', name: 'north.applications.0' }
    const newState = dispatchNewConfig(action)
    const expectedState = utils.jsonCopy(testConfig)
    expectedState.north.applications.shift()
    delete expectedState.errors['north.applications.0']
    expect(newState).toEqual(expectedState)

    // remove test error
    delete testConfig.errors
  })
  test('check deleteAllRows action', () => {
    act(() => {
      root.render(
        <ConfigProvider>
          <div />
        </ConfigProvider>,
      )
    })
    const action = { type: 'deleteAllRows', name: 'south.dataSources.0.points' }
    const newState = dispatchNewConfig(action)
    const expectedState = utils.jsonCopy(testConfig)
    expectedState.south.dataSources[0].points = []
    expect(newState).toEqual(expectedState)
  })
  test('check addRow action', () => {
    act(() => {
      root.render(
        <ConfigProvider>
          <div />
        </ConfigProvider>,
      )
    })
    const action = { type: 'addRow', name: 'south.dataSources.0.points', value: {} }
    const newState = dispatchNewConfig(action)
    const expectedState = utils.jsonCopy(testConfig)
    expectedState.south.dataSources[0].points.push({})
    expect(newState).toEqual(expectedState)
  })
  test('check importPoints action', () => {
    act(() => {
      root.render(
        <ConfigProvider>
          <div />
        </ConfigProvider>,
      )
    })
    const action = { type: 'importPoints', name: 'south.dataSources.0.points', value: [{}] }
    const newState = dispatchNewConfig(action)
    const expectedState = utils.jsonCopy(testConfig)
    expectedState.south.dataSources[0].points = [{}]
    expect(newState).toEqual(expectedState)
  })
  test('check unknown action', () => {
    act(() => {
      root.render(
        <ConfigProvider>
          <div />
        </ConfigProvider>,
      )
    })
    const action = { type: 'unknown' }
    expect(() => dispatchNewConfig(action)).toThrow()
  })
})
