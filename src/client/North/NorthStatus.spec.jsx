/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'
import newConfig from '../../../tests/testConfig'
import NorthStatus from './NorthStatus.jsx'

const dispatchNewConfig = jest.fn()
const mockNavigate = jest.fn()
const setAlert = jest.fn()
global.EventSource = class {
  constructor() {
    this.close = () => {}
  }
}
React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig, setAlert })
jest.mock('react-router-dom', () => (
  {
    useParams: jest.fn().mockReturnValue({ id: 'application-uuid-1' }),
    useNavigate: () => mockNavigate,
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

describe('North Status', () => {
  React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig, setAlert })
  test('display NorthStatus page based on config', () => {
    act(() => {
      ReactDOM.render(<NorthStatus />, container)
    })
    expect(container).toMatchSnapshot()
  })

  test('go to previous page', () => {
    act(() => {
      ReactDOM.render(<NorthStatus />, container)
    })
    Simulate.click(document.getElementById('oi-sub-nav'))
    Simulate.click(document.getElementById('oi-navigate'))
    expect(mockNavigate).toHaveBeenCalled()
    expect(container).toMatchSnapshot()
  })
})
