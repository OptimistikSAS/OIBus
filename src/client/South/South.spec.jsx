import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import newConfig from '../../../tests/testConfig'
import South from './South.jsx'

React.useContext = jest.fn().mockReturnValue({ newConfig, protocolList: newConfig.protocolList })

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

describe('South', () => {
  test('check South', () => {
    act(() => {
      ReactDOM.render(
        <South />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
