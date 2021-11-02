/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import * as nanoid from 'nanoid'
import { act, Simulate } from 'react-dom/test-utils'
import NorthMenu from './NorthMenu.jsx'
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

const application = newConfig.north.applications[0]

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

describe('Northmenu', () => {
  test('display NorthMenu properly when empty newConfig', async () => {
    React.useContext = jest.fn().mockReturnValue({ newConfig: null, dispatchNewConfig })

    act(() => {
      ReactDOM.render(
        <NorthMenu application={application} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({ newConfig: {}, dispatchNewConfig })

    act(() => {
      ReactDOM.render(
        <NorthMenu application={application} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({ newConfig: { north: {} }, dispatchNewConfig })

    act(() => {
      ReactDOM.render(
        <NorthMenu application={application} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({ newConfig: { north: { applications: [] } }, dispatchNewConfig })

    act(() => {
      ReactDOM.render(
        <NorthMenu application={application} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })

  test('display NorthMenu page based on config', async () => {
    act(() => {
      ReactDOM.render(
        <NorthMenu application={application} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })

  test('check duplicate application', () => {
    act(() => {
      ReactDOM.render(
        <NorthMenu application={application} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('oi-duplicate'))
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'addRow',
      name: 'north.applications',
      value: {
        ...application,
        name: 'c copy',
        enabled: false,
        id: 'generated-uuid',
      },
    })
    expect(container).toMatchSnapshot()
  })

  test('check duplicate application already copied', () => {
    const applicationWithCopyInName = newConfig.north.applications[8]

    act(() => {
      ReactDOM.render(
        <NorthMenu application={applicationWithCopyInName} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('oi-duplicate'))
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'addRow',
      name: 'north.applications',
      value: {
        ...applicationWithCopyInName,
        name: 'test04 copy2',
        enabled: false,
        id: 'generated-uuid',
      },
    })
    expect(container).toMatchSnapshot()
  })

  test('check edit first application', () => {
    act(() => {
      ReactDOM.render(
        <NorthMenu application={application} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('oi-settings'))
    expect(mockHistoryPush).toBeCalledWith({ pathname: `/north/${newConfig.north.applications[0].id}` })
    expect(container).toMatchSnapshot()
  })

  test('check delete first application', () => {
    act(() => {
      ReactDOM.render(
        <NorthMenu application={application} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('oi-delete'))
    Simulate.click(document.getElementById('confirm'))
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'deleteRow',
      name: 'north.applications.0',
    })
    expect(container).toMatchSnapshot()
  })

  test('check cancel delete first application', () => {
    act(() => {
      ReactDOM.render(
        <NorthMenu application={application} />, container,
      )
    })
    Simulate.click(document.getElementById('dropdown-toggle'))
    Simulate.click(document.getElementById('oi-delete'))
    Simulate.click(document.getElementById('cancel'))
    expect(dispatchNewConfig).not.toBeCalled()
    expect(container).toMatchSnapshot()
  })
})
