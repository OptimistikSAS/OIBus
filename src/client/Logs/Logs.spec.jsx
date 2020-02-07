import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'
import { BrowserRouter } from 'react-router-dom'

import Logs from './Logs.jsx'

// fixing date to match snapshot
const dateToTest = new Date(1577836800) // 2020-01-01T00:00:00.000Z
const testDate = Date
global.Date = jest.fn(() => dateToTest)
global.Date.UTC = testDate.UTC
global.Date.parse = testDate.parse
global.Date.now = testDate.now

// sample test logs
const testLogs = [{
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
}]

// setting initial test logs to be displayed
const setState = jest.fn()
React.useState = jest.fn().mockImplementation((init) => (
  [init === undefined ? testLogs : init, setState]
))

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
      ReactDOM.render(<BrowserRouter><Logs /></BrowserRouter>, container)
    })
    expect(container).toMatchSnapshot()
  })
})
