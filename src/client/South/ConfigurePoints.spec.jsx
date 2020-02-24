import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import newConfig from '../../../tests/testConfig'
import ConfigurePoints from './ConfigurePoints.jsx'

React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig: () => 1 })
jest.mock('react-router-dom', () => (
  { useParams: jest.fn().mockReturnValue({ dataSourceId: 'CSVServer' }) }
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

describe('ConfigurePoints', () => {
  test('check ConfigurePoints', () => {
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
