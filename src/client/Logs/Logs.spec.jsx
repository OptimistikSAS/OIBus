/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import apis from '../services/apis'
import Logs from './Logs.jsx'

// fixing date to match snapshot
const RealDate = Date
const constantDate = new Date(Date.UTC(2020, 1, 1, 0, 0, 0))
// Ensure test output is consistent across machine locale and time zone config.
const mockToLocaleString = () => constantDate.toUTCString()

global.Date.prototype.toLocaleString = mockToLocaleString
global.Date.prototype.toLocaleTimeString = mockToLocaleString
global.Date.prototype.toLocaleDateString = mockToLocaleString

// Prevent random and time elements from failing repeated tests.
global.Date = class {
  static now() {
    return new RealDate(constantDate)
  }

  constructor() {
    // eslint-disable-next-line no-constructor-return
    return new RealDate(constantDate)
  }
}

// sample test logs
const testLogs = [
  {
    id: 1,
    timestamp: '2020-01-01T00:00:00.000Z',
    level: 'debug',
    source: 'Source',
    message: 'Testing debug logs',
  },
  {
    id: 2,
    timestamp: '2020-01-01T00:00:00.000Z',
    level: 'info',
    source: 'Source',
    message: 'Testing info logs',
  },
  {
    id: 3,
    timestamp: '2020-01-01T00:00:00.000Z',
    level: 'warning',
    source: 'Source',
    message: 'Testing warning logs',
  },
  {
    id: 4,
    timestamp: '2019-12-31T23:00:00.000Z',
    level: 'error',
    source: 'Source',
    message: 'Testing error logs',
  },
  {
    id: 5,
    timestamp: '2020-01-01T02:00:00.000Z',
    level: 'trace',
    source: 'Source',
    message: 'Testing trace logs',
  },
  {
    id: 6,
    timestamp: '2020-01-01T03:00:00.000Z',
    level: 'trace',
    source: 'Source',
    message: 'Testing trace logs on page 2',
  },
]

// mock get Logs
let resolve
let reject
const setAlert = jest.fn()
apis.getLogs = () => new Promise((_resolve, _reject) => {
  resolve = _resolve
  reject = _reject
})
React.useContext = jest.fn().mockReturnValue({ setAlert })

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

describe('Logs', () => {
  test('check Logs', async () => {
    act(() => {
      root.render(
        <Logs />,
      )
    })
    act(() => {
      Simulate.click(document.getElementById('showLog'))
    })

    await act(async () => {
      resolve(testLogs)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change fromDate', async () => {
    act(() => {
      root.render(
        <Logs />,
      )
    })
    act(() => {
      Simulate.change(document.getElementById('fromDate'), { target: { value: '2020-02-01T00:00:00.000Z' } })
    })
    act(() => {
      Simulate.click(document.getElementById('showLog'))
    })

    await act(async () => {
      resolve(testLogs)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change toDate', async () => {
    act(() => {
      root.render(
        <Logs />,
      )
    })
    act(() => {
      Simulate.change(document.getElementById('toDate'), { target: { value: '2020-02-01T00:00:00.000Z' } })
    })
    act(() => {
      Simulate.click(document.getElementById('showLog'))
    })
    await act(async () => {
      resolve(testLogs)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change filterText', async () => {
    act(() => {
      root.render(
        <Logs />,
      )
    })
    await act(async () => {
      resolve([])
    })
    act(() => {
      Simulate.change(document.getElementById('filterText'), { target: { value: 'debug' } })
    })
    act(() => {
      Simulate.click(document.getElementById('showLog'))
    })
    expect(container).toMatchSnapshot()
  })
  test('check change verbosity, uncheck error', async () => {
    act(() => {
      root.render(
        <Logs />,
      )
    })
    await act(async () => {
      resolve([])
    })
    act(() => {
      Simulate.change(document.getElementById('verbosity'), { target: { checked: false } })
    })
    act(() => {
      Simulate.click(document.getElementById('showLog'))
    })

    expect(container).toMatchSnapshot()
  })
  test('check change verbosity, check trace', async () => {
    act(() => {
      root.render(
        <Logs />,
      )
    })
    await act(async () => {
      resolve([])
    })
    act(() => {
      Simulate.change(document.getElementsByClassName('oi-form-input form-check-input')[4], { target: { checked: true } })
    })

    expect(container).toMatchSnapshot()
  })
  test('check press Show Logs, error in logs call', async () => {
    const originalError = console.error
    console.error = jest.fn()
    act(() => {
      root.render(
        <Logs />,
      )
    })
    act(() => {
      // resolve the call requested by showLog
      Simulate.click(document.getElementById('showLog'))
    })
    await act(async () => {
      reject('Logs: testing error on getLogs request')
    })
    console.error = originalError
    expect(container).toMatchSnapshot()
  })
  test('check press showMore', async () => {
    act(() => {
      root.render(
        <Logs />,
      )
    })
    act(() => {
      // resolve the call requested by showLog
      Simulate.click(document.getElementById('showLog'))
    })
    await act(async () => {
      const logs = []
      for (let index = 0; index < 1000; index += 1) {
        logs[index] = {
          id: index,
          timestamp: '2020-01-01T00:00:00.000Z',
          level: 'debug',
          source: 'Source',
          message: 'Testing lot of logs',
        }
      }
      resolve(logs)
    })
    expect(container).toMatchSnapshot()
    act(() => {
      Simulate.click(document.getElementById('showMore'))
    })
    expect(container).toMatchSnapshot()
  })
})
