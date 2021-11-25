/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import utils from '../helpers/utils'
import testConfig from '../../../tests/testHistoryConfig'
import { HistoryConfigProvider, reducer } from './historyContext.jsx'

// console.log(JSON.parse(testConfig))
// mock fetch
global.fetch = jest.fn().mockImplementation((uri) => {
  let jsonString
  switch (uri) {
    case '/historyQuery/config':
      jsonString = JSON.stringify({ config: testConfig })
      break
    default:
      jsonString = '""'
      break
  }
  return {
    status: 200,
    text: jest.fn().mockImplementation(() => jsonString),
  }
})

// mock states
const initState = 'activeHistoryConfig'
const setActiveHistoryConfig = jest.fn()
const setState = jest.fn()
React.useState = jest.fn().mockImplementation((init) => {
  if (init?.length === 0 && initState === 'activeHistoryConfig') {
    return [init, setActiveHistoryConfig]
  }
  return [init, setState]
})
// mock dispatchNewConfig
React.useReducer = jest.fn().mockImplementation(() => [testConfig, jest.fn()])
const dispatchNewHistoryConfig = (action) => reducer(testConfig, action)

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('HistoryConfigProvider', () => {
  test('check HistoryConfigProvider', () => {
    act(() => {
      ReactDOM.render(
        <HistoryConfigProvider>
          <div />
        </HistoryConfigProvider>,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check initial data setup', async () => {
    await act(async () => {
      ReactDOM.render(
        <HistoryConfigProvider>
          <div />
        </HistoryConfigProvider>,
        container,
      )
    })
    expect(setActiveHistoryConfig).toBeCalledWith(testConfig)
    expect(container).toMatchSnapshot()
  })
  test('check initial data fail', async () => {
    const originalError = console.error
    console.error = jest.fn()
    const originalGlobalFetchMock = global.fetch
    global.fetch = jest.fn().mockImplementation(() => ({ status: 500 }))
    await act(async () => {
      ReactDOM.render(
        <HistoryConfigProvider>
          <div />
        </HistoryConfigProvider>,
        container,
      )
    })
    expect(console.error).toBeCalled()
    global.fetch = originalGlobalFetchMock
    console.error = originalError
  })
  test('check reset action', () => {
    act(() => {
      ReactDOM.render(
        <HistoryConfigProvider>
          <div />
        </HistoryConfigProvider>,
        container,
      )
    })
    const action = { type: 'reset', config: testConfig }
    const newState = dispatchNewHistoryConfig(action)
    expect(newState).toEqual(testConfig)
  })
  test('check update action', () => {
    act(() => {
      ReactDOM.render(
        <HistoryConfigProvider>
          <div />
        </HistoryConfigProvider>,
        container,
      )
    })
    const action = { type: 'update', name: '0.compress', value: false }
    const newState = dispatchNewHistoryConfig(action)
    expect(newState[0].compress).toEqual(false)
  })
  test('check update action with previous error', () => {
    // add some previuous error to test error cleaning
    testConfig.errors = { '0.compress': 'some previous error' }

    act(() => {
      ReactDOM.render(
        <HistoryConfigProvider>
          <div />
        </HistoryConfigProvider>,
        container,
      )
    })
    const action = { type: 'update', name: '0.compress', value: false }
    const newState = dispatchNewHistoryConfig(action)
    expect(newState[0].compress).toEqual(false)
    expect(newState.errors).toBeUndefined()

    // remove test error
    delete testConfig.errors
  })
  test('check update action invalide', () => {
    act(() => {
      ReactDOM.render(
        <HistoryConfigProvider>
          <div />
        </HistoryConfigProvider>,
        container,
      )
    })
    const action = {
      type: 'update',
      name: '0.compress',
      value: 0,
      validity: 'Value should be boolean',
    }
    const newState = dispatchNewHistoryConfig(action)
    expect(newState.errors['0.compress']).toEqual(
      'Value should be boolean',
    )
  })
  test('check deleteRow action', () => {
    act(() => {
      ReactDOM.render(
        <HistoryConfigProvider>
          <div />
        </HistoryConfigProvider>,
        container,
      )
    })

    const action = { type: 'deleteRow', name: '0' }
    const newState = dispatchNewHistoryConfig(action)
    expect(newState).toEqual([testConfig[1]])
  })
  test('check deleteRow action with previous error', () => {
    // add some previuous error to test error cleaning
    testConfig.errors = { 0: 'some previous error' }
    act(() => {
      ReactDOM.render(
        <HistoryConfigProvider>
          <div />
        </HistoryConfigProvider>,
        container,
      )
    })

    const action = { type: 'deleteRow', name: '0' }
    const newState = dispatchNewHistoryConfig(action)
    const expectedState = utils.jsonCopy(testConfig)
    delete expectedState.errors
    expect(newState).toEqual([expectedState[1]])

    // remove test error
    delete testConfig.errors
  })
  // test('check deleteRow action with multiple previous error', () => {
  //   // add some previuous error to test error cleaning
  //   testConfig.errors = {
  //     '0.compress': 'some previous error',
  //     '0.enabled': 'some previous error',
  //   }
  //   act(() => {
  //     ReactDOM.render(
  //       <HistoryConfigProvider>
  //         <div />
  //       </HistoryConfigProvider>,
  //       container,
  //     )
  //   })

  //   const action = { type: 'deleteRow', name: '0' }
  //   const newState = dispatchNewHistoryConfig(action)
  //   const expectedState = utils.jsonCopy(testConfig)
  //   delete expectedState.errors['0.enabled']
  //   expect(newState).toEqual([expectedState[1]])

  //   // remove test error
  //   delete testConfig.errors
  // })
  test('check deleteAllRows action', () => {
    act(() => {
      ReactDOM.render(
        <HistoryConfigProvider>
          <div />
        </HistoryConfigProvider>,
        container,
      )
    })
    const action = {
      type: 'deleteAllRows',
      name: '0.points',
    }
    const newState = dispatchNewHistoryConfig(action)
    const expectedState = utils.jsonCopy(testConfig)
    expectedState[0].points = []
    expect(newState).toEqual(expectedState)
  })
  test('check addRow action', () => {
    act(() => {
      ReactDOM.render(
        <HistoryConfigProvider>
          <div />
        </HistoryConfigProvider>,
        container,
      )
    })
    const action = {
      type: 'addRow',
      name: '0.points',
      value: {},
    }
    const newState = dispatchNewHistoryConfig(action)
    const expectedState = utils.jsonCopy(testConfig)
    expectedState[0].points.push({})
    expect(newState).toEqual(expectedState)
  })
  test('check importPoints action', () => {
    act(() => {
      ReactDOM.render(
        <HistoryConfigProvider>
          <div />
        </HistoryConfigProvider>,
        container,
      )
    })
    const action = {
      type: 'importPoints',
      name: '0.points',
      value: [{}],
    }
    const newState = dispatchNewHistoryConfig(action)
    const expectedState = utils.jsonCopy(testConfig)
    expectedState[0].points = [{}]
    expect(newState).toEqual(expectedState)
  })
  test('check unknown action', () => {
    act(() => {
      ReactDOM.render(
        <HistoryConfigProvider>
          <div />
        </HistoryConfigProvider>,
        container,
      )
    })
    const action = { type: 'unknown' }
    expect(() => dispatchNewHistoryConfig(action)).toThrow()
  })
})
