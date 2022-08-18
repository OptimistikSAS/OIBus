/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import apis from '../services/apis.js'
import About from './About.jsx'

import activeConfig from '../../../tests/testConfig.js'

global.EventSource = class {
  constructor() {
    this.close = () => {}
  }
}

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

// sample status (object returned by Server to give various informations on the behavior)
const status = {
  version: '0.5.7-dev',
  architecture: 'x64',
  currentDirectory: 'C:\\Users\\jfh\\Documents\\GitHub\\OIBus\\tests',
  nodeVersion: 'v12.13.1',
  executable: 'C:\\Users\\jfh\\Documents\\GitHub\\OIBus\\dist\\win\\oibus.exe',
  configurationFile: 'C:\\Users\\jfh\\Documents\\GitHub\\OIBus\\tests\\oibus.json',
  memory: '564.89/2047.61/27.59 MB/%',
  rss: '127.80/128.79/354.32 MB',
  heapTotal: '79.55/81.54/281.62 MB',
  heapUsed: '60.54/60.54/261.28 MB',
  external: '1.99/2.16/3.16 MB',
  processId: 4916,
  uptime: '3 minutes',
  hostname: 'EC2AMAZ-OBJ8M6C',
  osRelease: '10.0.14393',
  osType: 'Windows_NT',
  apisCacheStats: [
    {
      name: 'Console (points)',
      count: 195410,
      cache: 614,
    },
    {
      name: 'Console (files)',
      count: 195410,
      cache: 0,
    },
  ],
  protocolsCacheStats: [
    {
      name: 'MQTTServer',
      count: 62,
    },
    {
      name: 'SimulationServer',
      count: 422,
    },
    {
      name: 'OPC-HDA',
      count: 194926,
    },
  ],
  copyright: '(c) Copyright 2019 Optimistik, all rights reserved.',
}
// mock get Status
let resolve
let reject
const setAlert = jest.fn()
apis.getOIBusInfo = () => new Promise((_resolve, _reject) => {
  resolve = _resolve
  reject = _reject
})
React.useContext = jest.fn().mockReturnValue({ activeConfig, setAlert })
describe('About', () => {
  test('display About page based on config and status', async () => {
    act(() => {
      root.render(
        <About />,
      )
    })
    expect(container).toMatchSnapshot()
    // resolve the call requested by useffect
    await act(async () => {
      resolve(status)
    })
    expect(container).toMatchSnapshot()
  })
  test('About: manage error in status call', async () => {
    const originalError = console.error
    console.error = jest.fn()
    act(() => {
      root.render(
        <About />,
      )
    })
    // resolve the call requested by useffect with a reject
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
    React.useContext = jest.fn().mockReturnValue({ activeConfig, setAlert })
  })
})
