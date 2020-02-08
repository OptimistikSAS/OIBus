import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'
import { BrowserRouter } from 'react-router-dom'

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
    timestamp: '2020-01-01T00:00:00.000Z',
    level: 'error',
    source: 'Source',
    message: 'Testing error logs',
  },
  {
    id: 5,
    timestamp: '2020-01-01T00:00:00.000Z',
    level: 'silly',
    source: 'Source',
    message: 'Testing silly logs',
  },
]

// setting initial test logs to be displayed
const setState = jest.fn()
React.useState = jest.fn().mockImplementation((init) => [init === undefined ? testLogs : init, setState])

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
        <BrowserRouter>
          <Logs />
        </BrowserRouter>,
        container,
      )
    })
    expect(container).toMatchSnapshot()
    global.Date = RealDate
    global.Date.prototype.toLocaleString = realToLocaleString
    global.Date.prototype.toLocaleTimeString = realToLocaleTimeString
    global.Date.prototype.toLocaleDateString = realToLocaleDateString
  })
})
