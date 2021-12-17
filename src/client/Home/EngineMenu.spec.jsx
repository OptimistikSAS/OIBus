/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import EngineMenu from './EngineMenu.jsx'

import activeConfig from '../../../tests/testConfig'

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
describe('EngineMenu', () => {
  test('display EngineMenu page based on config', async () => {
    act(() => {
      ReactDOM.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })

  test('check restart engine', () => {
    act(() => {
      ReactDOM.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />,
        container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('restart'))
    Simulate.click(document.getElementById('confirm'))
    expect(restartFunction).toBeCalled()
    expect(container).toMatchSnapshot()
  })

  test('check cancel restart', () => {
    act(() => {
      ReactDOM.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />,
        container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('restart'))
    Simulate.click(document.getElementById('cancel'))
    expect(restartFunction).not.toBeCalled()
    expect(container).toMatchSnapshot()
  })

  test('check shutdown engine', () => {
    act(() => {
      ReactDOM.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />,
        container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('shutdown'))
    Simulate.click(document.getElementById('confirm'))
    // expect(shutdownFunction).toBeCalled()
    expect(container).toMatchSnapshot()
  })

  test('check cancel shutdown', () => {
    act(() => {
      ReactDOM.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />,
        container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('shutdown'))
    Simulate.click(document.getElementById('cancel'))
    expect(shutdownFunction).not.toBeCalled()
    expect(container).toMatchSnapshot()
  })

  test('go to engine settings', () => {
    act(() => {
      ReactDOM.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />,
        container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('oi-settings'))
    expect(mockHistoryPush).toBeCalledWith({ pathname: '/engine/' })
    expect(container).toMatchSnapshot()
  })
})
