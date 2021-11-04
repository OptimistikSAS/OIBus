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
const realToLocaleString = global.Date.prototype.toLocaleString
const realToLocaleTimeString = global.Date.prototype.toLocaleTimeString
const realToLocaleDateString = global.Date.prototype.toLocaleDateString
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
    return new RealDate(constantDate)
  }
}

// verbosity options
const verbosityOptions = ['debug', 'info', 'warning', 'error', 'silly']

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
    level: 'silly',
    source: 'Source',
    message: 'Testing silly logs',
  },
  {
    id: 6,
    timestamp: '2020-01-01T03:00:00.000Z',
    level: 'silly',
    source: 'Source',
    message: 'Testing silly logs on page 2',
  },
]

// setting initial test logs to be displayed
// setting max log to 5 to have more pages
const setVerbosity = jest.fn()
const setState = jest.fn()
const defaultMaxLog = 300
const tempDefaultMaxLog = 5
React.useState = jest.fn().mockImplementation((init) => {
  if (JSON.stringify(init) === JSON.stringify(verbosityOptions)) {
    // init test with 'silly' option unchecked
    return [verbosityOptions.filter((item) => item !== 'silly'), setVerbosity]
  }
  if (init === undefined) {
    return [testLogs, setState]
  }
  if (init === defaultMaxLog) {
    return [tempDefaultMaxLog, setState]
  }
  return [init, setState]
})

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
  test('check Logs', () => {
    act(() => {
      ReactDOM.render(
        <Logs />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check change fromDate', () => {
    act(() => {
      ReactDOM.render(
        <Logs />,
        container,
      )
    })
    Simulate.change(document.getElementById('fromDate'), { target: { value: '2020-02-01T00:00:00.000Z' } })
    expect(setState).toBeCalledWith('2020-02-01T00:00:00.000Z')
    expect(container).toMatchSnapshot()
  })
  test('check change toDate', () => {
    act(() => {
      ReactDOM.render(
        <Logs />,
        container,
      )
    })
    Simulate.change(document.getElementById('toDate'), { target: { value: '2020-02-01T00:00:00.000Z' } })
    expect(setState).toBeCalledWith('2020-02-01T00:00:00.000Z')
    expect(container).toMatchSnapshot()
  })
  test('check change filterText', () => {
    act(() => {
      ReactDOM.render(
        <Logs />,
        container,
      )
    })
    Simulate.change(document.getElementById('filterText'), { target: { value: 'debug' } })
    expect(setState).toBeCalledWith('debug')
    expect(container).toMatchSnapshot()
  })
  test('check change verbosity, uncheck debug', () => {
    act(() => {
      ReactDOM.render(
        <Logs />,
        container,
      )
    })
    Simulate.change(document.getElementById('verbosity'), { target: { checked: false } })
    expect(setVerbosity).toBeCalledWith(['info', 'warning', 'error'])
    expect(container).toMatchSnapshot()
  })
  test('check change verbosity, check silly', () => {
    act(() => {
      ReactDOM.render(
        <Logs />,
        container,
      )
    })
    Simulate.change(document.getElementsByClassName('oi-form-input form-check-input')[4], { target: { checked: true } })
    expect(setVerbosity).toBeCalledWith(['debug', 'info', 'warning', 'error', 'silly'])
    expect(container).toMatchSnapshot()
  })
  test('check press Show Logs, success in logs call', async () => {
    act(() => {
      ReactDOM.render(
        <Logs />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
    // resolve the call requested by showLog
    Simulate.click(document.getElementById('showLog'))
    await act(async () => {
      resolve(testLogs)
    })
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
    expect(setAlert).toHaveBeenCalled()
    console.error = originalError
  })
  test('check press showMore', () => {
    act(() => {
      ReactDOM.render(
        <Logs />,
        container,
      )
    })
    Simulate.click(document.getElementById('showMore'))
    expect(setState).toBeCalledWith(defaultMaxLog)
    expect(container).toMatchSnapshot()
    global.Date = RealDate
    global.Date.prototype.toLocaleString = realToLocaleString
    global.Date.prototype.toLocaleTimeString = realToLocaleTimeString
    global.Date.prototype.toLocaleDateString = realToLocaleDateString
  })
})
