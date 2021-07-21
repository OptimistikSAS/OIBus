/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'
import newConfig from '../../../tests/testConfig'
import ConfigureProtocol from './ConfigureProtocol.jsx'
import utils from '../helpers/utils'

const dispatchNewConfig = jest.fn()
React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig })
jest.mock('react-router-dom', () => (
  {
    useParams: jest.fn().mockReturnValue({ dataSourceId: 'OPC-HDA' }),
    useHistory: jest.fn(),
  }
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

describe('ConfigureProtocol', () => {
  test('check ConfigureProtocol', () => {
    act(() => {
      ReactDOM.render(<ConfigureProtocol />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check update', () => {
    act(() => {
      ReactDOM.render(<ConfigureProtocol />, container)
    })
    Simulate.change(document.getElementById('south.dataSources.8.OPCHDA.host'), { target: { value: 'newhost' } })
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'south.dataSources.8.OPCHDA.host',
      value: 'newhost',
      validity: null,
    })
    expect(container).toMatchSnapshot()
  })
  test('check datasource not found', () => {
    const reactUseContextMock = React.useContext
    // temporary empty applicartions array
    const config = utils.jsonCopy(newConfig)
    config.south.dataSources = []
    React.useContext = jest.fn().mockReturnValue({ newConfig: config, dispatchNewConfig })
    act(() => {
      ReactDOM.render(<ConfigureProtocol />, container)
    })
    expect(container).toMatchSnapshot()
    React.useContext = reactUseContextMock
  })
})
