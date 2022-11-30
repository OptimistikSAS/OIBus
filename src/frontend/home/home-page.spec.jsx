/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'
import * as ReactDOMClient from 'react-dom/client'
import HomePage from './home-page.jsx'

import { testConfig } from '../../../tests/test-config.js'

// ReacFlow does not seem to be working with jest.
// so we have to mock this component
jest.mock('react-flow-renderer', () => () => 'ReactFlow')

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

const setAlert = jest.fn()

React.useContext = jest.fn().mockReturnValue({ activeConfig: testConfig, setAlert })
describe('HomePage', () => {
  test('display Health page based on config', async () => {
    act(() => {
      root.render(
        <HomePage />,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('display Health with config null', () => {
    React.useContext = jest.fn().mockReturnValue({ activeConfig: null, setAlert })
    act(() => {
      root.render(
        <HomePage />,
      )
    })
    expect(container).toMatchSnapshot()
    React.useContext = jest.fn().mockReturnValue({ activeConfig: testConfig, setAlert })
  })
})
