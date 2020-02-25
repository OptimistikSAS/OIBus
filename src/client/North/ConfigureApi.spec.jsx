import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import newConfig from '../../../tests/testConfig'
import ConfigureApi from './ConfigureApi.jsx'

React.useContext = jest.fn().mockReturnValue({ newConfig })
jest.mock('react-router-dom', () => (
  { useParams: jest.fn().mockReturnValue({ applicationId: 'monoiconnect' }) }
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
})
