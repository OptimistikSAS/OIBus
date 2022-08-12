/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'
import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../tests/testConfig'
import NorthStatus from './NorthStatus.jsx'

const dispatchNewConfig = jest.fn()
const mockNavigate = jest.fn()
const setAlert = jest.fn()
global.EventSource = class {
  constructor() {
    this.close = () => {}
  }
}
React.useContext = jest.fn().mockReturnValue({ newConfig: testConfig, dispatchNewConfig, setAlert })
jest.mock('react-router-dom', () => (
  {
    useParams: jest.fn().mockReturnValue({ id: 'north-uuid-1' }),
    useNavigate: () => mockNavigate,
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

describe('North Status', () => {
  React.useContext = jest.fn().mockReturnValue({ newConfig: testConfig, dispatchNewConfig, setAlert })
  test('display NorthStatus page based on config', () => {
    act(() => {
      root.render(<NorthStatus />)
    })
    expect(container).toMatchSnapshot()
  })

  test('go to previous page', () => {
    act(() => {
      root.render(<NorthStatus />)
    })
    Simulate.click(document.getElementById('oi-sub-nav'))
    Simulate.click(document.getElementById('oi-navigate'))
    expect(mockNavigate).toHaveBeenCalled()
    expect(container).toMatchSnapshot()
  })
})
