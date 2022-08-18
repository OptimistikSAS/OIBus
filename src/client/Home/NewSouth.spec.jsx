/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import NewSouth from './NewSouth.jsx'
import EngineMenu from './EngineMenu.jsx'

import newConfig from '../../../tests/testConfig.js'

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
    protocolList: [
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
        <NewSouth modal={false} toggle={() => false} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: null,
      dispatchNewConfig,
      protocolList: [
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
        <NewSouth modal={false} toggle={() => false} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: {},
      dispatchNewConfig,
      protocolList: [
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
        <NewSouth modal={false} toggle={() => false} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: { south: {} },
      dispatchNewConfig,
      protocolList: [
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
        <NewSouth modal={false} toggle={() => false} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: { south: { dataSources: [] } },
      dispatchNewConfig,
      protocolList: [
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
        <NewSouth modal={false} toggle={() => false} />,
      )
    })
    expect(container).toMatchSnapshot()
  })

  test('check change name with "new_application" id', () => {
    React.useContext = jest.fn().mockReturnValue({
      newConfig: { south: { dataSources: [] } },
      dispatchNewConfig,
      protocolList: [
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
      Simulate.change(document.getElementById('name'), { target: { value: 'new_application' } })
    })
    act(() => {
      Simulate.click(document.getElementById('confirm'))
    })
    expect(container).toMatchSnapshot()
  })

  test('check add connector without "protocol" & without new name', () => {
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

  test('check add connector without "protocol" & with new name', () => {
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
      Simulate.change(document.getElementById('name'), { target: { value: 'new_application' } })
    })
    act(() => {
      Simulate.click(document.getElementById('confirm'))
    })
    expect(container).toMatchSnapshot()
  })

  test('check add connector without "name" & with protocol', () => {
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
      Simulate.change(document.getElementById('name'), { target: { value: 'new_application' } })
    })
    act(() => {
      Simulate.click(document.getElementById('confirm'))
    })
    expect(container).toMatchSnapshot()
  })
})
