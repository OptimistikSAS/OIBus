/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'
import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../tests/testConfig'
import ConfigureProtocol from './ConfigureProtocol.jsx'
import utils from '../helpers/utils'

const dispatchNewConfig = jest.fn()
React.useContext = jest.fn().mockReturnValue({ newConfig: testConfig, dispatchNewConfig })
jest.mock('react-router-dom', () => (
  {
    useParams: jest.fn().mockReturnValue({ id: 'south-uuid-1' }),
    useNavigate: jest.fn(),
  }
))

const mockMath = Object.create(global.Math)
mockMath.random = () => 1
global.Math = mockMath

let container
let root
// eslint-disable-next-line no-undef
globalThis.IS_REACT_ACT_ENVIRONMENT = true
beforeEach(() => {
  container = document.createElement('div')
  root = ReactDOMClient.createRoot(container)
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
  root = null
})

describe('ConfigureProtocol', () => {
  test('check ConfigureProtocol', () => {
    act(() => {
      root.render(<ConfigureProtocol />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check update', () => {
    act(() => {
      root.render(<ConfigureProtocol />)
    })
    act(() => {
      Simulate.change(document.getElementById('south.dataSources.0.FolderScanner.inputFolder'), { target: { value: './myNewInputFolder' } })
    })

    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'south.dataSources.0.FolderScanner.inputFolder',
      value: './myNewInputFolder',
      validity: null,
    })
    expect(container).toMatchSnapshot()
  })

  test('check south not found', () => {
    const reactUseContextMock = React.useContext
    // temporary empty array
    const config = utils.jsonCopy(testConfig)
    config.south.dataSources = []
    React.useContext = jest.fn().mockReturnValue({ newConfig: config, dispatchNewConfig })
    act(() => {
      root.render(<ConfigureProtocol />)
    })
    expect(container).toMatchSnapshot()
    React.useContext = reactUseContextMock
  })
})
