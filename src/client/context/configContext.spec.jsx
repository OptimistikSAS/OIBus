import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import { ConfigProvider } from './configContext.jsx'

// mock fetch
global.fetch = jest.fn().mockImplementation((uri) => {
  let jsonString
  switch (uri) {
    case '/config/schemas/north':
      jsonString = JSON.stringify(testConfig.north)
      break
    case '/config/schemas/south':
      jsonString = JSON.stringify(testConfig.south)
      break
    case '/config':
      jsonString = JSON.stringify(testConfig)
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
let initState = 'apiList'
const setActiveConfig = jest.fn()
const setApiList = jest.fn()
const setProtocolList = jest.fn()
const setState = jest.fn()
React.useState = jest.fn().mockImplementation((init) => {
  if (init === null) {
    return [init, setActiveConfig]
  }
  if (init === undefined && initState === 'apiList') {
    initState = 'protocolList'
    return [init, setApiList]
  }
  if (init === undefined && initState === 'protocolList') {
    initState = 'apiList'
    return [init, setProtocolList]
  }
  return [init, setState]
})

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('ConfigProvider', () => {
  test('check ConfigProvider', () => {
    act(() => {
      ReactDOM.render(
        <ConfigProvider>
          <div />
        </ConfigProvider>,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
