import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'
// need BrowserRouter so Link component is not complaining
import { BrowserRouter } from 'react-router-dom'

import newConfig from '../../../tests/testConfig'
import Engine from './Engine.jsx'

React.useContext = jest.fn().mockReturnValue({ newConfig })

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

describe('Engine', () => {
  test('check Engine', () => {
    act(() => {
      ReactDOM.render(<BrowserRouter><Engine /></BrowserRouter>, container)
    })
    expect(container).toMatchSnapshot()
  })
})
