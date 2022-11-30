/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'
import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../tests/test-config.js'
import ConfigureSouth from './configure-south.jsx'
import utils from '../helpers/utils.js'

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

describe('ConfigureSouth', () => {
  test('check ConfigureSouth', () => {
    act(() => {
      root.render(<ConfigureSouth />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check update', () => {
    act(() => {
      root.render(<ConfigureSouth />)
    })
    act(() => {
      Simulate.change(document.getElementById('south.0.settings.inputFolder'), { target: { value: './myNewInputFolder' } })
    })

    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'south.0.settings.inputFolder',
      value: './myNewInputFolder',
      validity: null,
    })
    expect(container).toMatchSnapshot()
  })

  test('check south not found', () => {
    const reactUseContextMock = React.useContext
    // temporary empty array
    const config = utils.jsonCopy(testConfig)
    config.south = []
    React.useContext = jest.fn().mockReturnValue({ newConfig: config, dispatchNewConfig })
    act(() => {
      root.render(<ConfigureSouth />)
    })
    expect(container).toMatchSnapshot()
    React.useContext = reactUseContextMock
  })
})
