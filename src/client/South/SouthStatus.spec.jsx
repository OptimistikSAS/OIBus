/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'
import newConfig from '../../../tests/testConfig'

import SouthStatus from './SouthStatus.jsx'

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
    useParams: jest.fn().mockReturnValue({ id: 'datasource-uuid-1' }),
    useNavigate: () => mockNavigate,
  }
))

const mockMath = Object.create(global.Math)
mockMath.random = () => 1
global.Math = mockMath

let container
beforeEach(() => {
  // jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2000-01-01T00:00:00.000Z');
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('South Status', () => {
  React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig, setAlert })
  test('display SouthStatus page based on config', () => {
    act(() => {
      ReactDOM.render(<SouthStatus />, container)
    })
    expect(container).toMatchSnapshot()
  })

  test('go to previous page', () => {
    act(() => {
      ReactDOM.render(<SouthStatus />, container)
    })
    Simulate.click(document.getElementById('oi-sub-nav'))
    Simulate.click(document.getElementById('oi-navigate'))
    expect(mockNavigate).toHaveBeenCalled()
    expect(container).toMatchSnapshot()
  })
})
