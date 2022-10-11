/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import NewNorth from './NewNorth.jsx'
import EngineMenu from './EngineMenu.jsx'

import newConfig from '../../../tests/testConfig'

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
    northTypes: [
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
  root = ReactDOMClient.createRoot(container)
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
  root = null
})

describe('NewNorth', () => {
  test('display NewNorth page based on config', async () => {
    act(() => {
      root.render(
        <NewNorth modal={false} toggle={() => false} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: null,
      dispatchNewConfig,
      northTypes: [
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
      root.render(
        <NewNorth modal={false} toggle={() => false} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: {},
      dispatchNewConfig,
      northTypes: [
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
      root.render(
        <NewNorth modal={false} toggle={() => false} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: { north: {} },
      dispatchNewConfig,
      northTypes: [
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
      root.render(<NewNorth modal={false} toggle={() => false} />)
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: { north: [] },
      dispatchNewConfig,
      northTypes: [
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
      root.render(
        <NewNorth modal={false} toggle={() => false} />,
      )
    })
    expect(container).toMatchSnapshot()
  })

  test('check change name with "new_north" id', () => {
    React.useContext = jest.fn().mockReturnValue({
      newConfig: { north: [] },
      dispatchNewConfig,
      northTypes: [
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
      root.render(<EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />)
    })
    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })
    act(() => {
      Simulate.click(document.getElementById('add-north'))
    })
    act(() => {
      Simulate.click(document.getElementById('icon-connector'))
    })
    expect(document.getElementById('icon-connector').classList).toContain('connector-focus')
    act(() => {
      Simulate.change(document.getElementById('name'), { target: { value: 'new_north' } })
    })
    act(() => {
      Simulate.click(document.getElementById('confirm'))
    })
    expect(container).toMatchSnapshot()
  })

  test('check add connector without north type & without new name', () => {
    act(() => {
      root.render(<EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />)
    })
    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })
    act(() => {
      Simulate.click(document.getElementById('add-north'))
    })
    act(() => {
      Simulate.click(document.getElementById('confirm'))
    })
    expect(container).toMatchSnapshot()
  })

  test('check add connector without north type & with new name', () => {
    act(() => {
      root.render(<EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />)
    })

    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })
    act(() => {
      Simulate.click(document.getElementById('add-north'))
    })
    act(() => {
      Simulate.change(document.getElementById('name'), { target: { value: 'new_north' } })
    })
    act(() => {
      Simulate.click(document.getElementById('confirm'))
    })
    expect(container).toMatchSnapshot()
  })

  test('check add connector without name & with north type', () => {
    act(() => {
      root.render(<EngineMenu onRestart={restartFunction} onShutdown={shutdownFunction} />)
    })
    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })
    act(() => {
      Simulate.click(document.getElementById('add-north'))
    })
    act(() => {
      Simulate.click(document.getElementById('icon-connector'))
    })
    act(() => {
      Simulate.change(document.getElementById('name'), { target: { value: '' } })
    })
    act(() => {
      Simulate.click(document.getElementById('confirm'))
    })
    expect(container).toMatchSnapshot()
  })
})
