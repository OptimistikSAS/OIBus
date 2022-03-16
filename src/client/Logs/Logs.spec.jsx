/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

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

/*
React.useState = jest.fn().mockImplementation((init) => {
  if (JSON.stringify(init) === JSON.stringify(verbosityOptions)) {
    // init test with 'trace' option unchecked
    return [verbosityOptions.filter((item) => item !== 'trace'), setVerbosity]
  }
  if (init === undefined) {
    return [testLogs, setState]
  }
  if (init === defaultMaxLog) {
    return [tempDefaultMaxLog, setState]
  }
  return [init, setState]
})
*/
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
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('Logs', () => {
  test('check Logs', async () => {
    act(() => {
      ReactDOM.render(
        <Logs />,
        container,
      )
    })
    Simulate.click(document.getElementById('showLog'))
    await act(async () => {
      resolve(testLogs)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change fromDate', async () => {
    act(() => {
      ReactDOM.render(
        <Logs />,
        container,
      )
    })
    Simulate.change(document.getElementById('fromDate'), { target: { value: '2020-02-01T00:00:00.000Z' } })
    Simulate.click(document.getElementById('showLog'))
    await act(async () => {
      resolve(testLogs)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change toDate', async () => {
    act(() => {
      ReactDOM.render(
        <Logs />,
        container,
      )
    })
    Simulate.change(document.getElementById('toDate'), { target: { value: '2020-02-01T00:00:00.000Z' } })
    Simulate.click(document.getElementById('showLog'))
    await act(async () => {
      resolve(testLogs)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change filterText', async () => {
    act(() => {
      ReactDOM.render(
        <Logs />,
        container,
      )
    })
    await act(async () => {
      resolve([])
    })
    Simulate.change(document.getElementById('filterText'), { target: { value: 'debug' } })
    Simulate.click(document.getElementById('showLog'))
    expect(container).toMatchSnapshot()
  })
  test('check change verbosity, uncheck error', async () => {
    act(() => {
      ReactDOM.render(
        <Logs />,
        container,
      )
    })
    await act(async () => {
      resolve([])
    })
    Simulate.change(document.getElementById('verbosity'), { target: { checked: false } })
    Simulate.click(document.getElementById('showLog'))
    expect(container).toMatchSnapshot()
  })
  test('check change verbosity, check trace', async () => {
    act(() => {
      ReactDOM.render(
        <Logs />,
        container,
      )
    })
    await act(async () => {
      resolve([])
    })
    Simulate.change(document.getElementsByClassName('oi-form-input form-check-input')[4], { target: { checked: true } })
    expect(container).toMatchSnapshot()
  })
  test('check press Show Logs, error in logs call', async () => {
    const originalError = console.error
    console.error = jest.fn()
    act(() => {
      ReactDOM.render(
        <Logs />,
        container,
      )
    })
    // resolve the call requested by showLog
    Simulate.click(document.getElementById('showLog'))
    await act(async () => {
      reject('Logs: testing error on getLogs request')
    })
    console.error = originalError
    expect(container).toMatchSnapshot()
  })
  test('check press showMore', async () => {
    act(() => {
      ReactDOM.render(
        <Logs />,
        container,
      )
    })
    // resolve the call requested by showLog
    Simulate.click(document.getElementById('showLog'))
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
    Simulate.click(document.getElementById('showMore'))
    expect(container).toMatchSnapshot()
  })
})
