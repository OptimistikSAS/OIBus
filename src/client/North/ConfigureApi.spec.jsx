/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import newConfig from '../../../tests/testConfig'
import ConfigureApi from './ConfigureApi.jsx'
import utils from '../helpers/utils'

const dispatchNewConfig = jest.fn()
React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig })
jest.mock('react-router-dom', () => (
  { useParams: jest.fn().mockReturnValue({ id: 'application-uuid-2' }) }
))

const mockMath = Object.create(global.Math)
mockMath.random = () => 1
global.Math = mockMath

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('ConfigureApi', () => {
  test('check ConfigureApi', () => {
    act(() => {
      ReactDOM.render(
        <ConfigureApi />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check update', () => {
    act(() => {
      ReactDOM.render(
        <ConfigureApi />, container,
      )
    })
    Simulate.change(document.getElementById('north.applications.1.OIConnect.host'), { target: { value: 'http://new_host' } })
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'north.applications.1.OIConnect.host',
      value: 'http://new_host',
      validity: null,
    })
    expect(container).toMatchSnapshot()
  })
  test('check application not found', () => {
    const reactUseContextMock = React.useContext
    // temporary empty applicartions array
    const config = utils.jsonCopy(newConfig)
    config.north.applications = []
    React.useContext = jest.fn().mockReturnValue({ newConfig: config, dispatchNewConfig })
    act(() => {
      ReactDOM.render(
        <ConfigureApi />, container,
      )
    })
    expect(container).toMatchSnapshot()
    React.useContext = reactUseContextMock
  })
})
