import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import newConfig from '../../../tests/testConfig'
import North from './North.jsx'

React.useContext = jest.fn().mockReturnValue({ newConfig, apiList: newConfig.apiList })

jest.mock('react-router-dom', () => (
  { useHistory: jest.fn().mockReturnValue([]) }
))

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('North', () => {
  test('check North', () => {
    act(() => {
      ReactDOM.render(
        <North />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
