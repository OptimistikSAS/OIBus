/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'
import NodeView from './NodeView.jsx'
import newConfig from '../../../tests/testConfig'

const dispatchNewConfig = jest.fn()

global.EventSource = class {
  constructor() {
    this.close = () => {}
  }
}

// ReactFlow does not seem to be working with jest.
// so we have to mock this component
jest.mock('../../../node_modules/react-flow-renderer/dist/esm/index.js', () => () => ('ReactFlow'))

let container

beforeEach(() => {
  React.useContext = jest.fn().mockReturnValue({
    newConfig,
    dispatchNewConfig,
  })
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

// sample status (object returned by Server to give various informations on the behavior)
const status = { version: 'x.x.x' }

React.useContext = jest.fn().mockReturnValue({ newConfig })
describe('NodeView', () => {
  test('display main page based on config', async () => {
    act(() => {
      ReactDOM.render(
        <NodeView status={status} onRestart={() => true} onShutdown={() => true} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: null,
      dispatchNewConfig,
    })

    act(() => {
      ReactDOM.render(
        <NodeView status={status} onRestart={() => true} onShutdown={() => true} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: {},
      dispatchNewConfig,
    })

    act(() => {
      ReactDOM.render(
        <NodeView status={status} onRestart={() => true} onShutdown={() => true} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: { south: {}, north: {} },
      dispatchNewConfig,
    })

    act(() => {
      ReactDOM.render(
        <NodeView status={status} onRestart={() => true} onShutdown={() => true} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: { south: { dataSources: [] }, north: { applications: [] } },
      dispatchNewConfig,
    })

    act(() => {
      ReactDOM.render(
        <NodeView status={status} onRestart={() => true} onShutdown={() => true} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
