/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import * as nanoid from 'nanoid'
import { act, Simulate } from 'react-dom/test-utils'
import SouthMenu from './SouthMenu.jsx'
import newConfig from '../../../tests/testConfig'

// mocking the nanoid method
jest.mock('nanoid')
jest.spyOn(nanoid, 'nanoid').mockReturnValue('generated-uuid')

// ReacFlow does not seem to be working with jest.
// so we have to mock this component
jest.mock('../../../node_modules/react-flow-renderer/dist/ReactFlow.js', () => () => ('ReactFlow'))

const dispatchNewConfig = jest.fn((link) => link)

const mockHistoryPush = jest.fn()

jest.mock('react-router-dom', () => (
  { useHistory: () => ({ push: mockHistoryPush }) }
))

const dataSource = newConfig.south.dataSources[0]

let container

beforeEach(() => {
  React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig })
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
  jest.clearAllMocks()
})

describe('SouthMenu', () => {
  test('display SouthMenu properly when empty newConfig', async () => {
    React.useContext = jest.fn().mockReturnValue({ newConfig: null, dispatchNewConfig })

    act(() => {
      ReactDOM.render(
        <SouthMenu dataSource={dataSource} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({ newConfig: {}, dispatchNewConfig })

    act(() => {
      ReactDOM.render(
        <SouthMenu dataSource={dataSource} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({ newConfig: { south: {} }, dispatchNewConfig })

    act(() => {
      ReactDOM.render(
        <SouthMenu dataSource={dataSource} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({ newConfig: { south: { dataSources: [] } }, dispatchNewConfig })

    act(() => {
      ReactDOM.render(
        <SouthMenu dataSource={dataSource} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })

  test('display SouthMenu page based on config', async () => {
    act(() => {
      ReactDOM.render(
        <SouthMenu dataSource={dataSource} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })

  test('check duplicate dataSource', async () => {
    act(() => {
      ReactDOM.render(
        <SouthMenu dataSource={dataSource} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('oi-duplicate'))
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'addRow',
      name: 'south.dataSources',
      value: {
        ...dataSource,
        name: 'MQTTServer copy',
        enabled: false,
        id: 'generated-uuid',
      },
    })
    expect(container).toMatchSnapshot()
  })

  test('check duplicate dataSource already copied', async () => {
    const dataSourceWithCopyInName = newConfig.south.dataSources[2]

    act(() => {
      ReactDOM.render(
        <SouthMenu dataSource={dataSourceWithCopyInName} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('oi-duplicate'))
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'addRow',
      name: 'south.dataSources',
      value: {
        ...dataSourceWithCopyInName,
        name: 'SimulationServerBis copy2',
        enabled: false,
        id: 'generated-uuid',
      },
    })
    expect(container).toMatchSnapshot()
  })

  test('check edit first dataSource', () => {
    act(() => {
      ReactDOM.render(
        <SouthMenu dataSource={dataSource} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('oi-settings'))
    expect(mockHistoryPush).toBeCalledWith({ pathname: `/south/${newConfig.south.dataSources[0].id}` })
    expect(container).toMatchSnapshot()
  })

  test('check status first dataSource', () => {
    act(() => {
      ReactDOM.render(
        <SouthMenu dataSource={dataSource} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('oi-status'))
    expect(mockHistoryPush).toBeCalledWith({ pathname: `/south/${newConfig.south.dataSources[0].id}/live` })
    expect(container).toMatchSnapshot()
  })

  test('check delete first dataSource', () => {
    act(() => {
      ReactDOM.render(
        <SouthMenu dataSource={dataSource} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('oi-delete'))
    Simulate.click(document.getElementById('confirm'))
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'deleteRow',
      name: 'south.dataSources.0',
    })
    expect(container).toMatchSnapshot()
  })

  test('check cancel delete first dataSource', () => {
    act(() => {
      ReactDOM.render(
        <SouthMenu dataSource={dataSource} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('oi-delete'))
    Simulate.click(document.getElementById('cancel'))
    expect(dispatchNewConfig).not.toBeCalled()
    expect(container).toMatchSnapshot()
  })
})
