/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import EngineSettings from './EngineSettings.jsx'

import activeConfig from '../../../tests/testConfig'
import SouthSettings from './SouthSettings'

// ReacFlow does not seem to be working with jest.
// so we have to mock this component
jest.mock('../../../node_modules/react-flow-renderer/dist/ReactFlow.js', () => () => ('ReactFlow'))

const mockHistoryPush = jest.fn()

jest.mock('react-router-dom', () => (
  { useHistory: () => ({ push: mockHistoryPush }) }
))

const restartFunction = jest.fn()
const shutdownFunction = jest.fn()

let container

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
  jest.clearAllMocks()
})

React.useContext = jest.fn().mockReturnValue({ activeConfig })
describe('EngineSettings', () => {
  test('display EngineSettings page based on config', async () => {
    act(() => {
      ReactDOM.render(
        <EngineSettings onRestart={restartFunction} onShutdown={shutdownFunction} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })

  test('check restart engine', () => {
    act(() => {
      ReactDOM.render(
        <EngineSettings onRestart={restartFunction} onShutdown={shutdownFunction} />,
        container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('icon-restart'))
    Simulate.click(document.getElementById('restart-button'))
    expect(restartFunction).toBeCalled()
    expect(container).toMatchSnapshot()
  })

  test('check cancel restart', () => {
    act(() => {
      ReactDOM.render(
        <EngineSettings onRestart={restartFunction} onShutdown={shutdownFunction} />,
        container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('icon-restart'))
    Simulate.click(document.getElementById('cancel-restart'))
    expect(restartFunction).not.toBeCalled()
    expect(container).toMatchSnapshot()
  })

  test('check shutdown engine', () => {
    act(() => {
      ReactDOM.render(
        <EngineSettings onRestart={restartFunction} onShutdown={shutdownFunction} />,
        container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('icon-shutdown'))
    Simulate.click(document.getElementById('shutdown-button'))
    expect(shutdownFunction).toBeCalled()
    expect(container).toMatchSnapshot()
  })

  test('check cancel shutdown', () => {
    act(() => {
      ReactDOM.render(
        <EngineSettings onRestart={restartFunction} onShutdown={shutdownFunction} />,
        container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('icon-shutdown'))
    Simulate.click(document.getElementById('cancel-shutdown'))
    expect(shutdownFunction).not.toBeCalled()
    expect(container).toMatchSnapshot()
  })

  test('go to engine settings', () => {
    act(() => {
      ReactDOM.render(
        <EngineSettings onRestart={restartFunction} onShutdown={shutdownFunction} />,
        container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('icon-settings'))
    expect(mockHistoryPush).toBeCalledWith({ pathname: '/Engine/' })
    expect(container).toMatchSnapshot()
  })
})
