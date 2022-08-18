/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../tests/testConfig.js'
import ConfigureApi from './ConfigureApi.jsx'
import utils from '../helpers/utils.js'

const dispatchNewConfig = jest.fn()
React.useContext = jest.fn().mockReturnValue({ newConfig: testConfig, dispatchNewConfig })
jest.mock('react-router-dom', () => (
  {
    useParams: jest.fn().mockReturnValue({ id: 'north-uuid-1' }),
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

describe('ConfigureApi', () => {
  test('check ConfigureApi', () => {
    act(() => {
      root.render(<ConfigureApi />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check update', () => {
    act(() => {
      root.render(<ConfigureApi />)
    })
    act(() => {
      Simulate.change(document.getElementById('north.applications.0.Console.verbose'), { target: { checked: true } })
    })

    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'north.applications.0.Console.verbose',
      value: true,
      validity: null,
    })
    expect(container).toMatchSnapshot()
  })
  test('check application not found', () => {
    const reactUseContextMock = React.useContext
    // temporary empty applications array
    const config = utils.jsonCopy(testConfig)
    config.north.applications = []
    React.useContext = jest.fn().mockReturnValue({ newConfig: config, dispatchNewConfig })
    act(() => {
      root.render(<ConfigureApi />)
    })
    expect(container).toMatchSnapshot()
    React.useContext = reactUseContextMock
  })
})
