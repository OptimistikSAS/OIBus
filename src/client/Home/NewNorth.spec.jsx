/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import NewNorth from './NewNorth.jsx'
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
    apiList: [
      {
        connectorName: 'Console',
        category: 'Debug',
      },
      {
        connectorName: 'InfluxDB',
        category: 'Database',
      },
      {
        connectorName: 'TimescaleDB',
        category: 'Database',
      },
      {
        connectorName: 'OIAnalytics',
        category: 'OI',
      },
      {
        connectorName: 'AmazonS3',
        category: 'FileIn',
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

describe('NewNorth', () => {
  test('display NewNorth page based on config', async () => {
    act(() => {
      ReactDOM.render(
        <NewNorth modal={false} toggle={() => false} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: null,
      dispatchNewConfig,
      apiList: [
        {
          connectorName: 'Console',
          category: 'Debug',
        },
        {
          connectorName: 'InfluxDB',
          category: 'Database',
        },
        {
          connectorName: 'TimescaleDB',
          category: 'Database',
        },
        {
          connectorName: 'OIAnalytics',
          category: 'OI',
        },
        {
          connectorName: 'AmazonS3',
          category: 'File',
        },
      ],
    })

    act(() => {
      ReactDOM.render(
        <NewNorth modal={false} toggle={() => false} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: {},
      dispatchNewConfig,
      apiList: [
        {
          connectorName: 'Console',
          category: 'Debug',
        },
        {
          connectorName: 'InfluxDB',
          category: 'Database',
        },
        {
          connectorName: 'TimescaleDB',
          category: 'Database',
        },
        {
          connectorName: 'OIAnalytics',
          category: 'OI',
        },
        {
          connectorName: 'AmazonS3',
          category: 'File',
        },
      ],
    })

    act(() => {
      ReactDOM.render(
        <NewNorth modal={false} toggle={() => false} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: { north: {} },
      dispatchNewConfig,
      apiList: [
        {
          connectorName: 'Console',
          category: 'Debug',
        },
        {
          connectorName: 'InfluxDB',
          category: 'Database',
        },
        {
          connectorName: 'TimescaleDB',
          category: 'Database',
        },
        {
          connectorName: 'OIAnalytics',
          category: 'OI',
        },
        {
          connectorName: 'AmazonS3',
          category: 'File',
        },
      ],
    })

    act(() => {
      ReactDOM.render(
        <NewNorth modal={false} toggle={() => false} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: { north: { applications: [] } },
      dispatchNewConfig,
      apiList: [
        {
          connectorName: 'Console',
          category: 'Debug',
        },
        {
          connectorName: 'InfluxDB',
          category: 'Database',
        },
        {
          connectorName: 'TimescaleDB',
          category: 'Database',
        },
        {
          connectorName: 'OIAnalytics',
          category: 'OI',
        },
        {
          connectorName: 'AmazonS3',
          category: 'File',
        },
      ],
    })

    act(() => {
      ReactDOM.render(
        <NewNorth modal={false} toggle={() => false} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })

  test('check change name with "new_application" id', () => {
    React.useContext = jest.fn().mockReturnValue({
      newConfig: { north: { applications: [] } },
      dispatchNewConfig,
      apiList: [
        {
          connectorName: 'Console',
          category: 'Debug',
        },
        {
          connectorName: 'InfluxDB',
          category: 'Database',
        },
        {
          connectorName: 'TimescaleDB',
          category: 'Database',
        },
        {
          connectorName: 'OIAnalytics',
          category: 'OI',
        },
        {
          connectorName: 'AmazonS3',
          category: 'File',
        },
      ],
    })

    act(() => {
      ReactDOM.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('add-north'))
    Simulate.click(document.getElementById('icon-connector'))
    expect(document.getElementById('icon-connector').classList).toContain('connector-focus')
    Simulate.change(document.getElementById('name'), { target: { value: 'new_application' } })
    Simulate.click(document.getElementById('confirm'))
    expect(container).toMatchSnapshot()
  })

  test('check add connector without protocol & without new name', () => {
    act(() => {
      ReactDOM.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('add-north'))
    Simulate.click(document.getElementById('confirm'))
    expect(container).toMatchSnapshot()
  })

  test('check add connector without protocol & with new name', () => {
    act(() => {
      ReactDOM.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('add-north'))
    Simulate.change(document.getElementById('name'), { target: { value: 'new_application' } })
    expect(container).toMatchSnapshot()
    Simulate.click(document.getElementById('confirm'))
  })

  test('check add connector without name & with protocol', () => {
    act(() => {
      ReactDOM.render(
        <EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('add-north'))
    Simulate.click(document.getElementById('icon-connector'))
    Simulate.change(document.getElementById('name'), { target: { value: '' } })
    Simulate.click(document.getElementById('confirm'))
    expect(container).toMatchSnapshot()
  })
})
