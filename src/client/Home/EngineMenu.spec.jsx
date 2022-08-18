/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import EngineMenu from './EngineMenu.jsx'

import activeConfig from '../../../tests/testConfig.js'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => (
  { useNavigate: () => mockNavigate }
))

const restartFunction = jest.fn()
const shutdownFunction = jest.fn()

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
  jest.clearAllMocks()
})

React.useContext = jest.fn().mockReturnValue({ activeConfig })
describe('EngineMenu', () => {
  test('display EngineMenu page based on config', async () => {
    act(() => {
      root.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />,
      )
    })
    expect(container).toMatchSnapshot()
  })

  test('check restart engine', () => {
    act(() => {
      root.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />,
      )
    })
    act(() => (
      Simulate.click(document.getElementById('dropdown-toggle'))
    ))
    act(() => (
      Simulate.click(document.getElementById('restart'))
    ))
    act(() => (
      Simulate.click(document.getElementById('confirm'))
    ))
    expect(restartFunction).toBeCalled()
    expect(container).toMatchSnapshot()
  })

  test('check cancel restart', () => {
    act(() => {
      root.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />,
      )
    })
    act(() => (
      Simulate.click(document.getElementById('dropdown-toggle'))
    ))
    act(() => (
      Simulate.click(document.getElementById('restart'))
    ))
    act(() => (
      Simulate.click(document.getElementById('cancel'))
    ))

    expect(restartFunction).not.toBeCalled()
    expect(container).toMatchSnapshot()
  })

  test('check shutdown engine', () => {
    act(() => {
      root.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />,
      )
    })
    act(() => (
      Simulate.click(document.getElementById('dropdown-toggle'))
    ))
    act(() => (
      Simulate.click(document.getElementById('shutdown'))
    ))
    act(() => (
      Simulate.click(document.getElementById('confirm'))
    ))

    expect(container).toMatchSnapshot()
  })

  test('check cancel shutdown', () => {
    act(() => {
      root.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />,
      )
    })
    act(() => (
      Simulate.click(document.getElementById('dropdown-toggle'))
    ))
    act(() => (
      Simulate.click(document.getElementById('shutdown'))
    ))
    act(() => (
      Simulate.click(document.getElementById('cancel'))
    ))

    expect(shutdownFunction).not.toBeCalled()
    expect(container).toMatchSnapshot()
  })

  test('go to engine settings', () => {
    act(() => {
      root.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />,
      )
    })

    act(() => (
      Simulate.click(document.getElementById('dropdown-toggle'))
    ))

    act(() => (
      Simulate.click(document.getElementById('oi-settings'))
    ))

    expect(mockNavigate).toBeCalledWith('/engine')
    expect(container).toMatchSnapshot()
  })
})
