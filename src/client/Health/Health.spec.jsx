import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

// need BrowserRouter so Link component is not complaining
import { BrowserRouter } from 'react-router-dom'

import apis from '../services/apis'
import Health from './Health.jsx'

import activeConfig from '../../../tests/testConfig'

let container

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

// sample status (object returned by Server to give various informations on the behavior)
const status = {
  Version: 'x.x.x',
  Architecture: 'x64',
  CurrentDirectory: '/Users/jfh/Work/OIBus/tests',
  'Node Version': 'v12.14.0',
  Executable: '/usr/local/bin/node',
  ConfigFile: '/Users/jfh/Work/OIBus/tests/oibus.json',
  Copyright: '(c) Copyright 2019 Optimistik, all rights reserved.',
}
// mock get Status
let resolve
apis.getStatus = () => (
  new Promise((_resolve) => {
    resolve = _resolve
  })
)

React.useContext = jest.fn().mockReturnValue({ activeConfig })

describe('Health', () => {
  test('display Health page based on config and status', async () => {
    act(() => {
      ReactDOM.render(<BrowserRouter><Health /></BrowserRouter>, container)
    })
    expect(container).toMatchSnapshot()
    // resolve the call requested by useffect
    await act(async () => {
      resolve(status)
    })
    expect(container).toMatchSnapshot()
  })
})
