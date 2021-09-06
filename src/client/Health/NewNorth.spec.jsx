/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import NewNorth from './NewNorth.jsx'

import newConfig from '../../../tests/testConfig'

let container

const dispatchNewConfig = jest.fn()

beforeEach(() => {
  React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig, apiList: ['API1', 'API2', 'API3'] })
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
        <NewNorth />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: null,
      dispatchNewConfig,
      apiList: ['API1', 'API2', 'API3'],
    })

    act(() => {
      ReactDOM.render(
        <NewNorth />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: {},
      dispatchNewConfig,
      apiList: ['API1', 'API2', 'API3'],
    })

    act(() => {
      ReactDOM.render(
        <NewNorth />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: { north: {} },
      dispatchNewConfig,
      apiList: ['API1', 'API2', 'API3'],
    })

    act(() => {
      ReactDOM.render(
        <NewNorth />,
        container,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({
      newConfig: { north: { applications: [] } },
      dispatchNewConfig,
      apiList: ['API1', 'API2', 'API3'],
    })

    act(() => {
      ReactDOM.render(
        <NewNorth />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })

  // TODO: improve this test to check handleAddApplication
  test('check add pressed with "new_application" id', () => {
    act(() => {
      ReactDOM.render(
        <NewNorth />, container,
      )
    })
    Simulate.click(document.getElementById('add-north'))
    // Simulate.change(document.getElementById('name'), { target: { value: 'new_application' } })
    // Simulate.click(document.getElementById('icon-add'))
    expect(container).toMatchSnapshot()
  })
})
