/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'
import HomePage from './HomePage.jsx'

import activeConfig from '../../../tests/testConfig'

// ReacFlow does not seem to be working with jest.
// so we have to mock this component
jest.mock('../../../node_modules/react-flow-renderer/dist/ReactFlow.js', () => () => 'ReactFlow')

global.EventSource = class {
  constructor() {
    this.close = () => {}
  }
}

let container

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

const setAlert = jest.fn()

React.useContext = jest.fn().mockReturnValue({ activeConfig, setAlert })
describe('HomePage', () => {
  test('display Health page based on config', async () => {
    act(() => {
      ReactDOM.render(
        <HomePage />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('display Health with config null', () => {
    React.useContext = jest.fn().mockReturnValue({ activeConfig: null, setAlert })
    act(() => {
      ReactDOM.render(
        <HomePage />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
    React.useContext = jest.fn().mockReturnValue({ activeConfig, setAlert })
  })
})
