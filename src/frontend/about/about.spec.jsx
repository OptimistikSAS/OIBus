/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import apis from '../service/apis.js'
import utils from '../helpers/utils.js'
import About from './about.jsx'

import { testConfig } from '../../../tests/test-config.js'

// eslint-disable-next-line no-undef
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// sample status (object returned by Server to give various information about OIBus)
const status = {
  version: '2.2.2',
  currentDirectory: 'C:\\path\\to\\data\\directory',
  executable: 'C:\\path\\to\\oibus.exe',
  nodeVersion: 'v18.0.0',
  processId: 4916,
  hostname: 'EC2AMAZ-OBJ8M6C',
  osRelease: '10.0.14393',
  architecture: 'x64',
  osType: 'Windows_NT',
  copyright: '(c) Copyright 2019-2022 Optimistik, all rights reserved.',
}
let resolve
let reject
const setAlert = jest.fn()
apis.getOIBusInfo = () => new Promise((_resolve, _reject) => {
  resolve = _resolve
  reject = _reject
})
utils.createEventSource = jest.fn().mockImplementation(() => ({ close: jest.fn() }))
React.useContext = jest.fn().mockReturnValue({ activeConfig: testConfig, setAlert })

let container
let root
describe('About', () => {
  beforeEach(() => {
    container = document.createElement('div')
    root = ReactDOMClient.createRoot(container)
    document.body.appendChild(container)
  })

  afterEach(() => {
    jest.clearAllMocks()
    document.body.removeChild(container)
    container = null
    root = null
  })

  test('display page based on config and status', async () => {
    await act(() => {
      root.render(
        <About />,
      )
    })
    expect(container).toMatchSnapshot()
    // resolve the call requested by useEffect
    await act(async () => {
      resolve(status)
    })
    expect(container).toMatchSnapshot()
  })

  test('About: manage error in status call', async () => {
    const originalError = console.error
    console.error = jest.fn()
    await act(() => {
      root.render(
        <About />,
      )
    })
    // resolve the call requested by useEffect with a reject
    await act(async () => {
      reject('error')
    })
    expect(setAlert).toHaveBeenCalled()
    console.error = originalError
  })

  test('display About with config null', () => {
    React.useContext = jest.fn().mockReturnValue({ activeConfig: null, setAlert })
    act(() => {
      root.render(
        <About />,
      )
    })
    expect(container).toMatchSnapshot()
    React.useContext = jest.fn().mockReturnValue({ activeConfig: testConfig, setAlert })
  })
})
