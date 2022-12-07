/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import NewSouth from './new-south.jsx'
import EngineMenu from './engine-menu.jsx'

import newConfig from '../../../tests/test-config.js'

const dispatchNewConfig = jest.fn()
const restartFunction = jest.fn()
const shutdownFunction = jest.fn()
const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))

let container
let root
// eslint-disable-next-line no-undef
globalThis.IS_REACT_ACT_ENVIRONMENT = true
beforeEach(() => {
  React.useContext = jest.fn().mockReturnValue({
    newConfig,
    dispatchNewConfig,
    southTypes: [
      {
        connectorName: 'OPCUA_HA',
        category: 'IoT',
      },
      {
        connectorName: 'MQTT',
        category: 'MMM',
      },
      {
        connectorName: 'FolderScanner',
        category: 'IoT',
      },
      {
        connectorName: 'SQL',
        category: 'IoT',
      },
      {
        connectorName: 'OPCHDA',
        category: 'IoT',
      },
    ],
  })
  container = document.createElement('div')
  root = ReactDOMClient.createRoot(container)
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
  root = null
})

React.useContext = jest.fn().mockReturnValue({ newConfig })
describe('NewSouth', () => {
  test('display NewSouth page based on config', async () => {
    act(() => {
      root.render(
        <NewSouth displayModal={false} toggle={() => false} callback={() => null} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: null,
      dispatchNewConfig,
      southTypes: [
        {
          connectorName: 'OPCUA_HA',
          category: 'IoT',
        },
        {
          connectorName: 'MQTT',
          category: 'IoT',
        },
        {
          connectorName: 'FolderScanner',
          category: 'IoT',
        },
        {
          connectorName: 'SQL',
          category: 'IoT',
        },
        {
          connectorName: 'OPCHDA',
          category: 'IoT',
        },
      ],
    })

    act(() => {
      root.render(
        <NewSouth displayModal={false} toggle={() => false} callback={() => null} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: {},
      dispatchNewConfig,
      southTypes: [
        {
          connectorName: 'OPCUA_HA',
          category: 'IoT',
        },
        {
          connectorName: 'MQTT',
          category: 'IoT',
        },
        {
          connectorName: 'FolderScanner',
          category: 'IoT',
        },
        {
          connectorName: 'SQL',
          category: 'IoT',
        },
        {
          connectorName: 'OPCHDA',
          category: 'IoT',
        },
      ],
    })

    act(() => {
      root.render(
        <NewSouth displayModal={false} toggle={() => false} callback={() => null} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: { south: {} },
      dispatchNewConfig,
      southTypes: [
        {
          connectorName: 'OPCUA_HA',
          category: 'IoT',
        },
        {
          connectorName: 'MQTT',
          category: 'IoT',
        },
        {
          connectorName: 'FolderScanner',
          category: 'IoT',
        },
        {
          connectorName: 'SQL',
          category: 'IoT',
        },
        {
          connectorName: 'OPCHDA',
          category: 'IoT',
        },
      ],
    })

    act(() => {
      root.render(
        <NewSouth displayModal={false} toggle={() => false} callback={() => null} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: { south: [] },
      dispatchNewConfig,
      southTypes: [
        {
          connectorName: 'OPCUA_HA',
          category: 'IoT',
        },
        {
          connectorName: 'MQTT',
          category: 'IoT',
        },
        {
          connectorName: 'FolderScanner',
          category: 'IoT',
        },
        {
          connectorName: 'SQL',
          category: 'IoT',
        },
        {
          connectorName: 'OPCHDA',
          category: 'IoT',
        },
      ],
    })

    act(() => {
      root.render(
        <NewSouth displayModal={false} toggle={() => false} callback={() => null} />,
      )
    })
    expect(container).toMatchSnapshot()
  })

  test('check change name with "new_south" id', () => {
    React.useContext = jest.fn().mockReturnValue({
      newConfig: { south: [] },
      dispatchNewConfig,
      southTypes: [
        {
          connectorName: 'OPCUA_HA',
          category: 'IoT',
        },
        {
          connectorName: 'MQTT',
          category: 'IoT',
        },
        {
          connectorName: 'FolderScanner',
          category: 'IoT',
        },
        {
          connectorName: 'SQL',
          category: 'IoT',
        },
        {
          connectorName: 'OPCHDA',
          category: 'IoT',
        },
      ],
    })
    act(() => {
      root.render(<EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />)
    })
    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })
    act(() => {
      Simulate.click(document.getElementById('add-south'))
    })
    act(() => {
      Simulate.click(document.getElementById('icon-connector'))
    })

    expect(document.getElementById('icon-connector').classList).toContain('connector-focus')
    act(() => {
      Simulate.change(document.getElementById('name'), { target: { value: 'new_south' } })
    })
    act(() => {
      Simulate.click(document.getElementById('confirm'))
    })
    expect(container).toMatchSnapshot()
  })

  test('check add connector without "south type" & without new name', () => {
    act(() => {
      root.render(<EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />)
    })
    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })
    act(() => {
      Simulate.click(document.getElementById('add-south'))
    })
    act(() => {
      Simulate.click(document.getElementById('confirm'))
    })

    expect(container).toMatchSnapshot()
  })

  test('check add connector without "south type" & with new name', () => {
    act(() => {
      root.render(<EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />)
    })

    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })
    act(() => {
      Simulate.click(document.getElementById('add-south'))
    })
    act(() => {
      Simulate.change(document.getElementById('name'), { target: { value: 'new_south' } })
    })
    act(() => {
      Simulate.click(document.getElementById('confirm'))
    })
    expect(container).toMatchSnapshot()
  })

  test('check add connector without "name" & with south type', () => {
    act(() => {
      root.render(<EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />)
    })
    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })
    act(() => {
      Simulate.click(document.getElementById('add-south'))
    })
    act(() => {
      Simulate.click(document.getElementById('icon-connector'))
    })
    act(() => {
      Simulate.change(document.getElementById('name'), { target: { value: 'new_south' } })
    })
    act(() => {
      Simulate.click(document.getElementById('confirm'))
    })
    expect(container).toMatchSnapshot()
  })
})
