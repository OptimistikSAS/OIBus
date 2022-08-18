/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'
import * as ReactDOMClient from 'react-dom/client'
import NodeView from './NodeView.jsx'
import newConfig from '../../../tests/testConfig.js'

const dispatchNewConfig = jest.fn()

global.EventSource = class {
  constructor() {
    this.close = () => {}
  }
}

// ReactFlow does not seem to be working with jest.
// so we have to mock this component
jest.mock('react-flow-renderer', () => () => 'ReactFlow')

let container
let root
// eslint-disable-next-line no-undef
globalThis.IS_REACT_ACT_ENVIRONMENT = true
beforeEach(() => {
  container = document.createElement('div')
  root = ReactDOMClient.createRoot(container)
  document.body.appendChild(container)

  React.useContext = jest.fn().mockReturnValue({
    newConfig,
    dispatchNewConfig,
  })
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
  root = null
})

// sample status (object returned by Server to give various informations on the behavior)
const status = { version: 'x.x.x' }

React.useContext = jest.fn().mockReturnValue({ newConfig })
describe('NodeView', () => {
  test('display main page based on config', async () => {
    act(() => {
      root.render(
        <NodeView status={status} onRestart={() => true} onShutdown={() => true} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: null,
      dispatchNewConfig,
    })

    act(() => {
      root.render(
        <NodeView status={status} onRestart={() => true} onShutdown={() => true} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: {},
      dispatchNewConfig,
    })

    act(() => {
      root.render(
        <NodeView status={status} onRestart={() => true} onShutdown={() => true} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: { south: {}, north: {} },
      dispatchNewConfig,
    })

    act(() => {
      root.render(
        <NodeView status={status} onRestart={() => true} onShutdown={() => true} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: { south: { dataSources: [] }, north: { applications: [] } },
      dispatchNewConfig,
    })

    act(() => {
      root.render(
        <NodeView status={status} onRestart={() => true} onShutdown={() => true} />,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
