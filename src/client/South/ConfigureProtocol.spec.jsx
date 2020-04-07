import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import newConfig from '../../../tests/testConfig'
import ConfigureProtocol from './ConfigureProtocol.jsx'

React.useContext = jest.fn().mockReturnValue({ newConfig })
jest.mock('react-router-dom', () => (
  { useParams: jest.fn().mockReturnValue({ dataSourceId: 'OPC-HDA' }) }
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
      ReactDOM.render(
        <ConfigureProtocol />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
