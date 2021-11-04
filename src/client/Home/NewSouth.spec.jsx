/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import NewSouth from './NewSouth.jsx'
import EngineMenu from './EngineMenu.jsx'

import newConfig from '../../../tests/testConfig'

const dispatchNewConfig = jest.fn()
const restartFunction = jest.fn()
const shutdownFunction = jest.fn()
const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))

let container

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
        connectorName: 'SQLDbToFile',
        category: 'IoT',
      },
      {
        connectorName: 'OPCHDA',
        category: 'IoT',
      },
    ],
  })

  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

React.useContext = jest.fn().mockReturnValue({ newConfig })
describe('NewSouth', () => {
  test('display NewSouth page based on config', async () => {
    act(() => {
      ReactDOM.render(
        <NewSouth modal={false} toggle={() => false} />,
        container,
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
          connectorName: 'SQLDbToFile',
          category: 'IoT',
        },
        {
          connectorName: 'OPCHDA',
          category: 'IoT',
        },
      ],
    })

    act(() => {
      ReactDOM.render(
        <NewSouth modal={false} toggle={() => false} />,
        container,
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
          connectorName: 'SQLDbToFile',
          category: 'IoT',
        },
        {
          connectorName: 'OPCHDA',
          category: 'IoT',
        },
      ],
    })

    act(() => {
      ReactDOM.render(
        <NewSouth modal={false} toggle={() => false} />,
        container,
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
          connectorName: 'SQLDbToFile',
          category: 'IoT',
        },
        {
          connectorName: 'OPCHDA',
          category: 'IoT',
        },
      ],
    })

    act(() => {
      ReactDOM.render(
        <NewSouth modal={false} toggle={() => false} />,
        container,
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
          connectorName: 'SQLDbToFile',
          category: 'IoT',
        },
        {
          connectorName: 'OPCHDA',
          category: 'IoT',
        },
      ],
    })

    act(() => {
      ReactDOM.render(
        <NewSouth modal={false} toggle={() => false} />,
        container,
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
          connectorName: 'SQLDbToFile',
          category: 'IoT',
        },
        {
          connectorName: 'OPCHDA',
          category: 'IoT',
        },
      ],
    })
    act(() => {
      ReactDOM.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('add-south'))
    Simulate.click(document.getElementById('icon-connector'))
    expect(document.getElementById('icon-connector').classList).toContain('connector-focus')
    Simulate.change(document.getElementById('name'), { target: { value: 'new_application' } })
    expect(container).toMatchSnapshot()
    Simulate.click(document.getElementById('confirm'))
  })

  test('check add connector without "protocol" & without new name', () => {
    act(() => {
      ReactDOM.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('add-south'))
    Simulate.click(document.getElementById('confirm'))
    expect(container).toMatchSnapshot()
  })

  test('check add connector without "protocol" & with new name', () => {
    act(() => {
      ReactDOM.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('add-south'))
    Simulate.change(document.getElementById('name'), { target: { value: 'new_application' } })
    Simulate.click(document.getElementById('confirm'))
    expect(container).toMatchSnapshot()
  })

  test('check add connector without "name" & with protocol', () => {
    act(() => {
      ReactDOM.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('add-south'))
    Simulate.click(document.getElementById('icon-connector'))
    Simulate.change(document.getElementById('name'), { target: { value: '' } })
    Simulate.click(document.getElementById('confirm'))
    expect(container).toMatchSnapshot()
  })
})
