/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import NewSouth from './NewSouth.jsx'

import newConfig from '../../../tests/testConfig'

const dispatchNewConfig = jest.fn()

let container

beforeEach(() => {
  React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig, protocolList: ['PROTOCOL1', 'PROTOCOL2', 'PROTOCOL3'] })

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
        <NewSouth />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: null,
      dispatchNewConfig,
      protocolList: ['PROTOCOL1', 'PROTOCOL2', 'PROTOCOL3'],
    })

    act(() => {
      ReactDOM.render(
        <NewSouth />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: {},
      dispatchNewConfig,
      protocolList: ['PROTOCOL1', 'PROTOCOL2', 'PROTOCOL3'],
    })

    act(() => {
      ReactDOM.render(
        <NewSouth />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: { south: {} },
      dispatchNewConfig,
      protocolList: ['PROTOCOL1', 'PROTOCOL2', 'PROTOCOL3'],
    })

    act(() => {
      ReactDOM.render(
        <NewSouth />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: { south: { dataSources: [] } },
      dispatchNewConfig,
      protocolList: ['PROTOCOL1', 'PROTOCOL2', 'PROTOCOL3'],
    })

    act(() => {
      ReactDOM.render(
        <NewSouth />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
